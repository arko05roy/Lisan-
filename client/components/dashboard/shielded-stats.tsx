import { Card, CardContent } from "@/components/ui/card";
import { Lock, Shuffle, TrendingUp, Vote } from "lucide-react";

interface ShieldedStatsProps {
    totalDeposited: string;
    commitmentCount: string;
    btcReserve: string;
    strkReserve: string;
    marketCount: string;
    proposalCount: string;
}

export function ShieldedStats({
    totalDeposited,
    commitmentCount,
    btcReserve,
    strkReserve,
    marketCount,
    proposalCount,
}: ShieldedStatsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Shielded Pool Stats */}
            <Card className="bg-card border-none shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Shielded Pool TVL</h3>
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <Lock className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold tracking-tight">{totalDeposited} mBTC</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="text-green-400 font-medium">{commitmentCount}</span> active commitments
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* AMM Stats */}
            <Card className="bg-card border-none shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Shielded AMM</h3>
                        <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                            <Shuffle className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">BTC Reserve</span>
                            <span className="font-bold">{btcReserve}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">STRK Reserve</span>
                            <span className="font-bold">{strkReserve}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Prediction Markets */}
            <Card className="bg-card border-none shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Prediction Markets</h3>
                        <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold tracking-tight">{marketCount}</p>
                        <p className="text-xs text-muted-foreground">active markets</p>
                    </div>
                </CardContent>
            </Card>

            {/* Governance */}
            <Card className="bg-card border-none shadow-lg relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent pointer-events-none" />
                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-sm font-medium text-muted-foreground">Governance</h3>
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                            <Vote className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-2xl font-bold tracking-tight">{proposalCount}</p>
                        <p className="text-xs text-muted-foreground">proposals</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
