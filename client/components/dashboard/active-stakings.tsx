import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, BarChart2 } from "lucide-react";

interface ActiveStakingProps {
    btcBalance?: string;
    strkBalance?: string;
}

export function ActiveStakings({ btcBalance, strkBalance }: ActiveStakingProps) {
    return (
        <Card className="border-none bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Left Column: Active Staking Info */}
                    <div className="flex-1 space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    Last Update - Just now <RefreshCw className="h-3 w-3 animate-spin duration-3000" />
                                </div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    Stake mocked-BTC <span className="px-2 py-0.5 rounded bg-[#F7931A]/20 text-[#F7931A] text-xs">BTC</span>
                                </h3>
                            </div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-white/5">
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-sm text-muted-foreground">Current Reward Balance (mBTC)</div>
                            <div className="flex items-baseline gap-4">
                                <span className="text-4xl font-bold tracking-tighter">{btcBalance || "0.00"}</span>
                                <div className="flex gap-2">
                                    <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary/30 border-none">Upgrade</Button>
                                    <Button size="sm" variant="ghost">Unstake</Button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                            <div>
                                <div className="text-xs text-muted-foreground">Momentum</div>
                                <div className="font-medium text-sm text-green-500">Growth dynamics</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">General</div>
                                <div className="font-medium text-sm">Overview</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Risk</div>
                                <div className="font-medium text-sm">Risk assessment</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Reward</div>
                                <div className="font-medium text-sm">Expected profit</div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Investment Period Chart (Mock) */}
                    <div className="flex-1 bg-black/20 rounded-xl p-6 border border-white/5">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h4 className="font-medium">Investment Period</h4>
                                <p className="text-xs text-muted-foreground">Contribution Period (Month)</p>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 bg-transparent">6 Month</Button>
                        </div>

                        {/* Mock Timeline Visual */}
                        <div className="relative h-12 flex items-center">
                            <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/50 w-2/3" />
                            </div>
                            {/* Thumb */}
                            <div className="absolute left-2/3 -translate-x-1/2 h-8 w-8 rounded-full border-4 border-card bg-primary shadow-lg flex items-center justify-center z-10">
                                <div className="h-2 w-2 rounded-full bg-white" />
                            </div>
                            <div className="absolute left-2/3 -translate-x-1/2 -top-8 bg-[#2A2A35] px-2 py-1 rounded text-xs border border-white/10">
                                4 Month
                            </div>
                        </div>

                        {/* Sound wave visual mock */}
                        <div className="flex items-center justify-center gap-1 h-8 mt-4 opacity-30">
                            {Array.from({ length: 40 }).map((_, i) => (
                                <div key={i} className="w-1 bg-primary rounded-full" style={{ height: Math.random() * 24 + 4 + 'px' }} />
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
