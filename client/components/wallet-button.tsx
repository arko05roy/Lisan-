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
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-muted-foreground">{short}</span>
        <Button variant="ghost" size="icon" onClick={() => disconnect()}>
          <LogOut className="h-4 w-4" />
        </Button>
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
        >
          <Wallet className="mr-2 h-4 w-4" />
          {connector.name}
        </Button>
      ))}
    </div>
  );
}
