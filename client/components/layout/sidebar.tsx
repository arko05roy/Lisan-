"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Wallet,
  ArrowRightLeft,
  Shield,
  Zap,
  TrendingUp,
  Vote,
  Settings,
  Network
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Wallet", icon: Wallet },
  { href: "/deposit", label: "Shielded Pool", icon: Shield },
  { href: "/execute", label: "Private Execute", icon: Zap },
  { href: "/swap", label: "Swap", icon: ArrowRightLeft },
  { href: "/predict", label: "Predict", icon: TrendingUp },
  { href: "/vote", label: "Vote", icon: Vote },
  { href: "/relayer-dashboard", label: "Relayers", icon: Network },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 border-r border-white/[0.04] bg-[#08090D] flex flex-col items-center py-8 z-50">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-12 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B8CFF] to-[#6B6DFF] shadow-lg shadow-[#8B8CFF]/20 transition-transform hover:scale-105"
      >
        <Shield className="h-6 w-6 text-white" strokeWidth={2.5} />
      </Link>

      {/* Navigation */}
      <nav className="flex flex-col gap-2 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative group flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200",
                active
                  ? "bg-[#8B8CFF] text-white shadow-lg shadow-[#8B8CFF]/30"
                  : "text-white/40 hover:text-white hover:bg-white/[0.06]"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />

              {/* Tooltip on hover */}
              <div className="absolute left-full ml-4 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/[0.08] text-sm font-semibold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A1D23]" />
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <button className="flex h-12 w-12 items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-all duration-200">
        <Settings className="h-5 w-5" strokeWidth={2} />
      </button>
    </aside>
  );
}
