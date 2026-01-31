"use client";

import { Navbar } from "@/components/layout/navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-[#0B0F14]">
      <Navbar />
      <main className="flex-1 overflow-y-auto custom-scrollbar p-8">
        {children}
      </main>
    </div>
  );
}
