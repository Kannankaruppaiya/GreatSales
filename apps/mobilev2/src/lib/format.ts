/**
 * Display formatting.
 *
 * Money is the one that matters: this product deals in Indian rupees, and the
 * design writes large figures in lakh/crore short form ("₹ 48.2L", "₹ 5.0L")
 * rather than grouped digits. Both forms are here — `money` for a figure being
 * read exactly, `moneyShort` for the KPI tiles where the design uses short form.
 */
import {
  format,
  formatDistanceToNowStrict,
  isSameDay,
  isToday,
  isTomorrow,
  isYesterday,
} from "date-fns";

const RUPEE = "₹";

/** What a missing amount reads as — a price the catalogue does not carry. */
const NO_AMOUNT = "—";

/** Exact, with Indian digit grouping: ₹ 5,00,000. A missing amount reads "—". */
export function money(amount: number | null | undefined): string {
  if (amount == null) return NO_AMOUNT;
  const rounded = Math.round(amount);
  return `${RUPEE} ${rounded.toLocaleString("en-IN")}`;
}

/**
 * Short form, as the KPI tiles use: ₹ 48.2L, ₹ 1.2Cr, ₹ 8,400.
 *
 * Below a lakh the exact figure is short enough to read, so it is left alone
 * rather than rendered as "0.08L".
 */
export function moneyShort(amount: number | null | undefined): string {
  if (amount == null) return NO_AMOUNT;
  const abs = Math.abs(amount);
  if (abs >= 10_000_000)
    return `${RUPEE} ${(amount / 10_000_000).toFixed(1)}Cr`;
  if (abs >= 100_000) return `${RUPEE} ${(amount / 100_000).toFixed(1)}L`;
  if (abs >= 1_000)
    return `${RUPEE} ${Math.round(amount).toLocaleString("en-IN")}`;
  return `${RUPEE} ${Math.round(amount)}`;
}

/**
 * The pattern `longDate` writes dates in.
 *
 * A module-level value rather than a hook, because `longDate` is called from
 * ordinary functions as well as components and threading a context through
 * every call site would be a large change for a display preference. The
 * settings screen sets it through `setDateFormatPattern`, and does so
 * alongside a React state change, so the tree re-renders and the new pattern
 * is picked up.
 */
let longDatePattern = "d MMM yyyy";

export type DateFormatKey = "dmy" | "mdy" | "iso";

const DATE_PATTERNS: Record<DateFormatKey, string> = {
  dmy: "d MMM yyyy",
  mdy: "MMM d, yyyy",
  iso: "yyyy-MM-dd",
};

export function setDateFormatPattern(key: DateFormatKey): void {
  longDatePattern = DATE_PATTERNS[key] ?? DATE_PATTERNS.dmy;
}

/**
 * A value as a local `Date`.
 *
 * A bare `YYYY-MM-DD` is a calendar day — a follow-up's due day, an expected
 * closure — and must stay that day wherever the phone is. `new Date("2026-09-25")`
 * reads it as UTC midnight, which is the 24th west of Greenwich; this reads it
 * as local midnight instead. Full instants pass through unchanged.
 */
export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  return new Date(value);
}

/** True for a bare calendar day, which carries no time of day to show. */
export function isDayOnly(value: string | Date): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Today's (or an offset day's) calendar date on this device, `YYYY-MM-DD`. */
export function localDate(offsetDays = 0, now: Date = new Date()): string {
  const d = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  );
  return format(d, "yyyy-MM-dd");
}

/** `YYYY-MM` for the month we are in now. */
export function currentPeriod(now: Date = new Date()): string {
  return format(now, "yyyy-MM");
}

/** `YYYY-MM` shifted by whole months: shiftPeriod("2026-01", -1) is "2025-12". */
export function shiftPeriod(period: string, months: number): string {
  const [year, month] = period.split("-").map(Number);
  return format(new Date(year!, month! - 1 + months, 1), "yyyy-MM");
}

/** "20 Sep 2026" — the design's long date, in the chosen format. */
export function longDate(value: string | Date): string {
  return format(toDate(value), longDatePattern);
}

/** "20 Sep" — the nano label. */
export function shortDate(value: string | Date): string {
  return format(toDate(value), "d MMM");
}

/** "04:00 PM" — the time shown against a follow-up. */
export function timeOfDay(value: string | Date): string {
  return format(new Date(value), "hh:mm a");
}

/**
 * How a due date is written on a follow-up row.
 *
 * Today's follow-ups show a time, because the user is deciding what to do in
 * the next hour. Anything else shows a day, because the time is not the
 * deciding factor yet.
 */
export function dueLabel(value: string | Date): string {
  const date = toDate(value);
  if (isToday(date)) return isDayOnly(value) ? "Today" : timeOfDay(date);
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return shortDate(date);
}

/** "5 days overdue" — only ever used where the row genuinely is overdue. */
export function overdueLabel(value: string | Date): string {
  return `${formatDistanceToNowStrict(toDate(value), { unit: "day" })} overdue`;
}

/** Whole days a date is past. 0 when it is today or still ahead. */
export function daysOverdue(
  value: string | Date,
  now: Date = new Date(),
): number {
  const due = toDate(value);
  if (isSameDay(due, now) || due > now) return 0;
  return Math.floor((now.getTime() - due.getTime()) / 86_400_000);
}

/** "12%" — probabilities and deltas. */
export function percent(value: number): string {
  return `${Math.round(value)}%`;
}

/** "2,450 L" — a quantity with its unit, or the bare number when there is none. */
export function quantity(qty: number, unit?: string | null): string {
  const n = qty.toLocaleString("en-IN");
  return unit ? `${n} ${unit}` : n;
}
