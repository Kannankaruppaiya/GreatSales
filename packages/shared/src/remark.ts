import { z } from "zod";
import { CursorSchema } from "./pagination";
import { EntityTypeSchema, type EntityTypeValue } from "./enums";

/**
 * Remark (free-text activity note) contracts, shared by the API and web.
 *
 * A remark hangs off any of the five entity types in `EntityType`, so the
 * resource is addressed by the pair (entityType, entityId) rather than nested
 * under each parent — one controller instead of five, and the timeline
 * component can stay generic.
 *
 * The `Remark` table predates these contracts: it shipped in the schema with
 * relations from Projection, Lead, Payment, SalesOrder and Customer, but no
 * route ever read it, so every note a user typed was discarded by the client.
 */

/** GET /remarks — both params required; a remark list is never global. */
export const RemarkListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
});
export type RemarkListQuery = z.infer<typeof RemarkListQuerySchema>;

export const RemarkCreateSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
  text: z.string().trim().min(1).max(2000),
});
export type RemarkCreate = z.infer<typeof RemarkCreateSchema>;

/** One note on an entity's timeline. `at` is an ISO instant. */
export interface RemarkRow {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  userId: string | null;
  userName: string | null;
  text: string;
  at: string;
}
