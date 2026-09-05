import { z } from "zod";
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
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  category: CustomerCategorySchema.optional(),
  ownerId: z.string().optional(),
  active: z.coerce.boolean().optional(),
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

export interface CustomerListResponse {
  items: CustomerRow[];
  nextCursor: string | null;
}

/** POST /customers body. `salespersonId` is required (the owning FK). */
export const CustomerCreateSchema = z.object({
  name: z.string().min(1),
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

// ============================================================
// CUSTOMER CONTACTS (sub-resource of a customer)
// ============================================================
/**
 * A customer's contact people. Managed under the parent customer
 * (`/customers/:customerId/contacts`); tenancy + sales-ownership are enforced
 * through that parent, and CustomerContact's RLS policy isolates it via the
 * Customer it belongs to. A customer has AT MOST ONE primary contact — the
 * server owns that invariant (a DB partial-unique index backs it), so `isPrimary`
 * is set by promoting a contact, never by hand-clearing another. The customer
 * list row's `primaryContactName`/`primaryContactPhone` are sourced from it.
 */
export interface CustomerContactRow {
  id: string;
  customerId: string;
  name: string;
  designation: string | null;
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;
  sameAsMobile: boolean;
  email: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerContactListResponse {
  items: CustomerContactRow[];
}

/**
 * POST /customers/:customerId/contacts. Only `name` is required. `isPrimary:
 * true` promotes this contact and demotes any current primary; the FIRST
 * contact a customer gets is always primary regardless. Contact channels
 * (phone/mobile/whatsapp/email) are free text, consistent with the rest of the
 * customer master — the UI, not the wire schema, formats them.
 */
export const CustomerContactCreateSchema = z.object({
  name: z.string().min(1),
  designation: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  mobile: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  sameAsMobile: z.boolean().optional(),
  email: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});
export type CustomerContactCreate = z.infer<typeof CustomerContactCreateSchema>;

/**
 * PATCH /customers/:customerId/contacts/:contactId — partial edit, at least one
 * field. `isPrimary: true` promotes this contact; `isPrimary: false` is ignored
 * (a customer with contacts always keeps exactly one primary — promote a
 * different contact to move the flag).
 */
export const CustomerContactUpdateSchema = CustomerContactCreateSchema.partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type CustomerContactUpdate = z.infer<typeof CustomerContactUpdateSchema>;
