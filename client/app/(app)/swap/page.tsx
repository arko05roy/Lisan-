"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useReadContract, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { SHIELDED_AMM_ABI } from "@/lib/abis";
import { getAmmNotes, addNote, markAmmNoteSpent, markNoteConfirmed, AmmNote } from "@/lib/storage";
import { generateSecret, computeAmmCommitment, computeNullifierHash } from "@/lib/crypto";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256 } from "starknet";
import { buildTreeFromChain } from "@/lib/merkle";
import { generateAmmSwapProof } from "@/lib/prover";
import { relaySwap, getRelayTxStatus } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";
import { u256ToBigInt } from "@/lib/utils";

function formatTokens(data: unknown): string {
  const raw = u256ToBigInt(data);
  const whole = raw / 10n ** 18n;
  return whole.toString();
}

function toBool(v: unknown): boolean {
  if (v === true) return true;
  if (v === 1 || v === 1n) return true;
  if (v === "1" || v === "0x1") return true;
  return false;
}

interface SwapResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

/**
 * Check if a note's commitment exists on-chain by fetching events.
 * Returns true if found, false otherwise.
 */
async function checkNoteConfirmed(commitment: string, contractType: "pool" | "amm"): Promise<boolean> {
  try {
    const resp = await fetch(`/api/events?contract=${contractType}`);
    if (!resp.ok) return false;
    const { deposits } = await resp.json();
    const normalized = "0x" + BigInt(commitment).toString(16);
    return deposits.some((d: { commitment: string }) => {
      const dNorm = "0x" + BigInt(d.commitment).toString(16);
      return dNorm === normalized;
    });
  } catch {
    return false;
  }
}

