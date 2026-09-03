import { z } from "zod";

/**
 * Domain enums mirrored from the Prisma schema as Zod enums. The API validates
 * inbound values against these and clients infer the union types, so the wire
 * format stays locked to the database's own enum definitions.
 */
export const CustomerCategory = z.enum(["Platinum", "Gold", "Silver", "Brass"]);
export type CustomerCategory = z.infer<typeof CustomerCategory>;

export const PaymentTerms = z.enum([
  "Immediate",
  "Credit15",
  "Credit30",
  "Credit45",
  "CashOnDelivery",
  "AdvancePayment",
]);
export type PaymentTerms = z.infer<typeof PaymentTerms>;

export const DealStage = z.enum([
  "NewEnquiries",
  "NeedsAnalysis",
  "TrialsAndSampleTests",
  "ProposalsAndPriceQuote",
  "NegotiationOralConfirmation",
  "ClosedWon",
  "ClosedLost",
  "NoRequirementOrCold",
  "TrialProblem",
]);
export type DealStage = z.infer<typeof DealStage>;

export const LeadStatus = z.enum(["Platinum", "Gold", "Silver", "Bronze"]);
export type LeadStatus = z.infer<typeof LeadStatus>;

export const PayZone = z.enum(["RedZone", "YellowZone", "GreenZone", "Blacklist"]);
export type PayZone = z.infer<typeof PayZone>;

export const OrderStatus = z.enum([
  "Draft",
  "Confirmed",
  "Dispatched",
  "Delivered",
  "Completed",
  "Cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentStatus = z.enum([
  "Pending",
  "PartiallyPaid",
  "Paid",
  "Overdue",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;
