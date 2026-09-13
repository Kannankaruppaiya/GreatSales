import { REMINDER_ORDINALS, REMINDER_STAGES } from '@greatsales/shared';
import type { PaymentStatusValue, ReminderStage } from '@greatsales/shared';

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

/**
 * The reminder chase, as the server sees it.
 *
 * The four letters are a SEQUENCE, not four independent switches — the shared
 * contract says so, and `ReminderMenu` in the console offers exactly one
 * actionable row because of it: the next unsent letter, or the most recent sent
 * one to take back. None of that was enforced anywhere but in that menu, so a
 * direct `PATCH /payments/:id` with `{ mail3: true }` against an invoice whose
 * first two letters had never gone out was accepted, stamped `mail3At`, and
 * notified the collector that a third reminder they never sent had been sent.
 *
 * Two rules, and between them they are the menu:
 *
 *   1. **The sent letters are a prefix.** mail3 cannot be true while mail1 is
 *      false, in any state the payment is ever left in.
 *   2. **One letter moves at a time**, on an edit. Sending a letter is an
 *      event — it stamps a date and notifies somebody — and two events in one
 *      PATCH is not a chase, it is a record being back-filled by hand.
 *
 * Rule 2 is deliberately NOT applied at creation: a payment imported from the
 * accounting system, or one a collector is catching the record up on, legitimately
 * arrives with two letters already behind it. That is one event, the import,
 * and the prefix rule still holds it to a real sequence.
 */
export type ReminderFlags = Record<ReminderStage, boolean>;

/** How far the chase has got, in words — for a message a person reads. */
function chaseState(flags: ReminderFlags): string {
  const last = REMINDER_STAGES.reduce(
    (acc, st, i) => (flags[st] ? i : acc),
    -1,
  );
  return last < 0
    ? 'no reminder has been sent yet'
    : `the ${REMINDER_ORDINALS[last]} is the last one sent`;
}

/**
 * Why this set of flags is not a valid chase, or null when it is.
 *
 * A valid chase is a prefix: some number of letters from the first, then
 * nothing. A gap means a letter was skipped.
 */
export function reminderSequenceError(flags: ReminderFlags): string | null {
  const firstUnsent = REMINDER_STAGES.findIndex((st) => !flags[st]);
  if (firstUnsent < 0) return null;
  const skipped = REMINDER_STAGES.findIndex(
    (st, i) => i > firstUnsent && flags[st],
  );
  if (skipped < 0) return null;
  return (
    `Reminders are sent in order — the ${REMINDER_ORDINALS[skipped]} cannot go ` +
    `out before the ${REMINDER_ORDINALS[firstUnsent]}`
  );
}

/**
 * Why this edit to the chase is not allowed, or null when it is.
 *
 * `next` is the state the payment would be left in. Both rules are checked
 * here so a caller cannot apply one and forget the other.
 */
export function reminderUpdateError(
  current: ReminderFlags,
  next: ReminderFlags,
): string | null {
  const moved = REMINDER_STAGES.filter((st) => current[st] !== next[st]);
  if (moved.length > 1) {
    return 'Only one reminder can be marked at a time';
  }
  const sequence = reminderSequenceError(next);
  if (sequence) return `${sequence} (${chaseState(current)})`;
  return null;
}
