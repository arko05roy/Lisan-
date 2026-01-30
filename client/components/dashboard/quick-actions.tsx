"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Repeat,
  TrendingUp,
  Vote,
  ChevronRight,
  Lock,
  Eye,
  EyeOff,
  Zap,
  type LucideIcon,
} from "lucide-react";

interface ActionCardProps {
  href: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  whatYouGet: string;
  stagger: string;
}

function ActionCard({
  href,
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  whatYouGet,
  stagger,
}: ActionCardProps) {
  return (
    <Link
      href={href}
      className={`
        group relative rounded-2xl bg-[#151B23] border border-white/[0.06]
        p-5 transition-all duration-300
        hover:-translate-y-0.5 hover:border-white/[0.1]
        hover:bg-[#1A2029]
        animate-fade-in-up ${stagger}
      `}
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
    >
      {/* Top row: icon + arrow */}
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.5} />
        </div>
        <ChevronRight
          className="h-4 w-4 text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all duration-200"
          strokeWidth={1.5}
        />
      </div>

      {/* Title */}
      <h3 className="text-[14px] font-semibold text-white mb-1">{title}</h3>

      {/* Description */}
      <p className="text-[12px] text-white/35 leading-relaxed mb-3">{description}</p>

      {/* What you get */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <Zap className="h-3 w-3 text-[#F59E0B]" strokeWidth={2} />
        <span className="font-medium text-[#F59E0B]/80">{whatYouGet}</span>
      </div>
    </Link>
  );
}

interface QuickActionsProps {
  hasNotes: boolean;
  hasAmmNotes: boolean;
}

export function QuickActions({ hasNotes, hasAmmNotes }: QuickActionsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between animate-fade-in-up stagger-3">
        <div>
          <h2 className="text-[15px] font-semibold text-white">What you can do</h2>
          <p className="text-[11px] text-white/30 mt-0.5">
            Every action uses Poseidon commitments to keep your activity private
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Privacy Actions */}
        <ActionCard
          href="/deposit"
          icon={ArrowDownToLine}
          iconColor="text-[#8B8CFF]"
          iconBg="bg-[#8B8CFF]/10"
          title="Deposit"
          description="Send mBTC or mSTRK into the Shielded Pool or AMM. Your tokens become private — only you hold the secret to unlock them."
          whatYouGet="Creates a private note only you can spend"
          stagger="stagger-3"
        />

        <ActionCard
          href="/transfer"
          icon={ArrowRightLeft}
          iconColor="text-[#22C55E]"
          iconBg="bg-[#22C55E]/10"
          title="Private Transfer"
          description={
            hasNotes
              ? "Split a shielded note into two: send part to someone else while keeping the change. No on-chain trail."
              : "Deposit first to create notes, then privately transfer any amount to another user."
          }
          whatYouGet="Recipient gets secret keys to claim their tokens"
          stagger="stagger-4"
        />

        <ActionCard
          href="/withdraw"
          icon={ArrowUpFromLine}
          iconColor="text-[#EF4444]"
          iconBg="bg-[#EF4444]/10"
          title="Withdraw"
          description={
            hasNotes
              ? "Reveal a shielded note and withdraw tokens to any wallet address. Proves ownership without exposing your history."
              : "Once you have shielded notes from deposits or transfers, withdraw them to any address."
          }
          whatYouGet="Tokens sent to any wallet, note is consumed"
          stagger="stagger-5"
        />

        <ActionCard
          href="/swap"
          icon={Repeat}
          iconColor="text-[#A78BFA]"
          iconBg="bg-[#A78BFA]/10"
          title="Private Swap"
          description={
            hasAmmNotes
              ? "Swap mBTC to mSTRK (or vice versa) inside the Shielded AMM. The swap happens privately using your AMM notes."
              : "Deposit tokens into the AMM first, then swap between mBTC and mSTRK privately."
          }
          whatYouGet="Receive a new shielded note in the other token"
          stagger="stagger-3"
        />

        <ActionCard
          href="/predict"
          icon={TrendingUp}
          iconColor="text-[#F59E0B]"
          iconBg="bg-[#F59E0B]/10"
          title="Prediction Markets"
          description="Create markets, place private bets, and claim winnings. Your bet commitments are hidden until the oracle resolves the market."
          whatYouGet="Win payouts if your prediction is correct"
          stagger="stagger-4"
        />

        <ActionCard
          href="/vote"
          icon={Vote}
          iconColor="text-[#60A5FA]"
          iconBg="bg-[#60A5FA]/10"
          title="Private Voting"
          description="Create proposals and cast votes that remain hidden until tallied. Nullifier hashes prevent double-voting."
          whatYouGet="Vote privately, results revealed only at tally"
          stagger="stagger-5"
        />
      </div>
    </div>
  );
}
