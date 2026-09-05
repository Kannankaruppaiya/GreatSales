import { z } from "zod";
import { CursorSchema, QueryBool, type CursorPage } from "./pagination";
import {
  CustomerCategorySchema,
  CustomerTypeSchema,
  DivisionSchema,
  PaymentTermsSchema,
  PayZoneSchema,
  type CustomerCategoryValue,
  type CustomerTypeValue,
  type DivisionValue,
  type PaymentTermsValue,
  type PayZoneValue,
} from "./enums";

/**
 * Customer (master account) contracts, shared by the API and web. The API
 * validates inbound queries/bodies against these; the web infers its
 * request/response types from the same schemas so the wire format cannot drift.
 *
 * Money fields are plain numbers on the wire (Prisma Decimal → number in the
 * service). Enum values are the raw DB strings (see ./enums).
 */

/** GET /customers query. `ownerId` omitted (or "ALL") = no salesperson filter. */
export const CustomerListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: CustomerCategorySchema.optional(),
  ownerId: z.string().optional(),
  active: QueryBool.optional(),
  /** Industrial area, matched exactly against Customer.area. */
  area: z.string().optional(),
  /** Industry master id, not the display name. */
  industryId: z.string().optional(),
  /**
   * Accounts that carry at least one mapping for a product of this principal.
   * A customer has no principal column — the relation runs
   * customer → mappings → product → principal — so this is a `some` filter.
   */
  principalId: z.string().optional(),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

/** One enriched customer row. `outstanding` is a plain number (Decimal → number). */
export interface CustomerRow {
  id: string;
  name: string;
  division: DivisionValue | null;
  category: CustomerCategoryValue | null;
  type: CustomerTypeValue | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: PaymentTermsValue | null;
  payZone: PayZoneValue | null;
  outstanding: number;
  active: boolean;
  salespersonId: string;
  salespersonName: string;
  collectorId: string | null;
  collectorName: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CustomerListResponse = CursorPage<CustomerRow>;

/**
 * One row of the GLOBAL industry catalogue (`GET /industries`).
 *
 * Not tenant data: the table has no tenantId and the runtime role may only read
 * it. Lives here rather than in its own module because its only consumer is the
 * customer industry picker and the customers list's `industryId` filter.
 */
export interface IndustryRow {
  id: string;
  name: string;
  subIndustries: string[];
}

/** POST /customers body. `salespersonId` is required (the owning FK). */
export const CustomerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  salespersonId: z.string().min(1),
  division: DivisionSchema.nullable().optional(),
  category: CustomerCategorySchema.nullable().optional(),
  type: CustomerTypeSchema.nullable().optional(),
  industryId: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  paymentTerms: PaymentTermsSchema.nullable().optional(),
  payZone: PayZoneSchema.nullable().optional(),
  outstanding: z.number().nonnegative().optional(),
  collectorId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

/** PATCH /customers/:id — partial edit. At least one field required. */
export const CustomerUpdateSchema = CustomerCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
