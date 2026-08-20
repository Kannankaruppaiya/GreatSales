import { z } from "zod";

/**
 * DB enum value mirrors, shared by the API and web. Values are the Prisma enum
 * strings (PascalCase) exactly as they appear in schema.prisma — the wire format
 * carries these raw values; the web maps them to display labels locally.
 *
 * ProjStatus lives in ./projection.ts (worksheet-specific); every other tenant
 * enum used by more than one feature module is centralized here so a value can
 * never drift between contracts.
 */

export const DIVISION_VALUES = ["LUB", "WES"] as const;
export type DivisionValue = (typeof DIVISION_VALUES)[number];
export const DivisionSchema = z.enum(DIVISION_VALUES);

export const CUSTOMER_CATEGORY_VALUES = [
  "Platinum",
  "Gold",
  "Silver",
  "Brass",
] as const;
export type CustomerCategoryValue = (typeof CUSTOMER_CATEGORY_VALUES)[number];
export const CustomerCategorySchema = z.enum(CUSTOMER_CATEGORY_VALUES);

export const CUSTOMER_TYPE_VALUES = ["Existing", "New"] as const;
export type CustomerTypeValue = (typeof CUSTOMER_TYPE_VALUES)[number];
export const CustomerTypeSchema = z.enum(CUSTOMER_TYPE_VALUES);

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
export const PaymentTermsSchema = z.enum(PAYMENT_TERMS_VALUES);

export const PAY_ZONE_VALUES = [
  "RedZone",
  "YellowZone",
  "GreenZone",
  "Blacklist",
] as const;
export type PayZoneValue = (typeof PAY_ZONE_VALUES)[number];
export const PayZoneSchema = z.enum(PAY_ZONE_VALUES);

export const DEAL_STAGE_VALUES = [
  "NewEnquiries",
  "NeedsAnalysis",
  "TrialsAndSampleTests",
  "ProposalsAndPriceQuote",
  "NegotiationOralConfirmation",
  "ClosedWon",
  "ClosedLost",
  "NoRequirementOrCold",
  "TrialProblem",
] as const;
export type DealStageValue = (typeof DEAL_STAGE_VALUES)[number];
export const DealStageSchema = z.enum(DEAL_STAGE_VALUES);

export const LEAD_STATUS_VALUES = [
  "Platinum",
  "Gold",
  "Silver",
  "Bronze",
] as const;
export type LeadStatusValue = (typeof LEAD_STATUS_VALUES)[number];
export const LeadStatusSchema = z.enum(LEAD_STATUS_VALUES);

export const ORDER_STATUS_VALUES = [
  "Created",
  "Acknowledged",
  "DeliveryPartnerAssigned",
  "DeliveredFromWarehouse",
  "DeliveredToCustomer",
  "CustomerReceiptConfirmed",
  "Cancelled",
] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];
export const OrderStatusSchema = z.enum(ORDER_STATUS_VALUES);

export const DELIVERY_MODE_VALUES = [
  "TransportLR",
  "Courier",
  "CompanyVehicle",
  "CustomerPickup",
  "HandDelivery",
] as const;
export type DeliveryModeValue = (typeof DELIVERY_MODE_VALUES)[number];
export const DeliveryModeSchema = z.enum(DELIVERY_MODE_VALUES);

export const PAYMENT_STATUS_VALUES = [
  "Pending",
  "PartiallyPaid",
  "Paid",
  "Overdue",
] as const;
export type PaymentStatusValue = (typeof PAYMENT_STATUS_VALUES)[number];
export const PaymentStatusSchema = z.enum(PAYMENT_STATUS_VALUES);

export const ENTITY_TYPE_VALUES = [
  "Customer",
  "Lead",
  "Order",
  "Payment",
  "Projection",
] as const;
export type EntityTypeValue = (typeof ENTITY_TYPE_VALUES)[number];
export const EntityTypeSchema = z.enum(ENTITY_TYPE_VALUES);
