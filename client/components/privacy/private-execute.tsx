"use client";

import { useState, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    PoolNote,
    getPoolNotes,
    markPoolNoteSpent,
    markNoteConfirmed,
} from "@/lib/storage";
import { generatePoolWithdrawProof } from "@/lib/prover";
import { computeNullifierHash, computePoolCommitment, generateSecret } from "@/lib/crypto";
import { relayPrivateExecute, getRelayTxStatus } from "@/lib/relay";
import { resolveRelayerBaseUrl, Relayer } from "@/lib/relayer-registry";
import { ADDRESSES } from "@/lib/addresses";
import { buildTreeFromChain } from "@/lib/merkle";
import { txToast, errorToast } from "@/components/tx-toast";
import { Loader2, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrivateExecuteProps {
    relayer: Relayer | null;
}

export function PrivateExecute({ relayer }: PrivateExecuteProps) {
    const { address } = useAccount();
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    // Form state
    const [selectedNote, setSelectedNote] = useState<PoolNote | null>(null);
    const [targetContract, setTargetContract] = useState("");
    const [callData, setCallData] = useState("");
    const [amount, setAmount] = useState("");

    const relayerUrl = relayer ? resolveRelayerBaseUrl(relayer) : "";

    const poolNotes = typeof window !== "undefined" ? getPoolNotes().filter((n) => !n.spent) : [];

    const formatWei = (wei: string) => (Number(BigInt(wei)) / 10 ** 18).toFixed(4);

    const getTokenLabel = (note: PoolNote) => {
        if (note.tokenAddress === ADDRESSES.MOCK_BTC) return "mBTC";
        if (note.tokenAddress === ADDRESSES.MOCK_STRK) return "mSTRK";
        if (note.tokenAddress === ADDRESSES.DEMO_TOKEN) return "DEMO";
        return note.tokenAddress.slice(0, 8) + "...";
    };

    const pollTxStatus = useCallback(
        async (hash: string) => {
            const maxAttempts = 60;
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise((r) => setTimeout(r, 3000));
                try {
                    const { status } = await getRelayTxStatus(relayerUrl, hash);
                    if (status === "ACCEPTED_ON_L2" || status === "REJECTED") return status;
                } catch {
                    /* ignore */
                }
            }
            return "PENDING";
        },
        [relayerUrl],
    );

    const handleExecute = async () => {
        if (!selectedNote || !targetContract || !amount || !relayer) return;
        setLoading(true);

        try {
            const amountWei = BigInt(amount) * 10n ** 18n;
            const noteAmountWei = BigInt(selectedNote.amount);

            if (amountWei > noteAmountWei) {
                throw new Error("Amount exceeds shielded balance");
            }

            const changeAmount = noteAmountWei - amountWei;

            // Wait for on-chain confirmation
            setStatusMessage("Checking on-chain confirmation...");
            const result = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
            const normalized = "0x" + BigInt(selectedNote.commitment).toString(16);
            let leafIndex = result.commitmentToLeafIndex.get(normalized);

            if (leafIndex === undefined) {
                setStatusMessage("Waiting for deposit confirmation...");
                for (let i = 0; i < 15; i++) {
                    await new Promise((r) => setTimeout(r, 5000));
                    const r2 = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
                    leafIndex = r2.commitmentToLeafIndex.get(normalized);
                    if (leafIndex !== undefined) {
                        markNoteConfirmed(selectedNote.commitment);
                        break;
                    }
                }
                if (leafIndex === undefined) {
                    throw new Error("Deposit not found on-chain");
                }
            }

            setStatusMessage("Generating Zero-Knowledge Proof...");
            await new Promise((r) => setTimeout(r, 100));

            const path = await result.tree.getPath(leafIndex);
            const root = result.tree.getRoot().toString();
            const nullifierHash = await computeNullifierHash(selectedNote.nullifierSecret);

            const proofResult = await generatePoolWithdrawProof(
                selectedNote,
                path,
                root,
                nullifierHash,
            );

            // Compute change commitment if there's change
            let changeCommitment = "0";
            if (changeAmount > 0n) {
                const newSecret = generateSecret();
                const newNullifierSecret = generateSecret();
                changeCommitment = await computePoolCommitment(
                    changeAmount.toString(),
                    selectedNote.tokenAddress,
                    newSecret,
                    newNullifierSecret,
                );
            }

            // Parse calldata
            const callDataArray = callData
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);

            setStatusMessage("Submitting to Relayer...");

            const { transactionHash } = await relayPrivateExecute(relayerUrl, {
                fullProofWithHints: proofResult.fullProofWithHints,
                root,
                nullifierHash,
                tokenAddress: selectedNote.tokenAddress,
                amount: amountWei.toString(),
                targetContract,
                callData: callDataArray,
                changeCommitment,
                changeAmount: changeAmount.toString(),
            });

            setStatusMessage("Waiting for confirmation...");
            markPoolNoteSpent(selectedNote.commitment);

            const status = await pollTxStatus(transactionHash);
            if (status !== "ACCEPTED_ON_L2") {
                throw new Error("Transaction rejected or timed out");
            }

            txToast(transactionHash).success();
            setSelectedNote(null);
            setTargetContract("");
            setCallData("");
            setAmount("");
        } catch (e: unknown) {
            errorToast(e instanceof Error ? e.message : "Private execute failed");
        } finally {
            setLoading(false);
            setStatusMessage("");
        }
    };

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Private Execute
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                    Interact with any Starknet contract using your shielded funds. The pool acts as a
                    private proxy — nobody knows it was you.
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Note Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground/80">
                        Select Shielded Note
                    </Label>
                    {poolNotes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No unspent pool notes available. Deposit funds first.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {poolNotes.map((note) => (
                                <div
                                    key={note.commitment}
                                    onClick={() => setSelectedNote(note)}
                                    className={cn(
                                        "cursor-pointer rounded-lg border p-3 transition-all hover:bg-muted/50",
                                        selectedNote?.commitment === note.commitment
                                            ? "border-primary bg-primary/5"
                                            : "border-border/40",
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline">{getTokenLabel(note)}</Badge>
                                            <span className="font-mono text-sm">
                                                {formatWei(note.amount)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(note.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Target Contract */}
                <div className="space-y-2">
                    <Label>Target Contract Address</Label>
                    <Input
                        placeholder="0x..."
                        value={targetContract}
                        onChange={(e) => setTargetContract(e.target.value)}
                        disabled={loading}
                    />
                </div>

                {/* Amount */}
                <div className="space-y-2">
                    <Label>Amount to Send</Label>
                    <Input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={loading}
                    />
                    {selectedNote && (
                        <p className="text-xs text-muted-foreground">
                            Available: {formatWei(selectedNote.amount)}{" "}
                            {getTokenLabel(selectedNote)}
                        </p>
                    )}
                </div>

                {/* Calldata */}
                <div className="space-y-2">
                    <Label>Calldata (comma-separated felt252 values)</Label>
                    <Input
                        placeholder="0x1234, 0x5678, ..."
                        value={callData}
                        onChange={(e) => setCallData(e.target.value)}
                        disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                        The raw calldata to pass to the target contract. Leave empty for simple
                        token transfers.
                    </p>
                </div>

                {/* Status */}
                {loading && (
                    <div className="flex flex-col items-center justify-center p-4 gap-3 text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">
                            {statusMessage}
                        </p>
                    </div>
                )}

                {/* Action Button */}
                <Button
                    className="w-full h-12 text-lg font-medium"
                    disabled={
                        loading ||
                        !address ||
                        !selectedNote ||
                        !targetContract ||
                        !amount ||
                        !relayer
                    }
                    onClick={handleExecute}
                >
                    {loading ? (
                        "Executing Privately..."
                    ) : (
                        <span className="flex items-center gap-2">
                            Execute Privately <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
