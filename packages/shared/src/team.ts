import { z } from "zod";

/**
 * Team administration contracts, shared by the API and web.
 *
 * A team is a manager plus a set of members. `Team.managerId` is a required
 * foreign key, so an invalid manager would otherwise surface as a 500 rather
 * than a field-level validation error.
 */

/** Public-safe team shape. */
export interface TeamRow {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  /** Live members only — a soft-deleted user is not on the team. */
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export const TeamCreateSchema = z.object({
  name: z.string().min(1).max(80),
  managerId: z.string().min(1),
});
export type TeamCreate = z.infer<typeof TeamCreateSchema>;

export const TeamUpdateSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    managerId: z.string().min(1).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type TeamUpdate = z.infer<typeof TeamUpdateSchema>;

/**
 * Bulk membership assignment. Capped so one request cannot open an unbounded
 * transaction — a caller with more members than this should page.
 */
export const TeamMembersSchema = z.object({
  userIds: z.array(z.string()).min(1).max(200),
});
export type TeamMembers = z.infer<typeof TeamMembersSchema>;
