"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { generateSecret, computeCommitment, computeAmmCommitment } from "@/lib/crypto";
import { addNote } from "@/lib/storage";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256 } from "starknet";
import { cn } from "@/lib/utils";
import { ArrowRight, Lock, ShieldCheck, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AssetType = "BTC" | "STRK";
type StrategyType = "POOL" | "AMM";

export function DepositForm() {
    const { address } = useAccount();
    const { sendAsync } = useSendTransaction({});

    const [amount, setAmount] = useState("");
    const [asset, setAsset] = useState<AssetType>("BTC");
    const [strategy, setStrategy] = useState<StrategyType>("POOL");
    const [loading, setLoading] = useState(false);

    // If asset is STRK, force AMM strategy as Pool only supports BTC (based on original code)
    const availableStrategies: StrategyType[] = asset === "BTC" ? ["POOL", "AMM"] : ["AMM"];

    const handleAssetChange = (newAsset: AssetType) => {
        setAsset(newAsset);
        if (newAsset === "STRK") {
            setStrategy("AMM");
        }
    };

    async function handleDeposit() {
        if (!address || !amount) return;
        setLoading(true);

        try {
            const amountWei = BigInt(amount) * 10n ** 18n;
            const secret = generateSecret();
            const nullifierSecret = generateSecret();
            const amountFelt = amountWei.toString();

            let calls;
            let commitment;

            if (strategy === "POOL") {
                // Pool Deposit Logic
                commitment = await computeCommitment(amountFelt, secret, nullifierSecret);
                const u = uint256.bnToUint256(amountWei);

                calls = [
                    buildApproveCall(ADDRESSES.MOCK_BTC, ADDRESSES.SHIELDED_POOL, amountWei),
                    buildCall(ADDRESSES.SHIELDED_POOL, "deposit", [
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
                    secret,
                    nullifierSecret,
                    spent: false,
                    createdAt: Date.now(),
                    txHash: result.transaction_hash,
                    confirmed: false,
                });

                t.success();
            } else {
                // AMM Deposit Logic
                const tokenType = asset === "BTC" ? TOKEN_TYPE_BTC : TOKEN_TYPE_STRK;
                const tokenAddress = asset === "BTC" ? ADDRESSES.MOCK_BTC : ADDRESSES.MOCK_STRK;

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
                    <div className="grid grid-cols-2 gap-4">
                        {(["BTC", "STRK"] as AssetType[]).map((t) => (
                            <div
                                key={t}
                                onClick={() => handleAssetChange(t)}
                                className={cn(
                                    "cursor-pointer relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:bg-muted/50",
                                    asset === t
                                        ? "border-primary bg-primary/5 shadow-[0_0_20px_-5px_rgba(var(--primary),0.3)]"
                                        : "border-transparent bg-muted/20"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "flex h-10 w-10 items-center justify-center rounded-full font-bold",
                                        t === "BTC" ? "bg-orange-500/20 text-orange-500" : "bg-blue-500/20 text-blue-500"
                                    )}>
                                        {t[0]}
                                    </div>
                                    <div>
                                        <div className="font-bold">{t === "BTC" ? "Bitcoin" : "Starknet"}</div>
                                        <div className="text-xs text-muted-foreground">Mock Token</div>
                                    </div>
                                </div>
                                {asset === t && (
                                    <div className="absolute right-3 top-3 text-primary">
                                        <ShieldCheck className="h-5 w-5" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Strategy Selection (Only if multiple options) */}
                {asset === "BTC" && (
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
                                ? "Standard shielded pool for simple transfers."
                                : "Shielded AMM allowing private swaps."}
                        </p>
                    </div>
                )}

                {/* Amount Input */}
                <div className="space-y-3">
                    <Label className="text-base font-medium text-foreground/80">Amount</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="h-16 pl-4 pr-16 text-2xl font-bold bg-background/50 border-input/50 focus-visible:ring-primary/20"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                            m{asset}
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
                    disabled={loading || !address || !amount}
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
