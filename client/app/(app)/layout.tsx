"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { WalletButton } from "@/components/wallet-button";
import { Shield } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0F14]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 items-center justify-between border-b border-white/[0.06] px-8">
          <div className="flex items-center gap-2.5">
            <Shield className="h-4 w-4 text-white/20" strokeWidth={1.5} />
            <span className="text-[13px] font-medium text-white/40 tracking-wide">
              Private Bitcoin DeFi
            </span>
          </div>
          <WalletButton />
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
