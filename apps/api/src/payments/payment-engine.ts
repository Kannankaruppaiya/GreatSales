import type { PaymentStatusValue } from '@greatsales/shared';

/**
 * Pure payment arithmetic — no Prisma, no I/O — so it is unit-testable in
 * isolation (mirrors projection-engine/order-engine). Dates are YYYY-MM-DD
 * strings so comparisons are calendar-day exact and timezone-free.
 */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Outstanding balance: amount − received, clamped at 0 (overpayment ≠ credit). */
export function pending(amount: number, received: number): number {
  return round2(Math.max(0, amount - received));
}

/**
 * Lifecycle status. Paid wins outright; otherwise an unmet balance past its due
 * date is Overdue, a part-payment is PartiallyPaid, and the rest is Pending.
 */
export function deriveStatus(
  amount: number,
  received: number,
  dueDate: string | null,
  today: string,
): PaymentStatusValue {
  if (received >= amount) return 'Paid';
  if (dueDate && dueDate < today) return 'Overdue';
  if (received > 0) return 'PartiallyPaid';
  return 'Pending';
}

/** Whole days elapsed past the due date (0 if not yet due, null if no due date). */
export function agingDays(
  dueDate: string | null,
  today: string,
): number | null {
  if (!dueDate) return null;
  const ms = Date.parse(today) - Date.parse(dueDate);
  const days = Math.floor(ms / 86_400_000);
  return days > 0 ? days : 0;
}
