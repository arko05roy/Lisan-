"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    PoolNote, AmmNote, markPoolNoteSpent, markAmmNoteSpent, markNoteConfirmed,
    getPoolNotes, getAmmNotes
} from "@/lib/storage"; // Simplified imports, actual usage might differ
import { generatePoolWithdrawProof, generateAmmWithdrawProof } from "@/lib/prover";
import { computeNullifierHash } from "@/lib/crypto";
import { relayPrepareWithdraw, relayClaimWithdrawal, getRelayTxStatus } from "@/lib/relay";
import { resolveRelayerBaseUrl, formatFee, Relayer } from "@/lib/relayer-registry";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { selectRelayer, coordinatorWithdraw, calculateFee } from "@/lib/coordinator-relay";
import { RpcProvider, AccountInterface } from "starknet";
import { buildTreeFromChain } from "@/lib/merkle";
import { txToast, errorToast } from "@/components/tx-toast";
import { CheckCircle2, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface WithdrawFlowProps {
    note: PoolNote | AmmNote;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    relayer: Relayer | null;
    onWithdrawComplete: () => void;
    useCoordinator?: boolean;
    feeBps?: number;
}

type Step = "PREPARE" | "RELAY_PREPARE" | "CLAIM" | "RELAY_CLAIM" | "COMPLETED";

export function WithdrawFlow({ note, isOpen, onOpenChange, relayer, onWithdrawComplete, useCoordinator = false, feeBps = 10 }: WithdrawFlowProps) {
    const { account } = useAccount();
    const { provider } = useProvider();
    const [currentStep, setCurrentStep] = useState<Step>("PREPARE");
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [recipient, setRecipient] = useState("");

    // State from preparation
    const [prepareData, setPrepareData] = useState<{
        nullifierHash: string;
        source: "pool" | "amm";
        amount: string;
        tokenLabel: string;
    } | null>(null);

    const [txHash, setTxHash] = useState<string | null>(null);

    const relayerUrl = relayer ? resolveRelayerBaseUrl(relayer) : "";
    const isAmm = "tokenType" in note;
    const tokenLabel = isAmm
        ? ((note as AmmNote).tokenType === TOKEN_TYPE_BTC ? "BTC" : "STRK")
        : ((note as PoolNote).tokenAddress === ADDRESSES.MOCK_BTC ? "BTC"
            : (note as PoolNote).tokenAddress === ADDRESSES.MOCK_STRK ? "STRK"
            : (note as PoolNote).tokenAddress === ADDRESSES.DEMO_TOKEN ? "DEMO"
            : (note as PoolNote).tokenAddress.slice(0, 8) + "...");

    // Reset state when dialog opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep("PREPARE");
            setLoading(false);
            setStatusMessage("");
            setPrepareData(null);
            setTxHash(null);
            setRecipient("");
        }
    }, [isOpen]);

    const pollTxStatus = useCallback(async (hash: string, targetStatus: "ACCEPTED_ON_L2" | "REJECTED" = "ACCEPTED_ON_L2") => {
        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
            await new Promise((r) => setTimeout(r, 3000));
            try {
                const { status } = await getRelayTxStatus(relayerUrl, hash);
                if (status === targetStatus || status === "REJECTED") return status;
            } catch { /* ignore */ }
        }
        return "PENDING";
    }, [relayerUrl]);

    const waitForCommitment = async (commitment: string, contractType: "pool" | "amm") => {
        const normalized = "0x" + BigInt(commitment).toString(16);

        setStatusMessage("Checking on-chain confirmation...");
        let result = await buildTreeFromChain(
            contractType === "pool" ? ADDRESSES.SHIELDED_POOL : ADDRESSES.SHIELDED_AMM,
            contractType,
        );
        let leafIndex = result.commitmentToLeafIndex.get(normalized);

        if (leafIndex !== undefined) {
            // Verify the leaf index is valid for the tree
            const treeSize = result.tree.getNextIndex();
            if (leafIndex >= treeSize) {
                throw new Error(
                    `Note commitment found but tree index invalid (${leafIndex} >= ${treeSize}). This note may be from an old contract deployment. Please deposit fresh funds.`
                );
            }
            return { tree: result.tree, leafIndex };
        }

        setStatusMessage("Waiting for deposit confirmation...");
        // Faster polling: 2s intervals for up to 60s (30 attempts)
        for (let i = 0; i < 30; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            setStatusMessage(`Waiting for confirmation... (${(i + 1) * 2}s)`);
            result = await buildTreeFromChain(
                contractType === "pool" ? ADDRESSES.SHIELDED_POOL : ADDRESSES.SHIELDED_AMM,
                contractType,
            );
            leafIndex = result.commitmentToLeafIndex.get(normalized);
            if (leafIndex !== undefined) {
                const treeSize = result.tree.getNextIndex();
                if (leafIndex >= treeSize) {
                    throw new Error(
                        `Note commitment found but tree index invalid. This note may be from an old contract deployment. Please deposit fresh funds.`
                    );
                }
                markNoteConfirmed(commitment);
                return { tree: result.tree, leafIndex };
            }
        }
        throw new Error(
            "Deposit not found on-chain after 60s. Note may be from old contract. Try depositing fresh funds."
        );
    };

    const handleStartWithdraw = async () => {
        if (!useCoordinator && !relayer) return;
        if (useCoordinator && !account) return;
        setLoading(true);
        try {
            const contractType = isAmm ? "amm" : "pool";
            const { tree, leafIndex } = await waitForCommitment(note.commitment, contractType);

            setStatusMessage("Generating Zero-Knowledge Proof (this takes a moment)...");
            // Yield to UI
            await new Promise(r => setTimeout(r, 100));

            const path = await tree.getPath(leafIndex);
            const root = tree.getRoot().toString();
            const nullifierHash = await computeNullifierHash(note.nullifierSecret);

            // Debug info
            console.log("[Withdraw Debug]", {
                leafIndex,
                treeSize: tree.getNextIndex(),
                root: root,
                commitment: "0x" + BigInt(note.commitment).toString(16),
            });

            // Proof Gen
            let fullProofWithHints;
            if (isAmm) {
                const res = await generateAmmWithdrawProof(note as AmmNote, path, root, nullifierHash);
                fullProofWithHints = res.fullProofWithHints;
            } else {
                const res = await generatePoolWithdrawProof(note as PoolNote, path, root, nullifierHash);
                fullProofWithHints = res.fullProofWithHints;
            }

            setCurrentStep("RELAY_PREPARE");
            let transactionHash: string;
            let usedCoordinator = false;

            if (useCoordinator && account && !isAmm) {
                // On-chain coordinator path (pool withdrawals only, with fallback)
                try {
                    setStatusMessage("Selecting relayer from network...");
                    const relayerId = await selectRelayer(account);
                    const withdrawAmount = BigInt(note.amount);
                    const feeAmount = calculateFee(withdrawAmount, feeBps);
                    const poolNote = note as PoolNote;

                    setStatusMessage(`Submitting via Relayer #${relayerId}...`);
                    const result = await coordinatorWithdraw(account, {
                        fullProofWithHints,
                        root,
                        nullifierHash,
                        tokenAddress: poolNote.tokenAddress,
                        withdrawAmount,
                        relayerId,
                        feeAmount,
                    });
                    transactionHash = result.transactionHash;
                    usedCoordinator = true;
                } catch (coordError) {
                    console.warn("[Coordinator fallback] Withdraw via coordinator failed, falling back to default relayer:", coordError);
                    setStatusMessage("Coordinator unavailable, falling back to default relayer...");
                    const preparePayload: any = {
                        contract: contractType,
                        fullProofWithHints,
                        root,
                        nullifierHash,
                        withdrawAmount: note.amount,
                        tokenAddress: (note as PoolNote).tokenAddress,
                    };
                    const result = await relayPrepareWithdraw("", preparePayload);
                    transactionHash = result.transactionHash;
                }
            } else {
                // Legacy off-chain relayer path
                setStatusMessage("Submitting Proof to Relayer...");
                const fallbackUrl = relayerUrl || "";
                const preparePayload: any = {
                    contract: contractType,
                    fullProofWithHints,
                    root,
                    nullifierHash,
                    withdrawAmount: note.amount,
                };
                if (isAmm) {
                    preparePayload.tokenType = (note as AmmNote).tokenType;
                } else {
                    preparePayload.tokenAddress = (note as PoolNote).tokenAddress;
                }
                const result = await relayPrepareWithdraw(fallbackUrl, preparePayload);
                transactionHash = result.transactionHash;
            }

            setTxHash(transactionHash);
            setStatusMessage("Waiting for Confirmation...");

            // Mark spent locally optimistically/immediately
            if (isAmm) markAmmNoteSpent(note.commitment);
            else markPoolNoteSpent(note.commitment);

            if (usedCoordinator) {
                await (provider as unknown as RpcProvider).waitForTransaction(transactionHash);
            } else {
                const status = await pollTxStatus(transactionHash);
                if (status !== "ACCEPTED_ON_L2") throw new Error("Relayer transaction rejected or timed out");
            }

            setPrepareData({
                nullifierHash,
                source: contractType,
                amount: note.amount,
                tokenLabel
            });

            setCurrentStep("CLAIM");
            setStatusMessage("");
            setTxHash(null);
        } catch (e: any) {
            console.error(e);
            errorToast(e.message || "Withdrawal preparation failed");
            onOpenChange(false);
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!prepareData || !recipient || (!useCoordinator && !relayer)) return;
        setLoading(true);
        setCurrentStep("RELAY_CLAIM");
        setStatusMessage("Submitting Claim Request...");

        try {
            const claimUrl = relayerUrl || "";
            const { transactionHash } = await relayClaimWithdrawal(claimUrl, {
                contract: prepareData.source,
                nullifierHash: prepareData.nullifierHash,
                recipient,
            });

            setTxHash(transactionHash);
            setStatusMessage("Waiting for Funds...");

            const status = await pollTxStatus(transactionHash);
            if (status !== "ACCEPTED_ON_L2") throw new Error("Claim transaction rejected");

            setCurrentStep("COMPLETED");
            txToast(transactionHash).success();
            onWithdrawComplete();
        } catch (e: any) {
            errorToast(e.message || "Claim failed");
            setCurrentStep("CLAIM"); // Go back to claim step
        } finally {
            setLoading(false);
        }
    };

    const effectiveFeeBps = useCoordinator ? feeBps : (relayer?.feeBps || 0);
    const fees = (BigInt(note.amount) * BigInt(effectiveFeeBps)) / 10000n;
    const receiveAmount = BigInt(note.amount) - fees;
    const formatWei = (wei: bigint) => Number(wei) / 10 ** 18;

    return (
        <Dialog open={isOpen} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
            <DialogContent
                className="sm:max-w-md"
                onInteractOutside={(e) => {
                    e.preventDefault();
                }}
            >
                <DialogHeader>
                    <DialogTitle>Withdraw {tokenLabel}</DialogTitle>
                    <DialogDescription>
                        {currentStep === "PREPARE" || currentStep === "RELAY_PREPARE" ? "Step 1: Unshield & Prove" :
                            currentStep === "COMPLETED" ? "Success" : "Step 2: Destination"}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    {/* Steps Indicator */}
                    <div className="flex justify-between px-8">
                        <div className={cn("flex flex-col items-center gap-1", (currentStep === "PREPARE" || currentStep === "RELAY_PREPARE") && "text-primary")}>
                            <div className={cn("w-3 h-3 rounded-full", (currentStep === "PREPARE" || currentStep === "RELAY_PREPARE") ? "bg-primary animate-pulse" : "bg-primary/50")} />
                            <span className="text-[10px] font-medium">Prepare</span>
                        </div>
                        <div className={cn("w-full h-[1px] mt-1.5 mx-2", currentStep === "CLAIM" || currentStep === "RELAY_CLAIM" || currentStep === "COMPLETED" ? "bg-primary" : "bg-muted")} />
                        <div className={cn("flex flex-col items-center gap-1", (currentStep === "CLAIM" || currentStep === "RELAY_CLAIM") && "text-primary")}>
                            <div className={cn("w-3 h-3 rounded-full", (currentStep === "CLAIM" || currentStep === "RELAY_CLAIM") ? "bg-primary animate-pulse" : (currentStep === "COMPLETED" ? "bg-primary" : "bg-muted"))} />
                            <span className="text-[10px] font-medium">Claim</span>
                        </div>
                        <div className={cn("w-full h-[1px] mt-1.5 mx-2", currentStep === "COMPLETED" ? "bg-primary" : "bg-muted")} />
                        <div className={cn("flex flex-col items-center gap-1", currentStep === "COMPLETED" && "text-green-500")}>
                            <div className={cn("w-3 h-3 rounded-full", currentStep === "COMPLETED" ? "bg-green-500" : "bg-muted")} />
                            <span className="text-[10px] font-medium">Done</span>
                        </div>
                    </div>

                    {(currentStep === "PREPARE" || currentStep === "RELAY_PREPARE") && (
                        <div className="space-y-4">
                            <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Amount to Withdraw</span>
                                    <span className="font-mono">{formatWei(BigInt(note.amount))} {tokenLabel}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Relayer Fee ({formatFee(effectiveFeeBps)})</span>
                                    <span className="font-mono text-red-400">-{formatWei(fees)} {tokenLabel}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                                    <span>Receive Amount</span>
                                    <span className="text-primary">{formatWei(receiveAmount)} {tokenLabel}</span>
                                </div>
                            </div>

                            {loading && (
                                <div className="flex flex-col items-center justify-center p-4 gap-3 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm text-muted-foreground animate-pulse">{statusMessage}</p>
                                    {txHash && (
                                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                            Tx: {txHash.slice(0, 10)}...
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {(currentStep === "CLAIM" || currentStep === "RELAY_CLAIM") && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    placeholder="Enter recipient address (0x...)"
                                    value={recipient}
                                    disabled={loading}
                                    onChange={(e) => setRecipient(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter a fresh address for maximum privacy. This address will receive the unshielded funds.
                                </p>
                            </div>
                            {loading && (
                                <div className="flex flex-col items-center justify-center p-2 gap-2 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <p className="text-xs text-muted-foreground">{statusMessage}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === "COMPLETED" && (
                        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <h3 className="font-bold text-lg">Withdrawal Complete</h3>
                            <p className="text-sm text-muted-foreground">
                                Your funds have been sent to the recipient address.
                            </p>
                            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                Close
                            </Button>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {currentStep === "PREPARE" && !loading && (
                        <Button onClick={handleStartWithdraw} className="w-full" disabled={!useCoordinator && !relayer}>
                            Authorize Withdrawal
                        </Button>
                    )}
                    {currentStep === "CLAIM" && !loading && (
                        <Button onClick={handleClaim} className="w-full" disabled={!recipient}>
                            Confirm & Transfer
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
