"use client";

import { useState } from "react";
import { PrivateExecute } from "@/components/privacy/private-execute";
import { RelayerSelect } from "@/components/relayer-select";
import { Relayer } from "@/lib/relayer-registry";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Lock, Eye, EyeOff, Shield } from "lucide-react";

export default function ExecutePage() {
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8B8CFF]/10 via-[#6B6DFF]/5 to-transparent border border-[#8B8CFF]/20 p-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#8B8CFF]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#8B8CFF]/10 border border-[#8B8CFF]/20">
            <Lock className="h-3.5 w-3.5 text-[#8B8CFF]" />
            <span className="text-xs font-semibold text-[#8B8CFF] uppercase tracking-wider">
              Zero-Knowledge Execution
            </span>
          </div>
          <div>
            <h1 className="text-5xl font-bold tracking-tight text-white mb-4 leading-tight">
              Execute Privately
            </h1>
            <p className="text-lg text-white/60 max-w-2xl leading-relaxed">
              Interact with any Starknet contract using your shielded funds. The pool acts as a private proxy — on-chain observers only see the pool address, never yours.
            </p>
          </div>

          {/* Privacy Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B8CFF]/10 shrink-0">
                <EyeOff className="h-5 w-5 text-[#8B8CFF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Anonymous</p>
                <p className="text-xs text-white/40">Identity hidden</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B8CFF]/10 shrink-0">
                <Shield className="h-5 w-5 text-[#8B8CFF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Verified</p>
                <p className="text-xs text-white/40">ZK proofs</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B8CFF]/10 shrink-0">
                <Zap className="h-5 w-5 text-[#8B8CFF]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Instant</p>
                <p className="text-xs text-white/40">No delays</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Relayer Selection Card */}
      <Card className="border-white/[0.06] bg-[#0D1117] backdrop-blur-xl">
        <CardContent className="pt-6">
          <RelayerSelect
            selectedRelayer={selectedRelayer}
            onSelect={setSelectedRelayer}
          />
        </CardContent>
      </Card>

      {/* Private Execute Component */}
      <PrivateExecute relayer={selectedRelayer} />

      {/* How it Works */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#0D1117] p-8">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Eye className="h-5 w-5 text-[#8B8CFF]" />
          How It Works
        </h3>
        <div className="space-y-4">
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
  );
}
