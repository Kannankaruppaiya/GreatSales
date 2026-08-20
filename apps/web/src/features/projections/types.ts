/**
 * Wire types for the projections API. These mirror the `@greatsales/shared`
 * ProjectionLine / ProjectionListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/projection.ts.
 */

export type ProjStatusValue =
  | "ProjectionCreated"
  | "FollowUpPending"
  | "CustomerInterested"
  | "WaitingApproval"
  | "POExpected"
  | "POReceived"
  | "OrderPlaced"
  | "PartiallyConfirmed"
  | "Confirmed"
  | "Completed"
  | "DeferredToNextMonth"
  | "Lost"
  | "Cancelled";

/** DB enum value → human label (matches the frontend PROJ_STATUSES strings). */
export const PROJ_STATUS_LABELS: Record<ProjStatusValue, string> = {
  ProjectionCreated: "Projection Created",
  FollowUpPending: "Follow-up Pending",
  CustomerInterested: "Customer Interested",
  WaitingApproval: "Waiting Approval",
  POExpected: "PO Expected",
  POReceived: "PO Received",
  OrderPlaced: "Order Placed",
  PartiallyConfirmed: "Partially Confirmed",
  Confirmed: "Confirmed",
  Completed: "Completed",
  DeferredToNextMonth: "Deferred to Next Month",
  Lost: "Lost",
  Cancelled: "Cancelled",
};

export const PROJ_STATUS_VALUES = Object.keys(
  PROJ_STATUS_LABELS,
) as ProjStatusValue[];

export interface ProjectionLine {
  id: string;
  period: string;
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
  price: number;
  committedQty: number;
  achievedQty: number;
  projValue: number;
  achValue: number;
  achPct: number | null;
  status: ProjStatusValue;
  probability: number | null;
  nextFollowUp: string | null;
  targetDate: string | null;
  salesOrderId: string | null;
  salesOrderStatus: string | null;
}

export interface ProjectionSummary {
  totLines: number;
  totCommitted: number;
  totAchieved: number;
  totPct: number | null;
}

export interface ProjectionListResponse {
  lines: ProjectionLine[];
  summary: ProjectionSummary;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  username: string;
  roleId: string;
  role: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
