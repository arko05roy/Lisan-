"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { WalletButton } from "@/components/wallet-button";
import { Separator } from "@/components/ui/separator";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <span className="text-sm font-medium text-muted-foreground">
            Private Bitcoin DeFi
          </span>
          <WalletButton />
        </header>
        <Separator />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
