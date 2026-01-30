"use client";

import { Badge } from "@/components/ui/badge";
import { getPoolNotes, getAmmNotes, getBetNotes } from "@/lib/storage";
import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Shuffle, Ticket } from "lucide-react";

interface NoteSummary {
  id: string;
  type: "Pool" | "AMM" | "Prediction";
  amount?: string;
  details: string;
  status: "Unspent" | "Active" | "Claimable";
}

const TYPE_STYLES = {
  Pool: {
    icon: Lock,
    bg: "bg-[#8B8CFF]/8",
    text: "text-[#8B8CFF]",
    badge: "bg-[#8B8CFF]/10 text-[#8B8CFF] border-[#8B8CFF]/15",
  },
  AMM: {
    icon: Shuffle,
    bg: "bg-[#A78BFA]/8",
    text: "text-[#A78BFA]",
    badge: "bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/15",
  },
  Prediction: {
    icon: Ticket,
    bg: "bg-[#F59E0B]/8",
    text: "text-[#F59E0B]",
    badge: "bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/15",
  },
} as const;

export function PrivateActivity() {
  const [notes, setNotes] = useState<NoteSummary[]>([]);

  useEffect(() => {
    const pool = getPoolNotes()
      .filter((n) => !n.spent)
      .map((n) => ({
        id: n.secret,
        type: "Pool" as const,
        amount: (Number(n.amount) / 1e18).toFixed(4),
        details: "mBTC Deposit",
        status: "Unspent" as const,
      }));

    const amm = getAmmNotes()
      .filter((n) => !n.spent)
      .map((n) => ({
        id: n.secret,
        type: "AMM" as const,
        amount: (Number(n.amount) / 1e18).toFixed(4),
        details: `${n.tokenType === "1" ? "BTC" : "STRK"} LP/Swap`,
        status: "Unspent" as const,
      }));

    const bets = getBetNotes()
      .filter((n) => !n.claimed)
      .map((n) => ({
        id: n.secret,
        type: "Prediction" as const,
        amount: (Number(n.amount) / 1e18).toFixed(4),
        details: `Market #${n.marketId}`,
        status: "Active" as const,
      }));

    setNotes([...pool, ...amm, ...bets]);
  }, []);

  return (
    <div
      className="rounded-2xl bg-[#151B23] border border-white/[0.06] overflow-hidden animate-fade-in-up stagger-5"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
            <ShieldCheck className="h-3.5 w-3.5 text-white/30" strokeWidth={1.5} />
          </div>
          <h3 className="text-[14px] font-semibold text-white">
            Private Activity
          </h3>
        </div>
        <Badge
          variant="outline"
          className="bg-[#8B8CFF]/8 text-[#8B8CFF] border-[#8B8CFF]/15 text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
        >
          {notes.length} Active
        </Badge>
      </div>

      {/* Content */}
      <div className="h-[320px] overflow-y-auto custom-scrollbar">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="h-12 w-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
              <ShieldCheck className="h-5 w-5 text-white/15" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-medium text-white/40">No active private notes</p>
            <p className="text-[11px] text-white/20 mt-1">
              Deposit tokens to create shielded notes
            </p>
          </div>
        ) : (
          <div>
            {notes.map((note, i) => {
              const style = TYPE_STYLES[note.type];
              const Icon = style.icon;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between px-6 py-3.5 border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-xl ${style.bg} flex items-center justify-center`}>
                      <Icon className={`h-4 w-4 ${style.text}`} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium text-white">{note.details}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">{note.type} Note</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[14px] font-bold text-white">
                      {note.amount}{" "}
                      <span className="text-[10px] font-normal text-white/30">tokens</span>
                    </p>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#22C55E]">
                      {note.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
