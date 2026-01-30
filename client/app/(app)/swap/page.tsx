"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { SHIELDED_AMM_ABI } from "@/lib/abis";
import { getAmmNotes, addNote, markAmmNoteSpent, AmmNote } from "@/lib/storage";
import { generateSecret, computeAmmCommitment, computeNullifierHash } from "@/lib/crypto";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256 } from "starknet";
import { MerkleTree } from "@/lib/merkle";
import { generateAmmSwapProof } from "@/lib/prover";
import { relaySwap } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";

function formatTokens(data: unknown): string {
  if (!data) return "0";
  try {
    const raw = BigInt(data as string | number | bigint);
    const whole = raw / 10n ** 18n;
    return whole.toString();
  } catch {
    return "0";
  }
}

export default function SwapPage() {
  const { address } = useAccount();

  const [notes, setNotes] = useState<AmmNote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;

  // Determine swap direction from selected note
  const tokenTypeIn = selectedNote?.tokenType || TOKEN_TYPE_BTC;
  const tokenTypeOut = tokenTypeIn === TOKEN_TYPE_BTC ? TOKEN_TYPE_STRK : TOKEN_TYPE_BTC;
  const tokenLabelIn = tokenTypeIn === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";
  const tokenLabelOut = tokenTypeOut === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";

  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

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

  // Get quote for the selected note
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

  useEffect(() => {
    setNotes(getAmmNotes().filter((n) => !n.spent));
  }, []);

  async function handleSwap() {
    if (!address || !selectedNote || !quoteData || relayerDisabled) return;
    setLoading(true);
    setProofStatus(null);
    try {
      const nullifierHash = computeNullifierHash(selectedNote.nullifierSecret);
      const amountOut = BigInt(quoteData as string | number | bigint).toString();

      // Generate new note for output token
      const newSecret = generateSecret();
      const newNullifierSecret = generateSecret();
      const newCommitment = computeAmmCommitment(amountOut, tokenTypeOut, newSecret, newNullifierSecret);

      // Build Merkle tree and generate ZK proof
      setProofStatus("Building Merkle tree...");
      const tree = new MerkleTree();
      await tree.initialize();
      const leafIndex = await tree.insert(BigInt(selectedNote.commitment));

      setProofStatus("Generating ZK proof...");
      const path = await tree.getPath(leafIndex);
      const { fullProofWithHints, publicSignals } = await generateAmmSwapProof(
        selectedNote,
        path,
        amountOut,
        tokenTypeOut,
        newSecret,
        newNullifierSecret,
      );

      const root = publicSignals[0];

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relaySwap(relayerUrl, {
        fullProofWithHints,
        root,
        nullifierHash,
        tokenTypeIn,
        amountIn: selectedNote.amount,
        tokenTypeOut,
        newCommitment,
        amountOut,
      });
      const t = txToast(transactionHash);

      markAmmNoteSpent(selectedNote.commitment);
      addNote({
        type: "amm",
        commitment: newCommitment,
        amount: amountOut,
        tokenType: tokenTypeOut,
        secret: newSecret,
        nullifierSecret: newNullifierSecret,
        spent: false,
        createdAt: Date.now(),
      });

      t.success();
      setNotes(getAmmNotes().filter((n) => !n.spent));
      setSelectedIdx(null);
      setProofStatus(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Swap failed");
    } finally {
      setLoading(false);
      setProofStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shielded Swap</h1>
        <p className="text-muted-foreground">
          Swap tokens privately through the AMM using ZK proofs
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Relayer</CardTitle>
        </CardHeader>
        <CardContent>
          <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AMM Reserves</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6">
          <div>
            <p className="text-xs text-muted-foreground">mBTC</p>
            <p className="text-lg font-bold">{formatTokens(btcReserve)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">mSTRK</p>
            <p className="text-lg font-bold">{formatTokens(strkReserve)}</p>
          </div>
        </CardContent>
      </Card>

      {proofStatus && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{proofStatus}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select AMM Note to Swap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unspent AMM notes. Deposit to AMM first.</p>
          ) : (
            notes.map((note, i) => {
              const amtTokens = BigInt(note.amount) / 10n ** 18n;
              const label = note.tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";
              return (
                <button
                  key={note.commitment}
                  onClick={() => setSelectedIdx(i)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedIdx === i ? "border-primary bg-accent" : "hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono">{note.commitment.slice(0, 16)}...</span>
                    <Badge variant="secondary">{amtTokens.toString()} {label}</Badge>
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {selectedNote && (
        <Card>
          <CardHeader>
            <CardTitle>Swap Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Selling</span>
              <span className="font-medium">
                {(BigInt(selectedNote.amount) / 10n ** 18n).toString()} {tokenLabelIn}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Receiving (est.)</span>
              <span className="font-medium text-green-500">
                {quoteData ? formatTokens(quoteData) : "..."} {tokenLabelOut}
              </span>
            </div>
            <Button className="w-full" disabled={loading || !quoteData || !address || relayerDisabled} onClick={handleSwap}>
              {loading ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...` : `Generate Proof & Swap ${tokenLabelIn} → ${tokenLabelOut}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
