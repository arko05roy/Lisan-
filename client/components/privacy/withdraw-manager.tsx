"use client";

import { useState, useEffect } from "react";
import { getPoolNotes, getAmmNotes, PoolNote, AmmNote } from "@/lib/storage";
import { RelayerSelect } from "@/components/relayer-select";
import { Relayer } from "@/lib/relayer-registry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, RefreshCw, Key, ArrowUpRight } from "lucide-react";
import { WithdrawFlow } from "./withdraw-flow";
import { TOKEN_TYPE_BTC } from "@/lib/addresses";
import { cn } from "@/lib/utils";

export function WithdrawManager() {
    const [poolNotes, setPoolNotes] = useState<PoolNote[]>([]);
    const [ammNotes, setAmmNotes] = useState<AmmNote[]>([]);
    const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);
    const [activeNote, setActiveNote] = useState<PoolNote | AmmNote | null>(null);
    const [isFlowOpen, setIsFlowOpen] = useState(false);

    const refreshNotes = () => {
        setPoolNotes(getPoolNotes().filter((n) => !n.spent));
        setAmmNotes(getAmmNotes().filter((n) => !n.spent));
    };

    useEffect(() => {
        refreshNotes();
    }, []);

    const allNotes = [
        ...poolNotes.map(n => ({ ...n, _source: "pool" as const })),
        ...ammNotes.map(n => ({ ...n, _source: "amm" as const }))
    ].sort((a, b) => b.createdAt - a.createdAt);

    const handleWithdrawClick = (note: PoolNote | AmmNote) => {
        setActiveNote(note);
        setIsFlowOpen(true);
    };

    return (
        <div className="space-y-6">
            <Card className="border-border/40 bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base font-medium">Relayer Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                    <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
                    {!selectedRelayer && (
                        <p className="text-xs text-yellow-500/80 mt-2">
                            Please select a relayer to process withdrawals.
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        Shielded Balances
                    </h2>
                    <Button variant="ghost" size="sm" onClick={refreshNotes} className="h-8 w-8 p-0">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {allNotes.length === 0 ? (
                    <Card className="border-dashed border-border/60 bg-transparent">
                        <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <Key className="h-10 w-10 mb-3 opacity-20" />
                            <p>No shielded funds found.</p>
                            <p className="text-xs">Deposit assets to see them here.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-3">
                        {allNotes.map((note) => {
                            const isAmm = "_source" in note && note._source === "amm";
                            const tokenLabel = isAmm
                                ? ((note as AmmNote).tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK")
                                : "mBTC";
                            const amountDisplay = (BigInt(note.amount) / 10n ** 18n).toString();

                            return (
                                <Card key={note.commitment} className="group overflow-hidden transition-all hover:bg-muted/20 hover:border-primary/20">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm",
                                                tokenLabel === "mBTC" ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
                                            )}>
                                                {tokenLabel === "mBTC" ? "₿" : "S"}
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg leading-none">{amountDisplay} {tokenLabel}</div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1 rounded-sm border-white/10">{isAmm ? "AMM" : "POOL"}</Badge>
                                                    <span className="font-mono opacity-50">{note.commitment.slice(0, 8)}...</span>
                                                    {!note.confirmed && <span className="text-yellow-500">(Pending)</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            disabled={!selectedRelayer}
                                            onClick={() => handleWithdrawClick(note)}
                                        >
                                            Withdraw <ArrowUpRight className="ml-2 h-3 w-3" />
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {activeNote && (
                <WithdrawFlow
                    note={activeNote}
                    isOpen={isFlowOpen}
                    onOpenChange={setIsFlowOpen}
                    relayer={selectedRelayer}
                    onWithdrawComplete={() => {
                        refreshNotes();
                    }}
                />
            )}
        </div>
    );
}
