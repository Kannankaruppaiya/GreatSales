import { z } from "zod";
import { EntityTypeSchema, type EntityTypeValue } from "./enums";

/**
 * FollowUp (cross-entity task) contracts, shared by the API and web. A follow-up
 * points at some entity (projection/lead/payment/…) and belongs to a
 * salesperson. `amount` is a plain number on the wire (Prisma Decimal → number).
 *
 * NOTE: the FollowUp table has NO soft-delete column, so removal is a hard
 * delete. RBAC has no dedicated key: reads are gated by `projection.read`,
 * writes by `projection.write`.
 */

export const FollowUpListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  entityType: EntityTypeSchema.optional(),
  done: z.coerce.boolean().optional(),
  ownerId: z.string().optional(),
});
export type FollowUpListQuery = z.infer<typeof FollowUpListQuerySchema>;

export interface FollowUpRow {
  id: string;
  entityType: EntityTypeValue;
  entityId: string;
  salespersonId: string;
  salespersonName: string;
  title: string | null;
  subtitle: string | null;
  amount: number | null;
  dueDate: string;
  done: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpListResponse {
  items: FollowUpRow[];
  nextCursor: string | null;
}

/** POST /followups body. `salespersonId` defaults to the caller when omitted. */
export const FollowUpCreateSchema = z.object({
  entityType: EntityTypeSchema,
  entityId: z.string().min(1),
  dueDate: z.string().min(1),
  salespersonId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  amount: z.number().nonnegative().nullable().optional(),
  note: z.string().nullable().optional(),
  done: z.boolean().optional(),
});
export type FollowUpCreate = z.infer<typeof FollowUpCreateSchema>;

/** PATCH /followups/:id — partial edit (commonly to mark `done`). */
export const FollowUpUpdateSchema = z
  .object({
    entityType: EntityTypeSchema.optional(),
    entityId: z.string().min(1).optional(),
    dueDate: z.string().min(1).optional(),
    title: z.string().nullable().optional(),
    subtitle: z.string().nullable().optional(),
    amount: z.number().nonnegative().nullable().optional(),
    note: z.string().nullable().optional(),
    done: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type FollowUpUpdate = z.infer<typeof FollowUpUpdateSchema>;
