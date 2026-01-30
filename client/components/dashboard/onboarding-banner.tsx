"use client";

import { useConnect } from "@starknet-react/core";
import Link from "next/link";
import {
  Shield,
  Wallet,
  Coins,
  ArrowDownToLine,
  Check,
  ChevronRight,
  ArrowRight,
} from "lucide-react";

type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  done: boolean;
  action?: React.ReactNode;
};

interface OnboardingBannerProps {
  isConnected: boolean;
  hasTokens: boolean;
  hasNotes: boolean;
  onOpenFaucet: () => void;
}

export function OnboardingBanner({
  isConnected,
  hasTokens,
  hasNotes,
  onOpenFaucet,
}: OnboardingBannerProps) {
  const { connect, connectors } = useConnect();

  // All done — hide the banner
  if (isConnected && hasTokens && hasNotes) return null;

  const steps: OnboardingStep[] = [
    {
      id: "connect",
      label: "Connect Wallet",
      description: "Link your Argent or Braavos wallet to get started",
      icon: <Wallet className="h-4 w-4" strokeWidth={1.5} />,
      done: isConnected,
      action: !isConnected ? (
        <div className="flex gap-2 mt-2">
          {connectors.map((c) => (
            <button
              key={c.id}
              onClick={() => connect({ connector: c })}
              className="flex items-center gap-1.5 rounded-lg bg-[#8B8CFF] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#6F73FF] transition-colors"
            >
              {c.name}
            </button>
          ))}
        </div>
      ) : undefined,
    },
    {
      id: "faucet",
      label: "Get Testnet Tokens",
      description: "Mint free mBTC and mSTRK from the faucet to experiment",
      icon: <Coins className="h-4 w-4" strokeWidth={1.5} />,
      done: hasTokens,
      action:
        isConnected && !hasTokens ? (
          <button
            onClick={onOpenFaucet}
            className="flex items-center gap-1.5 rounded-lg bg-[#8B8CFF]/15 border border-[#8B8CFF]/20 px-3 py-1.5 text-[12px] font-semibold text-[#8B8CFF] hover:bg-[#8B8CFF]/25 transition-colors mt-2"
          >
            <Coins className="h-3.5 w-3.5" strokeWidth={1.5} />
            Open Faucet
          </button>
        ) : undefined,
    },
    {
      id: "deposit",
      label: "Make Your First Deposit",
      description: "Deposit tokens into the Shielded Pool to make them private",
      icon: <ArrowDownToLine className="h-4 w-4" strokeWidth={1.5} />,
      done: hasNotes,
      action:
        isConnected && hasTokens && !hasNotes ? (
          <Link
            href="/deposit"
            className="flex items-center gap-1.5 rounded-lg bg-[#8B8CFF]/15 border border-[#8B8CFF]/20 px-3 py-1.5 text-[12px] font-semibold text-[#8B8CFF] hover:bg-[#8B8CFF]/25 transition-colors mt-2"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" strokeWidth={1.5} />
            Go to Deposit
          </Link>
        ) : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const currentStepIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="rounded-2xl border border-[#8B8CFF]/10 bg-gradient-to-br from-[#8B8CFF]/[0.04] to-transparent overflow-hidden animate-fade-in-up stagger-1">
      {/* Header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B8CFF]/10 border border-[#8B8CFF]/15">
              <Shield className="h-5 w-5 text-[#8B8CFF]" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">
                Welcome to Lisan
              </h2>
              <p className="text-[12px] text-white/40 mt-0.5">
                Private Bitcoin DeFi on Starknet — follow these steps to get started
              </p>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-white/30 bg-white/[0.04] rounded-full px-2.5 py-1">
            {completedCount}/{steps.length}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#8B8CFF] transition-all duration-500 ease-out"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-3 pb-3">
        {steps.map((step, i) => {
          const isCurrent = i === currentStepIdx;
          return (
            <div
              key={step.id}
              className={`
                rounded-xl px-4 py-3 transition-all duration-200
                ${isCurrent ? "bg-white/[0.04] border border-white/[0.06]" : "border border-transparent"}
                ${step.done ? "opacity-50" : ""}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Step indicator */}
                <div
                  className={`
                    mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors
                    ${step.done
                      ? "bg-[#22C55E]/15 text-[#22C55E]"
                      : isCurrent
                        ? "bg-[#8B8CFF]/15 text-[#8B8CFF] ring-1 ring-[#8B8CFF]/20"
                        : "bg-white/[0.04] text-white/20"
                    }
                  `}
                >
                  {step.done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    i + 1
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[13px] font-semibold ${
                        step.done
                          ? "text-white/50 line-through decoration-white/20"
                          : isCurrent
                            ? "text-white"
                            : "text-white/40"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#8B8CFF] bg-[#8B8CFF]/10 px-1.5 py-0.5 rounded">
                        Next
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] mt-0.5 ${isCurrent ? "text-white/40" : "text-white/25"}`}>
                    {step.description}
                  </p>
                  {step.action}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
