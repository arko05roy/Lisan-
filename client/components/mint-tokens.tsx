"use client";

import { useState } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ADDRESSES } from "@/lib/addresses";
import { uint256 } from "starknet";
import { txToast, errorToast } from "@/components/tx-toast";

export function MintTokens() {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});
  const [amount, setAmount] = useState("1000");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);

  async function mint(tokenAddress: string, tokenName: string) {
    if (!address) return;
    const mintTo = recipient.trim() || address;
    setLoading(true);
    try {
      const u = uint256.bnToUint256(BigInt(amount) * 10n ** 18n);
      const result = await sendAsync([
        {
          contractAddress: tokenAddress,
          entrypoint: "mint",
          calldata: [mintTo, u.low.toString(), u.high.toString()],
        },
      ]);
      const t = txToast(result.transaction_hash);
      t.success();
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : `Failed to mint ${tokenName}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Testnet Faucet (Owner Only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Only the contract deployer can mint tokens. Mint to yourself or paste another address below.
        </p>
        <Input
          placeholder="Recipient (defaults to your wallet)"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <Input
          type="number"
          placeholder="Amount (whole tokens)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => mint(ADDRESSES.MOCK_BTC, "BTC")}
          >
            Mint BTC
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => mint(ADDRESSES.MOCK_STRK, "STRK")}
          >
            Mint STRK
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
