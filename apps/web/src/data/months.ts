/**
 * Reporting periods for the console.
 *
 * Mirrors `@greatsales/shared/period`; kept as a local copy so the Vite build
 * does not consume the CJS `shared` dist, same as every feature's types.ts.
 * Source of truth: packages/shared/src/period.ts.
 *
 * WHAT THIS REPLACES, because the shape of the bug matters more than the fix:
 * `data/constants.ts` exported MONTHS, a hardcoded twelve-entry fiscal window
 * from Apr 2026 to Mar 2027. Three things were wrong with it at once.
 *
 *   1. It EXPIRED. In April 2027 the list would contain no current month, so
 *      every month selector in the app would open on a period that had passed.
 *   2. It could not reach BACKWARDS. Nothing before Apr 2026 was selectable,
 *      so the previous year's figures were simply unreachable in the UI.
 *   3. Labels were a LOOKUP into it, so any period outside the window rendered
 *      as the raw key — "2027-04" instead of "Apr 2027".
 *
 * A month is a function of the calendar. Nothing here is a constant.
 */

export const CURRENT_PERIOD_FALLBACK_YEARS = 2;

/** Hard ceiling on a generated list, in months. See periodRange. */
const MAX_PERIOD_SPAN = 15 * 12;

/** Forward horizon, matching shared's FUTURE_PERIOD_MONTHS. */
export const FUTURE_PERIOD_MONTHS = 3;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * The period a date falls in, in the VIEWER's timezone — always the real
 * current month.
 *
 * Local, not UTC, and deliberately: "this month" is a thing a person means
 * about their own calendar, so a rep in IST opening the app just after midnight
 * on the 1st should see the new month, not yesterday's. The string arithmetic
 * below (addMonths, monthsBetween) is UTC-based because it operates on periods
 * rather than instants, where a timezone would only introduce drift.
 */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function parsePeriod(period: string): { year: number; month: number } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (!m) throw new Error(`Not a period: ${period}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function isPeriod(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/**
 * `"2026-09"` → `"Sep 2026"`, for ANY valid period.
 *
 * Not a lookup. A label that comes from a list degrades to the raw key the
 * moment the data outgrows that list, which is what used to happen.
 */
export function periodLabel(period: string): string {
  try {
    const { year, month } = parsePeriod(period);
    return `${MONTH_NAMES[month - 1]} ${year}`;
  } catch {
    return period;
  }
}

export function addMonths(period: string, delta: number): string {
  const { year, month } = parsePeriod(period);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): number {
  const a = parsePeriod(from);
  const b = parsePeriod(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/**
 * Every period from `from` to `to`, oldest first, capped at MAX_PERIOD_SPAN.
 *
 * When the span exceeds the cap the OLDEST months are dropped rather than the
 * newest: last quarter must always be reachable, and nobody opens a
 * fifteen-year-old month from a filter bar. The cap exists because `from` is
 * derived from tenant data, and bad data must not build a dropdown with a
 * hundred thousand options in it.
 */
export function periodRange(from: string, to: string): string[] {
  const span = monthsBetween(from, to);
  if (span < 0) return [to];
  const start = span > MAX_PERIOD_SPAN ? addMonths(to, -MAX_PERIOD_SPAN) : from;
  const out: string[] = [];
  for (let p = start; monthsBetween(p, to) >= 0; p = addMonths(p, 1)) out.push(p);
  return out;
}

export type MonthGroup = { year: number; periods: string[] };

/** Newest first, grouped by year — a flat list of 120 options is unusable. */
export function groupByYear(periods: string[]): MonthGroup[] {
  const byYear = new Map<number, string[]>();
  for (const p of periods) {
    const { year } = parsePeriod(p);
    const list = byYear.get(year) ?? [];
    list.push(p);
    byYear.set(year, list);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, ps]) => ({ year, periods: [...ps].sort().reverse() }));
}

/**
 * Months a selector should offer: the workspace's whole history, plus a short
 * forward window.
 *
 * FORWARD, because projections are a forecast — a worksheet you cannot open for
 * next month is not a planning tool. Three months is the usual commitment
 * horizon and stops the list running away into a future nobody has data for.
 *
 * BACKWARD to the workspace's own creation, because "let them select it if they
 * want to check a previous month" only works if the month is on the list. On a
 * ten-year-old tenant that is ten years of options, which is why they are
 * grouped by year and why `periodRange` caps the span.
 *
 * `floor` comes from the tenant row the layout already fetches, so this costs
 * no extra request. It accepts either a period (`2026-04`) or an ISO date, so
 * the caller can pass the earliest period with data or fall back to the
 * workspace's creation date. When it is missing or unparseable the window falls
 * back to two years, which is wrong only in being shorter than it could be.
 */
export function monthOptions(
  floor?: string,
  now: Date = new Date(),
  futureMonths = FUTURE_PERIOD_MONTHS,
): string[] {
  const current = currentPeriod(now);
  const last = addMonths(current, futureMonths);

  const fromFloor = floor?.slice(0, 7);
  const first =
    fromFloor && isPeriod(fromFloor)
      ? fromFloor
      : addMonths(current, -CURRENT_PERIOD_FALLBACK_YEARS * 12);

  // Guard the ONE case that yields nothing: a workspace whose creation date is
  // in the future (clock skew, an imported record, a seeded demo). Then start
  // at the current month instead, so the list is never empty.
  const startsAfterNow = monthsBetween(first, current) < 0;
  return periodRange(startsAfterNow ? current : first, last);
}
