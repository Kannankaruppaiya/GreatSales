import { z } from "zod";

/**
 * Reporting periods — `YYYY-MM`, the key `Projection.period` and `PeriodLock`
 * both carry.
 *
 * Everything here is COMPUTED from a date. There is deliberately no list of
 * months anywhere in this codebase: the web console shipped one, a hardcoded
 * twelve-entry fiscal window from Apr 2026 to Mar 2027, and it had three
 * separate failures baked in. It would have run out entirely in March 2027,
 * leaving no selectable month at all. It could not reach a single month before
 * April 2026, so last year's figures were unreachable. And a label was a
 * lookup into that same list, so any period outside it rendered as the raw
 * string "2027-04". A month is a function of the calendar, not a constant.
 */

/**
 * A reporting period.
 *
 * The month is checked, not merely the shape: `/^\d{4}-\d{2}$/` — which two of
 * the three copies of this rule used — accepts "2026-00" and "2026-99", and
 * those reach Prisma as a period that simply matches no rows, so a typo in a
 * URL looks like an empty month rather than a bad request.
 */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");

/**
 * The period a date falls in, in the VIEWER's timezone — always the real
 * current month.
 *
 * Local, not UTC, and deliberately: "this month" is a thing a person means
 * about their own calendar. The period arithmetic below is UTC-based because it
 * operates on period strings rather than instants.
 */
export function currentPeriod(now: Date = new Date()): string {
  return toPeriod(now.getFullYear(), now.getMonth() + 1);
}

/** `(2026, 9)` → `"2026-09"`. */
export function toPeriod(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

/** `"2026-09"` → `{ year: 2026, month: 9 }`. Throws on a malformed period. */
export function parsePeriod(period: string): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!m) throw new Error(`Not a period: ${period}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * `"2026-09"` → `"Sep 2026"`.
 *
 * Works for ANY valid period rather than only for ones on some list, which is
 * the whole point: a label that comes from a lookup silently degrades to the
 * raw key the moment the data outgrows the list.
 */
export function periodLabel(period: string): string {
  try {
    const { year, month } = parsePeriod(period);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  } catch {
    // A period from an old link or a hand-edited URL should read as itself
    // rather than crash the header it is being rendered into.
    return period;
  }
}

/** Shift a period by whole months. Negative goes back. */
export function addMonths(period: string, delta: number): string {
  const { year, month } = parsePeriod(period);
  // Date handles the year rollover in both directions; month is 0-indexed here.
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return toPeriod(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

/** Whole months from `from` to `to`, inclusive. Negative spans return empty. */
export function monthsBetween(from: string, to: string): number {
  const a = parsePeriod(from);
  const b = parsePeriod(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * Hard ceiling on a generated month list, in months.
 *
 * A range is built from a tenant's creation date, which is data — a wrong or
 * corrupt one must not turn a dropdown into a hundred thousand options and
 * hang the tab. Fifteen years is far past any real deployment and still
 * bounded.
 */
export const MAX_PERIOD_SPAN = 15 * 12;

/**
 * How far ahead a month selector may go.
 *
 * Projections are a forecast, so the current month cannot be the ceiling — a
 * worksheet you cannot open for next month is not a planning tool. Three is the
 * usual commitment horizon. Shared so the web dropdown and the mobile stepper
 * cannot disagree about what "next month" is allowed to mean.
 */
export const FUTURE_PERIOD_MONTHS = 3;

/**
 * Every period from `from` to `to`, oldest first, capped at MAX_PERIOD_SPAN.
 *
 * When the span exceeds the cap the OLDEST months are dropped, not the newest:
 * a user reaching for last quarter must always find it, and nobody opens a
 * fifteen-year-old month from a filter bar.
 */
export function periodRange(from: string, to: string): string[] {
  const span = monthsBetween(from, to);
  if (span < 0) return [to];
  const start = span > MAX_PERIOD_SPAN ? addMonths(to, -MAX_PERIOD_SPAN) : from;
  const out: string[] = [];
  for (let p = start; monthsBetween(p, to) >= 0; p = addMonths(p, 1)) out.push(p);
  return out;
}
