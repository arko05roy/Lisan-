"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAccount, useProvider } from "@starknet-react/core";
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
    addNote,
} from "@/lib/storage";
import { generatePoolWithdrawProof } from "@/lib/prover";
import { computeNullifierHash, computePoolCommitment, generateSecret } from "@/lib/crypto";
import { relayPrivateExecute, getRelayTxStatus } from "@/lib/relay";
import { resolveRelayerBaseUrl, Relayer } from "@/lib/relayer-registry";
import { ADDRESSES } from "@/lib/addresses";
import { buildTreeFromChain } from "@/lib/merkle";
import { txToast, errorToast } from "@/components/tx-toast";
import { selectRelayer, coordinatorExecute, calculateFee } from "@/lib/coordinator-relay";
import { Loader2, Zap, ArrowRight, ChevronDown, Search, RefreshCw, Eye, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { hash, RpcProvider } from "starknet";
import {
    fetchContractAbi,
    FunctionAbi,
    getTypeDisplayName,
    getInputPlaceholder,
} from "@/lib/abi-fetcher";

interface PrivateExecuteProps {
    relayer: Relayer | null;
    useCoordinator?: boolean;
    feeBps?: number;
}

export function PrivateExecute({ relayer, useCoordinator = false, feeBps = 10 }: PrivateExecuteProps) {
    const { address, account } = useAccount();
    const { provider } = useProvider();
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    // Form state
    const [selectedNote, setSelectedNote] = useState<PoolNote | null>(null);
    const [targetContract, setTargetContract] = useState("");
    const [entrypoint, setEntrypoint] = useState("");
    const [callData, setCallData] = useState("");
    const [amount, setAmount] = useState("");

    // ABI state
    const [fetchingAbi, setFetchingAbi] = useState(false);
    const [contractFunctions, setContractFunctions] = useState<FunctionAbi[]>([]);
    const [selectedFunction, setSelectedFunction] = useState<FunctionAbi | null>(null);
    const [functionInputs, setFunctionInputs] = useState<Record<string, string>>({});
    const [showFunctionDropdown, setShowFunctionDropdown] = useState(false);
    const [abiError, setAbiError] = useState<string | null>(null);

    // View function results
    const [viewResult, setViewResult] = useState<string[] | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const relayerUrl = relayer ? resolveRelayerBaseUrl(relayer) : "";
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowFunctionDropdown(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch ABI when contract address changes
    useEffect(() => {
        const fetchAbi = async () => {
            // Reset state
            setContractFunctions([]);
            setSelectedFunction(null);
            setFunctionInputs({});
            setEntrypoint("");
            setAbiError(null);
            setViewResult(null);

            // Validate address format
            if (!targetContract || !targetContract.startsWith("0x") || targetContract.length < 10) {
                return;
            }

            setFetchingAbi(true);
            try {
                const result = await fetchContractAbi(
                    provider as unknown as RpcProvider,
                    targetContract
                );

                if (result && result.functions.length > 0) {
                    setContractFunctions(result.functions);
                } else {
                    setAbiError("No callable functions found. Contract may not be verified.");
                }
            } catch (error) {
                console.error("ABI fetch error:", error);
                setAbiError("Failed to fetch contract ABI. You can still enter function name manually.");
            } finally {
                setFetchingAbi(false);
            }
        };

        // Debounce the fetch
        const timeoutId = setTimeout(fetchAbi, 500);
        return () => clearTimeout(timeoutId);
    }, [targetContract, provider]);

    // Handle function selection
    const handleFunctionSelect = (func: FunctionAbi) => {
        setSelectedFunction(func);
        setEntrypoint(func.name);
        setShowFunctionDropdown(false);
        setViewResult(null); // Clear previous results
        // Initialize input fields for function parameters
        const inputs: Record<string, string> = {};
        func.inputs.forEach((input) => {
            inputs[input.name] = "";
        });
        setFunctionInputs(inputs);
    };

    // Check if current function is a view function
    const isViewFunction = selectedFunction?.stateMutability === "view";

    // Handle view function call (read-only, no transaction needed)
    const handleViewCall = async () => {
        if (!targetContract || !entrypoint) return;
        setLoading(true);
        setViewResult(null);

        try {
            setStatusMessage("Calling view function...");
            const rpcProvider = provider as unknown as RpcProvider;

            // Build calldata for view function
            const calldata = selectedFunction ? buildCalldataFromInputs() : [];

            const result = await rpcProvider.callContract({
                contractAddress: targetContract,
                entrypoint: entrypoint,
                calldata: calldata,
            });

            // Format the result
            const formattedResult = result.map((val: string) => {
                // Try to format as hex if it looks like a number
                try {
                    const bigVal = BigInt(val);
                    return {
                        raw: val,
                        hex: "0x" + bigVal.toString(16),
                        decimal: bigVal.toString(),
                    };
                } catch {
                    return { raw: val, hex: val, decimal: val };
                }
            });

            setViewResult(formattedResult.map((r: { raw: string }) => r.raw));
            setStatusMessage("");
        } catch (e: unknown) {
            errorToast(e instanceof Error ? e.message : "View call failed");
            setStatusMessage("");
        } finally {
            setLoading(false);
        }
    };

    // Copy result to clipboard
    const copyToClipboard = async (value: string, index: number) => {
        await navigator.clipboard.writeText(value);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    // Format result value for display
    const formatResultValue = (value: string, outputType?: string) => {
        try {
            const bigVal = BigInt(value);

            // Check if it looks like an address (large hex value)
            if (bigVal > 0n && value.length > 10) {
                const hex = "0x" + bigVal.toString(16).padStart(64, "0");
                // If it's likely an address, show shortened version
                if (outputType?.includes("ContractAddress") || hex.length === 66) {
                    return {
                        display: hex.slice(0, 10) + "..." + hex.slice(-8),
                        full: hex,
                        isAddress: true,
                    };
                }
            }

            // For u256, show both decimal and formatted
            if (outputType?.includes("u256") || bigVal > 10n ** 15n) {
                const formatted = (Number(bigVal) / 10 ** 18).toFixed(6);
                return {
                    display: `${bigVal.toString()} (${formatted} tokens)`,
                    full: bigVal.toString(),
                    isAddress: false,
                };
            }

            return {
                display: bigVal.toString(),
                full: bigVal.toString(),
                isAddress: false,
            };
        } catch {
            return { display: value, full: value, isAddress: false };
        }
    };

    // Build calldata from function inputs
    const buildCalldataFromInputs = (): string[] => {
        if (!selectedFunction) return [];

        const params: string[] = [];
        for (const input of selectedFunction.inputs) {
            const value = functionInputs[input.name] || "";
            if (value) {
                // Handle u256 which needs two felts (low, high)
                if (input.type.includes("u256")) {
                    const bigValue = BigInt(value);
                    const low = bigValue & ((1n << 128n) - 1n);
                    const high = bigValue >> 128n;
                    params.push(low.toString(), high.toString());
                } else if (input.type.includes("bool")) {
                    params.push(value.toLowerCase() === "true" ? "1" : "0");
                } else {
                    params.push(value);
                }
            }
        }
        return params;
    };

    const poolNotes = typeof window !== "undefined" ? getPoolNotes().filter((n) => !n.spent) : [];

    const formatWei = (wei: string) => (Number(BigInt(wei)) / 10 ** 18).toFixed(4);

    const getTokenLabel = (note: PoolNote) => {
        if (note.tokenAddress === ADDRESSES.MOCK_BTC) return "BTC";
        if (note.tokenAddress === ADDRESSES.MOCK_STRK) return "STRK";
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
        if (!selectedNote || !targetContract || !entrypoint || !amount) return;
        if (!useCoordinator && !relayer) return;
        if (useCoordinator && !account) return;
        setLoading(true);

        try {
            const amountWei = BigInt(amount) * 10n ** 18n;
            const noteAmountWei = BigInt(selectedNote.amount);

            // Calculate relayer fee if using coordinator
            const relayerFee = useCoordinator ? calculateFee(amountWei, feeBps) : 0n;
            const changeAmount = noteAmountWei - amountWei - relayerFee;

            if (changeAmount < 0n) {
                throw new Error("Amount (+ fee) exceeds shielded balance");
            }

            // Wait for on-chain confirmation
            setStatusMessage("Checking on-chain confirmation...");
            const result = await buildTreeFromChain(ADDRESSES.SHIELDED_POOL, "pool");
            const normalized = "0x" + BigInt(selectedNote.commitment).toString(16);
            let leafIndex = result.commitmentToLeafIndex.get(normalized);

            if (leafIndex === undefined) {
                setStatusMessage("Waiting for deposit confirmation...");
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
            let changeNoteData: { secret: string; nullifierSecret: string } | null = null;
            if (changeAmount > 0n) {
                const newSecret = generateSecret();
                const newNullifierSecret = generateSecret();
                changeCommitment = await computePoolCommitment(
                    changeAmount.toString(),
                    selectedNote.tokenAddress,
                    newSecret,
                    newNullifierSecret,
                );
                // Store the secrets to save the change note after tx confirms
                changeNoteData = { secret: newSecret, nullifierSecret: newNullifierSecret };
            }

            // Parse calldata: prepend function selector, then user params
            const selector = hash.getSelectorFromName(entrypoint);
            // Use auto-generated calldata if function is selected, otherwise use manual input
            const userParams = selectedFunction
                ? buildCalldataFromInputs()
                : callData
                    .split(",")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0);
            const callDataArray = [selector, ...userParams];

            let transactionHash: string;
            let usedCoordinator = false;

            if (useCoordinator && account) {
                // On-chain coordinator path (with fallback)
                try {
                    setStatusMessage("Selecting relayer from network...");
                    const relayerId = await selectRelayer(account);

                    setStatusMessage(`Submitting via Relayer #${relayerId}...`);
                    const coordResult = await coordinatorExecute(account, {
                        fullProofWithHints: proofResult.fullProofWithHints,
                        root,
                        nullifierHash,
                        tokenAddress: selectedNote.tokenAddress,
                        amount: amountWei,
                        targetContract,
                        callData: callDataArray,
                        changeCommitment,
                        changeAmount,
                        relayerId,
                        feeAmount: relayerFee,
                    });
                    transactionHash = coordResult.transactionHash;
                    usedCoordinator = true;
                } catch (coordError) {
                    console.warn("[Coordinator fallback] Execute via coordinator failed, falling back to default relayer:", coordError);
                    setStatusMessage("Coordinator unavailable, falling back to default relayer...");
                    const fallbackResult = await relayPrivateExecute("", {
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
                    transactionHash = fallbackResult.transactionHash;
                }
            } else {
                // Legacy off-chain relayer path
                setStatusMessage("Submitting to Relayer...");
                const fallbackUrl = relayerUrl || "";
                const legacyResult = await relayPrivateExecute(fallbackUrl, {
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
                transactionHash = legacyResult.transactionHash;
            }

            setStatusMessage("Waiting for confirmation...");
            markPoolNoteSpent(selectedNote.commitment);

            if (usedCoordinator) {
                await (provider as unknown as RpcProvider).waitForTransaction(transactionHash);
            } else {
                const status = await pollTxStatus(transactionHash);
                if (status !== "ACCEPTED_ON_L2") {
                    throw new Error("Transaction rejected or timed out");
                }
            }

            // Save the change note if there was change
            if (changeNoteData && changeAmount > 0n) {
                const changeNote: PoolNote = {
                    type: "pool",
                    commitment: changeCommitment,
                    amount: changeAmount.toString(),
                    tokenAddress: selectedNote.tokenAddress,
                    secret: changeNoteData.secret,
                    nullifierSecret: changeNoteData.nullifierSecret,
                    spent: false,
                    createdAt: Date.now(),
                    txHash: transactionHash,
                    confirmed: false, // Will be confirmed when it appears on-chain
                };
                addNote(changeNote);
                console.log(`[PrivateExecute] Saved change note: ${formatWei(changeAmount.toString())} ${getTokenLabel(selectedNote)}`);
            }

            txToast(transactionHash).success();
            setSelectedNote(null);
            setTargetContract("");
            setEntrypoint("");
            setCallData("");
            setAmount("");
            setSelectedFunction(null);
            setFunctionInputs({});
            setContractFunctions([]);
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
                {/* Note Selection - Hide for view functions */}
                {!isViewFunction && (
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
                )}

                {/* Target Contract */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Target Contract Address
                    </Label>
                    <div className="relative">
                        <Input
                            placeholder="0x..."
                            value={targetContract}
                            onChange={(e) => setTargetContract(e.target.value)}
                            disabled={loading}
                            className="h-12 bg-white/[0.02] border-white/[0.06] text-white font-mono text-sm focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20 pr-12"
                        />
                        {fetchingAbi && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-[#8B8CFF]" />
                            </div>
                        )}
                        {!fetchingAbi && contractFunctions.length > 0 && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                            </div>
                        )}
                    </div>
                    {abiError && (
                        <p className="text-xs text-amber-400">{abiError}</p>
                    )}
                </div>

                {/* Function Selection */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-white">
                        Function
                    </Label>
                    {contractFunctions.length > 0 ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowFunctionDropdown(!showFunctionDropdown)}
                                disabled={loading}
                                className={cn(
                                    "w-full h-12 px-4 flex items-center justify-between rounded-xl border transition-all",
                                    "bg-white/[0.02] border-white/[0.06] text-white",
                                    "hover:bg-white/[0.04] hover:border-white/[0.12]",
                                    "focus:border-[#8B8CFF] focus:ring-2 focus:ring-[#8B8CFF]/20",
                                    "disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                <span className={selectedFunction ? "text-white" : "text-white/40"}>
                                    {selectedFunction ? selectedFunction.name : "Select a function..."}
                                </span>
                                <ChevronDown className={cn(
                                    "h-4 w-4 text-white/40 transition-transform",
                                    showFunctionDropdown && "rotate-180"
                                )} />
                            </button>

                            {showFunctionDropdown && (
                                <div className="absolute z-50 w-full mt-2 py-2 rounded-xl border border-white/[0.06] bg-[#0D1117] shadow-xl max-h-64 overflow-auto">
                                    {contractFunctions.map((func) => (
                                        <button
                                            key={func.name}
                                            type="button"
                                            onClick={() => handleFunctionSelect(func)}
                                            className={cn(
                                                "w-full px-4 py-3 text-left hover:bg-white/[0.04] transition-colors",
                                                selectedFunction?.name === func.name && "bg-[#8B8CFF]/10"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-sm text-white">
                                                    {func.name}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] font-medium",
                                                        func.stateMutability === "view"
                                                            ? "border-blue-500/30 text-blue-400"
                                                            : "border-purple-500/30 text-purple-400"
                                                    )}
                                                >
                                                    {func.stateMutability}
                                                </Badge>
                                            </div>
                                            {func.inputs.length > 0 && (
                                                <p className="mt-1 text-xs text-white/40 font-mono">
                                                    ({func.inputs.map(i => `${i.name}: ${getTypeDisplayName(i.type)}`).join(", ")})
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <Input
                            placeholder="e.g. increment, transfer, approve"
                            value={entrypoint}
                            onChange={(e) => setEntrypoint(e.target.value)}
                            disabled={loading}
                            className="h-12 bg-white/[0.02] border-white/[0.06] text-white focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                        />
                    )}
                    <p className="text-xs text-white/40">
                        {contractFunctions.length > 0
                            ? `${contractFunctions.length} functions available`
                            : "Enter contract address to auto-detect functions, or type function name manually."
                        }
                    </p>
                </div>

                {/* Dynamic Function Parameters */}
                {selectedFunction && selectedFunction.inputs.length > 0 && (
                    <div className="space-y-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
                        <Label className="text-sm font-semibold text-white">
                            Function Parameters
                        </Label>
                        {selectedFunction.inputs.map((input) => (
                            <div key={input.name} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-medium text-white/70">
                                        {input.name}
                                    </Label>
                                    <span className="text-xs font-mono text-white/40">
                                        {getTypeDisplayName(input.type)}
                                    </span>
                                </div>
                                <Input
                                    placeholder={getInputPlaceholder(input.type)}
                                    value={functionInputs[input.name] || ""}
                                    onChange={(e) =>
                                        setFunctionInputs((prev) => ({
                                            ...prev,
                                            [input.name]: e.target.value,
                                        }))
                                    }
                                    disabled={loading}
                                    className="h-10 bg-white/[0.02] border-white/[0.06] text-white font-mono text-sm focus:border-[#8B8CFF] focus:ring-[#8B8CFF]/20"
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Amount - Hide for view functions */}
                {!isViewFunction && (
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
                )}

                {/* Manual Calldata - only show when no function is selected */}
                {!selectedFunction && (
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
                )}

                {/* View Function Results */}
                {viewResult && viewResult.length > 0 && (
                    <div className="space-y-3 p-4 rounded-xl border border-green-500/20 bg-green-500/5">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-green-400 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Result
                            </Label>
                            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                                {viewResult.length} value{viewResult.length !== 1 ? "s" : ""}
                            </Badge>
                        </div>
                        <div className="space-y-2">
                            {viewResult.map((value, index) => {
                                const outputType = selectedFunction?.outputs?.[index]?.type;
                                const formatted = formatResultValue(value, outputType);
                                return (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/[0.04]"
                                    >
                                        <div className="flex-1 min-w-0">
                                            {outputType && (
                                                <p className="text-xs text-white/40 mb-1 font-mono">
                                                    {getTypeDisplayName(outputType)}
                                                </p>
                                            )}
                                            <p className="font-mono text-sm text-white truncate" title={formatted.full}>
                                                {formatted.display}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(formatted.full, index)}
                                            className="ml-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            {copiedIndex === index ? (
                                                <Check className="h-4 w-4 text-green-400" />
                                            ) : (
                                                <Copy className="h-4 w-4 text-white/40" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

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

                {/* Action Button - Different for view vs external functions */}
                {isViewFunction ? (
                    <Button
                        className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading || !targetContract || !entrypoint}
                        onClick={handleViewCall}
                    >
                        {loading ? (
                            <span className="flex items-center gap-3">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Reading...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Eye className="h-5 w-5" strokeWidth={2.5} />
                                Read Contract
                                <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                            </span>
                        )}
                    </Button>
                ) : (
                    <Button
                        className="w-full h-14 text-base font-bold rounded-xl bg-gradient-to-r from-[#8B8CFF] to-[#6B6DFF] hover:from-[#7B7CFF] hover:to-[#5B5DFF] shadow-lg shadow-[#8B8CFF]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                            loading ||
                            !address ||
                            !selectedNote ||
                            !targetContract ||
                            !entrypoint ||
                            !amount ||
                            (!useCoordinator && !relayer)
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
                )}
            </CardContent>
        </Card>
    );
}
