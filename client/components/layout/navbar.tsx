"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Shield, Search, ChevronDown } from "lucide-react";
import { WalletButton } from "@/components/wallet-button";

const NAV_ITEMS = [
    { href: "/deposit", label: "Pool" },
    { href: "/swap", label: "Trade" },
    { href: "/predict", label: "Explore" },
    { href: "/dashboard", label: "Portfolio" },
];

export function Navbar() {
    const pathname = usePathname();

    return (
        <header className="flex h-16 items-center justify-between border-b border-white/[0.06] bg-[#0B0F14] px-6">
            <div className="flex items-center gap-8">
                {/* Brand */}
                <div className="flex items-center gap-1.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#8B8CFF]/15">
                        <Shield className="h-4 w-4 text-[#8B8CFF]" strokeWidth={2} />
                    </div>
                    <ChevronDown className="h-4 w-4 text-white/40" />
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const active = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "px-4 py-2 text-[14px] font-medium transition-colors duration-200",
                                    active
                                        ? "text-[#8B8CFF]"
                                        : "text-white/60 hover:text-white"
                                )}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {/* Search */}
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 hover:text-white transition-colors">
                    <Search className="h-4 w-4" />
                </button>

                {/* Get App Button */}
                <button className="hidden sm:flex items-center rounded-full border border-white/[0.1] bg-white/[0.02] px-4 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.05]">
                    Get the app
                </button>

                {/* Wallet */}
                <WalletButton />
            </div>
        </header>
    );
}
