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

/**
 * Reverse lookup: display label (as used by data/constants.ts PROJ_STATUSES,
 * and by ProjectionFollowUpModal's <Select> options) → raw wire enum value,
 * for components that still speak in display labels but need to PATCH the
 * raw `status` the API expects. Returns undefined for "(keep current
 * status)"/unrecognized labels so callers can omit the field from a patch.
 */
export function projStatusFromLabel(
  label: string | undefined,
): ProjStatusValue | undefined {
  if (!label) return undefined;
  const entry = (Object.entries(PROJ_STATUS_LABELS) as [ProjStatusValue, string][])
    .find(([, v]) => v === label);
  return entry?.[0];
}

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
  /** Resolved per-unit price: `ownPrice ?? inheritedPrice ?? 0`. */
  price: number;
  /**
   * The price typed onto THIS line, or null when it has none of its own. The
   * editable price cell's VALUE — so clearing the field is distinguishable from
   * typing the agreed price, and writes null to go back to inheriting.
   */
  ownPrice: number | null;
  /**
   * `mapping.customPrice ?? product.basePrice` — what the line charges with no
   * price of its own. The price cell's PLACEHOLDER.
   */
  inheritedPrice: number | null;
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
  /**
   * Remarks and follow-up entries logged against this line.
   *
   * Counts, not the rows: the worksheet shows them as badges on the Remarks and
   * Follow-up log buttons — the POC's shape, and the thing that tells an
   * operator which lines have been worked without opening each one. Loaded in
   * two grouped queries per page, not per row.
   */
  remarkCount: number;
  followUpCount: number;
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
  /**
   * The caller's resolved permission keys, from the server. Used to decide
   * which controls to RENDER; the server enforces every one of them
   * independently, so this is a courtesy and never a control.
   */
  permissions: string[];
  /** True while an admin-set password has not yet been replaced by the user. */
  mustChangePassword: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser;
}
