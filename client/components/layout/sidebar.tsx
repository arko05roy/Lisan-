"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Repeat,
  TrendingUp,
  Vote,
  Shield,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Privacy",
    items: [
      { href: "/deposit", label: "Privacy Hub", icon: Shield },
      { href: "/transfer", label: "Transfer", icon: ArrowRightLeft },
    ],
  },
  {
    label: "AMM",
    items: [
      { href: "/swap", label: "Swap", icon: Repeat },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/predict", label: "Predict", icon: TrendingUp },
      { href: "/vote", label: "Vote", icon: Vote },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] flex-col border-r border-white/[0.06] bg-[#11161D]">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B8CFF]/15">
          <Shield className="h-4 w-4 text-[#8B8CFF]" strokeWidth={1.5} />
        </div>
        <div className="flex items-baseline gap-2">
          <Link href="/" className="text-[17px] font-bold tracking-tight text-white">
            Lisan
          </Link>
          <span className="rounded-full bg-[#8B8CFF]/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[#8B8CFF]">
            Sepolia
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar px-3 pt-4 pb-6">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={cn("mb-1", gi > 0 && "mt-5")}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                      active
                        ? "nav-link-active text-white"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-[18px] w-[18px] transition-colors duration-200",
                        active
                          ? "text-[#8B8CFF]"
                          : "text-white/30 group-hover:text-white/50"
                      )}
                      strokeWidth={1.5}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mx-4 h-px bg-white/[0.06]" />
      <div className="px-5 py-4">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-1">Protocol</p>
          <p className="text-[11px] text-white/50">Private DeFi powered by Poseidon commitments on Starknet</p>
        </div>
      </div>
    </aside>
  );
}
