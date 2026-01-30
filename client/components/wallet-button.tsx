"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "@/components/ui/button";
import { LogOut, Wallet } from "lucide-react";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2">
          <div className="h-2 w-2 rounded-full bg-[#22C55E] pulse-dot" />
          <span className="text-[13px] font-mono text-white/60">{short}</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-white/60 hover:bg-white/[0.08] transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.id}
          variant="outline"
          size="sm"
          onClick={() => connect({ connector })}
          className="border-white/[0.08] bg-white/[0.04] hover:bg-[#8B8CFF]/10 hover:border-[#8B8CFF]/20 hover:text-white text-white/60 transition-all duration-200 rounded-xl"
        >
          <Wallet className="mr-2 h-4 w-4" />
          {connector.name}
        </Button>
      ))}
    </div>
  );
}
