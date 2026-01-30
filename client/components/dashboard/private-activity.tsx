"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { getPoolNotes, getAmmNotes, getBetNotes } from "@/lib/storage";
import { useEffect, useState } from "react";
import { ShieldCheck, Tag, Ticket } from "lucide-react";

interface NoteSummary {
    id: string; // secret or unique detail
    type: "Pool" | "AMM" | "Prediction";
    amount?: string;
    details: string;
    status: "Unspent" | "Active" | "Claimable";
}

export function PrivateActivity() {
    const [notes, setNotes] = useState<NoteSummary[]>([]);

    useEffect(() => {
        // Load notes from local storage and format them for display
        const pool = getPoolNotes()
            .filter(n => !n.spent)
            .map(n => ({
                id: n.secret,
                type: "Pool" as const,
                amount: (Number(n.amount) / 1e18).toFixed(4),
                details: `${n.token_type === "1" ? "BTC" : "STRK"} Deposit`,
                status: "Unspent" as const
            }));

        const amm = getAmmNotes()
            .filter(n => !n.spent)
            .map(n => ({
                id: n.secret,
                type: "AMM" as const,
                amount: (Number(n.amount) / 1e18).toFixed(4),
                details: `${n.token_type === "1" ? "BTC" : "STRK"} LP/Swap`,
                status: "Unspent" as const
            }));

        const bets = getBetNotes()
            .filter(n => !n.claimed)
            .map(n => ({
                id: n.secret,
                type: "Prediction" as const,
                amount: (Number(n.amount) / 1e18).toFixed(4),
                details: `Market #${n.market_id}`,
                status: "Active" as const
            }));

        setNotes([...pool, ...amm, ...bets]);
    }, []);

    return (
        <Card className="bg-card border-none shadow-lg">
            <CardHeader className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium">Your Private Activity (Local Notes)</CardTitle>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {notes.length} Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="h-[300px] overflow-y-auto">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground p-6">
                            <ShieldCheck className="h-10 w-10 mb-2 opacity-20" />
                            <p>No active private notes found.</p>
                            <p className="text-xs">Your privacy is safe.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {notes.map((note, i) => (
                                <div key={i} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground">
                                            {note.type === "Pool" && <LockIcon className="h-4 w-4" />}
                                            {note.type === "AMM" && <ShuffleIcon className="h-4 w-4" />}
                                            {note.type === "Prediction" && <Ticket className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{note.details}</p>
                                            <p className="text-xs text-muted-foreground">{note.type} Note</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm font-bold text-foreground">{note.amount} <span className="text-xs text-muted-foreground">tokens</span></p>
                                        <span className="text-[10px] text-green-400 uppercase tracking-wider">{note.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function LockIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}

function ShuffleIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l14.2-9.1c.6-.4.9-1.1.9-1.8V4" />
            <path d="M2 5h1.4c1.3 0 2.5.6 3.3 1.7l14.2 9.1c.6.4.9 1.1.9 1.8v1.4" />
        </svg>
    )
}
