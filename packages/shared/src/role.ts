import { z } from "zod";

/**
 * Role and permission administration contracts, shared by the API and web.
 *
 * A tenant may define its own roles beyond the three built-ins, so the web
 * cannot infer capability from a role NAME — it must read the actual grants
 * from here. That is why `permissionKeys` travels on every role row.
 */

/** Public-safe role shape. */
export interface RoleRow {
  id: string;
  name: string;
  /** Built-in roles may have their permissions edited, but not their identity. */
  isSystem: boolean;
  /** The role's actual grants, resolved from RolePermission. */
  permissionKeys: string[];
  /** Live users assigned to this role. A role in use cannot be deleted. */
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

/** One module's worth of the permission catalogue, for rendering a matrix. */
export interface PermissionGroup {
  module: string;
  permissions: { key: string; label: string }[];
}

export const RoleCreateSchema = z.object({
  name: z.string().min(1).max(60),
  /**
   * The complete grant set. Replacement is wholesale rather than additive, so
   * a caller can never be surprised by a permission they did not send.
   */
  permissionKeys: z.array(z.string()).min(1),
});
export type RoleCreate = z.infer<typeof RoleCreateSchema>;

export const RoleUpdateSchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    permissionKeys: z.array(z.string()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one field must be provided",
  });
export type RoleUpdate = z.infer<typeof RoleUpdateSchema>;
