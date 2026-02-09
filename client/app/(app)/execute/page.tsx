"use client";

import { useState, useEffect, Fragment } from "react";
import { useProvider } from "@starknet-react/core";
import { PrivateExecute } from "@/components/privacy/private-execute";
import { RelayerSelect } from "@/components/relayer-select";
import { Relayer } from "@/lib/relayer-registry";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Lock, Eye, EyeOff, Shield, Network, ChevronDown } from "lucide-react";
import { isCoordinatorAvailable, getFeeBps } from "@/lib/coordinator-relay";
import { RpcProvider } from "starknet";
import { cn } from "@/lib/utils";

export default function ExecutePage() {
  const { provider } = useProvider();
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);
  const [useCoordinator, setUseCoordinator] = useState(false);
  const [coordinatorReady, setCoordinatorReady] = useState(false);
  const [feeBps, setFeeBps] = useState(10);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    if (provider) {
      isCoordinatorAvailable(provider as unknown as RpcProvider).then((available) => {
        setCoordinatorReady(available);
        if (available) {
          setUseCoordinator(true);
          getFeeBps(provider as unknown as RpcProvider).then((bps) => setFeeBps(bps)).catch(() => {});
        }
      }).catch(() => {});
    }
  }, [provider]);

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8B8CFF]/10 border border-[#8B8CFF]/20 mb-3">
          <Lock className="h-3.5 w-3.5 text-[#8B8CFF]" />
          <span className="text-xs font-semibold text-[#8B8CFF] uppercase tracking-wider">
            Zero-Knowledge Execution
          </span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-white mb-2">
          Execute Privately
        </h1>
        <p className="text-[13px] text-white/40 leading-relaxed max-w-xl">
          Call any Starknet contract using shielded funds. On-chain, only the pool address is visible — never yours.
        </p>
      </div>

      {/* Relayer Selection Card */}
      <Card className="border-white/[0.06] bg-[#0D1117] backdrop-blur-xl">
        <CardContent className="pt-6 space-y-4">
          {coordinatorReady && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-[#8B8CFF]/20 bg-[#8B8CFF]/5">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-[#8B8CFF]" />
                <span className="text-sm font-medium text-white/80">On-Chain Relayer Network</span>
                <span className="text-xs text-white/40">(fee: {(feeBps / 100).toFixed(1)}%)</span>
              </div>
              <button
                onClick={() => setUseCoordinator(!useCoordinator)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  useCoordinator ? "bg-[#8B8CFF]" : "bg-white/20"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    useCoordinator ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
          )}
          {!useCoordinator && (
            <RelayerSelect
              selectedRelayer={selectedRelayer}
              onSelect={setSelectedRelayer}
            />
          )}
        </CardContent>
      </Card>

      {/* Private Execute Component */}
      <PrivateExecute relayer={selectedRelayer} useCoordinator={useCoordinator} feeBps={feeBps} />

      {/* How it Works (collapsible) */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D1117] overflow-hidden">
        <button
          onClick={() => setShowHowItWorks(!showHowItWorks)}
          className="w-full flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors"
        >
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#8B8CFF]" />
            How It Works
          </h3>
          <ChevronDown
            className={cn("h-4 w-4 text-white/40 transition-transform duration-200", showHowItWorks && "rotate-180")}
          />
        </button>
        <div className={cn(
          "overflow-hidden transition-all duration-300",
          showHowItWorks ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}>
          <div className="px-6 pb-6 space-y-4">
            {[
              { step: "1", text: "Select a shielded note with the token you want to use" },
              { step: "2", text: "Enter the target contract address and function to call" },
              { step: "3", text: "The pool generates a ZK proof and executes on your behalf" },
              { step: "4", text: "Unused funds are returned as a new shielded note (change)" },
              { step: "5", text: "On-chain, only the pool address is visible — not you" },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B8CFF]/10 text-[#8B8CFF] font-bold text-sm shrink-0">
                  {step}
                </div>
                <p className="text-sm text-white/60 pt-1">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
