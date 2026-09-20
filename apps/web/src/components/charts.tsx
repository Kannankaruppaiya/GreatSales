import { inr, lakhs, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/* Lightweight, dependency-free SVG/CSS charts tuned for a data-dense
 * B2B dashboard. Committed = brand green, Achieved = amber accent.
 *
 * Flat: a bar is a rectangle whose HEIGHT is the number, so a rounded cap
 * shortens it by the radius and a vertical gradient makes the top read lighter
 * than the bottom — two ways of drawing a value as something slightly other
 * than what it is. The legend swatches were already flat and solid, so the
 * bars now match the key that explains them. */

export function CompareLegend() {
  return (
    <div className="flex items-center gap-3.5 text-xs font-semibold text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-emerald-600 shadow-2xs" />
        <span className="text-ink font-bold">Committed</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-amber shadow-2xs" />
        <span className="text-ink font-bold">Achieved</span>
      </span>
    </div>
  );
}

export function GroupedBars({
  data,
}: {
  data: { label: string; committed: number; achieved: number }[];
}) {
  if (!data.length)
    return <div className="py-12 text-center text-xs text-muted">No data available for this selection.</div>;

  const max = Math.max(1, ...data.map((d) => Math.max(d.committed, d.achieved)));

  return (
    <div className="relative pt-4 pb-1">
      {/* Background Horizontal Reference Gridlines */}
      <div className="absolute inset-x-0 top-6 bottom-20 flex flex-col justify-between pointer-events-none opacity-40">
        <div className="border-b border-line border-dashed w-full" />
        <div className="border-b border-line border-dashed w-full" />
        <div className="border-b border-line border-dashed w-full" />
      </div>

      {/* Chart Bars Container */}
      <div className="flex items-end justify-around gap-2 sm:gap-4 overflow-x-auto min-h-[210px] px-2 relative z-10">
        {data.map((d) => {
          const p = d.committed > 0 ? (d.achieved / d.committed) * 100 : null;
          const commHeightPct = Math.max(4, Math.min(100, (d.committed / max) * 100));
          const achHeightPct = Math.max(4, Math.min(100, (d.achieved / max) * 100));

          return (
            <div
              key={d.label}
              className="flex flex-col items-center gap-2 min-w-[78px] flex-1 max-w-[120px] group"
            >
              {/* Bars Track */}
              <div className="flex h-36 items-end justify-center gap-2 w-full px-1">
                {/* Committed Bar Column */}
                <div className="flex h-full flex-col justify-end items-center flex-1 max-w-[26px]">
                  <div
                    className="w-full bg-emerald-600 group-hover:brightness-110 transition-all duration-300 relative cursor-pointer"
                    style={{ height: `${commHeightPct}%` }}
                    title={`Committed: ${inr(d.committed)}`}
                  />
                </div>

                {/* Achieved Bar Column */}
                <div className="flex h-full flex-col justify-end items-center flex-1 max-w-[26px]">
                  <div
                    className="w-full bg-amber group-hover:brightness-110 transition-all duration-300 relative cursor-pointer"
                    style={{ height: `${achHeightPct}%` }}
                    title={`Achieved: ${inr(d.achieved)}`}
                  />
                </div>
              </div>

              {/* Financial values label */}
              <div className="flex items-center gap-1 text-[10.5px] font-bold tabular-nums whitespace-nowrap">
                <span className="text-ink" title={`Committed: ${inr(d.committed)}`}>
                  {lakhs(d.committed)}
                </span>
                <span className="text-muted/40 font-normal">/</span>
                <span className="text-amber" title={`Achieved: ${inr(d.achieved)}`}>
                  {lakhs(d.achieved)}
                </span>
              </div>

              {/* Achievement Badge */}
              <div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums border shadow-2xs inline-block",
                    p == null
                      ? "bg-surface-2 text-muted border-line"
                      : p >= 60
                      ? "bg-brand-soft text-brand-ink border-brand/25"
                      : p >= 35
                      ? "bg-amber-soft text-amber border-amber/30"
                      : "bg-red-soft text-red border-red/30"
                  )}
                >
                  {p != null ? `${p.toFixed(0)}%` : "0%"}
                </span>
              </div>

              {/* Salesperson Name */}
              <div
                className="w-full truncate text-center text-xs font-bold text-ink transition-colors group-hover:text-brand"
                title={d.label}
              >
                {d.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Radial achievement gauge. */
export function Gauge({ value }: { value: number | null }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (v / 100) * c;
  const stroke = value == null ? "var(--color-line)" : v >= 70 ? "var(--color-brand)" : v >= 40 ? "var(--color-amber)" : "var(--color-red)";
  return (
    <div className="relative grid place-items-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--color-line)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-bold tabular-nums text-ink">{pct(value)}</div>
        <div className="text-[11px] text-faint">achieved</div>
      </div>
    </div>
  );
}

/** Horizontal pipeline funnel. */
export function Funnel({
  data,
}: {
  data: { stage: string; count: number; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.stage} className="flex items-center gap-3">
          <div className="w-44 shrink-0 truncate text-[12.5px] text-ink-2" title={d.stage}>
            {d.stage}
          </div>
          <div className="relative h-7 flex-1 overflow-hidden rounded-[--radius-xs] bg-line-2">
            <div
              className="flex h-full items-center rounded-[--radius-xs] bg-brand/85 px-2 transition-[width] duration-500"
              style={{ width: `${Math.max(6, (d.value / max) * 100)}%` }}
            >
              <span className="text-[11px] font-semibold text-white tabular-nums">
                {lakhs(d.value)}
              </span>
            </div>
          </div>
          <div className="w-10 shrink-0 text-right text-[12px] tabular-nums text-muted">
            {d.count}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Slim progress bar for achievement % inside tables/cards. */
export function MiniProgress({ value }: { value: number | null }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value));
  const cls = value == null ? "bg-line" : v >= 70 ? "bg-brand" : v >= 40 ? "bg-amber" : "bg-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line-2">
        <div className={cn("h-full rounded-full", cls)} style={{ width: `${v}%` }} />
      </div>
      <span className="w-9 text-right text-[11.5px] tabular-nums text-muted">{pct(value)}</span>
    </div>
  );
}
