import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";

/**
 * Customer x Product mapping contracts, shared by the API and web.
 *
 * A mapping records that a customer buys a product, who owns that
 * relationship, and the agreed price if it differs from the catalog. It is the
 * INPUT to the recurring projections worksheet: `Projection.mappingId` points here (required, not optional),
 * and the worksheet reads customer, product, principal, salesperson and price
 * through it. Without mappings there is nothing to project, which is why this
 * slice blocks F6 from being anything more than rows someone typed.
 *
 * RBAC: reads are gated by `projection.read` and writes by `projection.write`.
 * Mappings are not admin-only master data the way products are — a salesperson
 * maintains the mappings for their own customers, and `salespersonId` is what
 * scopes them.
 *
 * Prices are plain numbers on the wire (Prisma Decimal -> number in the
 * service), and `effectivePrice` is computed SERVER-side so two clients cannot
 * disagree about what a customer pays.
 */

export const MappingListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  customerId: z.string().optional(),
  productId: z.string().optional(),
  /** Admin/management may filter by owner; a sales user is always forced to self. */
  ownerId: z.string().optional(),
  /** Only mappings whose product belongs to this principal. */
  principalId: z.string().optional(),
  /**
   * Only mappings that cannot price anything — no agreed price AND no catalog
   * price behind it.
   *
   * This page calls a mapping "the basis for every projection line", and the
   * projection engine resolves `projectionPrice ?? customPrice ?? basePrice ?? 0`
   * — so projecting one of these values it at ZERO unless somebody types a price
   * on the line itself. They are the actionable set on this page and there was
   * no way to find them among hundreds of rows.
   *
   * Not `z.coerce.boolean()`: that casts any non-empty string to true, so
   * `?unpriced=false` would turn the filter ON. Only the literal "true" counts.
   */
  unpriced: z.enum(["true", "false"]).optional(),
  /** Matches customer name or product name/SKU. */
  search: z.string().optional(),
});
export type MappingListQuery = z.infer<typeof MappingListQuerySchema>;

export interface MappingRow {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  productSku: string | null;
  principalId: string;
  principalName: string;
  salespersonId: string;
  salespersonName: string;
  /** Catalog price, for showing what the override is departing from. */
  basePrice: number | null;
  /** The agreed override, or null when the catalog price applies. */
  customPrice: number | null;
  /** `customPrice ?? basePrice`, resolved by the server. */
  effectivePrice: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MappingListResponse = CursorPage<MappingRow>;

/**
 * POST /mappings body.
 *
 * `salespersonId` is OPTIONAL and only honoured for admin/management. A sales
 * user is bound to their own id regardless of what they send — accepting it
 * from the request would let them assign a customer's business to someone else.
 */
export const MappingCreateSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  salespersonId: z.string().min(1).optional(),
  customPrice: z.number().nonnegative().nullable().optional(),
});
export type MappingCreate = z.infer<typeof MappingCreateSchema>;

/** PATCH /mappings/:id — the pair itself is immutable; delete and re-create instead. */
export const MappingUpdateSchema = z
  .object({
    salespersonId: z.string().min(1).optional(),
    customPrice: z.number().nonnegative().nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type MappingUpdate = z.infer<typeof MappingUpdateSchema>;
