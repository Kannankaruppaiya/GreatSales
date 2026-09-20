import {
  REMINDER_ORDINALS,
  REMINDER_STAGES,
  creditDays,
} from '@greatsales/shared';
import type {
  PaymentStatusValue,
  PaymentTermsValue,
  ReminderStage,
} from '@greatsales/shared';

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

function wholeDaysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * When an invoice falls due.
 *
 * Derived, not invented: the invoice date plus whatever credit the customer
 * was granted. An explicitly recorded due date wins, because somebody typed it
 * — Add Payment has the field — and a one-off arrangement is a fact about that
 * invoice, not something a rule should override.
 *
 * The import used to add a flat 30 days here for every customer in the ledger.
 * That is now only what a customer with NO terms recorded falls back to.
 */
export function dueDateFor(
  invoiceDate: string | null,
  terms: PaymentTermsValue | null | undefined,
  storedDueDate: string | null = null,
): string | null {
  if (storedDueDate) return storedDueDate;
  if (!invoiceDate) return null;
  const due = new Date(
    Date.parse(invoiceDate) + creditDays(terms) * 86_400_000,
  );
  return due.toISOString().slice(0, 10);
}

/**
 * How old the invoice is: whole days since it was raised.
 *
 * THIS is what the Aging column means, and it did not use to. It counted from
 * the DUE date, so a row dated 22 Oct 2024 read "664d" on a day 694 days after
 * it — the 30 days of credit, silently subtracted from a number printed
 * beside the very date it was counting from. Anybody who checked it with a
 * calendar found it wrong, and they were right.
 *
 * Never negative: an invoice dated in the future is 0 days old, not -5.
 */
export function invoiceAgeDays(
  invoiceDate: string | null,
  today: string,
): number | null {
  if (!invoiceDate) return null;
  return Math.max(0, wholeDaysBetween(invoiceDate, today));
}

/**
 * How far past its due date an invoice has gone; 0 while it is still within
 * terms.
 *
 * The old `agingDays` arithmetic, kept under the name that actually describes
 * it. This is the number the "overdue 90+ days" figure is about — an invoice
 * can be 100 days old and not overdue at all.
 */
export function overdueDays(
  dueDate: string | null,
  today: string,
): number | null {
  if (!dueDate) return null;
  return Math.max(0, wholeDaysBetween(dueDate, today));
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
