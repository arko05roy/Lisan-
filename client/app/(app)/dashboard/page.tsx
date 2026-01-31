"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { useEffect, useState } from "react";
import { ADDRESSES } from "@/lib/addresses";
import { ERC20_ABI, SHIELDED_POOL_ABI, SHIELDED_AMM_ABI, PREDICTION_MARKET_ABI, PRIVATE_VOTING_ABI } from "@/lib/abis";
import { exportNotes, importNotes, getPoolNotes, getAmmNotes, getBetNotes } from "@/lib/storage";
import { Download, Upload, Wallet, Info } from "lucide-react";

import { ShieldedStats } from "@/components/dashboard/shielded-stats";
import { PrivateActivity } from "@/components/dashboard/private-activity";
import { FaucetModal } from "@/components/dashboard/faucet-modal";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { HowItWorks } from "@/components/dashboard/how-it-works";
import { u256ToBigInt } from "@/lib/utils";

function formatU256(data: unknown): string {
  return u256ToBigInt(data).toString();
}

function formatTokens(data: unknown): string {
  const raw = u256ToBigInt(data);
  const whole = raw / 10n ** 18n;
  const frac = raw % 10n ** 18n;
  if (frac === 0n) return `${whole}.00`;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return `${whole}.${fracStr}`;
}

