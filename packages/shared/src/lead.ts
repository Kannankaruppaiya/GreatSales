import { z } from "zod";
import { CursorSchema, type CursorPage } from "./pagination";
import {
  CustomerCategorySchema,
  CustomerTypeSchema,
  DealStageSchema,
  DivisionSchema,
  LeadStatusSchema,
  type CustomerCategoryValue,
  type CustomerTypeValue,
  type DealStageValue,
  type DivisionValue,
  type LeadStatusValue,
} from "./enums";

/**
 * Lead (new-sales pipeline) contracts, shared by the API and web. Enum values
 * are the raw DB strings; money/qty fields are plain numbers on the wire
 * (Prisma Decimal → number in the service).
 */

/** One line item attached to a lead. */
export const LeadProductInputSchema = z.object({
  productName: z.string().min(1).max(200),
  principalId: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  qty: z.number().nonnegative().nullable().optional(),
  unit: z.string().nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
});
export type LeadProductInput = z.infer<typeof LeadProductInputSchema>;

export interface LeadProductRow {
  id: string;
  principalId: string | null;
  productId: string | null;
  productName: string;
  brand: string | null;
  qty: number | null;
  unit: string | null;
  price: number | null;
  value: number | null;
}

/** GET /leads query. `ownerId` omitted (or "ALL") = no salesperson filter. */
export const LeadListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  stage: DealStageSchema.optional(),
  tier: CustomerCategorySchema.optional(),
  ownerId: z.string().optional(),
  /** Leads carrying at least one line item for this principal. */
  principalId: z.string().optional(),
});
export type LeadListQuery = z.infer<typeof LeadListQuerySchema>;

/** One enriched lead row. `totalValue` sums the line-item values. */
export interface LeadRow {
  id: string;
  customerName: string;
  division: DivisionValue | null;
  tier: CustomerCategoryValue | null;
  type: CustomerTypeValue | null;
  salespersonId: string;
  salespersonName: string;
  stage: DealStageValue;
  leadStatus: LeadStatusValue | null;
  industryId: string | null;
  industryName: string | null;
  subIndustry: string | null;
  area: string | null;
  address: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  sameAsMobile: boolean;
  email: string | null;
  nextFollowUp: string | null;
  expClose: string | null;
  stageUpdatedAt: string | null;
  products: LeadProductRow[];
  totalValue: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadListResponse = CursorPage<LeadRow>;

/** POST /leads body. `salespersonId` is required (the owning FK). */
export const LeadCreateSchema = z.object({
  customerName: z.string().min(1).max(200),
  salespersonId: z.string().min(1),
  stage: DealStageSchema.optional(),
  division: DivisionSchema.nullable().optional(),
  tier: CustomerCategorySchema.nullable().optional(),
  type: CustomerTypeSchema.nullable().optional(),
  leadStatus: LeadStatusSchema.nullable().optional(),
  industryId: z.string().nullable().optional(),
  subIndustry: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  sameAsMobile: z.boolean().optional(),
  email: z.string().nullable().optional(),
  nextFollowUp: z.string().nullable().optional(),
  expClose: z.string().nullable().optional(),
  products: z.array(LeadProductInputSchema).optional(),
});
export type LeadCreate = z.infer<typeof LeadCreateSchema>;

/** PATCH /leads/:id — partial scalar edit. At least one field required. */
export const LeadUpdateSchema = LeadCreateSchema.omit({ products: true })
  .partial()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type LeadUpdate = z.infer<typeof LeadUpdateSchema>;
