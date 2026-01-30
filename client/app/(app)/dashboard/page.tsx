"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { ADDRESSES } from "@/lib/addresses";
import { ERC20_ABI, SHIELDED_POOL_ABI, SHIELDED_AMM_ABI, PREDICTION_MARKET_ABI, PRIVATE_VOTING_ABI } from "@/lib/abis";
import { exportNotes, importNotes } from "@/lib/storage";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// New Components
import { ShieldedStats } from "@/components/dashboard/shielded-stats";
import { PrivateActivity } from "@/components/dashboard/private-activity";
import { FaucetModal } from "@/components/dashboard/faucet-modal";

function formatU256(data: unknown): string {
  if (!data) return "0";
  try {
    return BigInt(data as string | number | bigint).toString();
  } catch {
    return "0";
  }
}

function formatTokens(data: unknown): string {
  if (!data) return "0.00";
  try {
    const raw = BigInt(data as string | number | bigint);
    const whole = raw / 10n ** 18n;
    const frac = raw % 10n ** 18n;
    if (frac === 0n) return `${whole}.00`;
    const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
    return `${whole}.${fracStr}`;
  } catch {
    return "0.00";
  }
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  // --- DATA FETCHING ---
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
    <div className="space-y-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold">Private Bitcoin DeFi</span>
            {isConnected && <span className="bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold">Connected</span>}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        </div>

        <div className="flex gap-2">
          <FaucetModal />
          <Button variant="outline" size="sm" onClick={handleExport} className="border-white/10 bg-white/5 hover:bg-white/10">
            <Download className="mr-2 h-4 w-4" /> Export Keys
          </Button>
          <Button variant="outline" size="sm" onClick={handleImport} className="border-white/10 bg-white/5 hover:bg-white/10">
            <Upload className="mr-2 h-4 w-4" /> Import Keys
          </Button>
        </div>
      </div>

      {/* 1. Shielded Statistics (TVL, Reserves, Counts) */}
      <ShieldedStats
        totalDeposited={formatTokens(totalDeposited)}
        commitmentCount={formatU256(commitmentCount)}
        btcReserve={formatTokens(btcReserve)}
        strkReserve={formatTokens(strkReserve)}
        marketCount={formatU256(marketCount)}
        proposalCount={formatU256(proposalCount)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Public Balances (Transparent) - Smaller column */}
        <div className="space-y-6">
          <Card className="bg-card border-none shadow-lg">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">Public Wallet Balances</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="font-medium">mBTC</span>
                <span className="font-mono text-xl">{formatTokens(btcBalance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">mSTRK</span>
                <span className="font-mono text-xl">{formatTokens(strkBalance)}</span>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                These funds are visible on Starkscan. Deposit to Shielded Pool to make them private.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 3. Private Activity (Notes) - Wider column */}
        <div className="lg:col-span-2">
          <PrivateActivity />
        </div>
      </div>
    </div>
  );
}

