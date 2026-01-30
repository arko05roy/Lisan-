"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADDRESSES, TOKEN_TYPE_BTC, TOKEN_TYPE_STRK } from "@/lib/addresses";
import { generateSecret, computeCommitment, computeAmmCommitment } from "@/lib/crypto";
import { addNote } from "@/lib/storage";
import { buildApproveCall, buildCall } from "@/lib/contracts";
import { txToast, errorToast } from "@/components/tx-toast";
import { uint256 } from "starknet";

export default function DepositPage() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});

  const [poolAmount, setPoolAmount] = useState("");
  const [ammAmount, setAmmAmount] = useState("");
  const [ammToken, setAmmToken] = useState<"btc" | "strk">("btc");
  const [loading, setLoading] = useState(false);

  async function depositPool() {
    if (!address || !poolAmount) return;
    setLoading(true);
    try {
      const amountWei = BigInt(poolAmount) * 10n ** 18n;
      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const amountFelt = amountWei.toString();
      const commitment = computeCommitment(amountFelt, secret, nullifierSecret);

      const u = uint256.bnToUint256(amountWei);
      const calls = [
        buildApproveCall(ADDRESSES.MOCK_BTC, ADDRESSES.SHIELDED_POOL, amountWei),
        buildCall(ADDRESSES.SHIELDED_POOL, "deposit", [
          u.low.toString(), u.high.toString(),
          commitment,
        ]),
      ];

      const result = await sendAsync(calls);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "pool",
        commitment,
        amount: amountFelt,
        secret,
        nullifierSecret,
        spent: false,
        createdAt: Date.now(),
      });

      t.success();
      setPoolAmount("");
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "Deposit failed");
    } finally {
      setLoading(false);
    }
  }

  async function depositAmm() {
    if (!address || !ammAmount) return;
    setLoading(true);
    try {
      const amountWei = BigInt(ammAmount) * 10n ** 18n;
      const tokenType = ammToken === "btc" ? TOKEN_TYPE_BTC : TOKEN_TYPE_STRK;
      const tokenAddress = ammToken === "btc" ? ADDRESSES.MOCK_BTC : ADDRESSES.MOCK_STRK;

      const secret = generateSecret();
      const nullifierSecret = generateSecret();
      const amountFelt = amountWei.toString();
      const commitment = computeAmmCommitment(amountFelt, tokenType, secret, nullifierSecret);

      const u = uint256.bnToUint256(amountWei);
      const calls = [
        buildApproveCall(tokenAddress, ADDRESSES.SHIELDED_AMM, amountWei),
        buildCall(ADDRESSES.SHIELDED_AMM, "deposit", [
          tokenType,
          u.low.toString(), u.high.toString(),
          commitment,
        ]),
      ];

      const result = await sendAsync(calls);
      const t = txToast(result.transaction_hash);

      addNote({
        type: "amm",
        commitment,
        amount: amountFelt,
        tokenType,
        secret,
        nullifierSecret,
        spent: false,
        createdAt: Date.now(),
      });

      t.success();
      setAmmAmount("");
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : "AMM deposit failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Deposit</h1>
        <p className="text-muted-foreground">
          Deposit tokens into the Shielded Pool or AMM
        </p>
      </div>

      <Tabs defaultValue="pool">
        <TabsList className="w-full">
          <TabsTrigger value="pool" className="flex-1">Shielded Pool</TabsTrigger>
          <TabsTrigger value="amm" className="flex-1">Shielded AMM</TabsTrigger>
        </TabsList>

        <TabsContent value="pool">
          <Card>
            <CardHeader>
              <CardTitle>Pool Deposit (mBTC)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Amount (whole tokens)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={poolAmount}
                  onChange={(e) => setPoolAmount(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A secret and nullifier will be generated automatically. Your note will be stored in localStorage.
              </p>
              <Button className="w-full" disabled={loading || !address || !poolAmount} onClick={depositPool}>
                {loading ? "Processing..." : "Deposit to Pool"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amm">
          <Card>
            <CardHeader>
              <CardTitle>AMM Deposit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Token</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    size="sm"
                    variant={ammToken === "btc" ? "default" : "outline"}
                    onClick={() => setAmmToken("btc")}
                  >
                    mBTC
                  </Button>
                  <Button
                    size="sm"
                    variant={ammToken === "strk" ? "default" : "outline"}
                    onClick={() => setAmmToken("strk")}
                  >
                    mSTRK
                  </Button>
                </div>
              </div>
              <div>
                <Label>Amount (whole tokens)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={ammAmount}
                  onChange={(e) => setAmmAmount(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={loading || !address || !ammAmount} onClick={depositAmm}>
                {loading ? "Processing..." : "Deposit to AMM"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
