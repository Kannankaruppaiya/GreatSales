/**
 * Wire types for the customers API. These mirror the `@greatsales/shared`
 * CustomerRow / CustomerListResponse contracts; kept as a local copy so the
 * Vite build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/customer.ts.
 */

export type DivisionValue = "LUB" | "WES";

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
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  items: CustomerRow[];
  nextCursor: string | null;
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
}

export type CustomerUpdate = Partial<CustomerCreate>;

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

/**
 * Customer contacts sub-resource. Mirrors @greatsales/shared CustomerContact* —
 * the API owns the "at most one primary per customer" invariant, so `isPrimary`
 * is set by promoting a contact (isPrimary: true), never by hand-clearing one.
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

export interface CustomerContactCreate {
  name: string;
  designation?: string | null;
  phone?: string | null;
  mobile?: string | null;
  whatsapp?: string | null;
  sameAsMobile?: boolean;
  email?: string | null;
  isPrimary?: boolean;
}

export type CustomerContactUpdate = Partial<CustomerContactCreate>;
