"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADDRESSES } from "@/lib/addresses";
import { PREDICTION_MARKET_ABI } from "@/lib/abis";
import { generateSecret, computeBetCommitment } from "@/lib/crypto";
import { addNote, getBetNotes, markBetNoteClaimed, BetNote, addMarket, getMarket } from "@/lib/storage";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256, hash } from "starknet";
import { generateBetClaimProof } from "@/lib/prover";
import { relayClaimBet, getRelayTxStatus } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl, formatFee } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";
import { u256ToBigInt } from "@/lib/utils";

const PM_ARGS = {
  address: ADDRESSES.PREDICTION_MARKET as `0x${string}`,
  abi: PREDICTION_MARKET_ABI,
};

function toBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === 1 || v === 1n) return true;
  if (v === "1" || v === "0x1") return true;
  return false;
}

function formatPool(v: unknown): string {
  return (u256ToBigInt(v) / 10n ** 18n).toString();
}

function timeUntil(ts: number): string {
  const diff = ts - Date.now();
  if (diff <= 0) return "Expired";
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/* ─── Market Card (Kalshi-style) ─────────────────────────────── */

function MarketCard({
  marketId,
  onPlaceBet,
  onResolve,
  loading,
}: {
  marketId: number;
  onPlaceBet: (marketId: number, outcome: string, amount: string) => Promise<void>;
  onResolve: (marketId: number) => Promise<void>;
  loading: boolean;
}) {
  const [betAmount, setBetAmount] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Get market question from storage, with fallback examples
  const marketMetadata = getMarket(marketId);
  const defaultQuestions = [
    "Will BTC reach $100k by March 2026?",
    "Will STRK hit $5 by Q2 2026?",
    "Will Ethereum L2 TVL exceed $50B by end of year?",
    "Will Starknet process 10M+ transactions in a single day?",
    "Will a new L2 launch with 100k+ users in Q1 2026?",
  ];
  const question = marketMetadata?.question || defaultQuestions[marketId % defaultQuestions.length] || `Market #${marketId}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = [marketId.toString()] as any;
  const { data: numOutcomes } = useReadContract({ ...PM_ARGS, functionName: "get_market_num_outcomes", args });
  const { data: resolutionTime } = useReadContract({ ...PM_ARGS, functionName: "get_market_resolution_time", args });
  const { data: totalPool } = useReadContract({ ...PM_ARGS, functionName: "get_market_total_pool", args });
  const { data: betCount } = useReadContract({ ...PM_ARGS, functionName: "get_market_bet_count", args });
  const { data: isResolved } = useReadContract({ ...PM_ARGS, functionName: "is_market_resolved", args });
  const { data: winningOutcome } = useReadContract({ ...PM_ARGS, functionName: "get_winning_outcome", args });

  const outcomes = numOutcomes ? Number(numOutcomes) : 0;
  const pool = formatPool(totalPool);
  const bets = betCount ? Number(betCount) : 0;
  const resolved = toBool(isResolved);
  const resTime = resolutionTime ? Number(resolutionTime) * 1000 : 0;
  // eslint-disable-next-line react-hooks/purity
  const isExpired = resTime > 0 && resTime < Date.now();
  const isBinary = outcomes === 2;
  const canResolve = isExpired && !resolved;

  async function handleBet() {
    if (selectedOutcome === null || !betAmount) return;
    await onPlaceBet(marketId, selectedOutcome, betAmount);
    setBetAmount("");
    setSelectedOutcome(null);
    setExpanded(false);
  }

  if (!numOutcomes && numOutcomes !== 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#151B23] p-6 animate-pulse">
        <div className="h-4 w-32 bg-white/[0.06] rounded" />
        <div className="h-3 w-20 bg-white/[0.06] rounded mt-3" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-[#151B23] overflow-hidden transition-all ${resolved
          ? "border-green-500/20"
          : canResolve
            ? "border-yellow-500/20"
            : "border-white/[0.06] hover:border-white/[0.12]"
        }`}
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
    >
      {/* Card Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                Market #{marketId}
              </span>
              {resolved ? (
                <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                  Resolved
                </Badge>
              ) : canResolve ? (
                <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0">
                  Awaiting Resolution
                </Badge>
              ) : (
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-[10px] px-1.5 py-0">
                  Live
                </Badge>
              )}
            </div>
            <h3 className="text-[15px] font-semibold text-white leading-tight">
              {question}
            </h3>
          </div>

          {/* Timer / Status */}
          <div className="text-right shrink-0">
            {resolved ? (
              <div className="text-center">
                <p className="text-[10px] text-white/30 uppercase">Winner</p>
                <p className="text-lg font-black mt-0.5">
                  {isBinary ? (
                    winningOutcome?.toString() === "0" ? (
                      <span className="text-green-400">YES</span>
                    ) : (
                      <span className="text-red-400">NO</span>
                    )
                  ) : (
                    <span className="text-[#8B8CFF]">#{winningOutcome?.toString()}</span>
                  )}
                </p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-[10px] text-white/30 uppercase">
                  {isExpired ? "Ended" : "Ends in"}
                </p>
                <p className={`text-sm font-bold mt-0.5 ${isExpired ? "text-yellow-400" : "text-white/70"}`}>
                  {resTime > 0 ? timeUntil(resTime) : "..."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#F7931A]" />
            <span className="text-[12px] text-white/50">
              <span className="font-semibold text-white/80">{pool}</span> mBTC pool
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#8B8CFF]" />
            <span className="text-[12px] text-white/50">
              <span className="font-semibold text-white/80">{bets}</span> bets
            </span>
          </div>
          {resTime > 0 && !isExpired && (
            <span className="text-[11px] text-white/30 ml-auto">
              {new Date(resTime).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
              {new Date(resTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Outcome buttons (always visible for active markets) */}
      {!resolved && (
        <div className="px-5 pb-4">
          {isBinary ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setSelectedOutcome("0"); setExpanded(true); }}
                className={`rounded-xl border-2 py-3 px-4 text-center transition-all ${selectedOutcome === "0"
                    ? "border-green-500 bg-green-500/10"
                    : "border-white/[0.06] hover:border-green-500/40 bg-white/[0.02]"
                  }`}
              >
                <p className={`text-xl font-black ${selectedOutcome === "0" ? "text-green-400" : "text-green-500/60"}`}>
                  YES
                </p>
              </button>
              <button
                onClick={() => { setSelectedOutcome("1"); setExpanded(true); }}
                className={`rounded-xl border-2 py-3 px-4 text-center transition-all ${selectedOutcome === "1"
                    ? "border-red-500 bg-red-500/10"
                    : "border-white/[0.06] hover:border-red-500/40 bg-white/[0.02]"
                  }`}
              >
                <p className={`text-xl font-black ${selectedOutcome === "1" ? "text-red-400" : "text-red-500/60"}`}>
                  NO
                </p>
              </button>
            </div>
          ) : outcomes > 0 ? (
            <div className={`grid gap-2 ${outcomes <= 4 ? `grid-cols-${outcomes}` : "grid-cols-3"}`}>
              {Array.from({ length: outcomes }, (_, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedOutcome(i.toString()); setExpanded(true); }}
                  className={`rounded-xl border-2 py-2.5 px-3 text-center transition-all ${selectedOutcome === i.toString()
                      ? "border-[#8B8CFF] bg-[#8B8CFF]/10"
                      : "border-white/[0.06] hover:border-[#8B8CFF]/40 bg-white/[0.02]"
                    }`}
                >
                  <p className={`text-sm font-bold ${selectedOutcome === i.toString() ? "text-[#8B8CFF]" : "text-white/50"}`}>
                    Option {i}
                  </p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Expanded bet form */}
      {expanded && selectedOutcome !== null && !resolved && (
        <div className="border-t border-white/[0.04] bg-white/[0.02] px-5 py-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Input
                type="number"
                placeholder="Amount (mBTC)"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08]"
              />
            </div>
            <Button
              disabled={loading || !betAmount}
              onClick={handleBet}
              className="shrink-0"
            >
              {loading ? "..." : "Place Bet"}
            </Button>
          </div>

          {betAmount && Number(betAmount) > 0 && (
            <div className="flex items-center justify-between text-[12px] text-white/40 px-1">
              <span>
                Position: <span className="text-white/70 font-medium">
                  {isBinary ? (selectedOutcome === "0" ? "YES" : "NO") : `Option ${selectedOutcome}`}
                </span>
              </span>
              <span>
                Potential payout: <span className="text-green-400 font-semibold">
                  {(Number(betAmount) * outcomes).toString()} mBTC
                </span>
              </span>
            </div>
          )}

          <p className="text-[10px] text-white/25 text-center">
            ZK-protected — copycats can&apos;t see your position until settlement
          </p>
        </div>
      )}

      {/* Resolve button for expired markets */}
      {canResolve && (
        <div className="border-t border-white/[0.04] px-5 py-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
            disabled={loading}
            onClick={() => onResolve(marketId)}
          >
            {loading ? "Resolving..." : `Resolve Market #${marketId}`}
          </Button>
        </div>
      )}

      {/* Resolved outcome banner */}
      {resolved && (
        <div className="border-t border-green-500/10 bg-green-500/[0.03] px-5 py-3 text-center">
          <p className="text-[11px] text-green-400/60">
            Market settled — check My Bets to claim winnings
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Bet Card (My Bets tab) ──────────────────────────────────── */

function BetCard({
  note,
  selected,
  onSelect,
}: {
  note: BetNote;
  selected: boolean;
  onSelect: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = [note.marketId.toString()] as any;
  const { data: isResolved } = useReadContract({ ...PM_ARGS, functionName: "is_market_resolved", args });
  const { data: winningOutcome } = useReadContract({ ...PM_ARGS, functionName: "get_winning_outcome", args });
  const { data: numOutcomes } = useReadContract({ ...PM_ARGS, functionName: "get_market_num_outcomes", args });

  const resolved = toBool(isResolved);
  const won = resolved && winningOutcome?.toString() === note.outcome;
  const lost = resolved && winningOutcome?.toString() !== note.outcome;
  const isBinary = numOutcomes ? Number(numOutcomes) === 2 : false;
  const amtTokens = BigInt(note.amount) / 10n ** 18n;
  const outcomes = numOutcomes ? Number(numOutcomes) : 2;
  const potentialPayout = amtTokens * BigInt(outcomes);

  const outcomeLabel = isBinary
    ? note.outcome === "0" ? "YES" : "NO"
    : `Outcome ${note.outcome}`;

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-all ${selected
          ? "border-[#8B8CFF] bg-[#8B8CFF]/5"
          : won
            ? "border-green-500/30 hover:border-green-500/50"
            : lost
              ? "border-red-500/20 opacity-60"
              : "border-white/[0.06] hover:border-white/[0.12]"
        }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-white/80">Market #{note.marketId}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge
              variant="outline"
              className={
                isBinary && note.outcome === "0"
                  ? "border-green-500/50 text-green-400 text-[10px]"
                  : isBinary && note.outcome === "1"
                    ? "border-red-500/50 text-red-400 text-[10px]"
                    : "text-[10px]"
              }
            >
              {outcomeLabel}
            </Badge>
            {won && <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[10px]">Won</Badge>}
            {lost && <Badge className="bg-red-900/20 text-red-400 border-red-500/30 text-[10px]">Lost</Badge>}
            {!resolved && <Badge variant="outline" className="text-[10px]">Pending</Badge>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-white">{amtTokens.toString()} mBTC</p>
          {won && (
            <p className="text-[11px] text-green-400 mt-0.5">
              Win: {potentialPayout.toString()} mBTC
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function PredictPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  // Create market
  const [question, setQuestion] = useState("");
  const [numOutcomes, setNumOutcomes] = useState("2");
  const [resolutionMinutes, setResolutionMinutes] = useState("60");

  // Oracle admin
  const [oracleMarketId, setOracleMarketId] = useState("");
  const [oracleOutcome, setOracleOutcome] = useState("");

  // My Bets
  const [betNotes, setBetNotes] = useState<BetNote[]>([]);
  const [selectedBetIdx, setSelectedBetIdx] = useState<number | null>(null);
  const [claimRecipient, setClaimRecipient] = useState("");

  // General
  const [loading, setLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

  const { data: marketCount, refetch: refetchCount } = useReadContract({
    ...PM_ARGS,
    functionName: "get_market_count",
    args: [],
  });

  const totalMarkets = marketCount ? Number(marketCount) : 0;

  useEffect(() => {
    setBetNotes(getBetNotes().filter((n) => !n.claimed));
  }, []);

  const pollTxStatus = useCallback(async (txHash: string) => {
    setTxStatus("PENDING");
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const { status } = await getRelayTxStatus(relayerUrl, txHash);
        setTxStatus(status);
        if (status === "ACCEPTED_ON_L2" || status === "REJECTED") return status;
      } catch {
        // keep polling
      }
    }
    return "PENDING";
  }, [relayerUrl]);

  /* ── Actions ──────────────────────────────────────────────── */

  async function createMarket() {
    if (!address || !question || !numOutcomes || !resolutionMinutes) return;
    setLoading(true);
    try {
      const questionHash = hash.computePoseidonHashOnElements(
        Array.from(new TextEncoder().encode(question)).map((b) => b.toString()),
      );
      const resolutionTime = Math.floor(Date.now() / 1000) + parseInt(resolutionMinutes) * 60;

      // Get current market count to know the new market ID
      const currentCount = marketCount ? Number(marketCount) : 0;

      const result = await sendAsync([
        buildCall(ADDRESSES.PREDICTION_MARKET, "create_market", [
          questionHash,
          numOutcomes,
          resolutionTime.toString(),
        ]),
      ]);

      // Store market metadata locally
      addMarket({
        marketId: currentCount,
        question: question,
        createdAt: Date.now(),
      });

      txToast(result.transaction_hash).success();
      setQuestion("");
      refetchCount();
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to create market");
    } finally {
      setLoading(false);
    }
  }

  async function placeBet(marketId: number, outcome: string, amount: string) {
    if (!address) return;
    setLoading(true);
    try {
      const amountWei = BigInt(amount) * 10n ** 18n;
      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const amountFelt = amountWei.toString();
      const betCommitment = await computeBetCommitment(outcome, amountFelt, secret, nullifierSecret);

      const u = uint256.bnToUint256(amountWei);
      const calls = [
        buildApproveCall(ADDRESSES.MOCK_BTC, ADDRESSES.PREDICTION_MARKET, amountWei),
        buildCall(ADDRESSES.PREDICTION_MARKET, "place_bet", [
          marketId.toString(),
          betCommitment,
          u.low.toString(),
          u.high.toString(),
        ]),
      ];

      const result = await sendAsync(calls);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "bet",
        commitment: betCommitment,
        marketId,
        outcome,
        amount: amountFelt,
        secret,
        nullifierSecret,
        claimed: false,
        createdAt: Date.now(),
      });

      t.success();
      setBetNotes(getBetNotes().filter((n) => !n.claimed));
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to place bet");
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve(marketId: number) {
    if (!address) return;
    setLoading(true);
    try {
      const result = await sendAsync([
        buildCall(ADDRESSES.PREDICTION_MARKET, "resolve", [marketId.toString()]),
      ]);
      txToast(result.transaction_hash).success();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to resolve";
      if (msg.includes("Too early to resolve") || msg.includes("too early")) {
        errorToast("Cannot resolve yet — the resolution time has not passed. Check the countdown on the market card.");
      } else if (msg.includes("Oracle has no result") || msg.includes("oracle")) {
        errorToast("Oracle data not available yet. The oracle needs to provide the market outcome before resolution. Please wait for the oracle to update or manually set the result.");
      } else {
        errorToast(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function claimBet() {
    if (selectedBetIdx === null || relayerDisabled) return;
    const note = betNotes[selectedBetIdx];
    const recipient = claimRecipient || address;
    if (!recipient) return;

    setLoading(true);
    setProofStatus(null);
    try {
      setProofStatus("Generating ZK proof...");
      const { fullProofWithHints } = await generateBetClaimProof(note, note.outcome);

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relayClaimBet(relayerUrl, {
        marketId: note.marketId.toString(),
        fullProofWithHints,
        betCommitment: note.commitment,
        nullifierHash: fullProofWithHints[1],
        recipient,
      });

      const t = txToast(transactionHash);
      setProofStatus(null);

      const finalStatus = await pollTxStatus(transactionHash);
      if (finalStatus === "ACCEPTED_ON_L2") {
        t.success();
        markBetNoteClaimed(note.commitment);
        setBetNotes(getBetNotes().filter((n) => !n.claimed));
        setSelectedBetIdx(null);
        setClaimRecipient("");
      } else if (finalStatus === "REJECTED") {
        errorToast("Claim transaction was rejected");
      }
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to claim");
    } finally {
      setLoading(false);
      setTxStatus(null);
      setProofStatus(null);
    }
  }

  async function setOracleResult() {
    if (!address || !oracleMarketId || !oracleOutcome) return;
    setLoading(true);
    try {
      const result = await sendAsync([
        buildCall(ADDRESSES.MOCK_PRAGMA_ORACLE, "set_result", [
          oracleMarketId,
          oracleOutcome,
        ]),
      ]);
      txToast(result.transaction_hash).success();
      setOracleMarketId("");
      setOracleOutcome("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to set oracle result";
      if (msg.includes("Only owner") || msg.includes("owner")) {
        errorToast("Only the oracle owner can set results. Make sure you're connected with the oracle owner account.");
      } else {
        errorToast(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  /* ── Render ───────────────────────────────────────────────── */

  const marketIds = Array.from({ length: totalMarkets }, (_, i) => totalMarkets - 1 - i);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="inline-flex items-center gap-1.5 bg-[#8B8CFF]/8 text-[#8B8CFF] px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold border border-[#8B8CFF]/10">
            Private Predictions
          </span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-white">
          Explore
        </h1>
        <p className="text-[13px] text-white/40 mt-1">
          Private bets on future outcomes — no one can see your position.
          {totalMarkets > 0 && (
            <span className="text-white/60 ml-1">{totalMarkets} market{totalMarkets !== 1 ? "s" : ""} live.</span>
          )}
        </p>
      </div>

      <Tabs defaultValue="markets">
        <TabsList className="w-full">
          <TabsTrigger value="markets" className="flex-1">Markets</TabsTrigger>
          <TabsTrigger value="bets" className="flex-1">
            My Bets{betNotes.length > 0 ? ` (${betNotes.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="create" className="flex-1">Create</TabsTrigger>
        </TabsList>

        {/* ── Markets Tab ─────────────────────────────────── */}
        <TabsContent value="markets" className="space-y-4 mt-4">
          {/* Copy-Trading Prevention Callout */}
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-400 font-semibold text-sm">
                🛡️ Copy-Trading Protection
              </span>
            </div>
            <p className="text-xs text-white/60">
              On Polymarket, whales get copied instantly. Here, your positions are hidden via ZK proofs —
              only the commitment is stored on-chain. Take positions without leaking your strategy.
            </p>
          </div>

          {totalMarkets === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#151B23] py-12 text-center">
              <p className="text-white/40">No markets yet.</p>
              <p className="text-[12px] text-white/25 mt-1">
                Create one from the Create tab to get started.
              </p>
            </div>
          ) : (
            marketIds.map((id) => (
              <MarketCard
                key={id}
                marketId={id}
                onPlaceBet={placeBet}
                onResolve={handleResolve}
                loading={loading}
              />
            ))
          )}
        </TabsContent>

        {/* ── My Bets Tab ─────────────────────────────────── */}
        <TabsContent value="bets" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Select Relayer</CardTitle>
            </CardHeader>
            <CardContent>
              <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
            </CardContent>
          </Card>

          {(proofStatus || txStatus) && (
            <Card>
              <CardContent className="py-3">
                {proofStatus && (
                  <p className="text-sm text-muted-foreground">{proofStatus}</p>
                )}
                {txStatus && (
                  <p className="text-sm text-muted-foreground">
                    Transaction status: <Badge variant="outline">{txStatus}</Badge>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Your Positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {betNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No unclaimed bets. Place a bet from the Markets tab.
                </p>
              ) : (
                betNotes.map((note, i) => (
                  <BetCard
                    key={note.commitment}
                    note={note}
                    selected={selectedBetIdx === i}
                    onSelect={() => setSelectedBetIdx(i)}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {selectedBetIdx !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Claim Winnings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Recipient Address (optional)</Label>
                  <Input
                    placeholder="0x... (fresh address for privacy)"
                    value={claimRecipient}
                    onChange={(e) => setClaimRecipient(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For maximum privacy, use a fresh wallet. The relayer submits the claim — your wallet stays hidden.
                  </p>
                </div>
                {selectedRelayer && (
                  <p className="text-xs text-muted-foreground">
                    Relayer fee: {formatFee(selectedRelayer.feeBps)}
                  </p>
                )}
                <Button
                  className="w-full"
                  disabled={loading || relayerDisabled}
                  onClick={claimBet}
                >
                  {loading
                    ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...`
                    : "Generate Proof & Claim"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Create Tab ──────────────────────────────────── */}
        <TabsContent value="create" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Create Market</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Question</Label>
                <Input
                  placeholder="Will BTC reach 100k?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Hashed with Poseidon before storing on-chain.
                </p>
              </div>
              <div>
                <Label>Number of Outcomes</Label>
                <Input
                  type="number"
                  min="2"
                  value={numOutcomes}
                  onChange={(e) => setNumOutcomes(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  2 = Yes/No market. More outcomes for multi-choice.
                </p>
              </div>
              <div>
                <Label>Resolution Time (minutes from now)</Label>
                <Input
                  type="number"
                  value={resolutionMinutes}
                  onChange={(e) => setResolutionMinutes(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button className="w-full" disabled={loading || !address || !question} onClick={createMarket}>
                {loading ? "Creating..." : "Create Market"}
              </Button>
            </CardContent>
          </Card>

          {/* Oracle Admin Section */}
          <Card className="border-yellow-500/20">
            <CardHeader>
              <CardTitle className="text-[14px] flex items-center gap-2">
                <span>🔮 Oracle Admin</span>
                <Badge variant="outline" className="text-[10px]">Owner Only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-xs text-white/60">
                  Before a market can be resolved, the oracle must have a result set. Only the oracle owner can set results.
                  After setting the result here, you can then click &quot;Resolve Market&quot; on the market card.
                </p>
              </div>
              <div>
                <Label>Market ID</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={oracleMarketId}
                  onChange={(e) => setOracleMarketId(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The market ID to set the result for (shown on market cards as &quot;Market #X&quot;)
                </p>
              </div>
              <div>
                <Label>Winning Outcome</Label>
                <Input
                  type="number"
                  placeholder="0 for YES, 1 for NO (binary markets)"
                  value={oracleOutcome}
                  onChange={(e) => setOracleOutcome(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For binary markets: 0 = YES, 1 = NO. For multi-outcome: 0, 1, 2, etc.
                </p>
              </div>
              <Button
                className="w-full"
                variant="outline"
                disabled={loading || !address || !oracleMarketId || !oracleOutcome}
                onClick={setOracleResult}
              >
                {loading ? "Setting..." : "Set Oracle Result"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
