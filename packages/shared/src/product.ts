import { z } from "zod";
import { DivisionSchema, type DivisionValue } from "./enums";

/**
 * Product (catalog master data) contracts, shared by the API and web. Products
 * are tenant-wide reference data (not owned by a salesperson). `basePrice` is a
 * plain number on the wire (Prisma Decimal → number in the service).
 *
 * NOTE: RBAC has no dedicated product permission key. Reads are guarded by
 * `order.read` (every role needs catalog visibility to build orders/leads);
 * writes by `user.manage` (admin-only master-data maintenance).
 */

export const ProductListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  principalId: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  division: DivisionValue | null;
  unit: string | null;
  basePrice: number | null;
  active: boolean;
  principalId: string;
  principalName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: ProductRow[];
  nextCursor: string | null;
}

/** POST /products body. `principalId` is required (the owning brand FK). */
export const ProductCreateSchema = z.object({
  name: z.string().min(1),
  principalId: z.string().min(1),
  sku: z.string().nullable().optional(),
  division: DivisionSchema.nullable().optional(),
  unit: z.string().nullable().optional(),
  basePrice: z.number().nonnegative().nullable().optional(),
  active: z.boolean().optional(),
});
export type ProductCreate = z.infer<typeof ProductCreateSchema>;

/** PATCH /products/:id — partial edit. At least one field required. */
export const ProductUpdateSchema = ProductCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
