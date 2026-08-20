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
