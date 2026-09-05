import { z } from "zod";

/**
 * A pagination cursor is always an id this API handed out on a previous page,
 * so it is constrained to the shape of one. Left as a free string, a caller
 * could post a control character that Postgres refuses outright, which surfaced
 * as a 500 from `findMany` instead of a 400 from validation.
 */
export const CursorSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid cursor");

/**
 * Cursor pagination is the default for list endpoints (stable under inserts,
 * cheap at depth). Offset is reserved for admin tables that need page jumps.
 */
export const CursorPageQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuerySchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  /**
   * Total rows matching the filter, ignoring the cursor window.
   *
   * Costs one indexed COUNT per list call, and buys the callers that need a
   * true count (the Data page's per-entity totals, the mobile "showing N of M"
   * footer) an answer without walking every page. Before this existed the Data
   * page reported `items.length` and so displayed 20 customers out of 417.
   */
  total: number;
}

/**
 * A boolean carried on a query string.
 *
 * NOT `z.coerce.boolean()`: that is `Boolean(value)`, which maps the STRING
 * "false" to `true`, so `?done=false` asked for the done rows and the
 * Follow-ups timeline came back empty. A query string only ever carries
 * strings, so the two literals are parsed explicitly. Same reasoning as
 * `UserStatusFilter` in user.ts, which this generalises.
 */
export const QueryBool = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");
