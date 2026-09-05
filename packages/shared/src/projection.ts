import { z } from "zod";
import { PeriodSchema } from "./period";

/**
 * Projection (recurring-sales worksheet) contracts, shared by the API and web.
 * The API validates inbound queries/bodies against these; the web infers its
 * request/response types from the same schemas so the wire format cannot drift.
 *
 * Enum values on the wire are the Prisma DB values (PascalCase, e.g.
 * "ProjectionCreated"). The web maps them to human labels via
 * {@link PROJ_STATUS_LABELS} and back with {@link projStatusFromLabel}.
 */

/** ProjStatus DB enum values, in worksheet order. Mirrors schema.prisma. */
export const PROJ_STATUS_VALUES = [
  "ProjectionCreated",
  "FollowUpPending",
  "CustomerInterested",
  "WaitingApproval",
  "POExpected",
  "POReceived",
  "OrderPlaced",
  "PartiallyConfirmed",
  "Confirmed",
  "Completed",
  "DeferredToNextMonth",
  "Lost",
  "Cancelled",
] as const;
export type ProjStatusValue = (typeof PROJ_STATUS_VALUES)[number];

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

const LABEL_TO_STATUS: Record<string, ProjStatusValue> = Object.fromEntries(
  (Object.entries(PROJ_STATUS_LABELS) as [ProjStatusValue, string][]).map(
    ([value, label]) => [label, value],
  ),
) as Record<string, ProjStatusValue>;

/** Human label → DB enum value; returns undefined for an unknown label. */
export function projStatusFromLabel(label: string): ProjStatusValue | undefined {
  return LABEL_TO_STATUS[label];
}

/** Worksheet line-filter chips. */
export const ProjectionLineFilterSchema = z.enum([
  "all",
  "projected",
  "blank",
  "due",
]);
export type ProjectionLineFilter = z.infer<typeof ProjectionLineFilterSchema>;

/** GET /projections query. `principalId`/`ownerId` omitted (or "ALL") = no filter. */
export const ProjectionListQuerySchema = z.object({
  period: PeriodSchema,
  principalId: z.string().optional(),
  ownerId: z.string().optional(),
  search: z.string().optional(),
  lineFilter: ProjectionLineFilterSchema.default("all"),
});
export type ProjectionListQuery = z.infer<typeof ProjectionListQuerySchema>;

/** One enriched worksheet row. Amounts are plain numbers (Decimal → number). */
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

/**
 * PATCH /projections/:id — inline cell edits. At least one field required.
 * `status` carries a DB enum value (PascalCase); use {@link projStatusFromLabel}
 * client-side to convert a display label before sending.
 */
export const ProjectionUpdateSchema = z
  .object({
    price: z.number().nonnegative().nullable().optional(),
    committedQty: z.number().nonnegative().optional(),
    achievedQty: z.number().nonnegative().optional(),
    status: z.enum(PROJ_STATUS_VALUES).optional(),
    probability: z.number().int().min(0).max(100).nullable().optional(),
    nextFollowUp: z.string().nullable().optional(),
    targetDate: z.string().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type ProjectionUpdate = z.infer<typeof ProjectionUpdateSchema>;
