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
export function projStatusFromLabel(
  label: string,
): ProjStatusValue | undefined {
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
  /** One account's lines, e.g. the Customer 360 screen. */
  customerId: z.string().optional(),
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
  /** Resolved per-unit price: `ownPrice ?? inheritedPrice ?? 0`. */
  price: number;
  /**
   * The price typed onto THIS line, or null when it has none of its own.
   *
   * `price` alone cannot drive an editable cell: a worksheet that shows the
   * resolved figure in the input has no way to say "this line has no price of
   * its own", so clearing the field would look identical to typing the catalog
   * price, and a later repricing of the mapping would silently stop reaching
   * the line.
   */
  ownPrice: number | null;
  /**
   * What the line would charge with no price of its own —
   * `mapping.customPrice ?? product.basePrice`. The editable cell's
   * placeholder, so an empty field reads as the agreed or catalog price rather
   * than as a missing value.
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

/**
 * POST /projections/roll-forward — open a month from the one before it.
 *
 * A recurring commitment recurs: the same customer buys the same product again
 * next month, which is the premise the whole worksheet rests on. Until this
 * existed there was no way to put a line into a month at all — the only rows
 * that ever existed were the ones the import created, so every month after the
 * imported one was permanently empty and nobody could commit to it.
 *
 * What carries, and why:
 *   - only lines with a commitment, because a blank line is not a commitment;
 *   - not Lost or Cancelled, because that business is gone;
 *   - the quantity, since that is the recurring part;
 *   - NOT the achievement, the status, the probability or the follow-up date —
 *     last month's progress is not this month's, and carrying it would open a
 *     month that claims work already done.
 *
 * A mapping that already has a row in the target month is left exactly as it
 * is, so running this twice adds nothing the second time and can never
 * overwrite a number somebody has already typed.
 */
export const ProjectionRollForwardSchema = z.object({
  /** The month to fill. */
  to: PeriodSchema,
  /** Where to copy from. Defaults to the latest month before `to` that has lines. */
  from: PeriodSchema.optional(),
  /** Admin/management may roll one salesperson's book; sales is forced to self. */
  ownerId: z.string().optional(),
});
export type ProjectionRollForward = z.infer<typeof ProjectionRollForwardSchema>;

export interface ProjectionRollForwardResult {
  /** The month actually copied from. */
  from: string;
  to: string;
  /** Lines written into `to`. */
  created: number;
  /**
   * Source lines deliberately left behind — uncommitted, dead, or already
   * present in the target month. Reported so "created 12, skipped 40" can be
   * read as an answer rather than a shortfall.
   */
  skipped: number;
}
