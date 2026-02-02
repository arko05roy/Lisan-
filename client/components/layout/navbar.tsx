"use client";

import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/wallet-button";
import { Shield, Zap, ArrowRightLeft, TrendingUp, Vote } from "lucide-react";

const PAGE_TITLES: Record<string, { title: string; subtitle: string; icon: typeof Shield }> = {
  "/dashboard": { title: "Wallet", subtitle: "Manage your shielded assets", icon: Shield },
  "/deposit": { title: "Shielded Pool", subtitle: "Deposit & withdraw privately", icon: Shield },
  "/execute": { title: "Private Execute", subtitle: "Interact with contracts anonymously", icon: Zap },
  "/swap": { title: "Swap", subtitle: "Trade tokens privately", icon: ArrowRightLeft },
  "/predict": { title: "Predict", subtitle: "Prediction markets", icon: TrendingUp },
  "/vote": { title: "Vote", subtitle: "Private governance", icon: Vote },
  "/transfer": { title: "Transfer", subtitle: "Send funds privately", icon: Shield },
  "/withdraw": { title: "Withdraw", subtitle: "Claim shielded funds", icon: Shield },
};

export function Navbar() {
  const pathname = usePathname();
  const pageInfo = PAGE_TITLES[pathname] || { title: "Lisan Wallet", subtitle: "Privacy-first wallet", icon: Shield };
  const Icon = pageInfo.icon;

  return (
    <header className="flex h-20 items-center justify-between border-b border-white/[0.04] bg-[#08090D]/80 backdrop-blur-xl px-8">
      {/* Page Title */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B8CFF]/10">
          <Icon className="h-6 w-6 text-[#8B8CFF]" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">{pageInfo.title}</h1>
          <p className="text-sm text-white/40">{pageInfo.subtitle}</p>
        </div>
      </div>

      {/* Wallet Connection */}
      <div className="flex items-center gap-4">
        <WalletButton />
      </div>
    </header>
  );
}
