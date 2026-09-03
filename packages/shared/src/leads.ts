import { z } from "zod";
import { DealStage, LeadStatus } from "./enums";

/** Lead contracts (new-sales pipeline). */
export const LeadProductSchema = z.object({
  id: z.string(),
  productName: z.string(),
  brand: z.string().nullable(),
  value: z.string().nullable(),
});
export type LeadProduct = z.infer<typeof LeadProductSchema>;

export const LeadActivitySchema = z.object({
  id: z.string(),
  date: z.string(),
  note: z.string(),
});
export type LeadActivity = z.infer<typeof LeadActivitySchema>;

export const LeadSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  salespersonId: z.string(),
  stage: DealStage,
  leadStatus: LeadStatus.nullable(),
  industryId: z.string().nullable(),
  area: z.string().nullable(),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const LeadDetailSchema = LeadSchema.extend({
  products: z.array(LeadProductSchema),
  activities: z.array(LeadActivitySchema),
});
export type LeadDetail = z.infer<typeof LeadDetailSchema>;

export const CreateLeadSchema = z.object({
  customerName: z.string().min(1).max(200),
  stage: DealStage.optional(),
  leadStatus: LeadStatus.optional(),
  industryId: z.string().optional(),
  area: z.string().max(120).optional(),
  salespersonId: z.string().optional(),
  products: z
    .array(
      z.object({
        productName: z.string().min(1).max(200),
        brand: z.string().max(120).optional(),
        value: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
});
export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;

export const UpdateLeadSchema = z.object({
  customerName: z.string().min(1).max(200).optional(),
  stage: DealStage.optional(),
  leadStatus: LeadStatus.optional(),
  industryId: z.string().optional(),
  area: z.string().max(120).optional(),
});
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;

/** Append a timeline note to a lead. */
export const AddLeadActivitySchema = z.object({
  note: z.string().min(1).max(2000),
});
export type AddLeadActivityInput = z.infer<typeof AddLeadActivitySchema>;
