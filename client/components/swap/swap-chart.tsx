"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, BarChart3, LineChart, Maximize2, MoreHorizontal, Share2 } from "lucide-react";

interface SwapChartProps {
    btcRes: string;
    strkRes: string;
}

export function SwapChart({ btcRes, strkRes }: SwapChartProps) {
    const btc = Number(btcRes);
    const strk = Number(strkRes);
    const price = btc > 0 ? (strk / btc).toFixed(4) : "0.00";
    const isPoolEmpty = btc === 0 && strk === 0;

    return (
        <Card className="flex flex-col h-full border-border/40 bg-card/50 overflow-hidden">
            {/* Header */}
            <div className="p-6 pb-2 border-b border-white/[0.04]">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                            <div className="h-8 w-8 rounded-full bg-orange-500/10 border-2 border-background flex items-center justify-center text-orange-500 font-bold text-xs">₿</div>
                            <div className="h-8 w-8 rounded-full bg-blue-500/10 border-2 border-background flex items-center justify-center text-blue-500 font-bold text-xs">S</div>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold">mBTC / mSTRK</h2>
                                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground font-normal">v2</Badge>
                                <Badge variant="secondary" className="bg-muted/50 text-muted-foreground font-normal">0.3%</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><BarChart3 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Share2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </div>
                </div>

                <div className="flex items-end gap-6">
                    <div>
                        <div className="text-3xl font-bold">
                            {isPoolEmpty ? "Uninitialized" : `${price} mSTRK`}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                            {isPoolEmpty ? (
                                <span className="text-yellow-500">No Liquidity</span>
                            ) : (
                                <>
                                    <span className="text-green-500 font-medium">1 mBTC = {price} mSTRK</span> <span className="opacity-50">Current Ratio</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Area (Mock) */}
            <div className="flex-1 relative bg-gradient-to-b from-transparent to-primary/5 p-6 min-h-[300px]">
                {/* Mock Bars */}
                <div className="absolute bottom-10 left-6 right-6 flex items-end justify-between gap-2 h-[200px] opacity-80">
                    {[40, 65, 30, 80, 45, 90, 55, 70, 35, 60, 85, 50, 95, 25, 75, 50, 40, 60, 90, 100, 40, 30, 20, 50].map((h, i) => (
                        <div
                            key={i}
                            className="w-full bg-pink-500 hover:bg-pink-400 transition-colors rounded-t-sm"
                            style={{ height: `${h}%`, opacity: i % 2 === 0 ? 0.4 : 1 }}
                        />
                    ))}
                </div>

                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none p-6">
                    <div className="border-t border-dashed border-white/5 w-full h-1/4" />
                    <div className="border-t border-dashed border-white/5 w-full h-1/4" />
                    <div className="border-t border-dashed border-white/5 w-full h-1/4" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 h-10 border-t border-white/5 flex items-center justify-between px-6 text-xs text-muted-foreground">
                    <span>11:30 PM</span>
                    <span>3:30 AM</span>
                    <span>7:30 AM</span>
                    <span>11:30 AM</span>
                    <span>3:30 PM</span>
                    <span>7:30 PM</span>
                </div>
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">1H</Button>
                    <Button variant="secondary" size="sm" className="h-7 text-xs bg-muted text-foreground">1D</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">1W</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">1M</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">1Y</Button>
                </div>
                <div className="flex bg-muted/30 rounded-lg p-0.5">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-3 hover:bg-background">Price</Button>
                    <Button variant="secondary" size="sm" className="h-6 text-[10px] px-3 shadow-none bg-background text-foreground">Volume</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-3 hover:bg-background">Liquidity</Button>
                </div>
            </div>
        </Card>
    );
}
