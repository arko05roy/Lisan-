"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { generateSecret, computePoolCommitment, computeAmmCommitment } from "@/lib/crypto";
import { addNote } from "@/lib/storage";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256 } from "starknet";
import { cn } from "@/lib/utils";
import { ArrowRight, Lock, ShieldCheck, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type AssetChoice = "BTC" | "STRK" | "DEMO" | "CUSTOM";
type StrategyType = "POOL" | "AMM";

const PRESET_TOKENS: { id: AssetChoice; label: string; fullName: string; color: string }[] = [
    { id: "BTC", label: "mBTC", fullName: "Mock Bitcoin", color: "bg-orange-500/20 text-orange-500" },
    { id: "STRK", label: "mSTRK", fullName: "Mock Starknet", color: "bg-blue-500/20 text-blue-500" },
    { id: "DEMO", label: "DEMO", fullName: "Demo Token", color: "bg-green-500/20 text-green-500" },
    { id: "CUSTOM", label: "ERC20", fullName: "Custom Address", color: "bg-purple-500/20 text-purple-500" },
];

export function DepositForm() {
    const { address } = useAccount();
    const { sendAsync } = useSendTransaction({});

    const [amount, setAmount] = useState("");
    const [asset, setAsset] = useState<AssetChoice>("BTC");
    const [strategy, setStrategy] = useState<StrategyType>("POOL");
    const [customTokenAddress, setCustomTokenAddress] = useState("");
    const [loading, setLoading] = useState(false);

    const isKnownAsset = asset === "BTC" || asset === "STRK";
    const availableStrategies: StrategyType[] = isKnownAsset ? ["POOL", "AMM"] : ["POOL"];

    const handleAssetChange = (newAsset: AssetChoice) => {
        setAsset(newAsset);
        if (!["BTC", "STRK"].includes(newAsset) && strategy === "AMM") {
            setStrategy("POOL");
        }
    };

    const resolveTokenAddress = (): string => {
        if (asset === "BTC") return ADDRESSES.MOCK_BTC;
        if (asset === "STRK") return ADDRESSES.MOCK_STRK;
        if (asset === "DEMO") return ADDRESSES.DEMO_TOKEN;
        return customTokenAddress;
    };

    const getDisplayUnit = (): string => {
        if (asset === "BTC") return "mBTC";
        if (asset === "STRK") return "mSTRK";
        if (asset === "DEMO") return "DEMO";
        return "tokens";
    };

    const isFormValid = (): boolean => {
        if (!address || !amount) return false;
        if (asset === "CUSTOM" && !customTokenAddress.startsWith("0x")) return false;
        return true;
    };

    async function handleDeposit() {
        if (!isFormValid()) return;
        setLoading(true);

        try {
            // Parse amount and convert to wei (handling decimals)
            const amountFloat = parseFloat(amount);
            if (isNaN(amountFloat) || amountFloat <= 0) {
                throw new Error("Invalid amount");
            }
            // Convert to smallest unit (18 decimals) then to BigInt
            const amountWei = BigInt(Math.floor(amountFloat * 1e18));
            const secret = generateSecret();
            const nullifierSecret = generateSecret();
            const amountFelt = amountWei.toString();
            const tokenAddress = resolveTokenAddress();

            let calls;
            let commitment;

            if (strategy === "POOL") {
                commitment = await computePoolCommitment(amountFelt, tokenAddress, secret, nullifierSecret);
                const u = uint256.bnToUint256(amountWei);

                calls = [
                    buildApproveCall(tokenAddress, ADDRESSES.SHIELDED_POOL, amountWei),
                    buildCall(ADDRESSES.SHIELDED_POOL, "deposit", [
                        tokenAddress,
                        u.low.toString(), u.high.toString(),
                        commitment,
                    ]),
                ];

                const result = await sendAsync(calls);
                const t = txToast(result.transaction_hash);

                addNote({
                    type: "pool",
                    commitment,
                    amount: amountFelt,
                    tokenAddress,
                    secret,
                    nullifierSecret,
                    spent: false,
                    createdAt: Date.now(),
                    txHash: result.transaction_hash,
                    confirmed: false,
                });

                t.success();
            } else {
                const tokenType = asset === "BTC" ? TOKEN_TYPE_BTC : TOKEN_TYPE_STRK;

                commitment = await computeAmmCommitment(amountFelt, tokenType, secret, nullifierSecret);
                const u = uint256.bnToUint256(amountWei);

                calls = [
                    buildApproveCall(tokenAddress, ADDRESSES.SHIELDED_AMM, amountWei),
                    buildCall(ADDRESSES.SHIELDED_AMM, "deposit", [
                        tokenType,
                        u.low.toString(), u.high.toString(),
                        commitment,
                    ]),
                ];

                const result = await sendAsync(calls);
                const t = txToast(result.transaction_hash);

                addNote({
                    type: "amm",
                    commitment,
                    amount: amountFelt,
                    tokenType,
                    secret,
                    nullifierSecret,
                    spent: false,
                    createdAt: Date.now(),
                    txHash: result.transaction_hash,
                    confirmed: false,
                });

                t.success();
            }

            setAmount("");
        } catch (e: unknown) {
            errorToast(e instanceof Error ? e.message : "Deposit failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6 space-y-8">
                {/* Asset Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground/80">Select Asset to Shield</Label>
                    <div className="grid grid-cols-4 gap-3">
                        {PRESET_TOKENS.map((t) => (
                            <div
                                key={t.id}
                                onClick={() => handleAssetChange(t.id)}
                                className={cn(
                                    "cursor-pointer relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:bg-muted/50",
                                    asset === t.id
                                        ? "border-primary bg-primary/5 shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)]"
                                        : "border-transparent bg-muted/20"
                                )}
                            >
                                <div className="flex flex-col items-center gap-2 text-center">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-full font-bold",
                                        t.color
                                    )}>
                                        {t.id === "CUSTOM" ? <Pencil className="h-4 w-4" /> : t.label[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm">{t.label}</div>
                                        <div className="text-xs text-muted-foreground">{t.fullName}</div>
                                    </div>
                                </div>
                                {asset === t.id && (
                                    <div className="absolute right-2 top-2 text-primary">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom Token Address */}
                {asset === "CUSTOM" && (
                    <div className="space-y-2">
                        <Label className="text-base font-medium text-foreground/80">Token Contract Address</Label>
                        <Input
                            placeholder="0x... (paste any ERC20 token address)"
                            value={customTokenAddress}
                            onChange={(e) => setCustomTokenAddress(e.target.value)}
                            className="font-mono text-sm bg-background/50 border-input/50 focus-visible:ring-primary/20"
                        />
                        <p className="text-xs text-muted-foreground">
                            Enter the contract address of any ERC20 token on Starknet. The multi-asset pool accepts all tokens.
                        </p>
                    </div>
                )}

                {/* Strategy Selection */}
                <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground/80">Select Strategy</Label>
                    <div className="flex gap-2">
                        {availableStrategies.map((s) => (
                            <Button
                                key={s}
                                variant={strategy === s ? "default" : "outline"}
                                onClick={() => setStrategy(s)}
                                className="flex-1"
                            >
                                {s === "POOL" ? "Standard Pool" : "DeFi AMM"}
                            </Button>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground ml-1">
                        {strategy === "POOL"
                            ? "Multi-asset shielded pool for private transfers and composability."
                            : "Shielded AMM allowing private swaps."}
                        {!isKnownAsset && " Custom tokens can only use the Standard Pool."}
                    </p>
                </div>

                {/* Amount Input */}
                <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground/80">Amount</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-16 pl-4 pr-20 text-2xl font-bold bg-background/50 border-input/50 focus-visible:ring-primary/20"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            {getDisplayUnit()}
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
                    <div className="flex gap-3">
                        <Lock className="h-5 w-5 text-blue-400 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-blue-100">Privacy Note</p>
                            <p className="text-xs text-blue-200/70">
                                A secure note will be generated and stored locally in your browser.
                                Wait for the transaction to confirm before attempting to withdraw.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <Button
                    className="w-full h-12 text-lg font-medium shadow-lg shadow-primary/20"
                    disabled={loading || !isFormValid()}
                    onClick={handleDeposit}
                >
                    {loading ? (
                        "Shielding Assets..."
                    ) : (
                        <span className="flex items-center gap-2">
                            Shield Assets <ArrowRight className="h-4 w-4" />
                        </span>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
