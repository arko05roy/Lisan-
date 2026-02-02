"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getPoolNotes, addNote, markPoolNoteSpent, markNoteConfirmed, PoolNote } from "@/lib/storage";
import { generateSecret, computeCommitment, computeNullifierHash } from "@/lib/crypto";
import { txToast, errorToast } from "@/components/tx-toast";
import { buildTreeFromChain } from "@/lib/merkle";
import { ADDRESSES } from "@/lib/addresses";
import { generatePoolTransferProof } from "@/lib/prover";
import { relayTransfer, getRelayTxStatus } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";
import { cn } from "@/lib/utils";
import { ArrowRightLeft, ShieldCheck, Copy, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function TransferForm() {
    const { address } = useAccount();

    const [notes, setNotes] = useState<PoolNote[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [transferAmount, setTransferAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [recipientSecrets, setRecipientSecrets] = useState<string | null>(null);
    const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

    // Wizard state
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<"PREPARE" | "RELAY" | "DONE">("PREPARE");
    const [txHash, setTxHash] = useState<string | null>(null);

    useEffect(() => {
        setNotes(getPoolNotes().filter((n) => !n.spent));
    }, []);

    const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;
    const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
    const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

    async function handleTransfer() {
        if (!address || !selectedNote || !transferAmount || relayerDisabled) return;
        setLoading(true);
        setRecipientSecrets(null);
        setWizardStep("PREPARE");
        setIsWizardOpen(true);

        try {
            const transferAmountWei = BigInt(transferAmount) * 10n ** 18n;
            const oldAmountBig = BigInt(selectedNote.amount);
            const changeAmount = oldAmountBig - transferAmountWei;

            if (changeAmount < 0n) {
                throw new Error("Transfer amount exceeds note balance");
            }

            setStatusMessage("Generating new secrets...");
            await new Promise(r => setTimeout(r, 100)); // Yield

            // Generate new secrets for sender change note
            const newSecretSender = generateSecret();
            const newNullifierSecretSender = generateSecret();
            const newCommitmentSender = await computeCommitment(
                changeAmount.toString(),
                newSecretSender,
                newNullifierSecretSender,
            );

            // Generate new secrets for recipient note
            const newSecretRecipient = generateSecret();
            const newNullifierSecretRecipient = generateSecret();
            const newCommitmentRecipient = await computeCommitment(
                transferAmountWei.toString(),
                newSecretRecipient,
                newNullifierSecretRecipient,
            );

            // Build Merkle tree from on-chain events (auto-waits for unconfirmed deposits)
            setStatusMessage("Verifying deposit chain consistency...");
            const normalizedCommitment = "0x" + BigInt(selectedNote.commitment).toString(16);
            let treeResult = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
            let leafIndex = treeResult.commitmentToLeafIndex.get(normalizedCommitment);

            if (leafIndex === undefined) {
                setStatusMessage("Waiting for deposit confirmation...");
                // Faster polling: 2s intervals for up to 60s (30 attempts)
                for (let attempt = 0; attempt < 30; attempt++) {
                    await new Promise((r) => setTimeout(r, 2000));
                    setStatusMessage(`Waiting for confirmation... (${(attempt + 1) * 2}s)`);
                    treeResult = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
                    leafIndex = treeResult.commitmentToLeafIndex.get(normalizedCommitment);
                    if (leafIndex !== undefined) {
                        markNoteConfirmed(selectedNote.commitment);
                        break;
                    }
                }
                if (leafIndex === undefined) {
                    throw new Error(
                        "Deposit not found on-chain after 60s. Note may be from old contract. Try depositing fresh funds."
                    );
                }
            }

            setStatusMessage("Generating Zero-Knowledge Proof...");
            const path = await treeResult.tree.getPath(leafIndex);
            const root = treeResult.tree.getRoot().toString();
            const nullifierHash = await computeNullifierHash(selectedNote.nullifierSecret);

            const { fullProofWithHints } = await generatePoolTransferProof(
                selectedNote,
                path,
                root,
                nullifierHash,
                newCommitmentSender,
                newCommitmentRecipient,
                changeAmount.toString(),
                transferAmountWei.toString(),
                newSecretSender,
                newNullifierSecretSender,
                newSecretRecipient,
                newNullifierSecretRecipient,
            );

            setStatusMessage("Submitting to Relayer...");
            setWizardStep("RELAY");

            const { transactionHash } = await relayTransfer(relayerUrl, {
                fullProofWithHints,
                root,
                nullifierHash,
                newCommitmentSender,
                newCommitmentRecipient,
            });

            setTxHash(transactionHash);
            setStatusMessage("Waiting for L2 confirmation...");

            // Wait for completion
            const maxAttempts = 60;
            let finalStatus = "PENDING";
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(r => setTimeout(r, 3000));
                try {
                    const res = await getRelayTxStatus(relayerUrl, transactionHash);
                    finalStatus = res.status;
                    if (finalStatus === "ACCEPTED_ON_L2" || finalStatus === "REJECTED") break;
                } catch (e) { }
            }

            if (finalStatus !== "ACCEPTED_ON_L2") throw new Error("Transaction rejected by network");

            txToast(transactionHash).success();

            // Mark old note as spent
            markPoolNoteSpent(selectedNote.commitment);

            // Save sender change note (if > 0)
            if (changeAmount > 0n) {
                addNote({
                    type: "pool",
                    commitment: newCommitmentSender,
                    amount: changeAmount.toString(),
                    secret: newSecretSender,
                    nullifierSecret: newNullifierSecretSender,
                    spent: false,
                    createdAt: Date.now(),
                    txHash: transactionHash,
                    confirmed: false,
                    tokenAddress: selectedNote.tokenAddress,
                });
            }

            // Save recipient note locally (for self-transfers)
            addNote({
                type: "pool",
                commitment: newCommitmentRecipient,
                amount: transferAmountWei.toString(),
                secret: newSecretRecipient,
                nullifierSecret: newNullifierSecretRecipient,
                spent: false,
                createdAt: Date.now(),
                txHash: transactionHash,
                confirmed: false,
                tokenAddress: selectedNote.tokenAddress,
            });

            // Display recipient secrets
            setRecipientSecrets(
                JSON.stringify({
                    commitment: newCommitmentRecipient,
                    amount: transferAmountWei.toString(),
                    secret: newSecretRecipient,
                    nullifierSecret: newNullifierSecretRecipient,
                }, null, 2),
            );

            setWizardStep("DONE");
            setNotes(getPoolNotes().filter((n) => !n.spent));
            setSelectedIdx(null);
            setTransferAmount("");
        } catch (e: unknown) {
            errorToast(e instanceof Error ? e.message : "Transfer failed");
            setIsWizardOpen(false); // Close on error
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Relayer & Intro */}
            <div className="flex flex-col gap-4">
                <Card className="border-border/40 bg-card/50">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
                    </CardContent>
                </Card>
            </div>

            {/* Step 1: Select Note */}
            <div className="space-y-3">
                <Label className="text-base font-medium">1. Select Source Note</Label>
                {notes.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                        <p>No unspent pool notes available.</p>
                        <Button variant="link" className="text-primary" onClick={() => window.location.href = '/deposit'}>Go to Deposit</Button>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {notes.map((note, i) => {
                            const amtTokens = BigInt(note.amount) / 10n ** 18n;
                            const isSelected = selectedIdx === i;
                            return (
                                <div
                                    key={note.commitment}
                                    onClick={() => setSelectedIdx(i)}
                                    className={cn(
                                        "cursor-pointer rounded-xl border p-4 transition-all hover:bg-accent/50",
                                        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/50 bg-card"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10 text-orange-500 font-bold text-xs">
                                                ₿
                                            </div>
                                            <div>
                                                <div className="font-mono text-xs text-muted-foreground">{note.commitment.slice(0, 12)}...</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="font-bold text-lg">{amtTokens.toString()} mBTC</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Step 2: Amount & Action */}
            <div className={cn("space-y-4 transition-opacity", !selectedNote && "opacity-50 pointer-events-none")}>
                <Label className="text-base font-medium">2. Transfer Details</Label>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label>Amount to Transfer</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-4 pr-16 text-lg"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">mBTC</div>
                            </div>
                            {selectedNote && (
                                <p className="text-xs text-muted-foreground text-right">
                                    Available: {(BigInt(selectedNote.amount) / 10n ** 18n).toString()} mBTC
                                </p>
                            )}
                        </div>

                        <Button
                            className="w-full"
                            disabled={loading || !transferAmount || !selectedIdx || relayerDisabled}
                            onClick={handleTransfer}
                        >
                            {loading ? "Processing..." : "Transfer Privately"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Success Dialog / Wizard */}
            <Dialog open={isWizardOpen} onOpenChange={(v) => { if (!loading) setIsWizardOpen(v); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Shielded Transfer</DialogTitle>
                        <DialogDescription>
                            {wizardStep === "DONE" ? "Transfer Completed Successfully" : "Processing Privacy Transaction"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 space-y-6">
                        {wizardStep !== "DONE" ? (
                            <div className="flex flex-col items-center justify-center gap-4 text-center">
                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                <p className="text-sm font-medium">{statusMessage}</p>
                                {txHash && <p className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">{txHash.slice(0, 16)}...</p>}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center gap-2 text-center text-green-500 mb-4">
                                    <CheckCircle2 className="h-12 w-12" />
                                    <span className="font-bold">Sent!</span>
                                </div>

                                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-yellow-500 font-medium">
                                        <ShieldCheck className="h-4 w-4" />
                                        <span>Recipient Secrets</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        The recipient needs these secrets to withdraw funds. This is the <b>ONLY</b> copy.
                                    </p>
                                    <div className="relative">
                                        <pre className="overflow-x-auto rounded bg-background p-3 text-[10px] border max-h-[150px] custom-scrollbar">
                                            {recipientSecrets}
                                        </pre>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="absolute top-2 right-2 h-6 w-6"
                                            onClick={() => navigator.clipboard.writeText(recipientSecrets || "")}
                                        >
                                            <Copy className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        {wizardStep === "DONE" && (
                            <Button onClick={() => setIsWizardOpen(false)} className="w-full">Done</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
