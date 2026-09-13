/* Formatting helpers — INR money, lakh-scale summaries, %, dates.
 * Sales figures in this product are Indian-market, so money reads in the
 * lakh/crore convention on summary tiles and full ₹ grouping in tables. */

export function inr(value: number): string {
  return "₹" + Math.round(value).toLocaleString("en-IN");
}

/** Compact lakh/crore scale for KPI tiles. 1250000 -> "₹12.5L". */
export function lakhs(value: number): string {
  const v = Math.round(value);
  if (Math.abs(v) >= 1_00_00_000) return "₹" + (v / 1_00_00_000).toFixed(2) + "Cr";
  if (Math.abs(v) >= 1_00_000) return "₹" + (v / 1_00_000).toFixed(1) + "L";
  if (Math.abs(v) >= 1_000) return "₹" + (v / 1_000).toFixed(1) + "K";
  return "₹" + v.toLocaleString("en-IN");
}

export function num(value: number): string {
  return value.toLocaleString("en-IN");
}

export function pct(value: number | null, digits = 0): string {
  if (value == null || !isFinite(value)) return "—";
  return value.toFixed(digits) + "%";
}

/**
 * Today, `YYYY-MM-DD`, in the timezone the person is actually in.
 *
 * `new Date().toISOString().slice(0, 10)` is the obvious way to write this and
 * it is wrong: `toISOString` converts to UTC first, so everywhere east of
 * Greenwich — India is UTC+5:30 — the string it returns is YESTERDAY's date
 * until half past five in the morning. Every comparison built on it drifts for
 * those hours: a follow-up due today counts as not yet due, an overdue tile
 * reads zero, a new invoice defaults to the wrong day.
 *
 * The API has the same function for the same reason (`businessToday` in
 * apps/api/src/common/business-day.ts), pinned to the business timezone rather
 * than the viewer's, because a figure the whole company reports on cannot mean
 * different days to different desks.
 */
export function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `today()` shifted by whole days — negative for the past. */
export function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** Days between an ISO date and today (negative = future). */
export function agingDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - d.getTime()) / 86_400_000);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
