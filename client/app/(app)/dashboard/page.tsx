"use client";

import { useAccount, useReadContract } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { ERC20_ABI, SHIELDED_POOL_ABI, SHIELDED_AMM_ABI, PREDICTION_MARKET_ABI, PRIVATE_VOTING_ABI } from "@/lib/abis";
import { getPoolNotes, getAmmNotes, getBetNotes, getVoteNotes, exportNotes, importNotes } from "@/lib/storage";
import { MintTokens } from "@/components/mint-tokens";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowDownToLine, Repeat, TrendingUp, Vote, Download, Upload } from "lucide-react";

function formatU256(data: unknown): string {
  if (!data) return "0";
  try {
    return BigInt(data as string | number | bigint).toString();
  } catch {
    return "0";
  }
}

function formatTokens(data: unknown): string {
  if (!data) return "0";
  try {
    const raw = BigInt(data as string | number | bigint);
    const whole = raw / 10n ** 18n;
    const frac = raw % 10n ** 18n;
    if (frac === 0n) return whole.toString();
    const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
    return `${whole}.${fracStr}`;
  } catch {
    return "0";
  }
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

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

  const [poolNoteCount, setPoolNoteCount] = useState(0);
  const [ammNoteCount, setAmmNoteCount] = useState(0);
  const [betNoteCount, setBetNoteCount] = useState(0);
  const [voteNoteCount, setVoteNoteCount] = useState(0);

  useEffect(() => {
    setPoolNoteCount(getPoolNotes().filter((n) => !n.spent).length);
    setAmmNoteCount(getAmmNotes().filter((n) => !n.spent).length);
    setBetNoteCount(getBetNotes().filter((n) => !n.claimed).length);
    setVoteNoteCount(getVoteNotes().length);
  }, []);

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {isConnected ? "Overview of your private DeFi activity" : "Connect your wallet to get started"}
        </p>
      </div>

      {/* Wallet Balances */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">mBTC Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokens(btcBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">mSTRK Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokens(strkBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pool Total Deposited</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokens(totalDeposited)}</p>
            <p className="text-xs text-muted-foreground">{formatU256(commitmentCount)} commitments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AMM Reserves</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">BTC: {formatTokens(btcReserve)}</p>
            <p className="text-sm">STRK: {formatTokens(strkReserve)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Local Notes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pool Notes (unspent)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{poolNoteCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">AMM Notes (unspent)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{ammNoteCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bet Notes (unclaimed)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{betNoteCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vote Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{voteNoteCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* On-chain Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prediction Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatU256(marketCount)}</p>
            <p className="text-xs text-muted-foreground">active markets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Governance Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatU256(proposalCount)}</p>
            <p className="text-xs text-muted-foreground">total proposals</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/deposit">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 p-4">
              <ArrowDownToLine className="h-5 w-5 text-primary" />
              <span className="font-medium">Deposit</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/swap">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 p-4">
              <Repeat className="h-5 w-5 text-primary" />
              <span className="font-medium">Swap</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/predict">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 p-4">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-medium">Predict</span>
            </CardContent>
          </Card>
        </Link>
        <Link href="/vote">
          <Card className="cursor-pointer transition-colors hover:bg-accent/50">
            <CardContent className="flex items-center gap-3 p-4">
              <Vote className="h-5 w-5 text-primary" />
              <span className="font-medium">Vote</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Backup / Restore + Faucet */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Notes Backup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Your secrets are stored in localStorage only. Export regularly to avoid losing funds.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button size="sm" variant="outline" onClick={handleImport}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            </div>
          </CardContent>
        </Card>
        <MintTokens />
      </div>
    </div>
  );
}
