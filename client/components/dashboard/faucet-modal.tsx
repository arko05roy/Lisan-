"use client";

import { useState } from "react";
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

export function FaucetModal() {
    const { address } = useAccount();
    const { sendAsync } = useSendTransaction({});
    const [amount, setAmount] = useState("1000");
    const [recipient, setRecipient] = useState("");
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

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
            setOpen(false);
        } catch (e: unknown) {
            errorToast(e instanceof Error ? e.message : `Failed to mint ${tokenName}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-white/10 bg-white/5 hover:bg-white/10">
                    <Coins className="mr-2 h-4 w-4" /> Faucet
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Testnet Faucet</DialogTitle>
                    <DialogDescription>
                        Mint mock tokens for testing. Only works if you are the contract deployer (for now).
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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
                    <div className="flex flex-col gap-2">
                        <Button
                            disabled={loading}
                            onClick={() => mint(ADDRESSES.MOCK_BTC, "MockBTC")}
                        >
                            Mint mBTC
                        </Button>
                        <Button
                            variant="secondary"
                            disabled={loading}
                            onClick={() => mint(ADDRESSES.MOCK_STRK, "MockSTRK")}
                        >
                            Mint mSTRK
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
