"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { useState } from "react";
import Link from "next/link";
import { ADDRESSES } from "@/lib/addresses";
import { ERC20_ABI } from "@/lib/abis";
import { exportNotes, importNotes, getPoolNotes } from "@/lib/storage";
import {
  Download,
  Upload,
  Shield,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Send,
  ArrowDownToLine,
  Droplets,
} from "lucide-react";
import { FaucetModal } from "@/components/dashboard/faucet-modal";
import { u256ToBigInt } from "@/lib/utils";

function formatTokens(data: unknown): string {
  const raw = u256ToBigInt(data);
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  if (frac === 0n) return `${whole}.00`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole}.${fracStr}`;
}

const WALLET_ACTIONS = [
  { label: "Shield", icon: Shield, href: "/deposit" },
  { label: "Swap", icon: ArrowRightLeft, href: "/swap" },
  { label: "Send", icon: Send, href: "/transfer" },
  { label: "Withdraw", icon: ArrowDownToLine, href: "/withdraw" },
];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"shielded" | "public">("shielded");
  const [hideBalances, setHideBalances] = useState(false);

  const poolNotes = typeof window !== "undefined" ? getPoolNotes().filter((n) => !n.spent) : [];

  const { data: btcBalance } = useReadContract({
    address: ADDRESSES.MOCK_BTC as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
  });

  const { data: strkBalance } = useReadContract({
    address: ADDRESSES.MOCK_STRK as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balance_of",
    args: address ? [address] : undefined,
    enabled: !!address,
  });

  const btcBalanceNum = parseFloat(formatTokens(btcBalance));
  const strkBalanceNum = parseFloat(formatTokens(strkBalance));

  const shieldedTotal = poolNotes.reduce((acc, note) => {
    const amount = Number(BigInt(note.amount)) / 10 ** 18;
    return acc + amount;
  }, 0);

  function handleExport() {
    const json = exportNotes();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lisan-notes-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      importNotes(text);
      window.location.reload();
    };
    input.click();
  }

  const getTokenLabel = (tokenAddress: string) => {
    if (tokenAddress === ADDRESSES.MOCK_BTC) return "mBTC";
    if (tokenAddress === ADDRESSES.MOCK_STRK) return "mSTRK";
    if (tokenAddress === ADDRESSES.DEMO_TOKEN) return "DEMO";
    return tokenAddress.slice(0, 8) + "...";
  };

  const getTokenIcon = (tokenAddress: string) => {
    if (tokenAddress === ADDRESSES.MOCK_BTC) return { letter: "₿", color: "text-[#F7931A]", bg: "bg-[#F7931A]/10" };
    if (tokenAddress === ADDRESSES.MOCK_STRK) return { letter: "S", color: "text-[#8B8CFF]", bg: "bg-[#8B8CFF]/10" };
    return { letter: "?", color: "text-white/60", bg: "bg-white/10" };
  };

  return (
    <div className="max-w-[520px] mx-auto pb-16">
      {/* ── Balance ── */}
      <div className="text-center pt-4 pb-2 animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-1">
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            {hideBalances ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <div className="text-[42px] font-bold text-white tracking-tight leading-none mb-1">
          {hideBalances ? "••••••" : `${shieldedTotal.toFixed(4)}`}
        </div>
        <div className="text-sm text-white/40 font-medium">
          {poolNotes.length} shielded note{poolNotes.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Action Buttons (MetaMask-style) ── */}
      <div className="flex items-center justify-center gap-6 py-6 animate-fade-in-up stagger-1">
        {WALLET_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#1A1D23] border border-white/[0.06] group-hover:border-[#8B8CFF]/40 group-hover:bg-[#8B8CFF]/10 transition-all duration-200">
                <Icon className="h-5 w-5 text-white/70 group-hover:text-[#8B8CFF] transition-colors" strokeWidth={1.8} />
              </div>
              <span className="text-[11px] font-semibold text-white/50 group-hover:text-white/80 transition-colors">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ── Utility Row (small) ── */}
      <div className="flex items-center justify-center gap-2 pb-5 animate-fade-in-up stagger-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] text-[11px] font-medium transition-all"
        >
          <Download className="h-3 w-3" />
          Export
        </button>
        <button
          onClick={handleImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] text-[11px] font-medium transition-all"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
        <FaucetModal externalOpen={faucetOpen} onExternalOpenChange={setFaucetOpen} />
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-6 border-b border-white/[0.06] mb-1 animate-fade-in-up stagger-2">
        <button
          onClick={() => setActiveTab("shielded")}
          className={`pb-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === "shielded" ? "text-[#8B8CFF]" : "text-white/35 hover:text-white/55"
          }`}
        >
          Shielded
          {activeTab === "shielded" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />}
        </button>
        <button
          onClick={() => setActiveTab("public")}
          className={`pb-3 text-[13px] font-semibold transition-colors relative ${
            activeTab === "public" ? "text-[#8B8CFF]" : "text-white/35 hover:text-white/55"
          }`}
        >
          Public
          {activeTab === "public" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />}
        </button>
      </div>

      {/* ── Shielded Token List ── */}
      {activeTab === "shielded" && (
        <div className="animate-fade-in-up">
          {poolNotes.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#8B8CFF]/10 mb-4">
                <Shield className="h-6 w-6 text-[#8B8CFF]" strokeWidth={1.8} />
              </div>
              <p className="text-[13px] text-white/40 mb-5">No shielded tokens yet</p>
              <Link
                href="/deposit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white text-sm font-semibold transition-all"
              >
                <Shield className="h-4 w-4" strokeWidth={2} />
                Shield Your First Tokens
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {poolNotes.map((note) => {
                const tokenInfo = getTokenIcon(note.tokenAddress);
                const amount = (Number(BigInt(note.amount)) / 10 ** 18).toFixed(4);
                return (
                  <div
                    key={note.commitment}
                    className="flex items-center justify-between px-2 py-3.5 hover:bg-white/[0.02] transition-colors rounded-lg cursor-default"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full ${tokenInfo.bg} flex items-center justify-center`}>
                        <span className={`text-sm font-bold ${tokenInfo.color}`}>{tokenInfo.letter}</span>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-white">{getTokenLabel(note.tokenAddress)}</div>
                        <div className="text-[11px] text-white/30">Shielded</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-mono font-semibold text-white">
                        {hideBalances ? "•••" : amount}
                      </div>
                      <div className="text-[11px] text-[#8B8CFF]/60">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Public Token List ── */}
      {activeTab === "public" && (
        <div className="divide-y divide-white/[0.04] animate-fade-in-up">
          {/* mBTC */}
          <div className="flex items-center justify-between px-2 py-3.5 hover:bg-white/[0.02] transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F7931A]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[#F7931A]">₿</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">mBTC</div>
                <div className="text-[11px] text-white/30">Mock Bitcoin</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-mono font-semibold text-white">
                {hideBalances ? "•••" : formatTokens(btcBalance)}
              </div>
              <div className="text-[11px] text-white/30">
                {hideBalances ? "•••" : `$${(btcBalanceNum * 42000).toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* mSTRK */}
          <div className="flex items-center justify-between px-2 py-3.5 hover:bg-white/[0.02] transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[#8B8CFF]">S</span>
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white">mSTRK</div>
                <div className="text-[11px] text-white/30">Mock Starknet</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-mono font-semibold text-white">
                {hideBalances ? "•••" : formatTokens(strkBalance)}
              </div>
              <div className="text-[11px] text-white/30">
                {hideBalances ? "•••" : `$${(strkBalanceNum * 1.5).toFixed(2)}`}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