function hasBalance(data: unknown): boolean {
  return u256ToBigInt(data) > 0n;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [faucetOpen, setFaucetOpen] = useState(false);
  const [hasNotes, setHasNotes] = useState(false);
  const [hasAmmNotes, setHasAmmNotes] = useState(false);

  // Check localStorage for existing notes
  useEffect(() => {
    const pool = getPoolNotes().filter((n) => !n.spent);
    const amm = getAmmNotes().filter((n) => !n.spent);
    const bets = getBetNotes().filter((n) => !n.claimed);
    setHasNotes(pool.length + amm.length + bets.length > 0);
    setHasAmmNotes(amm.length > 0);
  }, []);

  // --- Contract reads ---
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

  const { data: totalDeposited } = useReadContract({
    address: ADDRESSES.SHIELDED_POOL as `0x${string}`,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_total_deposited",
    args: [],
  });

  const { data: commitmentCount } = useReadContract({
    address: ADDRESSES.SHIELDED_POOL as `0x${string}`,
    abi: SHIELDED_POOL_ABI,
    functionName: "get_commitment_count",
    args: [],
  });

  const { data: btcReserve } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "get_btc_reserve",
    args: [],
  });

  const { data: strkReserve } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "get_strk_reserve",
    args: [],
  });

  const { data: marketCount } = useReadContract({
    address: ADDRESSES.PREDICTION_MARKET as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: "get_market_count",
    args: [],
  });

  const { data: proposalCount } = useReadContract({
    address: ADDRESSES.PRIVATE_VOTING as `0x${string}`,
    abi: PRIVATE_VOTING_ABI,
    functionName: "get_proposal_count",
    args: [],
  });

  // --- Derived state ---
  const hasTokens = hasBalance(btcBalance) || hasBalance(strkBalance);
  const showOnboarding = !isConnected || !hasTokens || !hasNotes;

  // --- Handlers ---
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

  return (
    <div className="max-w-[1380px] mx-auto space-y-8 pb-10">
      {/* ─── Header ─── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 animate-fade-in-up stagger-1">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 bg-[#8B8CFF]/8 text-[#8B8CFF] px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold border border-[#8B8CFF]/10">
              Private Bitcoin DeFi
            </span>
            {isConnected && (
              <span className="inline-flex items-center gap-1.5 bg-[#22C55E]/8 text-[#22C55E] px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold border border-[#22C55E]/10">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] pulse-dot" />
                Connected
              </span>
            )}
          </div>
          <h1 className="text-[32px] font-bold tracking-tight text-white leading-none">
            Portfolio
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <FaucetModal
            externalOpen={faucetOpen}
            onExternalOpenChange={setFaucetOpen}
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-all duration-200"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
            Export
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2 text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-all duration-200"
          >
            <Upload className="h-4 w-4" strokeWidth={1.5} />
            Import
          </button>
        </div>
      </div>

      {/* ─── Onboarding (shown until user has completed all steps) ─── */}
      {showOnboarding && (
        <OnboardingBanner
          isConnected={isConnected ?? false}
          hasTokens={hasTokens}
          hasNotes={hasNotes}
          onOpenFaucet={() => setFaucetOpen(true)}
        />
      )}

      {/* ─── Protocol Stats ─── */}
      <ShieldedStats
        totalDeposited={formatTokens(totalDeposited)}
        commitmentCount={formatU256(commitmentCount)}
        btcReserve={formatTokens(btcReserve)}
        strkReserve={formatTokens(strkReserve)}
        marketCount={formatU256(marketCount)}
        proposalCount={formatU256(proposalCount)}
      />

      {/* ─── Bottom Grid: Wallet + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Public Wallet */}
        <div
          className="rounded-2xl bg-[#151B23] border border-white/[0.06] overflow-hidden animate-fade-in-up stagger-5"
          style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
                <Wallet className="h-3.5 w-3.5 text-white/30" strokeWidth={1.5} />
              </div>
              <h3 className="text-[14px] font-semibold text-white">
                Public Balances
              </h3>
            </div>
            <div className="group relative">
              <Info className="h-3.5 w-3.5 text-white/20 cursor-help" strokeWidth={1.5} />
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#1A2029] border border-white/[0.08] p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <p className="text-[11px] text-white/50 leading-relaxed">
                  These are your visible on-chain balances. Deposit them into the Shielded Pool to make them private.
                </p>
              </div>
            </div>
          </div>

          {/* Token Rows */}
          <div className="p-6 space-y-5">
            {/* mBTC */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-[#F7931A]/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#F7931A]">B</span>
                  </div>
                  <span className="text-[13px] font-medium text-white/60">mBTC</span>
                </div>
                <span className="font-mono text-[20px] font-bold text-white tracking-tight">
                  {formatTokens(btcBalance)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full w-3/5 rounded-full bg-[#F7931A]/30" />
              </div>
            </div>

            {/* mSTRK */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#8B8CFF]">S</span>
                  </div>
                  <span className="text-[13px] font-medium text-white/60">mSTRK</span>
                </div>
                <span className="font-mono text-[20px] font-bold text-white tracking-tight">
                  {formatTokens(strkBalance)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full w-2/5 rounded-full bg-[#8B8CFF]/30" />
              </div>
            </div>

            {/* Contextual guidance */}
            {isConnected && !hasTokens && (
              <button
                onClick={() => setFaucetOpen(true)}
                className="w-full rounded-xl bg-[#8B8CFF]/[0.06] border border-[#8B8CFF]/10 px-4 py-3 text-left hover:bg-[#8B8CFF]/[0.1] transition-colors group"
              >
                <p className="text-[12px] font-medium text-[#8B8CFF] group-hover:text-[#8B8CFF]">
                  No tokens yet — tap to open the Faucet
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">
                  Mint free mBTC and mSTRK to start
                </p>
              </button>
            )}
            {isConnected && hasTokens && !hasNotes && (
              <a
                href="/deposit"
                className="block w-full rounded-xl bg-[#22C55E]/[0.06] border border-[#22C55E]/10 px-4 py-3 hover:bg-[#22C55E]/[0.1] transition-colors group"
              >
                <p className="text-[12px] font-medium text-[#22C55E]">
                  You have tokens — deposit to make them private
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">
                  Creates a shielded note only you can spend
                </p>
              </a>
            )}
            {(!isConnected || (hasTokens && hasNotes)) && (
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-4 py-3">
                <p className="text-[11px] text-white/30 leading-relaxed">
                  {!isConnected
                    ? "Connect your wallet to see your token balances and start using private DeFi."
                    : "These funds are visible on-chain. Deposit into the Shielded Pool to make them private."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Private Activity */}
        <div className="lg:col-span-2">
          <PrivateActivity />
        </div>
      </div>

      {/* ─── Quick Actions: What you can do ─── */}
      <QuickActions hasNotes={hasNotes} hasAmmNotes={hasAmmNotes} />

      {/* ─── How it works ─── */}
      <HowItWorks />
    </div>
  );
}
