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
import { hash } from "starknet";

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
    const [entrypoint, setEntrypoint] = useState("");
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
        if (!selectedNote || !targetContract || !entrypoint || !amount || !relayer) return;
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
                // Faster polling: 2s intervals for up to 60s (30 attempts)
                for (let i = 0; i < 30; i++) {
                    await new Promise((r) => setTimeout(r, 2000));
                    setStatusMessage(`Waiting for confirmation... (${(i + 1) * 2}s)`);
                    const r2 = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
                    leafIndex = r2.commitmentToLeafIndex.get(normalized);
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

            // Parse calldata: prepend function selector, then user params
            const selector = hash.getSelectorFromName(entrypoint);
            const userParams = callData
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0);
            const callDataArray = [selector, ...userParams];

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
            setEntrypoint("");
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
        <Card className="border-white/[0.06] bg-[#0D1117] backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04] pb-6">
                <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B8CFF]/10">
                        <Zap className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2.5} />
                    </div>
                    Transaction Details
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
                {/* Note Selection */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-white">
                            Select Shielded Balance
                        </Label>
                        <span className="text-xs text-white/40">
                            {poolNotes.length} note{poolNotes.length !== 1 ? 's' : ''} available
                        </span>
                    </div>
                    {poolNotes.length === 0 ? (
                        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
                            <p className="text-sm text-white/40">
                                No shielded notes available. Deposit funds first to enable private execution.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {poolNotes.map((note) => {
                                const isSelected = selectedNote?.commitment === note.commitment;
                                return (
                                    <div
                                        key={note.commitment}
                                        onClick={() => setSelectedNote(note)}
                                        className={cn(
                                            "cursor-pointer rounded-xl border p-4 transition-all",
                                            isSelected
                                                ? "border-[#8B8CFF] bg-[#8B8CFF]/10 shadow-lg shadow-[#8B8CFF]/20"
                                                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12]",
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8B8CFF]/10">
                                                    <span className="text-sm font-bold text-[#8B8CFF]">
                                                        {getTokenLabel(note).charAt(0)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-white">
                                                        {getTokenLabel(note)}
                                                    </p>
                                                    <p className="font-mono text-lg font-bold text-white/80">
                                                        {formatWei(note.amount)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-white/40">
                                                    {new Date(note.createdAt).toLocaleDateString()}
                                                </p>
                                                {isSelected && (
                                                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#8B8CFF] text-[10px] font-semibold text-white">
                                                        Selected
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Target Contract */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Target Contract Address
                    </Label>
                    <Input
                        placeholder="0x..."
                        value={targetContract}
                        onChange={(e) => setTargetContract(e.target.value)}
                        disabled={loading}
                        className="h-12 bg-white/[0.02] border-white/[0.06] text-white font-mono text-sm focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                    />
                </div>

                {/* Function Name */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Function Name
                    </Label>
                    <Input
                        placeholder="e.g. increment, transfer, approve"
                        value={entrypoint}
                        onChange={(e) => setEntrypoint(e.target.value)}
                        disabled={loading}
                        className="h-12 bg-white/[0.02] border-white/[0.06] text-white focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                    />
                    <p className="text-xs text-white/40">
                        The name of the function to call on the target contract.
                    </p>
                </div>

                {/* Amount */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Amount to Send
                    </Label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={loading}
                            className="h-14 bg-white/[0.02] border-white/[0.06] text-white font-mono text-lg pr-20 focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                        />
                        {selectedNote && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-white/60">
                                {getTokenLabel(selectedNote)}
                            </div>
                        )}
                    </div>
                    {selectedNote && (
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs text-white/40">
                                Available: {formatWei(selectedNote.amount)} {getTokenLabel(selectedNote)}
                            </p>
                            <button
                                onClick={() => setAmount((Number(BigInt(selectedNote.amount)) / 10 ** 18).toString())}
                                className="text-xs font-semibold text-[#8B8CFF] hover:text-[#8B8CFF]/80 transition-colors"
                            >
                                Use Max
                            </button>
                        </div>
                    )}
                </div>

                {/* Calldata */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Calldata <span className="text-white/40 font-normal">(Optional)</span>
                    </Label>
                    <Input
                        placeholder="0x1234, 0x5678, ..."
                        value={callData}
                        onChange={(e) => setCallData(e.target.value)}
                        disabled={loading}
                        className="h-12 bg-white/[0.02] border-white/[0.06] text-white font-mono text-sm focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                    />
                    <p className="text-xs text-white/40">
                        Comma-separated felt252 values. Leave empty for simple token transfers.
                    </p>
                </div>

                {/* Status */}
                {loading && (
                    <div className="flex flex-col items-center justify-center p-8 gap-4 text-center rounded-xl border border-[#8B8CFF]/20 bg-[#8B8CFF]/5">
                        <Loader2 className="h-10 w-10 animate-spin text-[#8B8CFF]" strokeWidth={2.5} />
                        <div>
                            <p className="text-sm font-semibold text-white mb-1">
                                {statusMessage}
                            </p>
                            <p className="text-xs text-white/40">
                                This may take a moment...
                            </p>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                <Button
                    className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-[#8B8CFF] to-[#6B6DFF] hover:from-[#7B7CFF] hover:to-[#5B5DFF] shadow-lg shadow-[#8B8CFF]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={
                        loading ||
                        !address ||
                        !selectedNote ||
                        !targetContract ||
                        !entrypoint ||
                        !amount ||
                        !relayer
                    }
                    onClick={handleExecute}
                >
                    {loading ? (
                        <span className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Executing...
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <Zap className="h-5 w-5" strokeWidth={2.5} />
                            Execute Privately
                            <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                        </span>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
