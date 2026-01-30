"use client";

import { useState, useEffect } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getPoolNotes, addNote, markPoolNoteSpent, PoolNote } from "@/lib/storage";
import { generateSecret, computeCommitment, computeNullifierHash } from "@/lib/crypto";
import { buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { ADDRESSES } from "@/lib/addresses";

export default function TransferPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  const [notes, setNotes] = useState<PoolNote[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [transferAmount, setTransferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipientSecrets, setRecipientSecrets] = useState<string | null>(null);

  useEffect(() => {
    setNotes(getPoolNotes().filter((n) => !n.spent));
  }, []);

  const selectedNote = selectedIdx !== null ? notes[selectedIdx] : null;

  async function handleTransfer() {
    if (!address || !selectedNote || !transferAmount) return;
    setLoading(true);
    setRecipientSecrets(null);
    try {
      const transferAmountWei = BigInt(transferAmount) * 10n ** 18n;
      const oldAmountBig = BigInt(selectedNote.amount);
      const changeAmount = oldAmountBig - transferAmountWei;

      if (changeAmount < 0n) {
        errorToast("Transfer amount exceeds note balance");
        setLoading(false);
        return;
      }

      const nullifierHash = computeNullifierHash(selectedNote.nullifierSecret);

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

      const calldata = [
        selectedNote.commitment,
        nullifierHash,
        selectedNote.amount,
        selectedNote.secret,
        selectedNote.nullifierSecret,
        newCommitmentSender,
        newCommitmentRecipient,
        changeAmount.toString(),
        transferAmountWei.toString(),
        newSecretSender,
        newNullifierSecretSender,
        newSecretRecipient,
        newNullifierSecretRecipient,
      ];

      const result = await sendAsync([
        buildCall(ADDRESSES.SHIELDED_POOL, "transfer", calldata),
      ]);
      const t = txToast(result.transaction_hash);

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
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shielded Transfer</h1>
        <p className="text-muted-foreground">
          Transfer within the shielded pool without revealing amounts
        </p>
      </div>

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
            <Button className="w-full" disabled={loading || !transferAmount} onClick={handleTransfer}>
              {loading ? "Processing..." : "Transfer"}
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
