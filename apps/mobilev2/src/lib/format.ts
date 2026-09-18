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

/** Exact, with Indian digit grouping: ₹ 5,00,000. */
export function money(amount: number): string {
  const rounded = Math.round(amount);
  return `${RUPEE} ${rounded.toLocaleString("en-IN")}`;
}

/**
 * Short form, as the KPI tiles use: ₹ 48.2L, ₹ 1.2Cr, ₹ 8,400.
 *
 * Below a lakh the exact figure is short enough to read, so it is left alone
 * rather than rendered as "0.08L".
 */
export function moneyShort(amount: number): string {
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

/** "20 Sep 2026" — the design's long date, in the chosen format. */
export function longDate(value: string | Date): string {
  return format(new Date(value), longDatePattern);
}

/** "20 Sep" — the nano label. */
export function shortDate(value: string | Date): string {
  return format(new Date(value), "d MMM");
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
  const date = new Date(value);
  if (isToday(date)) return timeOfDay(date);
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return shortDate(date);
}

/** "5 days overdue" — only ever used where the row genuinely is overdue. */
export function overdueLabel(value: string | Date): string {
  return `${formatDistanceToNowStrict(new Date(value), { unit: "day" })} overdue`;
}

/** Whole days a date is past. 0 when it is today or still ahead. */
export function daysOverdue(
  value: string | Date,
  now: Date = new Date(),
): number {
  const due = new Date(value);
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
  return unit ? `${n} × ${unit}` : n;
}
