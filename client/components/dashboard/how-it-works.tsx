"use client";

import { Lock, Eye, EyeOff, KeyRound } from "lucide-react";

export function HowItWorks() {
  return (
    <div className="rounded-2xl bg-[#151B23] border border-white/[0.06] p-6 animate-fade-in-up stagger-6"
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
    >
      <h3 className="text-[14px] font-semibold text-white mb-1">How Lisan privacy works</h3>
      <p className="text-[11px] text-white/30 mb-5">
        Your tokens are shielded using Poseidon hash commitments on Starknet
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StepBlock
          step={1}
          icon={<Eye className="h-4 w-4" strokeWidth={1.5} />}
          title="Public tokens"
          desc="mBTC and mSTRK sit in your wallet, visible to anyone on Starkscan"
        />
        <StepBlock
          step={2}
          icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
          title="Deposit & shield"
          desc="Tokens are locked in a contract. You receive a private note with a secret key"
        />
        <StepBlock
          step={3}
          icon={<EyeOff className="h-4 w-4" strokeWidth={1.5} />}
          title="Use privately"
          desc="Transfer, swap, bet, or vote — all actions use commitments, not your address"
        />
        <StepBlock
          step={4}
          icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} />}
          title="Withdraw anytime"
          desc="Prove ownership with your secret key to withdraw tokens to any wallet"
        />
      </div>
    </div>
  );
}

function StepBlock({
  step,
  icon,
  title,
  desc,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative">
      {/* Connector line (hidden on first, shown on md+) */}
      {step > 1 && (
        <div className="hidden md:block absolute -left-2 top-5 w-4 h-px bg-white/[0.08]" />
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#8B8CFF]/10 text-[10px] font-bold text-[#8B8CFF]">
          {step}
        </span>
        <div className="text-white/30">{icon}</div>
      </div>
      <h4 className="text-[12px] font-semibold text-white/70 mb-1">{title}</h4>
      <p className="text-[11px] text-white/25 leading-relaxed">{desc}</p>
    </div>
  );
}
