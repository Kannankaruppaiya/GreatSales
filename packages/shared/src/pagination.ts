import { z } from "zod";

/**
 * Cursor pagination is the default for list endpoints (stable under inserts,
 * cheap at depth). Offset is reserved for admin tables that need page jumps.
 */
export const CursorPageQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuerySchema>;

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
