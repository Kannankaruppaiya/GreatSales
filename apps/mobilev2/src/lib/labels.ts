/**
 * How the wire enums are written to a person, and what colour each carries.
 *
 * The API sends Prisma's PascalCase values ("ProposalsAndPriceQuote"); nothing
 * in the UI should ever render one raw. The colour mapping follows the Penpot
 * chips board: "cool at the start, amber mid-funnel, mint won, red lost", and
 * the brand voice board's rule that labels are nouns in Title Case.
 */
import type {
  CustomerCategoryValue,
  DealStageValue,
  OrderStatusValue,
  PayZoneValue,
  PaymentTermsValue,
} from "@greatsales/shared";

import type { ChipTone } from "@/components/ui";

export {
  ALL_STAGES,
  DEAL_STAGE_LABELS,
  OPEN_STAGES,
  isOpenStage,
} from "./stages";

export const DEAL_STAGE_TONES: Record<DealStageValue, ChipTone> = {
  // Cool at the start of the funnel.
  NewEnquiries: "steel",
  NeedsAnalysis: "steel",
  // Amber through the middle, where something is owed by us.
  TrialsAndSampleTests: "amber",
  ProposalsAndPriceQuote: "amber",
  NegotiationOralConfirmation: "amber",
  // Mint won, red lost.
  ClosedWon: "mint",
  ClosedLost: "red",
  NoRequirementOrCold: "neutral",
  TrialProblem: "red",
};

/** The stages a salesperson can move a deal into from the mobile app. */
export const SELECTABLE_STAGES: DealStageValue[] = [
  "NewEnquiries",
  "NeedsAnalysis",
  "TrialsAndSampleTests",
  "ProposalsAndPriceQuote",
  "NegotiationOralConfirmation",
  "ClosedWon",
  "ClosedLost",
  "NoRequirementOrCold",
];

export const ORDER_STATUS_LABELS: Record<OrderStatusValue, string> = {
  Created: "Created",
  Acknowledged: "Acknowledged",
  DeliveryPartnerAssigned: "Partner Assigned",
  DeliveredFromWarehouse: "Left Warehouse",
  DeliveredToCustomer: "Delivered",
  CustomerReceiptConfirmed: "Receipt Confirmed",
  Cancelled: "Cancelled",
};

export const ORDER_STATUS_TONES: Record<OrderStatusValue, ChipTone> = {
  Created: "steel",
  Acknowledged: "steel",
  DeliveryPartnerAssigned: "amber",
  DeliveredFromWarehouse: "amber",
  DeliveredToCustomer: "mint",
  CustomerReceiptConfirmed: "mint",
  Cancelled: "red",
};

export const PAYMENT_TERMS_LABELS: Record<PaymentTermsValue, string> = {
  Immediate: "Immediate",
  Credit15: "15 Days Credit",
  Credit30: "30 Days Credit",
  Credit45: "45 Days Credit",
  CashOnDelivery: "Cash on Delivery",
  Advance50Balance: "50% Advance",
  AdvancePayment: "Full Advance",
};

export const PAY_ZONE_LABELS: Record<PayZoneValue, string> = {
  GreenZone: "Green Zone",
  YellowZone: "Yellow Zone",
  RedZone: "Red Zone",
  Blacklist: "Blacklisted",
};

export const PAY_ZONE_TONES: Record<PayZoneValue, ChipTone> = {
  GreenZone: "mint",
  YellowZone: "amber",
  RedZone: "red",
  Blacklist: "red",
};

export const CUSTOMER_CATEGORY_LABELS: Record<CustomerCategoryValue, string> = {
  Platinum: "Platinum",
  Gold: "Gold",
  Silver: "Silver",
  Brass: "Brass",
};

/** Falls back to the raw value rather than an empty cell, so a new enum shows up. */
export function labelFor<T extends string>(
  map: Record<T, string>,
  value: T | null | undefined,
  fallback = "—",
): string {
  if (value == null) return fallback;
  return map[value] ?? value;
}
