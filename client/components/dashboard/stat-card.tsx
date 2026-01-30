import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
    title: string;
    value: string;
    trend?: {
        value: string;
        isPositive: boolean;
        period?: string;
    };
    className?: string;
    icon?: React.ReactNode;
}

export function StatCard({ title, value, trend, className, icon }: StatCardProps) {
    return (
        <Card className={cn("bg-card border-none shadow-lg overflow-hidden relative group", className)}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    {icon && <div className="text-muted-foreground opacity-50">{icon}</div>}
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
                    {trend && (
                        <div className="flex items-center gap-2 text-xs">
                            <span
                                className={cn(
                                    "flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded-full bg-opacity-10",
                                    trend.isPositive
                                        ? "text-green-500 bg-green-500/10"
                                        : "text-red-500 bg-red-500/10"
                                )}
                            >
                                {trend.isPositive ? (
                                    <ArrowUpRight className="h-3 w-3" />
                                ) : (
                                    <ArrowDownRight className="h-3 w-3" />
                                )}
                                {trend.value}
                            </span>
                            {trend.period && <span className="text-muted-foreground">{trend.period}</span>}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
