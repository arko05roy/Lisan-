"use client";

import { cn } from "@/lib/utils";

interface SwapLayoutProps {
    chart: React.ReactNode;
    actions: React.ReactNode;
}

export function SwapLayout({ chart, actions }: SwapLayoutProps) {
    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8 h-[calc(100vh-100px)]">
            {/* Left Column: Chart & Analytics (Takes more space) */}
            <div className="flex-1 min-w-0 h-full flex flex-col">
                {chart}
            </div>

            {/* Right Column: Actions (Swap/Liquidity/Stats) */}
            <div className="w-full lg:w-[420px] shrink-0 space-y-6">
                {actions}
            </div>
        </div>
    );
}
