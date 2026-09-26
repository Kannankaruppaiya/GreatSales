/**
 * How a projection's status reads and what colour it carries.
 *
 * The statuses are the API's own (`PROJ_STATUS_VALUES` in @greatsales/shared)
 * and so are their labels; only the colour is this app's. The tones group the
 * thirteen statuses the way the worksheet reads them: still being worked,
 * committed, at risk, and finished.
 */
import {
  PROJ_STATUS_LABELS,
  PROJ_STATUS_VALUES,
  type ProjStatusValue,
} from "@greatsales/shared";

import type { ChipTone } from "@/components/ui";

export { currentPeriod } from "./format";

export type ProjectionStatus = ProjStatusValue;

export const PROJECTION_STATUS_LABELS: Record<ProjStatusValue, string> =
  PROJ_STATUS_LABELS;

export const PROJECTION_STATUS_TONES: Record<ProjStatusValue, ChipTone> = {
  ProjectionCreated: "steel",
  FollowUpPending: "amber",
  CustomerInterested: "steel",
  WaitingApproval: "amber",
  POExpected: "steel",
  POReceived: "mint",
  OrderPlaced: "mint",
  PartiallyConfirmed: "mint",
  Confirmed: "mint",
  Completed: "neutral",
  DeferredToNextMonth: "amber",
  Lost: "red",
  Cancelled: "neutral",
};

export const PROJECTION_STATUSES: readonly ProjStatusValue[] =
  PROJ_STATUS_VALUES;

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
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
