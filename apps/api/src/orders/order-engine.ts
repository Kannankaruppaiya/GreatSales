/**
 * Pure order logic — no Prisma, no I/O — so it is unit-testable in isolation
 * (mirrors projection-engine). Two responsibilities: the money arithmetic, and
 * the fulfilment STATE MACHINE. The service normalizes Decimal line items into
 * {@link EngineItem}s, computes here, and asks {@link canTransition} before it
 * ever writes a status — the server owns the machine, the client is not trusted.
 */
import type { OrderStatus } from '@prisma/client';

export interface EngineItem {
  qty: number;
  price: number;
}

/**
 * The linear fulfilment lifecycle, in order. `Cancelled` is deliberately NOT
 * here: it is a terminal side-branch reachable from any active state, not a
 * step in the progression. This mirrors the web's TIMELINE_STATUSES exactly, so
 * the "advance" button and the server agree on what "next" means.
 */
export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'Created',
  'Acknowledged',
  'DeliveryPartnerAssigned',
  'DeliveredFromWarehouse',
  'DeliveredToCustomer',
  'CustomerReceiptConfirmed',
];

/** The only status a brand-new order may start at. */
export const INITIAL_ORDER_STATUS: OrderStatus = 'Created';

const FLOW_INDEX = new Map<OrderStatus, number>(
  ORDER_STATUS_FLOW.map((s, i) => [s, i]),
);

/** A status from which nothing may move on: the end of the line, or a cancel. */
export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'CustomerReceiptConfirmed' || status === 'Cancelled';
}

/**
 * The statuses legally reachable from `from` in ONE step: the next stage in the
 * chain (if any), plus `Cancelled` while the order is still active. A terminal
 * status has none.
 */
export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  if (isTerminalOrderStatus(from)) return [];
  const next: OrderStatus[] = [];
  const idx = FLOW_INDEX.get(from);
  if (idx !== undefined && idx < ORDER_STATUS_FLOW.length - 1) {
    next.push(ORDER_STATUS_FLOW[idx + 1]);
  }
  next.push('Cancelled');
  return next;
}

/**
 * Whether `to` is a legal single step from `from`. Rejects skips (Created →
 * DeliveredToCustomer), moves backwards (Acknowledged → Created), and any move
 * out of a terminal state (Cancelled/CustomerReceiptConfirmed → anything). A
 * no-op (from === to) is not a transition.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  return allowedNextStatuses(from).includes(to);
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
