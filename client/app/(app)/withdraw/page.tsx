"use client";

import { useState, useEffect } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPoolNotes, getAmmNotes,
  markPoolNoteSpent, markAmmNoteSpent,
  PoolNote, AmmNote,
} from "@/lib/storage";
import { computeNullifierHash } from "@/lib/crypto";
import { buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { ADDRESSES, TOKEN_TYPE_BTC } from "@/lib/addresses";
import { uint256 } from "starknet";

interface PendingClaim {
  nullifierHash: string;
  source: "pool" | "amm";
}

export default function WithdrawPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  const [poolNotes, setPoolNotes] = useState<PoolNote[]>([]);
  const [ammNotes, setAmmNotes] = useState<AmmNote[]>([]);
  const [selectedPool, setSelectedPool] = useState<number | null>(null);
  const [selectedAmm, setSelectedAmm] = useState<number | null>(null);
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<PendingClaim | null>(null);

  useEffect(() => {
    setPoolNotes(getPoolNotes().filter((n) => !n.spent));
    setAmmNotes(getAmmNotes().filter((n) => !n.spent));
  }, []);

  async function preparePoolWithdraw() {
    if (!address || selectedPool === null) return;
    const note = poolNotes[selectedPool];
    setLoading(true);
    try {
      const nullifierHash = computeNullifierHash(note.nullifierSecret);
      const withdrawAmountBig = BigInt(note.amount);
      const u = uint256.bnToUint256(withdrawAmountBig);

      const result = await sendAsync([
        buildCall(ADDRESSES.SHIELDED_POOL, "prepare_withdraw", [
          note.commitment,
          nullifierHash,
          note.amount,
          note.secret,
          note.nullifierSecret,
          u.low.toString(), u.high.toString(),
        ]),
      ]);
      const t = txToast(result.transaction_hash);
      markPoolNoteSpent(note.commitment);
      t.success();
      setPoolNotes(getPoolNotes().filter((n) => !n.spent));
      setPendingClaim({ nullifierHash, source: "pool" });
      setSelectedPool(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Prepare withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  async function prepareAmmWithdraw() {
    if (!address || selectedAmm === null) return;
    const note = ammNotes[selectedAmm];
    setLoading(true);
    try {
      const nullifierHash = computeNullifierHash(note.nullifierSecret);
      const withdrawAmountBig = BigInt(note.amount);
      const u = uint256.bnToUint256(withdrawAmountBig);

      const result = await sendAsync([
        buildCall(ADDRESSES.SHIELDED_AMM, "prepare_withdraw", [
          note.commitment,
          nullifierHash,
          note.amount,
          note.tokenType,
          note.secret,
          note.nullifierSecret,
          u.low.toString(), u.high.toString(),
        ]),
      ]);
      const t = txToast(result.transaction_hash);
      markAmmNoteSpent(note.commitment);
      t.success();
      setAmmNotes(getAmmNotes().filter((n) => !n.spent));
      setPendingClaim({ nullifierHash, source: "amm" });
      setSelectedAmm(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "AMM prepare withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  async function claimWithdrawal() {
    if (!address || !pendingClaim) return;
    const recip = recipient || address;
    setLoading(true);
    try {
      const contractAddr = pendingClaim.source === "pool"
        ? ADDRESSES.SHIELDED_POOL
        : ADDRESSES.SHIELDED_AMM;

      const result = await sendAsync([
        buildCall(contractAddr, "claim_withdrawal", [
          pendingClaim.nullifierHash,
          recip,
        ]),
      ]);
      const t = txToast(result.transaction_hash);
      t.success();
      setPendingClaim(null);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setLoading(false);
    }
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
            <span className="text-sm font-mono">{note.commitment.slice(0, 16)}...</span>
            <Badge variant="secondary">{amtTokens.toString()} {tokenLabel}</Badge>
          </div>
        </button>
      );
    });
  }

  if (pendingClaim) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Claim Withdrawal</h1>
          <p className="text-muted-foreground">
            Step 2: Send the escrowed funds to a recipient address.
            This can be called from any wallet for privacy.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recipient</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="0x... (defaults to your wallet)"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              For maximum privacy, use a fresh wallet address that is not linked to your main account.
            </p>
            <Button className="w-full" disabled={loading || !address} onClick={claimWithdrawal}>
              {loading ? "Processing..." : "Claim Withdrawal"}
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
          Step 1: Prepare withdrawal — proves note ownership and escrows funds.
          No recipient address is revealed on-chain.
        </p>
      </div>

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
                <Button className="mt-4 w-full" disabled={loading || !address} onClick={preparePoolWithdraw}>
                  {loading ? "Processing..." : "Prepare Withdrawal"}
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
                <Button className="mt-4 w-full" disabled={loading || !address} onClick={prepareAmmWithdraw}>
                  {loading ? "Processing..." : "Prepare Withdrawal"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
