import { z } from "zod";

/**
 * Period lock contracts, shared by the API and web.
 *
 * Locking a month freezes its projection worksheet so figures cannot drift
 * after management has reported on them. The lock is enforced SERVER-SIDE in
 * `ProjectionsService.update` — the Data page's toggle used to be local React
 * state, which meant the card claimed to prevent "unauthorized row overrides
 * after accounting close" while every row stayed editable.
 */

/** `YYYY-MM`, the same period key Projection.period carries. */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");

export const PeriodLockListQuerySchema = z.object({
  /** Omit for every lock in the tenant; pass to ask about one month. */
  period: PeriodSchema.optional(),
});
export type PeriodLockListQuery = z.infer<typeof PeriodLockListQuerySchema>;

export const PeriodLockCreateSchema = z.object({
  period: PeriodSchema,
  reason: z.string().trim().max(500).optional(),
});
export type PeriodLockCreate = z.infer<typeof PeriodLockCreateSchema>;

export interface PeriodLockRow {
  period: string;
  reason: string | null;
  lockedById: string;
  lockedByName: string;
  lockedAt: string;
}
