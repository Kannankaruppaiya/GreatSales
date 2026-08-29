import { z } from "zod";

import { CursorPageQuerySchema } from "./pagination";

/**
 * Customer contracts shared by the API (validation + source of truth) and
 * clients (types). Enum values mirror `packages/db/prisma/schema.prisma`.
 */

export const CUSTOMER_CATEGORIES = ["Platinum", "Gold", "Silver", "Brass"] as const;
export const PAYMENT_TERMS = [
  "Immediate",
  "Credit15",
  "Credit30",
  "Credit45",
  "CashOnDelivery",
  "AdvancePayment",
] as const;
export const PAY_ZONES = ["RedZone", "YellowZone", "GreenZone", "Blacklist"] as const;

export const CustomerCategorySchema = z.enum(CUSTOMER_CATEGORIES);
export const PaymentTermsSchema = z.enum(PAYMENT_TERMS);
export const PayZoneSchema = z.enum(PAY_ZONES);

export type CustomerCategory = (typeof CUSTOMER_CATEGORIES)[number];
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];
export type PayZone = (typeof PAY_ZONES)[number];

/** Contact provided when creating a customer. */
export const CustomerContactInputSchema = z.object({
  name: z.string().trim().min(1, "Contact name is required").max(120),
  designation: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().email("Enter a valid email").max(200).optional().or(z.literal("")),
  isPrimary: z.boolean().optional(),
});
export type CustomerContactInput = z.infer<typeof CustomerContactInputSchema>;

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: CustomerCategorySchema.optional(),
  industryId: z.string().min(1).optional(),
  subIndustry: z.string().trim().max(120).optional(),
  area: z.string().trim().max(120).optional(),
  paymentTerms: PaymentTermsSchema.optional(),
  payZone: PayZoneSchema.optional(),
  /** Admin/management only; ignored for salespeople (forced to self). */
  salespersonId: z.string().min(1).optional(),
  contacts: z.array(CustomerContactInputSchema).max(20).optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

/** Every field optional; at least one must be present. */
export const UpdateCustomerSchema = CreateCustomerSchema.omit({ contacts: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const CustomerListQuerySchema = CursorPageQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  category: CustomerCategorySchema.optional(),
  payZone: PayZoneSchema.optional(),
});
export type CustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

/** Global master data: industries + their sub-industries. */
export interface IndustryDto {
  id: string;
  name: string;
  subIndustries: string[];
}

/* ---- Response DTOs (JSON; dates are ISO strings) ---- */

export interface CustomerContactDto {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface CustomerListItem {
  id: string;
  name: string;
  category: CustomerCategory | null;
  payZone: PayZone | null;
  area: string | null;
  salespersonId: string;
  salespersonName: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  id: string;
  name: string;
  category: CustomerCategory | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  paymentTerms: PaymentTerms | null;
  payZone: PayZone | null;
  salespersonId: string;
  salespersonName: string | null;
  contacts: CustomerContactDto[];
  createdAt: string;
  updatedAt: string;
}
