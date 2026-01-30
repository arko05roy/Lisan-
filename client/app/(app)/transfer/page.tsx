"use client";

import { useState, useEffect } from "react";
import { useAccount } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getPoolNotes, addNote, markPoolNoteSpent, PoolNote } from "@/lib/storage";
import { generateSecret, computeCommitment, computeNullifierHash } from "@/lib/crypto";
import { txToast, errorToast } from "@/components/tx-toast";
import { MerkleTree } from "@/lib/merkle";
import { generatePoolTransferProof } from "@/lib/prover";
import { relayTransfer, getRelayTxStatus } from "@/lib/relay";
import { Relayer, resolveRelayerBaseUrl } from "@/lib/relayer-registry";
import { RelayerSelect } from "@/components/relayer-select";

export default function TransferPage() {
  const { address } = useAccount();

  const [notes, setNotes] = useState<PoolNote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [proofStatus, setProofStatus] = useState<string | null>(null);
  const [recipientSecrets, setRecipientSecrets] = useState<string | null>(null);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  useEffect(() => {
    setNotes(getPoolNotes().filter((n) => !n.spent));
  }, []);

  const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;
  const relayerUrl = selectedRelayer ? resolveRelayerBaseUrl(selectedRelayer) : "";
  const relayerDisabled = !selectedRelayer || selectedRelayer.status === "offline";

  async function handleTransfer() {
    if (!address || !selectedNote || !transferAmount || relayerDisabled) return;
    setLoading(true);
    setRecipientSecrets(null);
    setProofStatus(null);
    try {
      const transferAmountWei = BigInt(transferAmount) * 10n ** 18n;
      const oldAmountBig = BigInt(selectedNote.amount);
      const changeAmount = oldAmountBig - transferAmountWei;

      if (changeAmount < 0n) {
        errorToast("Transfer amount exceeds note balance");
        setLoading(false);
        return;
      }

      // Generate new secrets for sender change note
      const newSecretSender = generateSecret();
      const newNullifierSecretSender = generateSecret();
      const newCommitmentSender = computeCommitment(
        changeAmount.toString(),
        newSecretSender,
        newNullifierSecretSender,
      );

      // Generate new secrets for recipient note
      const newSecretRecipient = generateSecret();
      const newNullifierSecretRecipient = generateSecret();
      const newCommitmentRecipient = computeCommitment(
        transferAmountWei.toString(),
        newSecretRecipient,
        newNullifierSecretRecipient,
      );

      // Build Merkle tree and generate ZK proof
      setProofStatus("Building Merkle tree...");
      const tree = new MerkleTree();
      await tree.initialize();
      const leafIndex = await tree.insert(BigInt(selectedNote.commitment));

      setProofStatus("Generating ZK proof...");
      const path = await tree.getPath(leafIndex);
      const { fullProofWithHints, publicSignals } = await generatePoolTransferProof(
        selectedNote,
        path,
        changeAmount.toString(),
        transferAmountWei.toString(),
        newSecretSender,
        newNullifierSecretSender,
        newSecretRecipient,
        newNullifierSecretRecipient,
      );

      const root = publicSignals[0];
      const nullifierHash = computeNullifierHash(selectedNote.nullifierSecret);

      setProofStatus("Sending to relayer...");
      const { transactionHash } = await relayTransfer(relayerUrl, {
        fullProofWithHints,
        root,
        nullifierHash,
        newCommitmentSender,
        newCommitmentRecipient,
      });
      const t = txToast(transactionHash);

      // Mark old note as spent
      markPoolNoteSpent(selectedNote.commitment);

      // Save sender change note (if > 0)
      if (changeAmount > 0n) {
        addNote({
          type: "pool",
          commitment: newCommitmentSender,
          amount: changeAmount.toString(),
          secret: newSecretSender,
          nullifierSecret: newNullifierSecretSender,
          spent: false,
          createdAt: Date.now(),
        });
      }

      // Save recipient note locally (for self-transfers)
      addNote({
        type: "pool",
        commitment: newCommitmentRecipient,
        amount: transferAmountWei.toString(),
        secret: newSecretRecipient,
        nullifierSecret: newNullifierSecretRecipient,
        spent: false,
        createdAt: Date.now(),
      });

      // Display recipient secrets for sharing
      setRecipientSecrets(
        JSON.stringify({
          commitment: newCommitmentRecipient,
          amount: transferAmountWei.toString(),
          secret: newSecretRecipient,
          nullifierSecret: newNullifierSecretRecipient,
        }, null, 2),
      );

      t.success();
      setNotes(getPoolNotes().filter((n) => !n.spent));
      setSelectedIdx(null);
      setTransferAmount("");
      setProofStatus(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
      setProofStatus(null);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shielded Transfer</h1>
        <p className="text-muted-foreground">
          Transfer within the shielded pool using ZK proofs. Secrets never leave your browser.
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

      {proofStatus && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">{proofStatus}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No unspent pool notes. Deposit first.</p>
          ) : (
            notes.map((note, i) => {
              const amtTokens = BigInt(note.amount) / 10n ** 18n;
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
                    <Badge variant="secondary">{amtTokens.toString()} mBTC</Badge>
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
            <CardTitle>Transfer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Transfer Amount (whole tokens)</Label>
              <Input
                type="number"
                placeholder="e.g. 50"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Note balance: {(BigInt(selectedNote.amount) / 10n ** 18n).toString()} mBTC
              </p>
            </div>
            <Button className="w-full" disabled={loading || !transferAmount || relayerDisabled} onClick={handleTransfer}>
              {loading ? `Processing${proofStatus ? ` — ${proofStatus}` : ""}...` : "Generate Proof & Transfer"}
            </Button>
          </CardContent>
        </Card>
      )}

      {recipientSecrets && (
        <Card className="border-yellow-500/50">
          <CardHeader>
            <CardTitle className="text-yellow-500">Recipient Secrets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Share these secrets with the recipient so they can withdraw. Copy and send securely.
            </p>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{recipientSecrets}</pre>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(recipientSecrets)}
            >
              Copy to clipboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
