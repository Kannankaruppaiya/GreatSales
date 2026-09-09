import { z } from "zod";
import { PeriodSchema } from "./period";
import type { LeadRow } from "./lead";
import type { ProjectionLine } from "./projection";

/**
 * Dashboard aggregate contract.
 *
 * The console used to build this page in the browser: it pulled the recurring
 * projections for the period AND then paged through EVERY lead in the tenant —
 * `fetchNextPage` in a loop until exhausted — and reduced them client-side into
 * six summaries. That is O(leads) requests to render six numbers, it re-does
 * money arithmetic the server already owns, and it degrades exactly as a tenant
 * becomes valuable.
 *
 * So the server computes it once and sends the answer. Two rules follow:
 *
 *   1. NOTHING here is recomputed on the client. Every figure below is final.
 *   2. The money math is the SAME code the projections worksheet uses
 *      (`projection-engine`) and the same row mapper the leads list uses. Two
 *      implementations of "what is this worth" is how a dashboard and a report
 *      end up disagreeing in front of a customer.
 *
 * The two row lists are bounded on purpose — they feed detail modals, so they
 * carry full rows rather than ids, and capping them is what keeps this payload
 * from growing back into the thing it replaced.
 */

export const DashboardQuerySchema = z.object({
  /** `YYYY-MM`. The recurring half is per-period; the new-sales half is not. */
  period: PeriodSchema,
  /** Admin/management may scope to one salesperson; sales is forced to self. */
  ownerId: z.string().optional(),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;

export interface DashboardKpis {
  /** Recurring = the projections worksheet for `period`. */
  recurringCommitted: number;
  recurringAchieved: number;
  recurringPct: number | null;
  /** New sales = leads not in a dead stage; achieved = ClosedWon. */
  newSalesCommitted: number;
  newSalesAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  totalPct: number | null;
  /**
   * Counted against the tenant's business day, resolved server-side. Computing
   * "is this overdue" from a browser clock means two users in different
   * timezones see different numbers for the same data.
   */
  followUpsDue: number;
  followUpsOverdue: number;
  /**
   * The sum of the SalesTarget rows in scope for `period`, or null when nobody
   * in scope has one set.
   *
   * Null and zero are different answers and the dashboard renders them
   * differently: null is "no target has been set", zero is "the target is
   * nothing". Coalescing them would make an unset month look like a met one.
   */
  target: number | null;
  /** achieved / target, or null when there is no target to divide by. */
  targetPct: number | null;
}

export interface DashboardBreakdown {
  id: string;
  name: string;
  committed: number;
  achieved: number;
  /**
   * This person's target for the period, or null if none is set.
   *
   * Always null on `byPrincipal`: targets are set against people, not brands,
   * and inventing a principal-level one by division would be arithmetic the
   * product never agreed to.
   */
  target: number | null;
}

export interface DashboardCategorySlice {
  tier: string;
  committed: number;
  achieved: number;
}

export interface DashboardResponse {
  period: string;
  kpis: DashboardKpis;
  /** Recurring + new sales, per salesperson. Empty for a sales user's own view. */
  bySalesperson: DashboardBreakdown[];
  /** Recurring only — leads carry no principal. */
  byPrincipal: DashboardBreakdown[];
  /** Recurring only, by customer category. Always the four tiers, in order. */
  byCategory: DashboardCategorySlice[];
  /** Deals at oral confirmation. Capped; `oralConfirmationTotal` is the real count. */
  oralConfirmationDeals: LeadRow[];
  oralConfirmationTotal: number;
  /** Highest-value open projection lines. Capped at 10. */
  topOpenProjections: ProjectionLine[];
}
