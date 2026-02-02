"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ADDRESSES } from "@/lib/addresses";
import { ERC20_ABI } from "@/lib/abis";
import { exportNotes, importNotes, getPoolNotes } from "@/lib/storage";
import {
  Download,
  Upload,
  Shield,
  ArrowRightLeft,
  Zap,
  TrendingUp,
  Eye,
  EyeOff,
  Send
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

const QUICK_ACTIONS = [
  { label: "Deposit", icon: Shield, href: "/deposit", variant: "default" as const },
  { label: "Swap", icon: ArrowRightLeft, href: "/swap", variant: "default" as const },
  { label: "Execute", icon: Zap, href: "/execute", variant: "primary" as const },
  { label: "Send", icon: Send, href: "/transfer", variant: "default" as const },
];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"public" | "shielded">("public");
  const [hideBalances, setHideBalances] = useState(false);

  const poolNotes = typeof window !== "undefined" ? getPoolNotes().filter((n) => !n.spent) : [];

  // Contract reads
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

  // Calculate totals
  const btcBalanceNum = parseFloat(formatTokens(btcBalance));
  const strkBalanceNum = parseFloat(formatTokens(strkBalance));
  const totalValue = ((btcBalanceNum * 42000) + (strkBalanceNum * 1.5)).toFixed(2);

  // Calculate shielded total
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

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-16">
      {/* Quick Actions */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={
                action.variant === "primary"
                  ? "flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0B0F] hover:bg-[#0D0E13] border border-white/[0.08] text-white font-semibold text-sm transition-all duration-200"
                  : "flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A0B0F] hover:bg-[#0D0E13] border border-white/[0.08] text-white font-semibold text-sm transition-all duration-200"
              }
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {action.label}
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0B0F] hover:bg-[#0D0E13] border border-white/[0.08] text-white/60 hover:text-white text-sm font-semibold transition-all duration-200"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            Export
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0B0F] hover:bg-[#0D0E13] border border-white/[0.08] text-white/60 hover:text-white text-sm font-semibold transition-all duration-200"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Import
          </button>
          <FaucetModal externalOpen={faucetOpen} onExternalOpenChange={setFaucetOpen} />
        </div>
      </div>

      {/* Main Balance Section */}
      <div className="animate-fade-in-up stagger-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Total Balance</h2>
          <button
            onClick={() => setHideBalances(!hideBalances)}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            {hideBalances ? (
              <Eye className="h-4 w-4" strokeWidth={2} />
            ) : (
              <EyeOff className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>

        <div className="mb-6">
          <div className="text-5xl font-bold text-white mb-2">
            {hideBalances ? "••••••" : `$${totalValue}`}
          </div>
          <div className="text-sm text-[#22C55E] font-medium">
            +$0.00 (+0.00%)
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-white/[0.06] mb-6">
          <button
            onClick={() => setActiveTab("public")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              activeTab === "public"
                ? "text-[#8B8CFF]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Public Tokens
            {activeTab === "public" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("shielded")}
            className={`pb-3 text-sm font-semibold transition-colors relative ${
              activeTab === "shielded"
                ? "text-[#8B8CFF]"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Shielded Notes
            {activeTab === "shielded" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B8CFF]" />
            )}
          </button>
          <button className="pb-3 text-sm font-semibold text-white/40 hover:text-white/60 transition-colors">
            Activity
          </button>
        </div>

        {/* Token List */}
        {activeTab === "public" && (
          <div>
            {/* Table Header */}
            <div className="grid grid-cols-4 gap-4 px-4 py-3 text-sm font-semibold text-white/40 border-b border-white/[0.04]">
              <div>Token</div>
              <div className="text-right">Portfolio %</div>
              <div className="text-right">Price (24hr)</div>
              <div className="text-right">Balance</div>
            </div>

            {/* Token Rows */}
            <div className="divide-y divide-white/[0.04]">
              {/* mBTC */}
              <div className="grid grid-cols-4 gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#F7931A]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#F7931A]">₿</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">mBTC</div>
                    <div className="text-xs text-white/40">Mock Bitcoin</div>
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-white self-center">
                  {btcBalanceNum > 0 ? "60%" : "0%"}
                </div>
                <div className="text-right self-center">
                  <div className="text-sm font-semibold text-white">$42,000</div>
                  <div className="text-xs text-[#22C55E]">+0.5%</div>
                </div>
                <div className="text-right self-center">
                  <div className="text-sm font-semibold text-white">
                    {hideBalances ? "•••" : formatTokens(btcBalance)}
                  </div>
                  <div className="text-xs text-white/40">
                    {hideBalances ? "•••" : `$${(btcBalanceNum * 42000).toFixed(2)}`}
                  </div>
                </div>
              </div>

              {/* mSTRK */}
              <div className="grid grid-cols-4 gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-[#8B8CFF]">S</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">mSTRK</div>
                    <div className="text-xs text-white/40">Mock Starknet</div>
                  </div>
                </div>
                <div className="text-right text-sm font-semibold text-white self-center">
                  {strkBalanceNum > 0 ? "40%" : "0%"}
                </div>
                <div className="text-right self-center">
                  <div className="text-sm font-semibold text-white">$1.50</div>
                  <div className="text-xs text-[#22C55E]">+0.2%</div>
                </div>
                <div className="text-right self-center">
                  <div className="text-sm font-semibold text-white">
                    {hideBalances ? "•••" : formatTokens(strkBalance)}
                  </div>
                  <div className="text-xs text-white/40">
                    {hideBalances ? "•••" : `$${(strkBalanceNum * 1.5).toFixed(2)}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "shielded" && (
          <div>
            {poolNotes.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#8B8CFF]/10 mb-4">
                  <Shield className="h-8 w-8 text-[#8B8CFF]" strokeWidth={2} />
                </div>
                <p className="text-white/60 mb-4">No shielded notes yet</p>
                <Link
                  href="/deposit"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#8B8CFF] hover:bg-[#7B7CFF] text-white font-semibold transition-all"
                >
                  <Shield className="h-4 w-4" strokeWidth={2} />
                  Create Shielded Note
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {poolNotes.map((note) => (
                  <div
                    key={note.commitment}
                    className="grid grid-cols-4 gap-4 px-4 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-[#8B8CFF]" strokeWidth={2} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {getTokenLabel(note.tokenAddress)}
                        </div>
                        <div className="text-xs text-white/40">Shielded</div>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold text-[#8B8CFF] self-center">
                      Private
                    </div>
                    <div className="text-right self-center">
                      <div className="text-xs text-white/40">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right self-center">
                      <div className="text-sm font-mono font-semibold text-white">
                        {hideBalances ? "•••" : (Number(BigInt(note.amount)) / 10 ** 18).toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
