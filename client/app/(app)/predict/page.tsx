"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADDRESSES } from "@/lib/addresses";
import { PREDICTION_MARKET_ABI } from "@/lib/abis";
import { generateSecret, computeBetCommitment, computeNullifierHash } from "@/lib/crypto";
import { addNote, getBetNotes, markBetNoteClaimed, BetNote } from "@/lib/storage";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256, hash } from "starknet";

export default function PredictPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  // Create market state
  const [question, setQuestion] = useState("");
  const [numOutcomes, setNumOutcomes] = useState("2");
  const [resolutionMinutes, setResolutionMinutes] = useState("60");

  // Bet state
  const [betMarketId, setBetMarketId] = useState("");
  const [betOutcome, setBetOutcome] = useState("0");
  const [betAmount, setBetAmount] = useState("");

  // Resolve state
  const [resolveMarketId, setResolveMarketId] = useState("");

  // Claim state
  const [betNotes, setBetNotes] = useState<BetNote[]>([]);
  const [selectedBetIdx, setSelectedBetIdx] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);

  const { data: marketCount } = useReadContract({
    address: ADDRESSES.PREDICTION_MARKET as `0x${string}`,
    abi: PREDICTION_MARKET_ABI,
    functionName: "get_market_count",
    args: [],
  });

  useEffect(() => {
    setBetNotes(getBetNotes().filter((n) => !n.claimed));
  }, []);

  async function createMarket() {
    if (!address || !question || !numOutcomes || !resolutionMinutes) return;
    setLoading(true);
    try {
      const questionHash = hash.computePoseidonHashOnElements(
        Array.from(new TextEncoder().encode(question)).map((b) => b.toString()),
      );
      const resolutionTime = Math.floor(Date.now() / 1000) + parseInt(resolutionMinutes) * 60;

      const result = await sendAsync([
        buildCall(ADDRESSES.PREDICTION_MARKET, "create_market", [
          questionHash,
          numOutcomes,
          resolutionTime.toString(),
        ]),
      ]);
      txToast(result.transaction_hash).success();
      setQuestion("");
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to create market");
    } finally {
      setLoading(false);
    }
  }

  async function placeBet() {
    if (!address || !betMarketId || !betAmount) return;
    setLoading(true);
    try {
      const amountWei = BigInt(betAmount) * 10n ** 18n;
      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const amountFelt = amountWei.toString();
      const betCommitment = computeBetCommitment(betOutcome, amountFelt, secret, nullifierSecret);

      const u = uint256.bnToUint256(amountWei);
      const calls = [
        buildApproveCall(ADDRESSES.MOCK_BTC, ADDRESSES.PREDICTION_MARKET, amountWei),
        buildCall(ADDRESSES.PREDICTION_MARKET, "place_bet", [
          betMarketId,
          betCommitment,
          u.low.toString(), u.high.toString(),
        ]),
      ];

      const result = await sendAsync(calls);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "bet",
        commitment: betCommitment,
        marketId: parseInt(betMarketId),
        outcome: betOutcome,
        amount: amountFelt,
        secret,
        nullifierSecret,
        claimed: false,
        createdAt: Date.now(),
      });

      t.success();
      setBetAmount("");
      setBetNotes(getBetNotes().filter((n) => !n.claimed));
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to place bet");
    } finally {
      setLoading(false);
    }
  }

  async function resolveMarket() {
    if (!address || !resolveMarketId) return;
    setLoading(true);
    try {
      const result = await sendAsync([
        buildCall(ADDRESSES.PREDICTION_MARKET, "resolve", [resolveMarketId]),
      ]);
      txToast(result.transaction_hash).success();
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to resolve market");
    } finally {
      setLoading(false);
    }
  }

  async function claimBet() {
    if (!address || selectedBetIdx === null) return;
    const note = betNotes[selectedBetIdx];
    setLoading(true);
    try {
      const nullifierHash = computeNullifierHash(note.nullifierSecret);

      const result = await sendAsync([
        buildCall(ADDRESSES.PREDICTION_MARKET, "claim", [
          note.marketId.toString(),
          note.commitment,
          nullifierHash,
          note.outcome,
          note.amount,
          note.secret,
          note.nullifierSecret,
          address,
        ]),
      ]);
      const t = txToast(result.transaction_hash);
      markBetNoteClaimed(note.commitment);
      t.success();
      setBetNotes(getBetNotes().filter((n) => !n.claimed));
      setSelectedBetIdx(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Failed to claim");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Prediction Market</h1>
        <p className="text-muted-foreground">
          Create markets, place private bets, and claim winnings
        </p>
        {marketCount !== undefined && (
          <p className="text-sm text-muted-foreground mt-1">
            {marketCount?.toString() || "0"} markets created
          </p>
        )}
      </div>

      <Tabs defaultValue="bet">
        <TabsList className="w-full">
          <TabsTrigger value="create" className="flex-1">Create</TabsTrigger>
          <TabsTrigger value="bet" className="flex-1">Bet</TabsTrigger>
          <TabsTrigger value="resolve" className="flex-1">Resolve</TabsTrigger>
          <TabsTrigger value="claim" className="flex-1">Claim</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Create Market</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Question</Label>
                <Input
                  placeholder="Will BTC reach 100k?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              </div>
              <div>
                <Label>Number of Outcomes</Label>
                <Input
                  type="number"
                  min="2"
                  value={numOutcomes}
                  onChange={(e) => setNumOutcomes(e.target.value)}
                />
              </div>
              <div>
                <Label>Resolution Time (minutes from now)</Label>
                <Input
                  type="number"
                  value={resolutionMinutes}
                  onChange={(e) => setResolutionMinutes(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={loading || !address} onClick={createMarket}>
                {loading ? "Processing..." : "Create Market"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bet">
          <Card>
            <CardHeader>
              <CardTitle>Place Bet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Market ID</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={betMarketId}
                  onChange={(e) => setBetMarketId(e.target.value)}
                />
              </div>
              <div>
                <Label>Outcome (0-indexed)</Label>
                <Input
                  type="number"
                  min="0"
                  value={betOutcome}
                  onChange={(e) => setBetOutcome(e.target.value)}
                />
              </div>
              <div>
                <Label>Amount (whole mBTC)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 10"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Your bet is private — only the commitment is stored on-chain.
              </p>
              <Button className="w-full" disabled={loading || !address || !betAmount} onClick={placeBet}>
                {loading ? "Processing..." : "Place Bet"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resolve">
          <Card>
            <CardHeader>
              <CardTitle>Resolve Market</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Market ID</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={resolveMarketId}
                  onChange={(e) => setResolveMarketId(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Can only be called after the resolution time has passed. Queries the oracle for the result.
              </p>
              <Button className="w-full" disabled={loading || !address} onClick={resolveMarket}>
                {loading ? "Processing..." : "Resolve Market"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="claim">
          <Card>
            <CardHeader>
              <CardTitle>Claim Winnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {betNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unclaimed bets.</p>
              ) : (
                betNotes.map((note, i) => {
                  const amtTokens = BigInt(note.amount) / 10n ** 18n;
                  return (
                    <button
                      key={note.commitment}
                      onClick={() => setSelectedBetIdx(i)}
                      className={`w-full rounded-md border p-3 text-left transition-colors ${
                        selectedBetIdx === i ? "border-primary bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-mono">{note.commitment.slice(0, 12)}...</span>
                          <p className="text-xs text-muted-foreground">
                            Market #{note.marketId} · Outcome {note.outcome}
                          </p>
                        </div>
                        <Badge variant="secondary">{amtTokens.toString()} mBTC</Badge>
                      </div>
                    </button>
                  );
                })
              )}
              {selectedBetIdx !== null && (
                <Button className="mt-4 w-full" disabled={loading || !address} onClick={claimBet}>
                  {loading ? "Processing..." : "Claim Winnings"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
