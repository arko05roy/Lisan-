"use client";

import { Card } from "@/components/ui/card";

interface SwapStatsProps {
    btcRes: string;
    strkRes: string;
}

export function SwapStats({ btcRes, strkRes }: SwapStatsProps) {
    // Mock data for realism based on reserves
    const btcVal = Number(btcRes) * 42000;
    const strkVal = Number(strkRes) * 2; // Assume $2
    const tvl = btcVal + strkVal || 0;
    const vol24 = tvl * 0.15; // Mock

    return (
        <div className="space-y-4">
            {/* APR Card */}
            <Card className="p-5 border-border/40 bg-card/50">
                <div className="mb-2 text-sm text-muted-foreground">Total APR</div>
                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-purple-500">
                    {tvl > 0 ? "12.4%" : "0.0%"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                    Based on 24h volume
                </div>
            </Card>

            {/* Stats Main Card */}
            <Card className="p-5 border-border/40 bg-card/50 space-y-6">
                <h3 className="font-semibold text-lg">Stats</h3>

                <div className="space-y-4">
                    <div>
                        <div className="text-xs text-muted-foreground mb-1.5">Pool Balances</div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="font-medium text-white">{Number(btcRes).toLocaleString()} mBTC</span>
                            <span className="font-medium text-white">{Number(strkRes).toLocaleString()} mSTRK</span>
                        </div>
                        {/* Custom Progress Bar */}
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                            <div className="h-full bg-orange-500" style={{ width: '50%' }} />
                            <div className="h-full bg-blue-500" style={{ width: '50%' }} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">TVL</div>
                            <div className="text-xl font-bold">${tvl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[10px] text-red-400">▼ 3.32%</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">24h Volume</div>
                            <div className="text-xl font-bold">${vol24.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[10px] text-green-400">▲ 199.9%</div>
                        </div>
                        <div>
                            <div className="text-xs text-muted-foreground mb-1">24h Fees</div>
                            <div className="text-xl font-bold">${(vol24 * 0.003).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
