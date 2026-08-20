import { z } from "zod";

/**
 * User (tenant member) management contracts, shared by the API and web. This is
 * admin-side (`user.manage`). The wire shape NEVER carries the password hash;
 * passwords travel inbound only, as plaintext to be hashed server-side.
 */

/** GET /users query. */
export const UserListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  roleId: z.string().optional(),
  active: z.coerce.boolean().optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

/** Public-safe user shape. No passwordHash, ever. */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  username: string;
  roleId: string;
  roleName: string;
  managerId: string | null;
  managerName: string | null;
  teamId: string | null;
  teamName: string | null;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: UserRow[];
  nextCursor: string | null;
}

/** POST /users body. `password` is plaintext, hashed server-side before store. */
export const UserCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(1),
  password: z.string().min(8),
  roleId: z.string().min(1),
  managerId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

/** PATCH /users/:id — partial edit. `password` (if present) is re-hashed. */
export const UserUpdateSchema = UserCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
