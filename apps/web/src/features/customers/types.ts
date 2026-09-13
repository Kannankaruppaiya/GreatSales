/**
 * Wire types for the customers API. These mirror the `@greatsales/shared`
 * CustomerRow / CustomerListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/customer.ts.
 */

import type { ContactRow } from "@/features/leads/types";

export type DivisionValue = "LUB" | "WES";

/** One row of the global industry catalogue (`GET /industries`). */
export interface IndustryRow {
  id: string;
  name: string;
  subIndustries: string[];
}

export interface CustomerRow {
  id: string;
  name: string;
  division: DivisionValue | null;
  category: string | null;
  type: string | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: string | null;
  payZone: string | null;
  outstanding: number;
  active: boolean;
  salespersonId: string;
  salespersonName: string;
  collectorId: string | null;
  collectorName: string | null;
  /** Everyone at this account, primary first. Mirrors LeadRow's `contacts`. */
  contacts: ContactRow[];
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  locationPinnedAt: string | null;
  locationPinnedById: string | null;
  locationPinnedByName: string | null;
  /** Ready-to-send maps link built by the API, or null when unpinned. */
  locationUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: CustomerRow[];
  nextCursor: string | null;
  /** Rows matching the filter, ignoring the cursor window. */
  total: number;
}

export interface CustomerCreate {
  name: string;
  salespersonId: string;
  division?: string | null;
  category?: string | null;
  type?: string | null;
  industryId?: string | null;
  subIndustry?: string | null;
  area?: string | null;
  paymentTerms?: string | null;
  payZone?: string | null;
  outstanding?: number;
  collectorId?: string | null;
  active?: boolean;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  sameAsMobile?: boolean;
  email?: string | null;
  designation?: string | null;
  /** Sent together, or both null to clear the pin. See LocationField. */
  latitude?: number | null;
  longitude?: number | null;
  locationAccuracyM?: number | null;
  /**
   * Products to map to the new account, created in the SAME transaction as the
   * customer. A recurring-sales account with no mapping can never appear on the
   * projections worksheet, so onboarding both together is the only way the
   * account is usable when the form closes.
   */
  mappings?: CustomerMappingSeed[];
  /**
   * `YYYY-MM`. When set, a blank projection line opens for each mapping in that
   * month. Sent by the worksheet, which has a month in view; omitted by the
   * customers page, which does not.
   */
  period?: string;
}

/** One customer x product pairing to create alongside the account. */
export interface CustomerMappingSeed {
  productId: string;
  /** Agreed price for this account, or null to use the catalog price. */
  customPrice?: number | null;
}

/**
 * A PATCH edits the account's own fields only. `mappings` and `period` are
 * create-time onboarding inputs — mappings are edited through /mappings and a
 * projection line through /projections, each with its own rules.
 */
export type CustomerUpdate = Partial<
  Omit<CustomerCreate, "mappings" | "period">
>;

/**
 * `paymentTerms` / `payZone` are raw DB enum strings on the wire (see
 * packages/shared/src/enums.ts — PaymentTermsSchema / PayZoneSchema); the API
 * rejects anything else with a 400. The web shows friendly labels in
 * `<select>`s, so each `<option value>` here is the raw value itself and the
 * label map only supplies the visible text — there is no separate
 * label→raw translation step for a mismatch to hide behind.
 *
 * `category` (CUSTOMER_TIERS in data/constants.ts) and `type` ("Existing" /
 * "New") were checked against CustomerCategorySchema / CustomerTypeSchema in
 * the same file and already match the raw DB values exactly, so they need no
 * bridge.
 */
export const PAYMENT_TERMS_VALUES = [
  "Immediate",
  "Credit15",
  "Credit30",
  "Credit45",
  "CashOnDelivery",
  "Advance50Balance",
  "AdvancePayment",
] as const;
export type PaymentTermsValue = (typeof PAYMENT_TERMS_VALUES)[number];
export const PAYMENT_TERMS_LABELS: Record<PaymentTermsValue, string> = {
  Immediate: "Immediate",
  Credit15: "15 Days Credit",
  Credit30: "30 Days Credit",
  Credit45: "45 Days Credit",
  CashOnDelivery: "Cash on Delivery",
  Advance50Balance: "Advance 50% + Balance Delivery",
  AdvancePayment: "100% Advance Payment",
};

export const PAY_ZONE_VALUES = ["RedZone", "YellowZone", "GreenZone", "Blacklist"] as const;
export type PayZoneValue = (typeof PAY_ZONE_VALUES)[number];
export const PAY_ZONE_LABELS: Record<PayZoneValue, string> = {
  RedZone: "Red Zone",
  YellowZone: "Yellow Zone",
  GreenZone: "Green Zone",
  Blacklist: "Blacklist",
};
