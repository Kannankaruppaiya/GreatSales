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

export const CustomerCreateSchema = CustomerFields.refine(bothCoordsOrNeither, {
  message: COORD_PAIR_MESSAGE,
  path: ["longitude"],
});
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