export default function SwapPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  const [notes, setNotes] = useState<AmmNote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);
  const [lastSwap, setLastSwap] = useState<SwapResult | null>(null);

  // LP state
  const [lpBtc, setLpBtc] = useState("");
  const [lpStrk, setLpStrk] = useState("");
  const [lpLoading, setLpLoading] = useState(false);

  // Note confirmation tracking
  const [confirmingNotes, setConfirmingNotes] = useState<Set<string>>(new Set());

  const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;

  const tokenTypeIn = selectedNote?.tokenType || TOKEN_TYPE_BTC;
  const tokenTypeOut = tokenTypeIn === TOKEN_TYPE_BTC ? TOKEN_TYPE_STRK : TOKEN_TYPE_BTC;
  const tokenLabelIn = tokenTypeIn === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";
  const tokenLabelOut = tokenTypeOut === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";

  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

  const { data: btcReserve, refetch: refetchBtc } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "get_btc_reserve",
    args: [],
  });

  const { data: strkReserve, refetch: refetchStrk } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "get_strk_reserve",
    args: [],
  });

  const { data: isSeeded, refetch: refetchSeeded } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "is_seeded",
    args: [],
  });

  const { data: quoteData } = useReadContract({
    address: ADDRESSES.SHIELDED_AMM as `0x${string}`,
    abi: SHIELDED_AMM_ABI,
    functionName: "get_amount_out",
    args: selectedNote
      ? [
        uint256.bnToUint256(BigInt(selectedNote.amount)),
        tokenTypeIn,
        tokenTypeOut,
      ]
      : undefined,
    enabled: !!selectedNote,
  });

  const seeded = toBool(isSeeded);

  // Load notes and check their confirmation status
  useEffect(() => {
    const unspent = getAmmNotes().filter((n) => !n.spent);
    setNotes(unspent);

    // Check confirmation for any notes that aren't marked confirmed
    unspent.forEach(async (note) => {
      if (note.confirmed) return;
      const confirmed = await checkNoteConfirmed(note.commitment, "amm");
      if (confirmed) {
        markNoteConfirmed(note.commitment);
        setNotes(getAmmNotes().filter((n) => !n.spent));
      }
    });
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

  // Check confirmation for a specific note (manual refresh)
  async function refreshNoteStatus(commitment: string) {
    setConfirmingNotes((prev) => new Set(prev).add(commitment));
    const confirmed = await checkNoteConfirmed(commitment, "amm");
    if (confirmed) {
      markNoteConfirmed(commitment);
      setNotes(getAmmNotes().filter((n) => !n.spent));
    }
    setConfirmingNotes((prev) => {
      const next = new Set(prev);
      next.delete(commitment);
      return next;
    });
    return confirmed;
  }

  async function handleAddLiquidity() {
    if (!address || !lpBtc || !lpStrk) return;
    setLpLoading(true);
    try {
      const btcWei = BigInt(lpBtc) * 10n ** 18n;
      const strkWei = BigInt(lpStrk) * 10n ** 18n;
      const uBtc = uint256.bnToUint256(btcWei);
      const uStrk = uint256.bnToUint256(strkWei);

      const fnName = seeded ? "add_liquidity" : "seed_liquidity";

      const calls = [
        buildApproveCall(ADDRESSES.MOCK_BTC, ADDRESSES.SHIELDED_AMM, btcWei),
        buildApproveCall(ADDRESSES.MOCK_STRK, ADDRESSES.SHIELDED_AMM, strkWei),
        buildCall(ADDRESSES.SHIELDED_AMM, fnName, [
          uBtc.low.toString(), uBtc.high.toString(),
          uStrk.low.toString(), uStrk.high.toString(),
        ]),
      ];

      const result = await sendAsync(calls);
      txToast(result.transaction_hash).success();
      setLpBtc("");
      setLpStrk("");
      setTimeout(() => { refetchBtc(); refetchStrk(); refetchSeeded(); }, 5000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Add liquidity failed";
      if (msg.includes("Only owner can seed")) {
        errorToast("Only the contract owner can seed initial liquidity. Wait for the pool to be seeded first, then you can add liquidity.");
      } else {
        errorToast(msg);
      }
    } finally {
      setLpLoading(false);
    }
  }

  async function handleSwap() {
    if (!address || !selectedNote || !quoteData || relayerDisabled) return;
    setLoading(true);
    setProofStatus(null);
    setLastSwap(null);
    try {
      // First check if note is confirmed on-chain
      if (!selectedNote.confirmed) {
        setProofStatus("Checking if deposit is confirmed on-chain...");
        const confirmed = await refreshNoteStatus(selectedNote.commitment);
        if (!confirmed) {
          // Auto-wait: poll for up to 60 seconds
          setProofStatus("Deposit not yet confirmed. Waiting for on-chain confirmation...");
          let found = false;
          for (let i = 0; i < 12; i++) {
            await new Promise((r) => setTimeout(r, 5000));
            const check = await checkNoteConfirmed(selectedNote.commitment, "amm");
            if (check) {
              markNoteConfirmed(selectedNote.commitment);
              setNotes(getAmmNotes().filter((n) => !n.spent));
              found = true;
              break;
            }
            setProofStatus(`Waiting for deposit confirmation... (${(i + 1) * 5}s)`);
          }
          if (!found) {
            throw new Error(
              "Your deposit transaction hasn't been confirmed on-chain yet. " +
              "This usually takes 30-60 seconds on Starknet Sepolia. " +
              "Please wait and try again in a moment."
            );
          }
        }
      }

      const nullifierHash = await computeNullifierHash(selectedNote.nullifierSecret);
      const amountOut = u256ToBigInt(quoteData).toString();

      const newSecret = generateSecret();
      const newNullifierSecret = generateSecret();
      const newCommitment = await computeAmmCommitment(amountOut, tokenTypeOut, newSecret, newNullifierSecret);

      setProofStatus("Building Merkle tree from on-chain events...");
      const { tree, commitmentToLeafIndex } = await buildTreeFromChain(
        ADDRESSES.SHIELDED_AMM,
        "amm",
      );
      const normalizedCommitment = "0x" + BigInt(selectedNote.commitment).toString(16);
      const leafIndex = commitmentToLeafIndex.get(normalizedCommitment);
      if (leafIndex === undefined) {
        throw new Error(
          "Your deposit commitment was not found in the on-chain Merkle tree. " +
          "This can happen if your deposit transaction is still being processed. " +
          "Please wait a minute for the transaction to finalize and try again."
        );
      }

      setProofStatus("Generating ZK proof...");
      const path = await tree.getPath(leafIndex);
      const root = tree.getRoot().toString();
      const { fullProofWithHints } = await generateAmmSwapProof(
        selectedNote, path, root, nullifierHash, newCommitment,
        amountOut, tokenTypeOut, newSecret, newNullifierSecret,
      );

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relaySwap(relayerUrl, {
        fullProofWithHints, root, nullifierHash, tokenTypeIn,
        amountIn: selectedNote.amount, tokenTypeOut, newCommitment, amountOut,
      });
      const t = txToast(transactionHash);
      setProofStatus(null);

      const swapResult: SwapResult = {
        tokenIn: tokenLabelIn, tokenOut: tokenLabelOut,
        amountIn: (BigInt(selectedNote.amount) / 10n ** 18n).toString(),
        amountOut: (BigInt(amountOut) / 10n ** 18n).toString(),
      };

      markAmmNoteSpent(selectedNote.commitment);
      addNote({
        type: "amm", commitment: newCommitment, amount: amountOut,
        tokenType: tokenTypeOut, secret: newSecret,
        nullifierSecret: newNullifierSecret, spent: false, createdAt: Date.now(),
        confirmed: false,
      });

      const finalStatus = await pollTxStatus(transactionHash);
      if (finalStatus === "ACCEPTED_ON_L2") {
        t.success();
        setLastSwap(swapResult);
      } else if (finalStatus === "REJECTED") {
        errorToast("Swap transaction was rejected");
      }

      setNotes(getAmmNotes().filter((n) => !n.spent));
      setSelectedIdx(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setLoading(false);
      setProofStatus(null);
      setTxStatus(null);
    }
  }

  const btcRes = formatTokens(btcReserve);
  const strkRes = formatTokens(strkReserve);
  const hasReserves = btcRes !== "0" || strkRes !== "0";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <span className="inline-flex items-center gap-1.5 bg-[#8B8CFF]/8 text-[#8B8CFF] px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-semibold border border-[#8B8CFF]/10">
            Private AMM
          </span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-white">
          Shielded Swap
        </h1>
        <p className="text-[13px] text-white/40 mt-1">
          Swap tokens privately through the AMM using ZK proofs, or provide liquidity.
        </p>
      </div>

      <Tabs defaultValue="swap">
        <TabsList className="w-full">
          <TabsTrigger value="swap" className="flex-1">Swap</TabsTrigger>
          <TabsTrigger value="liquidity" className="flex-1">Provide Liquidity</TabsTrigger>
        </TabsList>

        {/* ── Swap Tab ──────────────────────────────────── */}
        <TabsContent value="swap" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Select Relayer</CardTitle>
            </CardHeader>
            <CardContent>
              <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
            </CardContent>
          </Card>

          {/* Reserves */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#151B23] p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">AMM Reserves</p>
            {!seeded ? (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="text-sm text-yellow-400 font-medium">Pool not initialized</p>
                <p className="text-xs text-white/30 mt-1">
                  Go to the Provide Liquidity tab to seed the pool before swaps can work.
                </p>
              </div>
            ) : (
              <div className="flex gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#F7931A]/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[#F7931A]">B</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{btcRes}</p>
                    <p className="text-[10px] text-white/30">mBTC</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-[#8B8CFF]">S</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{strkRes}</p>
                    <p className="text-[10px] text-white/30">mSTRK</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {(proofStatus || txStatus) && (
            <Card>
              <CardContent className="py-3">
                {proofStatus && <p className="text-sm text-muted-foreground">{proofStatus}</p>}
                {txStatus && (
                  <p className="text-sm text-muted-foreground">
                    Transaction status: <Badge variant="outline">{txStatus}</Badge>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {lastSwap && (
            <div className="rounded-2xl border border-green-500/20 bg-[#151B23] p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <p className="font-semibold text-green-400 text-[14px]">Swap Complete</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Sold</span>
                  <span className="text-white">{lastSwap.amountIn} {lastSwap.tokenIn}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Received</span>
                  <span className="font-bold text-green-400">{lastSwap.amountOut} {lastSwap.tokenOut}</span>
                </div>
                <p className="text-[10px] text-white/25 pt-1">
                  A new {lastSwap.tokenOut} note has been created. You can withdraw it or swap it again.
                  Note: the new note needs ~30s to confirm on-chain before you can use it.
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setLastSwap(null)}>
                Dismiss
              </Button>
            </div>
          )}

          {/* Note selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Select AMM Note to Swap</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unspent AMM notes. Deposit to AMM first from the Deposit page.</p>
              ) : (
                notes.map((note, i) => {
                  const amtTokens = BigInt(note.amount) / 10n ** 18n;
                  const label = note.tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";
                  const isPending = !note.confirmed;
                  const isChecking = confirmingNotes.has(note.commitment);
                  return (
                    <div
                      key={note.commitment}
                      className={`rounded-xl border p-3 transition-all ${
                        selectedIdx === i
                          ? "border-[#8B8CFF] bg-[#8B8CFF]/5"
                          : isPending
                            ? "border-yellow-500/20 bg-yellow-500/[0.02]"
                            : "border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedIdx(i)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-white/50">{note.commitment.slice(0, 14)}...</span>
                            {isPending && (
                              <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-500/30 text-[9px] px-1.5 py-0">
                                Pending
                              </Badge>
                            )}
                            {!isPending && (
                              <Badge className="bg-green-600/20 text-green-400 border-green-500/30 text-[9px] px-1.5 py-0">
                                Confirmed
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary">{amtTokens.toString()} {label}</Badge>
                        </div>
                      </button>
                      {isPending && (
                        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                          <p className="text-[10px] text-yellow-400/60">
                            Deposit TX is being confirmed on-chain (~30-60s)
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[10px] h-6 px-2"
                            disabled={isChecking}
                            onClick={(e) => { e.stopPropagation(); refreshNoteStatus(note.commitment); }}
                          >
                            {isChecking ? "Checking..." : "Refresh"}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Swap preview */}
          {selectedNote && (
            <Card>
              <CardHeader>
                <CardTitle className="text-[14px]">Swap Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Selling</span>
                  <span className="font-medium">
                    {(BigInt(selectedNote.amount) / 10n ** 18n).toString()} {tokenLabelIn}
                  </span>
                </div>
                <div className="text-center text-muted-foreground text-lg">&darr;</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Receiving (est.)</span>
                  <span className="font-medium text-green-500">
                    {quoteData ? formatTokens(quoteData) : "..."} {tokenLabelOut}
                  </span>
                </div>
                {quoteData && selectedNote && (
                  <p className="text-xs text-muted-foreground text-center">
                    Rate: 1 {tokenLabelIn} &asymp;{" "}
                    {(Number(formatTokens(quoteData)) / Number((BigInt(selectedNote.amount) / 10n ** 18n).toString()) || 0).toFixed(4)}{" "}
                    {tokenLabelOut}
                  </p>
                )}
                <Button className="w-full" disabled={loading || !quoteData || !address || relayerDisabled || !seeded} onClick={handleSwap}>
                  {loading ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...` : `Generate Proof & Swap ${tokenLabelIn} → ${tokenLabelOut}`}
                </Button>
                {!seeded && (
                  <p className="text-xs text-red-400 text-center">AMM liquidity must be seeded before swaps can work.</p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Liquidity Tab ──────────────────────────────── */}
        <TabsContent value="liquidity" className="space-y-4 mt-4">
          {/* Current reserves */}
          <div className="rounded-2xl border border-white/[0.06] bg-[#151B23] p-5" style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3">Current Pool</p>
            {!seeded ? (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                <p className="text-sm text-yellow-400 font-medium">Pool not initialized yet</p>
                <p className="text-xs text-white/30 mt-1">
                  Be the first to seed liquidity. The initial deposit sets the price ratio between mBTC and mSTRK.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#F7931A]/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-[#F7931A]">B</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{btcRes}</p>
                      <p className="text-[10px] text-white/30">mBTC reserve</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-[#8B8CFF]/10 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-[#8B8CFF]">S</span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{strkRes}</p>
                      <p className="text-[10px] text-white/30">mSTRK reserve</p>
                    </div>
                  </div>
                </div>
                {hasReserves && Number(btcRes) > 0 && Number(strkRes) > 0 && (
                  <p className="text-[11px] text-white/30">
                    Current price: 1 mBTC = {(Number(strkRes) / Number(btcRes)).toFixed(4)} mSTRK
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Add liquidity form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">
                {seeded ? "Add Liquidity" : "Seed Initial Liquidity"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {seeded
                  ? "Provide both mBTC and mSTRK to add liquidity to the pool. Anyone can be an LP."
                  : "Initialize the pool by providing the first liquidity. This sets the initial price ratio."
                }
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[12px]">mBTC Amount</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000"
                    value={lpBtc}
                    onChange={(e) => setLpBtc(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[12px]">mSTRK Amount</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 1000"
                    value={lpStrk}
                    onChange={(e) => setLpStrk(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              {lpBtc && lpStrk && Number(lpBtc) > 0 && Number(lpStrk) > 0 && (
                <div className="rounded-lg border border-dashed border-white/[0.08] p-3 space-y-1">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/40">You provide</span>
                    <span className="text-white/70">{lpBtc} mBTC + {lpStrk} mSTRK</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/40">Implied price</span>
                    <span className="text-white/70">1 mBTC = {(Number(lpStrk) / Number(lpBtc)).toFixed(4)} mSTRK</span>
                  </div>
                </div>
              )}
              <Button
                className="w-full"
                disabled={lpLoading || !address || !lpBtc || !lpStrk}
                onClick={handleAddLiquidity}
              >
                {lpLoading ? "Processing..." : seeded ? "Add Liquidity" : "Seed Liquidity"}
              </Button>

              <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-3">
                <p className="text-[11px] text-white/30 leading-relaxed">
                  <strong className="text-white/50">How it works:</strong> Liquidity providers deposit both tokens into the AMM pool.
                  Swappers pay a fee to the pool which grows the reserves over time.
                  {seeded
                    ? " Your liquidity is added to the existing pool reserves."
                    : " As the first LP, you set the initial exchange rate between the tokens."
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
