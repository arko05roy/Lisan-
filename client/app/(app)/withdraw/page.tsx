"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPoolNotes, getAmmNotes,
  markPoolNoteSpent, markAmmNoteSpent,
  PoolNote, AmmNote,
} from "@/lib/storage";
import { computeNullifierHash } from "@/lib/crypto";
import { txToast, errorToast } from "@/components/tx-toast";
import { TOKEN_TYPE_BTC } from "@/lib/addresses";
import {
  relayPrepareWithdraw,
  relayClaimWithdrawal,
  getRelayTxStatus,
} from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl, formatFee } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";
import { MerkleTree } from "@/lib/merkle";
import { generatePoolWithdrawProof, generateAmmWithdrawProof } from "@/lib/prover";

interface PendingClaim {
  nullifierHash: string;
  source: "pool" | "amm";
  amount: string;
  tokenLabel: string;
}

export default function WithdrawPage() {
  const { address } = useAccount();

  const [poolNotes, setPoolNotes] = useState<PoolNote[]>([]);
  const [ammNotes, setAmmNotes] = useState<AmmNote[]>([]);
  const [selectedPool, setSelectedPool] = useState<number | null>(null);
  const [selectedAmm, setSelectedAmm] = useState<number | null>(null);
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  useEffect(() => {
    setPoolNotes(getPoolNotes().filter((n) => !n.spent));
    setAmmNotes(getAmmNotes().filter((n) => !n.spent));
  }, []);

  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

  const pollTxStatus = useCallback(async (txHash: string) => {
    setTxStatus("PENDING");
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
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

  async function preparePoolWithdraw() {
    if (selectedPool === null || relayerDisabled) return;
    const note = poolNotes[selectedPool];
    setLoading(true);
    setProofStatus(null);
    try {
      // Generate ZK proof locally
      setProofStatus("Building Merkle tree...");
      const tree = new MerkleTree();
      await tree.initialize();

      // Insert this note's commitment (simplified — in production, reconstruct full tree from events)
      const leafIndex = await tree.insert(BigInt(note.commitment));

      setProofStatus("Generating ZK proof...");
      const path = await tree.getPath(leafIndex);
      const { fullProofWithHints, publicSignals } = await generatePoolWithdrawProof(note, path);

      const root = publicSignals[0];
      const nullifierHash = computeNullifierHash(note.nullifierSecret);

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relayPrepareWithdraw(relayerUrl, {
        contract: "pool",
        fullProofWithHints,
        root,
        nullifierHash,
        withdrawAmount: note.amount,
      });

      const t = txToast(transactionHash);
      markPoolNoteSpent(note.commitment);
      setPoolNotes(getPoolNotes().filter((n) => !n.spent));
      setPendingClaim({ nullifierHash, source: "pool", amount: note.amount, tokenLabel: "mBTC" });
      setSelectedPool(null);
      setProofStatus(null);

      const finalStatus = await pollTxStatus(transactionHash);
      if (finalStatus === "ACCEPTED_ON_L2") {
        t.success();
      } else if (finalStatus === "REJECTED") {
        errorToast("Prepare withdraw transaction was rejected");
      }
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Prepare withdraw failed");
    } finally {
      setLoading(false);
      setTxStatus(null);
      setProofStatus(null);
    }
  }

  async function prepareAmmWithdraw() {
    if (selectedAmm === null || relayerDisabled) return;
    const note = ammNotes[selectedAmm];
    setLoading(true);
    setProofStatus(null);
    try {
      const tokenLabel = note.tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK";

      // Generate ZK proof locally
      setProofStatus("Building Merkle tree...");
      const tree = new MerkleTree();
      await tree.initialize();
      const leafIndex = await tree.insert(BigInt(note.commitment));

      setProofStatus("Generating ZK proof...");
      const path = await tree.getPath(leafIndex);
      const { fullProofWithHints, publicSignals } = await generateAmmWithdrawProof(note, path);

      const root = publicSignals[0];
      const nullifierHash = computeNullifierHash(note.nullifierSecret);

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relayPrepareWithdraw(relayerUrl, {
        contract: "amm",
        fullProofWithHints,
        root,
        nullifierHash,
        withdrawAmount: note.amount,
        tokenType: note.tokenType,
      });

      const t = txToast(transactionHash);
      markAmmNoteSpent(note.commitment);
      setAmmNotes(getAmmNotes().filter((n) => !n.spent));
      setPendingClaim({ nullifierHash, source: "amm", amount: note.amount, tokenLabel });
      setSelectedAmm(null);
      setProofStatus(null);

      const finalStatus = await pollTxStatus(transactionHash);
      if (finalStatus === "ACCEPTED_ON_L2") {
        t.success();
      } else if (finalStatus === "REJECTED") {
        errorToast("AMM prepare withdraw transaction was rejected");
      }
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "AMM prepare withdraw failed");
    } finally {
      setLoading(false);
      setTxStatus(null);
      setProofStatus(null);
    }
  }

  async function claimWithdrawal() {
    if (!pendingClaim || !recipient || relayerDisabled) return;
    setLoading(true);
    try {
      const { transactionHash } = await relayClaimWithdrawal(relayerUrl, {
        contract: pendingClaim.source,
        nullifierHash: pendingClaim.nullifierHash,
        recipient,
      });

      const t = txToast(transactionHash);

      const finalStatus = await pollTxStatus(transactionHash);
      if (finalStatus === "ACCEPTED_ON_L2") {
        t.success();
        setPendingClaim(null);
      } else if (finalStatus === "REJECTED") {
        errorToast("Claim withdrawal transaction was rejected");
      }
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setLoading(false);
      setTxStatus(null);
    }
  }

  function renderFeeBreakdown(amount: string, tokenLabel: string) {
    if (!selectedRelayer) return null;
    const amt = BigInt(amount);
    const feeBps = selectedRelayer.feeBps;
    const fee = (amt * BigInt(feeBps)) / 10000n;
    const received = amt - fee;
    const feeTokens = fee / 10n ** 18n;
    const receivedTokens = received / 10n ** 18n;
    return (
      <p className="text-xs text-muted-foreground">
        You receive: {receivedTokens.toString()} {tokenLabel} ({feeTokens.toString()} {tokenLabel} relayer fee @ {formatFee(feeBps)})
      </p>
    );
  }

  function renderNoteList(
    noteList: (PoolNote | AmmNote)[],
    selected: number | null,
    setSelected: (i: number) => void,
    isAmm: boolean,
  ) {
    if (noteList.length === 0) {
      return <p className="text-sm text-muted-foreground">No unspent notes.</p>;
    }
    return noteList.map((note, i) => {
      const amtTokens = BigInt(note.amount) / 10n ** 18n;
      const tokenLabel = isAmm ? ((note as AmmNote).tokenType === TOKEN_TYPE_BTC ? "mBTC" : "mSTRK") : "mBTC";
      return (
        <button
          key={note.commitment}
          onClick={() => setSelected(i)}
          className={`w-full rounded-md border p-3 text-left transition-colors ${
            selected === i ? "border-primary bg-accent" : "hover:bg-accent/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{amtTokens.toString()} {tokenLabel}</Badge>
          </div>
          {selected === i && renderFeeBreakdown(note.amount, tokenLabel)}
        </button>
      );
    });
  }

  const relayerCard = (
    <Card>
      <CardHeader>
        <CardTitle>Select Relayer</CardTitle>
      </CardHeader>
      <CardContent>
        <RelayerSelect selectedRelayer={selectedRelayer} onSelect={setSelectedRelayer} />
      </CardContent>
    </Card>
  );

  if (pendingClaim) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Claim Withdrawal</h1>
          <p className="text-muted-foreground">
            Step 2: Send the escrowed funds to a recipient address.
            The relayer submits this transaction — your wallet stays hidden.
          </p>
        </div>

        {relayerCard}

        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="0x... (enter recipient address)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              For maximum privacy, use a fresh wallet address that is not linked to your main account.
            </p>
            {renderFeeBreakdown(pendingClaim.amount, pendingClaim.tokenLabel)}
            {txStatus && (
              <p className="text-sm text-muted-foreground">
                Transaction status: <Badge variant="outline">{txStatus}</Badge>
              </p>
            )}
            <Button className="w-full" disabled={loading || !recipient || relayerDisabled} onClick={claimWithdrawal}>
              {loading ? `Processing${txStatus ? ` (${txStatus})` : ""}...` : "Claim Withdrawal"}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setPendingClaim(null)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Withdraw</h1>
        <p className="text-muted-foreground">
          Step 1: Generate a ZK proof locally, then the relayer submits it on-chain.
          Your secrets never leave your browser.
        </p>
      </div>

      {relayerCard}

      {(txStatus || proofStatus) && (
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

      <Tabs defaultValue="pool">
        <TabsList className="w-full">
          <TabsTrigger value="pool" className="flex-1">Pool Notes</TabsTrigger>
          <TabsTrigger value="amm" className="flex-1">AMM Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="pool">
          <Card>
            <CardHeader>
              <CardTitle>Select Pool Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderNoteList(poolNotes, selectedPool, setSelectedPool, false)}
              {selectedPool !== null && (
                <Button className="mt-4 w-full" disabled={loading || relayerDisabled} onClick={preparePoolWithdraw}>
                  {loading ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...` : "Generate Proof & Withdraw"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amm">
          <Card>
            <CardHeader>
              <CardTitle>Select AMM Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {renderNoteList(ammNotes, selectedAmm, setSelectedAmm, true)}
              {selectedAmm !== null && (
                <Button className="mt-4 w-full" disabled={loading || relayerDisabled} onClick={prepareAmmWithdraw}>
                  {loading ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...` : "Generate Proof & Withdraw"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
