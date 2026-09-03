import { z } from "zod";
import { DealStage } from "./enums";

/**
 * Dashboard summary — the numbers the mobile home screen leads with. All money
 * fields are strings (lossless decimals). Computed server-side under the
 * caller's tenant + role scope.
 */
export const PipelineStageCountSchema = z.object({
  stage: DealStage,
  count: z.number(),
});
export type PipelineStageCount = z.infer<typeof PipelineStageCountSchema>;

export const DashboardSummarySchema = z.object({
  customers: z.number(),
  leads: z.number(),
  openOrders: z.number(),
  orderRevenue: z.string(),
  outstandingReceivables: z.string(),
  overdueInvoices: z.number(),
  pipeline: z.array(PipelineStageCountSchema),
});
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
