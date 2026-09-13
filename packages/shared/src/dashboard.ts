import { z } from "zod";
import { IsoDateSchema } from "./period-range";
import type { LeadRow } from "./lead";
import type { ProjectionLine } from "./projection";
import type { EntityTypeValue } from "./enums";

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

/**
 * The window this page answers for.
 *
 * A pair of dates rather than a `YYYY-MM`, because the page now offers a day, a
 * week, a month and a year. The client resolves its granularity to a range with
 * `resolveRange` in period-range.ts and sends the range; the server does not
 * need to know which button was pressed, only which days it is summarising.
 *
 * The recurring half is still per-MONTH underneath, since a commitment is a
 * month — see `PeriodRange.months` for why a week resolves to its month rather
 * than to a slice of one.
 */
export const DashboardQuerySchema = z
  .object({
    /** Inclusive `YYYY-MM-DD`. */
    from: IsoDateSchema,
    /** Inclusive `YYYY-MM-DD`. */
    to: IsoDateSchema,
    /** Admin/management may scope to one salesperson; sales is forced to self. */
    ownerId: z.string().optional(),
  })
  .refine((q) => q.from <= q.to, {
    message: "`from` must not be after `to`",
    path: ["from"],
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
   *
   * Counts the `FollowUp` rows the Follow-ups page lists, and only those, so
   * the tile and that page can never disagree.
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

/**
 * One follow-up still owed — a row of the `FollowUp` table, which is what this
 * product means by the word.
 *
 * A follow-up points at the record it concerns through `entityType` and
 * `entityId`; the Follow-ups page and the mobile screen both list this table
 * and send you to that record's own surface. The `nextFollowUp` column a lead,
 * a projection line or a payment carries is a date ON that record, shown on
 * that record's page — not a follow-up, and deliberately not counted here.
 * Counting those was how the dashboard came to read "8 overdue" above a
 * Follow-ups page holding nothing.
 */
export interface DashboardFollowUp {
  /** The `FollowUp` row's own id. */
  id: string;
  /** Which kind of record it hangs off, and therefore where "open" leads. */
  entityType: EntityTypeValue;
  entityId: string;
  /** The row's title, or a stand-in when it was saved without one. */
  title: string;
  subtitle: string | null;
  /** Whose desk it is on. */
  ownerName: string | null;
  /** Inclusive `YYYY-MM-DD`. */
  dueDate: string;
  /** Days late against the tenant's business day; 0 means it falls today. */
  daysOverdue: number;
  amount: number | null;
}

export interface DashboardCategorySlice {
  tier: string;
  committed: number;
  achieved: number;
}

export interface DashboardResponse {
  /** The window answered for, echoed back. Inclusive `YYYY-MM-DD`. */
  from: string;
  to: string;
  /**
   * The months the window touched, which is what the RECURRING figures cover.
   * A day or a week resolves to the one month containing it, so the page can
   * say "recurring, Sep 2026" rather than implying a week's worth of a monthly
   * commitment.
   */
  months: string[];
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
  /**
   * The rows behind `followUpsDue` + `followUpsOverdue`, most overdue first.
   * Capped, like the other two row lists — the counts above are the whole
   * truth, this is what the tile can show without a second request.
   */
  followUps: DashboardFollowUp[];
}
