import { Lock, Shuffle, TrendingUp, Vote } from "lucide-react";

interface ShieldedStatsProps {
  totalDeposited: string;
  commitmentCount: string;
  btcReserve: string;
  strkReserve: string;
  marketCount: string;
  proposalCount: string;
}

const ACCENT_CONFIGS = {
  brand: {
    iconBg: "bg-[#8B8CFF]/10",
    iconText: "text-[#8B8CFF]",
    glowClass: "glow-brand",
    accentLine: "bg-[#8B8CFF]",
  },
  purple: {
    iconBg: "bg-[#A78BFA]/10",
    iconText: "text-[#A78BFA]",
    glowClass: "glow-brand",
    accentLine: "bg-[#A78BFA]",
  },
  orange: {
    iconBg: "bg-[#F59E0B]/10",
    iconText: "text-[#F59E0B]",
    glowClass: "glow-orange",
    accentLine: "bg-[#F59E0B]",
  },
  blue: {
    iconBg: "bg-[#60A5FA]/10",
    iconText: "text-[#60A5FA]",
    glowClass: "glow-blue",
    accentLine: "bg-[#60A5FA]",
  },
} as const;

export function ShieldedStats({
  totalDeposited,
  commitmentCount,
  btcReserve,
  strkReserve,
  marketCount,
  proposalCount,
}: ShieldedStatsProps) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {/* Shielded Pool TVL */}
      <StatTile
        accent={ACCENT_CONFIGS.brand}
        icon={<Lock className="h-4 w-4" strokeWidth={1.5} />}
        label="Shielded Pool TVL"
        value={`${totalDeposited}`}
        unit="mBTC"
        sub={
          <span className="text-[#22C55E]">
            {commitmentCount} <span className="text-white/40">commitments</span>
          </span>
        }
        stagger="stagger-1"
      />

      {/* Shielded AMM */}
      <StatTile
        accent={ACCENT_CONFIGS.purple}
        icon={<Shuffle className="h-4 w-4" strokeWidth={1.5} />}
        label="Shielded AMM"
        value=""
        customValue={
          <div className="space-y-1.5 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/35 uppercase tracking-wider">BTC</span>
              <span className="text-[15px] font-bold font-mono text-white">{btcReserve}</span>
            </div>
            <div className="h-px bg-white/[0.04]" />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/35 uppercase tracking-wider">STRK</span>
              <span className="text-[15px] font-bold font-mono text-white">{strkReserve}</span>
            </div>
          </div>
        }
        stagger="stagger-2"
      />

      {/* Prediction Markets */}
      <StatTile
        accent={ACCENT_CONFIGS.orange}
        icon={<TrendingUp className="h-4 w-4" strokeWidth={1.5} />}
        label="Prediction Markets"
        value={marketCount}
        sub={<span className="text-white/40">active markets</span>}
        stagger="stagger-3"
      />

      {/* Governance */}
      <StatTile
        accent={ACCENT_CONFIGS.blue}
        icon={<Vote className="h-4 w-4" strokeWidth={1.5} />}
        label="Governance"
        value={proposalCount}
        sub={<span className="text-white/40">proposals</span>}
        stagger="stagger-4"
      />
    </div>
  );
}

function StatTile({
  accent,
  icon,
  label,
  value,
  unit,
  sub,
  customValue,
  stagger,
}: {
  accent: (typeof ACCENT_CONFIGS)[keyof typeof ACCENT_CONFIGS];
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  customValue?: React.ReactNode;
  stagger: string;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl
        bg-[#151B23] border border-white/[0.06]
        p-5 transition-all duration-300
        hover:-translate-y-0.5
        stat-card-shimmer noise-overlay
        animate-fade-in-up ${stagger}
      `}
      style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.45)" }}
    >
      {/* Top accent line */}
      <div className={`absolute top-0 left-5 right-5 h-px ${accent.accentLine} opacity-20`} />

      <div className="relative z-10">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-medium uppercase tracking-wider text-white/40">
            {label}
          </span>
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent.iconBg} ${accent.iconText}`}>
            {icon}
          </div>
        </div>

        {/* Content */}
        {customValue || (
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[28px] font-bold tracking-tight text-white leading-none">
                {value}
              </span>
              {unit && (
                <span className="text-[13px] font-medium text-white/30">{unit}</span>
              )}
            </div>
            {sub && (
              <p className="text-[12px] mt-1.5 font-medium">{sub}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
