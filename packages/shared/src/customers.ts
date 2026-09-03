import { z } from "zod";
import { CustomerCategory, PaymentTerms, PayZone } from "./enums";

/**
 * Customer contracts. Decimal/money and dates cross the wire as strings
 * (JSON-safe, lossless) and clients parse as needed.
 */
export const CustomerContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  designation: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  isPrimary: z.boolean(),
});
export type CustomerContact = z.infer<typeof CustomerContactSchema>;

export const CustomerSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: CustomerCategory.nullable(),
  industryId: z.string().nullable(),
  subIndustry: z.string().nullable(),
  area: z.string().nullable(),
  paymentTerms: PaymentTerms.nullable(),
  payZone: PayZone.nullable(),
  salespersonId: z.string(),
  createdAt: z.string(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerDetailSchema = CustomerSchema.extend({
  contacts: z.array(CustomerContactSchema),
});
export type CustomerDetail = z.infer<typeof CustomerDetailSchema>;

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  category: CustomerCategory.optional(),
  industryId: z.string().optional(),
  subIndustry: z.string().max(120).optional(),
  area: z.string().max(120).optional(),
  paymentTerms: PaymentTerms.optional(),
  payZone: PayZone.optional(),
  salespersonId: z.string().optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = CreateCustomerSchema.partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
