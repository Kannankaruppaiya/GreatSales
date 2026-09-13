import { z } from "zod";
import type { ContactRow } from "./contact";
import { CursorSchema, QueryBool, type CursorPage } from "./pagination";
import { PeriodSchema } from "./period";
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
  /** Everyone at this account, primary first. */
  contacts: ContactRow[];
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  /** Pinned on site from GPS. Both coordinates are present, or neither is. */
  latitude: number | null;
  longitude: number | null;
  /** Radius the fix was good to, in metres — a 5m pin and a 500m one differ. */
  locationAccuracyM: number | null;
  locationPinnedAt: string | null;
  locationPinnedById: string | null;
  locationPinnedByName: string | null;
  /** Ready-to-send maps link, or null when unpinned. See `mapsUrl`. */
  locationUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * The shareable form of a pin.
 *
 * A driver is not a user of this application: whatever we send has to open in
 * whatever maps app their phone already has, from inside WhatsApp, with no
 * login. A `google.com/maps?q=lat,lng` link is the one URL every platform
 * routes correctly, so the "share location" feature is this function plus the
 * platform's own share sheet — no map SDK and no API key anywhere.
 *
 * Returns null unless both coordinates are present, so a half-pin can never
 * render as a link to the wrong place.
 */
export function mapsUrl(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
): string | null {
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  // 7 decimals is ~1cm — past what any phone GPS resolves, and it keeps the
  // link short enough to read in a chat message.
  const trim = (n: number) => String(Number(n.toFixed(7)));
  return `https://www.google.com/maps?q=${trim(latitude)},${trim(longitude)}`;
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
const CustomerFields = z.object({
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
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  sameAsMobile: z.boolean().optional(),
  email: z.string().nullable().optional(),
  designation: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  locationAccuracyM: z.number().int().nonnegative().nullable().optional(),
});

/**
 * A pin is a pair. Accepting one coordinate without the other would store a
 * point off the coast of Africa, which reads as a real answer rather than as
 * the mistake it is — so refuse it at the edge, in the contract both clients
 * and the API share.
 */
const bothCoordsOrNeither = <T extends { latitude?: unknown; longitude?: unknown }>(
  o: T,
) => (o.latitude == null) === (o.longitude == null);
const COORD_PAIR_MESSAGE = "latitude and longitude must be sent together";

/**
 * One customer x product pairing to open alongside the account.
 *
 * A recurring-sales customer is not usable until something is mapped to it:
 * `Projection.mappingId` is required, so an account with no mappings can never
 * appear on the worksheet. Onboarding the account and its products in one
 * request is what the POC's "Add new customer" did, and splitting it into
 * `POST /customers` followed by N `POST /mappings` calls means a half-created
 * customer whenever one of the later calls fails.
 */
export const CustomerMappingSeedSchema = z.object({
  productId: z.string().min(1),
  /** Agreed price for this account. Omit to let the catalog price apply. */
  customPrice: z.number().nonnegative().nullable().optional(),
});
export type CustomerMappingSeed = z.infer<typeof CustomerMappingSeedSchema>;

export const CustomerCreateSchema = CustomerFields.extend({
  /**
   * Products to map to the new account, in the same transaction. Capped
   * because this is an onboarding form, not an import.
   */
  mappings: z.array(CustomerMappingSeedSchema).max(50).optional(),
  /**
   * When given, a BLANK projection line is opened for each new mapping in this
   * month, so a customer added from the worksheet appears on the worksheet
   * instead of being created into a month that cannot show it. Omit from the
   * customers page, where no month is in view.
   */
  period: PeriodSchema.optional(),
})
  .refine(bothCoordsOrNeither, {
    message: COORD_PAIR_MESSAGE,
    path: ["longitude"],
  })
  // Silently collapsing a repeated product would report more mappings than it
  // created, so the duplicate is named instead.
  .refine(
    (o) =>
      !o.mappings ||
      new Set(o.mappings.map((m) => m.productId)).size === o.mappings.length,
    {
      message: "The same product is mapped more than once",
      path: ["mappings"],
    },
  );
export type CustomerCreate = z.infer<typeof CustomerCreateSchema>;

/** PATCH /customers/:id — partial edit. At least one field required. */
export const CustomerUpdateSchema = CustomerFields.partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  })
  .refine(bothCoordsOrNeither, {
    message: COORD_PAIR_MESSAGE,
    path: ["longitude"],
  });
export type CustomerUpdate = z.infer<typeof CustomerUpdateSchema>;
