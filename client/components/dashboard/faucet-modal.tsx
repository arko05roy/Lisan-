"use client";

import { useState, useEffect } from "react";
import { useAccount, useSendTransaction } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ADDRESSES } from "@/lib/addresses";
import { uint256 } from "starknet";
import { txToast, errorToast } from "@/components/tx-toast";
import { Coins } from "lucide-react";

interface FaucetModalProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function FaucetModal({ externalOpen, onExternalOpenChange }: FaucetModalProps) {
  const { address } = useAccount();
  const { sendAsync } = useSendTransaction({});
  const [amount, setAmount] = useState("1000");
  const [recipient, setRecipient] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Sync with external open state
  useEffect(() => {
    if (externalOpen !== undefined) {
      setOpen(externalOpen);
    }
  }, [externalOpen]);

  function handleOpenChange(val: boolean) {
    setOpen(val);
    onExternalOpenChange?.(val);
  }

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
      handleOpenChange(false);
    } catch (e: unknown) {
      errorToast(e instanceof Error ? e.message : `Failed to mint ${tokenName}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 rounded-xl bg-[#8B8CFF]/10 border border-[#8B8CFF]/15 px-3.5 py-2 text-[13px] font-medium text-[#8B8CFF] hover:bg-[#8B8CFF]/15 transition-all duration-200">
          <Coins className="h-4 w-4" strokeWidth={1.5} />
          Faucet
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[#151B23] border-white/[0.08] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Testnet Faucet</DialogTitle>
          <DialogDescription className="text-white/40">
            Mint free testnet tokens to start experimenting with private DeFi. These have no real value.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5 block">
              Recipient address
            </label>
            <Input
              placeholder="Defaults to your connected wallet"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-white/[0.03] border-white/[0.08] rounded-xl text-white placeholder:text-white/25 focus:border-[#8B8CFF]/30"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-white/30 mb-1.5 block">
              Amount (whole tokens)
            </label>
            <Input
              type="number"
              placeholder="1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/[0.03] border-white/[0.08] rounded-xl text-white placeholder:text-white/25 focus:border-[#8B8CFF]/30"
            />
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <Button
              disabled={loading}
              onClick={() => mint(ADDRESSES.MOCK_BTC, "MockBTC")}
              className="bg-[#8B8CFF] hover:bg-[#6F73FF] text-white rounded-xl h-10 font-medium"
            >
              Mint mBTC
            </Button>
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => mint(ADDRESSES.MOCK_STRK, "MockSTRK")}
              className="bg-white/[0.06] hover:bg-white/[0.1] text-white/70 border border-white/[0.06] rounded-xl h-10"
            >
              Mint mSTRK
            </Button>
          </div>
          <p className="text-[10px] text-white/20 text-center">
            Only works if your wallet is the contract deployer
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
