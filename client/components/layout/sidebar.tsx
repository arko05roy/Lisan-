"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Wallet,
  ArrowRightLeft,
  Shield,
  Zap,
  TrendingUp,
  Vote,
  Settings,
  Network,
  Send,
  ChevronDown,
} from "lucide-react";

const PRIMARY_NAV = [
  { href: "/dashboard", label: "Wallet", icon: Wallet },
  { href: "/deposit", label: "Shield", icon: Shield },
  { href: "/swap", label: "Swap", icon: ArrowRightLeft },
  { href: "/transfer", label: "Send", icon: Send },
];

const SECONDARY_NAV = [
  { href: "/execute", label: "Execute", icon: Zap },
  { href: "/predict", label: "Predict", icon: TrendingUp },
  { href: "/vote", label: "Vote", icon: Vote },
  { href: "/relayer-dashboard", label: "Relayers", icon: Network },
];

function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Wallet; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative group flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200",
        active
          ? "bg-[#8B8CFF] text-white shadow-lg shadow-[#8B8CFF]/30"
          : "text-white/40 hover:text-white hover:bg-white/[0.06]"
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
      <div className="absolute left-full ml-4 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/[0.08] text-sm font-semibold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A1D23]" />
      </div>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  // Persist state
  useEffect(() => {
    const saved = localStorage.getItem("lisan-sidebar-more");
    if (saved === "true") setShowMore(true);
  }, []);

  function toggleMore() {
    const next = !showMore;
    setShowMore(next);
    localStorage.setItem("lisan-sidebar-more", String(next));
  }

  // Auto-expand if user is on a secondary page
  const isOnSecondary = SECONDARY_NAV.some((item) => pathname === item.href);

  return (
    <aside className="fixed left-0 top-0 h-screen w-20 border-r border-white/[0.04] bg-[#08090D] flex flex-col items-center py-8 z-50">
      {/* Logo */}
      <Link
        href="/dashboard"
        className="mb-12 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#8B8CFF] to-[#6B6DFF] shadow-lg shadow-[#8B8CFF]/20 transition-transform hover:scale-105"
      >
        <Shield className="h-6 w-6 text-white" strokeWidth={2.5} />
      </Link>

      {/* Primary Navigation */}
      <nav className="flex flex-col gap-2">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>

      {/* More Toggle */}
      <div className="mt-3">
        <button
          onClick={toggleMore}
          className={cn(
            "relative group flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
            (showMore || isOnSecondary)
              ? "text-white/60 bg-white/[0.04]"
              : "text-white/20 hover:text-white/40 hover:bg-white/[0.03]"
          )}
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-200", (showMore || isOnSecondary) && "rotate-180")}
            strokeWidth={2}
          />
          <div className="absolute left-full ml-4 px-3 py-2 rounded-lg bg-[#1A1D23] border border-white/[0.08] text-sm font-semibold text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
            {(showMore || isOnSecondary) ? "Less" : "More"}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#1A1D23]" />
          </div>
        </button>
      </div>

      {/* Secondary Navigation (collapsible) */}
      <div
        className={cn(
          "flex flex-col gap-2 overflow-hidden transition-all duration-300",
          (showMore || isOnSecondary) ? "max-h-[240px] mt-2 opacity-100" : "max-h-0 mt-0 opacity-0"
        )}
      >
        {SECONDARY_NAV.map((item) => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings at bottom */}
      <button className="flex h-12 w-12 items-center justify-center rounded-xl text-white/40 hover:text-white hover:bg-white/[0.06] transition-all duration-200">
        <Settings className="h-5 w-5" strokeWidth={2} />
      </button>
    </aside>
  );
}
