/**
 * How a projection's status reads and what colour it carries.
 *
 * Kept out of `labels.ts` because the status is this app's own field rather
 * than a wire enum from `@greatsales/shared`; putting it there would suggest
 * the contract owns it.
 */
import type { ChipTone } from "@/components/ui";

export type ProjectionStatus = "Open" | "Committed" | "AtRisk" | "Closed";

export const PROJECTION_STATUS_LABELS: Record<ProjectionStatus, string> = {
  Open: "Open",
  Committed: "Committed",
  AtRisk: "At Risk",
  Closed: "Closed",
};

export const PROJECTION_STATUS_TONES: Record<ProjectionStatus, ChipTone> = {
  Open: "steel",
  Committed: "mint",
  AtRisk: "amber",
  Closed: "neutral",
};

export const PROJECTION_STATUSES: ProjectionStatus[] = [
  "Open",
  "Committed",
  "AtRisk",
  "Closed",
];

/** `YYYY-MM` for the month we are in now. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The month a projections screen should open on.
 *
 * The current one, because that is the month being worked. The list is sorted
 * newest first, so taking the head would open on next month, where nothing has
 * been achieved yet and every figure reads zero.
 */
export function defaultPeriod(
  periods: { period: string }[],
  now: Date = new Date(),
): string | null {
  const current = currentPeriod(now);
  if (periods.some((p) => p.period === current)) return current;
  return periods[0]?.period ?? null;
}

/** "2026-09" → "September 2026". */
export function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-IN",
    {
      month: "long",
      year: "numeric",
    },
  );
}
