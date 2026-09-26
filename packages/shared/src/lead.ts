import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import { IsoDateSchema } from "./period-range";
import { ContactsSchema, type ContactRow } from "./contact";
import {
  CustomerCategorySchema,
  CustomerTypeSchema,
  DealStageSchema,
  DivisionSchema,
  type CustomerCategoryValue,
  type CustomerTypeValue,
  type DealStageValue,
  type DivisionValue,
} from "./enums";

/**
 * Lead (new-sales pipeline) contracts, shared by the API and web. Enum values
 * are the raw DB strings; money/qty fields are plain numbers on the wire
 * (Prisma Decimal → number in the service).
 */

/** One line item attached to a lead. */
export const LeadProductInputSchema = z.object({
  productName: z.string().min(1).max(200),
  principalId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  qty: z.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
});
export type LeadProductInput = z.infer<typeof LeadProductInputSchema>;

export interface LeadProductRow {
  id: string;
  principalId: string | null;
  productId: string | null;
  productName: string;
  brand: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
  value: number | null;
}

/** GET /leads query. `ownerId` omitted (or "ALL") = no salesperson filter. */
export const LeadListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  stage: DealStageSchema.optional(),
  tier: CustomerCategorySchema.optional(),
  ownerId: z.string().optional(),
  /** Leads carrying at least one line item for this principal. */
  principalId: z.string().optional(),
  /**
   * Several stages at once, comma-separated (`?stages=A,B`). `stage` stays for
   * the single-stage case; when both are sent a lead must satisfy both.
   */
  stages: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(DealStageSchema).min(1))
    .optional(),
  /** Expected closure on or before this day. A lead with no date never matches. */
  closeBefore: IsoDateSchema.optional(),
  /**
   * Row order. Omitted keeps the historical id order the console pages by.
   *
   * `value` orders by the lead's worth (the sum of its line values), which is
   * not a column, so it is served as a top-N list: it honours `limit` and
   * returns no `nextCursor`. Every other order pages normally.
   */
  sort: z.enum(["recent", "closeDate", "value"]).optional(),
});
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

/** One enriched lead row. `totalValue` sums the line-item values. */
export interface LeadRow {
  id: string;
  customerName: string;
  division: DivisionValue | null;
  tier: CustomerCategoryValue | null;
  type: CustomerTypeValue | null;
  salespersonId: string;
  salespersonName: string;
  stage: DealStageValue;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  address: string | null;
  /** Everyone this deal is worked through, primary first. */
  contacts: ContactRow[];
  /**
   * The primary contact's name and number, denormalised onto the row.
   *
   * Derived server-side from `contacts`, never stored twice — the same
   * convenience `CustomerRow.primaryContactName` already is. The list page, the
   * dashboard drill-downs and the mobile screens want one name in a cell, and
   * making each of them reach into an array for it would spread the "which one
   * is primary" rule across every surface that renders a lead.
   */
  contactName: string | null;
  phone: string | null;
  nextFollowUp: string | null;
  expClose: string | null;
  stageUpdatedAt: string | null;
  products: LeadProductRow[];
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadListResponse = CursorPage<LeadRow>;

/** POST /leads body. `salespersonId` is required (the owning FK). */
export const LeadCreateSchema = z.object({
  customerName: z.string().min(1).max(200),
  salespersonId: z.string().min(1),
  stage: DealStageSchema.optional(),
  division: DivisionSchema.nullable().optional(),
  tier: CustomerCategorySchema.nullable().optional(),
  type: CustomerTypeSchema.nullable().optional(),
  industryId: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  /**
   * The people at this account. Sending it REPLACES the lead's contacts with
   * exactly what is sent, for the same reason `products` does: a contact has no
   * stable identity a client could address, and "these are the contacts now" is
   * both what the editor on screen means and the only instruction that can
   * express somebody having left.
   */
  contacts: ContactsSchema.optional(),
  nextFollowUp: z.string().nullable().optional(),
  expClose: z.string().nullable().optional(),
  products: z.array(LeadProductInputSchema).optional(),
});
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

/**
 * PATCH /leads/:id — partial edit. At least one field required.
 *
 * `products` is accepted, and sending it REPLACES the lead's line items with
 * exactly what is sent. It used to be omitted from this schema entirely, which
 * meant the quantity and the price on a deal were fixed the moment the enquiry
 * was written down — and a pipeline whose stages are named "Proposals & Price
 * Quote" and "Negotiation / Oral Confirmation" is one where those two numbers
 * are the whole conversation. The only way to correct a figure was to delete
 * the lead and type it again, losing its remarks, its files and its history.
 *
 * Replace rather than merge: a line item has no stable identity a client could
 * address (the ids are the database's), and "these are the products now" is
 * both what the editor on screen means and the only instruction that can
 * express a line being removed.
 */
export const LeadUpdateSchema = LeadCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;

/** GET /leads/stage-summary — count and worth of the caller's leads, per stage. */
export interface LeadStageSummaryRow {
  stage: DealStageValue;
  count: number;
  /** Sum of `LeadRow.totalValue` over the stage — the same figure the list shows. */
  value: number;
}
