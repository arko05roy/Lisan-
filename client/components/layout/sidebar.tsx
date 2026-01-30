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
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Shielded Pool",
    items: [
      { href: "/deposit", label: "Deposit", icon: ArrowDownToLine },
      { href: "/transfer", label: "Transfer", icon: ArrowRightLeft },
      { href: "/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
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
    <aside className="flex h-full w-60 flex-col border-r bg-card">
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Lisan
        </Link>
        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          SEPOLIA
        </span>
      </div>
      <Separator />
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
