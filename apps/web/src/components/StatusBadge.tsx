import { cn } from "@/lib/utils";
import type { CustomerTier, Division, PayZone, Tone } from "@/data/constants";

const toneClass: Record<Tone, string> = {
  won: "bg-brand-soft text-brand-ink border-brand/20",
  hot: "bg-amber-soft text-amber border-amber/30",
  open: "bg-blue-soft text-blue border-blue/30",
  lost: "bg-red-soft text-red border-red/30",
  neutral: "bg-surface-2 text-muted border-line",
};

export function StatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        toneClass[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function TierBadge({ tier, className }: { tier?: CustomerTier | string; className?: string }) {
  const map: Record<string, string> = {
    Platinum: "bg-violet-soft text-violet border-violet/30",
    Gold: "bg-amber-soft text-amber border-amber/30",
    Silver: "bg-surface-2 text-ink-2 border-line",
    Brass: "bg-[#F3EAE0] text-[#8A5A22] border-[#E8DCCF]",
  };
  if (!tier) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase",
        map[tier] ?? "bg-surface-2 text-muted border-line",
        className,
      )}
    >
      {tier}
    </span>
  );
}

export function DivisionBadge({ division, className }: { division?: Division | string; className?: string }) {
  if (!division) return null;
  const isLub = division === "LUB";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider",
        isLub
          ? "bg-blue-soft text-blue border-blue/25"
          : "bg-brand-soft text-brand-ink border-brand/25",
        className,
      )}
    >
      {division}
    </span>
  );
}

/**
 * Accepts either the DB enum value (`"YellowZone"`) or the display label
 * (`"Yellow Zone"`). The payments table holds the enum and the aging reports
 * hold labels, and before this the table hand-rolled its own square badge
 * rather than reach for this one — which is how "Yellow Zone" ended up
 * wrapping onto two lines and making every row in the column a different
 * height.
 */
export function PayZoneBadge({ zone, className }: { zone?: PayZone | string; className?: string }) {
  if (!zone) return <span className="text-xs text-muted">—</span>;
  const label = String(zone).replace(/([a-z])([A-Z])/g, "$1 $2");
  const map: Record<string, string> = {
    "Green Zone": "bg-brand-soft text-brand-ink border-brand/25",
    "Yellow Zone": "bg-amber-soft text-amber border-amber/30",
    "Red Zone": "bg-red-soft text-red border-red/30",
    Blacklist: "bg-violet-soft text-violet border-violet/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
        map[label] ?? "bg-surface-2 text-muted border-line",
        className,
      )}
    >
      {label}
    </span>
  );
}
