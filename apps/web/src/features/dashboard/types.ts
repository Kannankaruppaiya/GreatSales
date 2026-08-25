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
}

export interface DashboardBreakdown {
  id: string;
  name: string;
  committed: number;
  achieved: number;
}

export interface DashboardCategorySlice {
  tier: string;
  committed: number;
  achieved: number;
}

export interface DashboardResponse {
  period: string;
  kpis: DashboardKpis;
  bySalesperson: DashboardBreakdown[];
  byPrincipal: DashboardBreakdown[];
  byCategory: DashboardCategorySlice[];
  /** Capped by the server; `oralConfirmationTotal` is the real count. */
  oralConfirmationDeals: LeadRow[];
  oralConfirmationTotal: number;
  topOpenProjections: ProjectionLine[];
}
