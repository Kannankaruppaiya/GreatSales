/**
 * Wire types for the dashboard aggregate. Mirrors the `@greatsales/shared`
 * Dashboard contracts; kept as a local copy so the Vite build does not need to
 * consume the CJS `shared` dist — the arrangement every feature here uses. The
 * API is the source of truth: keep in sync with packages/shared/src/dashboard.ts.
 *
 * NOTHING in here is recomputed on the client. Every number is final; the
 * server owns the arithmetic so this page and the projections worksheet cannot
 * disagree.
 */
import type { LeadRow } from "@/features/leads/types";
import type { ProjectionLine } from "@/features/projections/types";
import type { EntityTypeValue } from "@/features/followups/types";

export interface DashboardKpis {
  recurringCommitted: number;
  recurringAchieved: number;
  recurringPct: number | null;
  newSalesCommitted: number;
  newSalesAchieved: number;
  totalCommitted: number;
  totalAchieved: number;
  totalPct: number | null;
  followUpsDue: number;
  followUpsOverdue: number;
  /**
   * The month's target, summed over everyone in scope. Null means nobody in
   * scope has one set — which reads differently from a target of zero, so the
   * two are never collapsed.
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
  /** This person's target for the month. Always null on `byPrincipal`. */
  target: number | null;
}

/** Mirrors `SalesTargetRow` in packages/shared/src/target.ts. */
export interface SalesTargetRow {
  id: string;
  salespersonId: string;
  salespersonName: string;
  period: string;
  targetValue: number;
}

/** Mirrors `TargetUpsert`. Validated server-side by the same Zod schema. */
export interface TargetUpsert {
  salespersonId: string;
  period: string;
  targetValue: number;
}

/**
 * One follow-up still owed — a row of the `FollowUp` table, which is what this
 * product means by the word.
 *
 * A follow-up points at the record it concerns through `entityType` and
 * `entityId`; the Follow-ups page and the mobile screen both list this table
 * and send you to that record's own surface. The `nextFollowUp` column a lead,
 * a line or a payment carries is a date ON that record, not a follow-up.
 */
export interface DashboardFollowUp {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  title: string;
  subtitle: string | null;
  ownerName: string | null;
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
  /** The months the window touched — what the RECURRING figures cover. */
  months: string[];
  kpis: DashboardKpis;
  bySalesperson: DashboardBreakdown[];
  byPrincipal: DashboardBreakdown[];
  byCategory: DashboardCategorySlice[];
  /** Capped by the server; `oralConfirmationTotal` is the real count. */
  oralConfirmationDeals: LeadRow[];
  oralConfirmationTotal: number;
  topOpenProjections: ProjectionLine[];
  /** The rows behind `followUpsDue` + `followUpsOverdue`, most overdue first. */
  followUps: DashboardFollowUp[];
}
