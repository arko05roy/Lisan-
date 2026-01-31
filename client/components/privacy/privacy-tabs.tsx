"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Unlock, ArrowRightLeft } from "lucide-react";

interface PrivacyTabsProps {
    children: React.ReactNode;
}

export function PrivacyTabs({ children }: PrivacyTabsProps) {
    const router = useRouter();
    const pathname = usePathname();

    const currentTab = pathname.includes("withdraw") ? "withdraw" : "deposit";

    const onTabChange = (value: string) => {
        if (value === "deposit") router.push("/deposit");
        if (value === "withdraw") router.push("/withdraw");
    };

    return (
        <div className="mx-auto max-w-xl space-y-8">
            <div className="flex flex-col items-center space-y-4 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Privacy Hub
                </h1>
                <p className="text-muted-foreground max-w-md">
                    Shield your assets for private DeFi interactions, or unshield them back to your public wallet.
                </p>
            </div>

            <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/20 p-1">
                    <TabsTrigger
                        value="deposit"
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex gap-2 items-center justify-center py-3"
                    >
                        <Shield className="h-4 w-4" />
                        Shield Assets
                    </TabsTrigger>
                    <TabsTrigger
                        value="withdraw"
                        className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary flex gap-2 items-center justify-center py-3"
                    >
                        <Unlock className="h-4 w-4" />
                        Unshield Assets
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            <div className="relative">
                {children}
            </div>
        </div>
    );
}
