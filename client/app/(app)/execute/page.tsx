"use client";

import { useState } from "react";
import { PrivateExecute } from "@/components/privacy/private-execute";
import { RelayerSelect } from "@/components/relayer-select";
import { Relayer } from "@/lib/relayer-registry";
import { Card, CardContent } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function ExecutePage() {
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Private Execute
        </h1>
        <p className="text-muted-foreground max-w-lg">
          Interact with any Starknet contract using your shielded funds. The pool acts
          as a private proxy — nobody knows who initiated the call.
        </p>
      </div>

      {/* Relayer Selection Card */}
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <RelayerSelect
            selectedRelayer={selectedRelayer}
            onSelect={setSelectedRelayer}
          />
        </CardContent>
      </Card>

      {/* Private Execute Component */}
      <PrivateExecute relayer={selectedRelayer} />

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-sm">How it works</h3>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li>• Select a shielded note with the token you want to use</li>
            <li>• Enter the target contract address and function calldata</li>
            <li>• The pool approves and executes the call on your behalf</li>
            <li>• Any unused funds are returned as change (new shielded note)</li>
            <li>• On-chain, only the pool address is visible — not you</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
