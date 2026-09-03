import { z } from "zod";

/**
 * Lightweight reference lists the mobile forms need (customer picker, product
 * picker, salesperson picker). Kept minimal — id + label only.
 */
export const LookupItemSchema = z.object({
  id: z.string(),
  label: z.string(),
});
export type LookupItem = z.infer<typeof LookupItemSchema>;

export const ProductLookupSchema = LookupItemSchema.extend({
  basePrice: z.string().nullable(),
  unit: z.string().nullable(),
});
export type ProductLookup = z.infer<typeof ProductLookupSchema>;

export const LookupsSchema = z.object({
  customers: z.array(LookupItemSchema),
  products: z.array(ProductLookupSchema),
  salespeople: z.array(LookupItemSchema),
  industries: z.array(LookupItemSchema),
});
export type Lookups = z.infer<typeof LookupsSchema>;
