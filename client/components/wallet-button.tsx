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
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 backdrop-blur-sm">
          <div className="h-2.5 w-2.5 rounded-full bg-[#22C55E] pulse-dot" />
          <span className="text-sm font-mono font-semibold text-white/80 tracking-tight">{short}</span>
        </div>
        <button
          onClick={() => disconnect()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/80 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

  // Only show Braavos wallet
  const braavosConnector = connectors.find((c) => c.id.toLowerCase().includes("braavos"));

  if (!braavosConnector) {
    return (
      <Button disabled className="h-10 px-5 rounded-xl bg-white/[0.04] text-white/40 border border-white/[0.08]">
        <Wallet className="mr-2 h-4 w-4" strokeWidth={2.5} />
        Braavos Not Found
      </Button>
    );
  }

  return (
    <Button
      onClick={() => connect({ connector: braavosConnector })}
      className="h-10 px-5 rounded-xl bg-gradient-to-r from-[#8B8CFF] to-[#6B6DFF] hover:from-[#7B7CFF] hover:to-[#5B5DFF] text-white font-bold text-sm shadow-lg shadow-[#8B8CFF]/30 border-0 transition-all duration-200"
    >
      <Wallet className="mr-2 h-4 w-4" strokeWidth={2.5} />
      Connect Braavos
    </Button>
  );
}
