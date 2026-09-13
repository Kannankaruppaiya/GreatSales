import type { TaxModeValue } from '@greatsales/shared';

/**
 * Pure order arithmetic — no Prisma, no I/O — so it is unit-testable in
 * isolation (mirrors projection-engine). The service normalizes Decimal line
 * items into {@link EngineItem}s, computes here, then persists the result.
 *
 * Every figure is carried through as an integer number of paise and converted
 * back to rupees once, at the edge. Summing rupee floats and rounding at the
 * end is how a hundred lines of 0.1 becomes 9.999999999999998: the column it
 * lands in is Decimal(14,2), so the arithmetic that produces it has to be
 * exact to the paise before Postgres ever sees it. Integers up to 2^53 cover
 * the whole of Decimal(14,2) with room to spare.
 */

export interface EngineItem {
  qty: number;
  price: number;
}

/** Rupees → whole paise. */
function paise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Whole paise → rupees, which is the only place a fraction reappears. */
function rupees(p: number): number {
  return p / 100;
}

/** Value of one line, in paise: qty × price, rounded once. */
function linePaise(item: EngineItem): number {
  return Math.round(item.qty * item.price * 100);
}

/** Value of one line: qty × price, to the paise. */
export function lineTotal(item: EngineItem): number {
  return rupees(linePaise(item));
}

/** Sum of the line values — the order's pre-tax subtotal. */
export function computeSubtotal(items: EngineItem[]): number {
  return rupees(items.reduce((sum, i) => sum + linePaise(i), 0));
}

/**
 * The GST an order carries, as the user chose to express it.
 *
 * `rate`/`amount` are whichever of the two the mode needs; the other is
 * ignored rather than rejected, because a dialog that remembers the
 * percentage you typed before switching to "No GST" is not making an error.
 */
export interface TaxSpec {
  mode: TaxModeValue;
  rate?: number | null;
  amount?: number | null;
}

/** The three money figures an order stores, derived together. */
export interface OrderTotals {
  subtotal: number;
  taxMode: TaxModeValue;
  /** Kept only for Percentage, so a reprint can say "GST @ 18%". */
  taxRate: number | null;
  taxAmount: number;
  /** subtotal + taxAmount — the grand total every surface prints. */
  total: number;
}

/** Money the columns can hold: Decimal(14,2) tops out just under 10^12. */
const MAX_MONEY = 999_999_999_999.99;

/**
 * Why a tax spec cannot be used, or null when it can.
 *
 * Returned rather than thrown so the engine stays free of Nest — the service
 * turns a message into a BadRequestException. This is the ONE place the rules
 * live; `create` and `update` both call it, so a percentage validated on
 * creation cannot be a different percentage on an edit.
 */
export function validateTaxSpec(tax: TaxSpec): string | null {
  if (tax.mode === 'Percentage') {
    const rate = tax.rate;
    if (rate == null || !Number.isFinite(rate)) {
      return 'A GST percentage is required when GST is charged by percentage';
    }
    if (rate < 0 || rate > 100) {
      return 'The GST percentage must be between 0 and 100';
    }
    if (Math.round(rate * 100) !== rate * 100) {
      return 'The GST percentage can carry at most two decimal places';
    }
  }
  if (tax.mode === 'Amount') {
    const amount = tax.amount;
    if (amount == null || !Number.isFinite(amount)) {
      return 'A GST amount is required when GST is charged as an amount';
    }
    if (amount < 0) return 'The GST amount cannot be negative';
    if (amount > MAX_MONEY) return 'The GST amount is out of range';
    if (Math.round(amount * 100) !== amount * 100) {
      return 'The GST amount can carry at most two paise';
    }
  }
  return null;
}

/**
 * The authoritative totals for an order: its subtotal, its GST and their sum.
 *
 * Called by both `create` and `update`, from the stored line items and the
 * stored tax mode — a client's own preview figure is never read, let alone
 * persisted. Callers must run {@link validateTaxSpec} first; an invalid spec
 * here is treated as no GST rather than silently guessing a rate.
 */
export function computeOrderTotals(
  items: EngineItem[],
  tax: TaxSpec,
): OrderTotals {
  const subtotalPaise = items.reduce((sum, i) => sum + linePaise(i), 0);

  const taxPaise =
    tax.mode === 'Percentage'
      ? Math.round((subtotalPaise * (tax.rate ?? 0)) / 100)
      : tax.mode === 'Amount'
        ? paise(tax.amount ?? 0)
        : 0;

  return {
    subtotal: rupees(subtotalPaise),
    taxMode: tax.mode,
    taxRate: tax.mode === 'Percentage' ? (tax.rate ?? 0) : null,
    taxAmount: rupees(taxPaise),
    total: rupees(subtotalPaise + taxPaise),
  };
}

/**
 * The fulfilment ladder, in the order an order climbs it. `Cancelled` is a
 * terminal side-branch reachable from any live rung, not a rung of its own.
 */
export const ORDER_LADDER = [
  'Created',
  'Acknowledged',
  'DeliveryPartnerAssigned',
  'DeliveredFromWarehouse',
  'DeliveredToCustomer',
  'CustomerReceiptConfirmed',
] as const;

export type LadderStatus = (typeof ORDER_LADDER)[number];
export type OrderStatusName = LadderStatus | 'Cancelled';

/**
 * Whether an order may move from one status to another.
 *
 * Nothing enforced this. The detail modal walks the ladder a rung at a time,
 * but the modal is not the authority — and a direct PATCH could take an order
 * from `Created` straight to `CustomerReceiptConfirmed`, bounce it back and
 * forth appending a rung to the trail each time, or bring a cancelled order
 * back to life with `cancelledAt` still stamped on it. All three were
 * reachable against the running API.
 *
 * That is not a theoretical hole: the Fulfilment SLA report measures transit
 * time and order→delivery off the trail, so a skipped rung is a blank column
 * and a customer receipt for a delivery that never happened — exactly the
 * shape the Promech dataset was in before it was rebuilt.
 *
 * The rules:
 *
 * - **One rung forward.** A delivery cannot happen before a dispatch.
 * - **One rung back**, as a correction. A mis-click on "Mark as Delivered"
 *   should not cost the order its remarks, files and trail, which is what
 *   cancel-and-re-raise would. Anything further back is a different order.
 * - **Cancel from any live rung**, and never out of one. A cancelled order
 *   that can be walked back to Acknowledged is live and cancelled at once.
 */
export function canTransition(
  from: OrderStatusName,
  to: OrderStatusName,
): boolean {
  if (from === to) return false;
  if (from === 'Cancelled') return false;
  if (to === 'Cancelled') return true;

  const a = (ORDER_LADDER as readonly string[]).indexOf(from);
  const b = (ORDER_LADDER as readonly string[]).indexOf(to);
  if (a < 0 || b < 0) return false;
  return Math.abs(b - a) === 1;
}

/** The rung after this one, or null at the top (and for Cancelled). */
export function nextStatus(from: OrderStatusName): LadderStatus | null {
  const a = (ORDER_LADDER as readonly string[]).indexOf(from);
  if (a < 0 || a >= ORDER_LADDER.length - 1) return null;
  return ORDER_LADDER[a + 1];
}
