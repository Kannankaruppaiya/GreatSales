/**
 * Pure order arithmetic — no Prisma, no I/O — so it is unit-testable in
 * isolation (mirrors projection-engine). The service normalizes Decimal line
 * items into {@link EngineItem}s, computes here, then persists the result.
 */

export interface EngineItem {
  qty: number;
  price: number;
}

/** Round to 2 decimal places (money is Decimal(14,2) in Postgres). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Value of one line: qty × price, rounded to 2 places. */
export function lineTotal(item: EngineItem): number {
  return round2(item.qty * item.price);
}

/** Order total: sum of the raw line values, rounded once at the end. */
export function computeTotal(items: EngineItem[]): number {
  const raw = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  return round2(raw);
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
