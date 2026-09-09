import { z } from "zod";
import { PeriodSchema } from "./period";

/**
 * Sales targets — what a salesperson is expected to bring in for a month.
 *
 * The dashboard has always shown committed and achieved: what the pipeline is
 * worth, and what has landed. Neither is a target. Without one, "achieved
 * ₹4.2L" answers nothing on its own — it is the number a manager has to hold
 * an unstated figure against, which means the figure lives in a spreadsheet or
 * in someone's head and two people quote it differently.
 *
 * The table for this shipped in the first migration and nothing ever read or
 * wrote it outside fixtures, so the dashboard's target line simply did not
 * exist. This is the contract that makes it real.
 *
 * A target is per salesperson per period, which is what the unique constraint
 * on `(salespersonId, period)` says. There is deliberately no team-level or
 * tenant-level target: those are sums of these, and a stored total that can
 * disagree with its parts is a reporting bug waiting to happen.
 */

/** Money is sent as a number, not a Decimal string — see `targetValue`. */
export interface SalesTargetRow {
  id: string;
  salespersonId: string;
  salespersonName: string;
  /** `YYYY-MM`. */
  period: string;
  /**
   * The month's target, in rupees.
   *
   * Serialised as a number to match every other money field on the wire
   * (`ProjectionLine.projValue`, `LeadRow.totalValue`). The column is
   * Decimal(14,2); the conversion happens once, in the service.
   */
  targetValue: number;
}

export const TargetListQuerySchema = z.object({
  /** Omit for every period; pass to ask about one month. */
  period: PeriodSchema.optional(),
  /**
   * Admin and management may scope to one person. A sales user is forced to
   * their own targets regardless of what they send — enforced in the service,
   * the same way the dashboard scopes `ownerId`.
   */
  salespersonId: z.string().optional(),
});
export type TargetListQuery = z.infer<typeof TargetListQuerySchema>;

/**
 * Set a month's target for one person.
 *
 * Upsert rather than create+update: `(salespersonId, period)` is unique, so
 * "set August for Megala" has exactly one meaning and a caller should not have
 * to know whether a row already exists to express it.
 */
export const TargetUpsertSchema = z.object({
  salespersonId: z.string().min(1),
  period: PeriodSchema,
  /**
   * Zero is allowed and means a real target of nothing — someone on leave for
   * the month. To remove a target entirely, DELETE it; an absent target and a
   * target of zero read differently on the dashboard and should.
   */
  targetValue: z
    .number()
    .min(0, "A target cannot be negative")
    // Decimal(14, 2): twelve digits before the point.
    .max(999_999_999_999.99, "That target is larger than the column allows"),
});
export type TargetUpsert = z.infer<typeof TargetUpsertSchema>;
