import type {
  ProjectionLine,
  ProjectionSummary,
  ProjStatusValue,
} from '@greatsales/shared';

/**
 * Pure, DB-free core of the projection worksheet. The service fetches rows via
 * Prisma, normalizes Decimal → number and dates → 'YYYY-MM-DD' into
 * {@link EngineRow}s, then delegates every computation and filter here so the
 * business rules are unit-testable without a database.
 *
 * Rules mirror the frontend worksheet exactly (see web ProjectionsPage):
 *   price     = projectionPrice ?? mapping.customPrice ?? product.basePrice ?? 0
 *   projValue = committedQty * price
 *   achValue  = achievedQty  * price
 *   achPct    = projValue > 0 ? achValue / projValue * 100 : null
 */
export interface EngineRow {
  id: string;
  period: string;
  projectionPrice: number | null;
  customPrice: number | null;
  basePrice: number | null;
  committedQty: number;
  achievedQty: number;
  probability: number | null;
  status: string;
  nextFollowUp: string | null;
  targetDate: string | null;
  salesOrderId: string | null;
  salesOrderStatus: string | null;
  customerId: string;
  customerName: string;
  contactName: string | null;
  tier: string | null;
  productId: string;
  productName: string;
  principalId: string;
  principalName: string;
  salespersonId: string;
  salespersonName: string;
}

/** Effective per-unit price, applying the projection → mapping → product fallback. */
export function resolvePrice(row: EngineRow): number {
  return row.projectionPrice ?? row.customPrice ?? row.basePrice ?? 0;
}

/** Enrich a raw row into a wire {@link ProjectionLine} with computed values. */
export function toLine(row: EngineRow): ProjectionLine {
  const price = resolvePrice(row);
  const projValue = row.committedQty * price;
  const achValue = row.achievedQty * price;
  return {
    id: row.id,
    period: row.period,
    customerId: row.customerId,
    customerName: row.customerName,
    contactName: row.contactName,
    tier: row.tier,
    productId: row.productId,
    productName: row.productName,
    principalId: row.principalId,
    principalName: row.principalName,
    salespersonId: row.salespersonId,
    salespersonName: row.salespersonName,
    price,
    committedQty: row.committedQty,
    achievedQty: row.achievedQty,
    projValue,
    achValue,
    achPct: projValue > 0 ? (achValue / projValue) * 100 : null,
    status: row.status as ProjStatusValue,
    probability: row.probability,
    nextFollowUp: row.nextFollowUp,
    targetDate: row.targetDate,
    salesOrderId: row.salesOrderId,
    salesOrderStatus: row.salesOrderStatus,
  };
}

export interface FilterOptions {
  principalId?: string;
  search?: string;
  lineFilter?: 'all' | 'projected' | 'blank' | 'due';
  today: string;
}

/** Principal / free-text search / line-chip filtering, matching the worksheet. */
export function applyFilters(
  lines: ProjectionLine[],
  opts: FilterOptions,
): ProjectionLine[] {
  const { principalId, search, lineFilter = 'all', today } = opts;
  const q = search?.trim().toLowerCase();

  return lines.filter((l) => {
    if (principalId && principalId !== 'ALL' && l.principalId !== principalId) {
      return false;
    }
    if (q) {
      const hit =
        l.customerName.toLowerCase().includes(q) ||
        l.productName.toLowerCase().includes(q) ||
        l.principalName.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (lineFilter === 'projected' && !(l.committedQty > 0)) return false;
    if (lineFilter === 'blank' && l.committedQty > 0) return false;
    if (lineFilter === 'due') {
      if (!l.nextFollowUp || l.nextFollowUp > today) return false;
    }
    return true;
  });
}

/** Customer tier rank — Platinum first, untiered last (mirrors CAT_RANK). */
const TIER_RANK: Record<string, number> = {
  Platinum: 0,
  Gold: 1,
  Silver: 2,
  Brass: 3,
};
function tierRank(tier: string | null): number {
  return tier != null && tier in TIER_RANK ? TIER_RANK[tier] : 4;
}

/** Sort by tier rank, then customer name, then product name. Non-mutating. */
export function sortLines(lines: ProjectionLine[]): ProjectionLine[] {
  return [...lines].sort((a, b) => {
    const rank = tierRank(a.tier) - tierRank(b.tier);
    if (rank !== 0) return rank;
    if (a.customerName !== b.customerName) {
      return a.customerName.localeCompare(b.customerName);
    }
    return a.productName.localeCompare(b.productName);
  });
}

/** Footer totals over the given (already filtered) lines. */
export function summarize(lines: ProjectionLine[]): ProjectionSummary {
  let totCommitted = 0;
  let totAchieved = 0;
  for (const l of lines) {
    totCommitted += l.projValue;
    totAchieved += l.achValue;
  }
  return {
    totLines: lines.length,
    totCommitted,
    totAchieved,
    totPct: totCommitted > 0 ? (totAchieved / totCommitted) * 100 : null,
  };
}
