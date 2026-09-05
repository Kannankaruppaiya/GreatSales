import { z } from "zod";
import { CursorSchema } from "./pagination";

/**
 * User (tenant member) management contracts, shared by the API and web. This is
 * admin-side (`user.manage`). The wire shape NEVER carries the password hash;
 * passwords travel inbound only, as plaintext to be hashed server-side.
 */

/**
 * Which activity states to include.
 *
 * An ENUM, deliberately. This was `active: z.coerce.boolean()`, and
 * `z.coerce.boolean()` maps the STRING "false" to `true` — so `?active=false`
 * returned ACTIVE users. Query strings only ever carry strings, so any boolean
 * coercion on a query parameter is a bug waiting to be found. An enum has
 * nothing to coerce.
 */
export const UserStatusFilter = z.enum(["all", "active", "inactive"]);
export type UserStatusFilter = z.infer<typeof UserStatusFilter>;

/** Columns the list may be ordered by. Closed set — never an arbitrary string,
 *  which would let a caller order by a column that has no index. */
export const UserSortField = z.enum([
  "name",
  "email",
  "username",
  "createdAt",
  "lastLoginAt",
]);
export type UserSortField = z.infer<typeof UserSortField>;

/** A string flag on a query string. Same reasoning as UserStatusFilter. */
export const BoolFlag = z.enum(["true", "false"]);
export type BoolFlag = z.infer<typeof BoolFlag>;

/** GET /users query. */
export const UserListQuerySchema = z.object({
  cursor: CursorSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Bounded so a pathological term cannot be used to drive an expensive scan. */
  search: z.string().max(200).optional(),
  roleId: z.string().optional(),
  teamId: z.string().optional(),
  status: UserStatusFilter.default("all"),
  sort: UserSortField.default("name"),
  dir: z.enum(["asc", "desc"]).default("asc"),
  includeDeleted: BoolFlag.default("false"),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

/**
 * The query the schema produces for an empty query string.
 *
 * Exported so internal callers and tests can spread it rather than restating
 * four fields — and, more importantly, so a caller that forgets one gets a
 * TYPE error instead of a silently different result set.
 */
export const DEFAULT_USER_LIST_QUERY: UserListQuery =
  UserListQuerySchema.parse({});

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
  /** True while an admin-set password has not yet been replaced by the user. */
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Non-null only for soft-deleted rows, which the list hides by default. */
  deletedAt: string | null;
}

export interface UserListResponse {
  items: UserRow[];
  nextCursor: string | null;
  /**
   * Count of ALL matching rows, not of this page. Read in the same transaction
   * as the page, so a concurrent insert cannot make the header count disagree
   * with the rows beneath it.
   */
  total: number;
}

/** POST /users body. `password` is plaintext, hashed server-side before store. */
export const UserCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  username: z.string().min(1).max(60),
  /**
   * Presence only. The STRENGTH rules live in `validatePassword` and are
   * applied by the service, so there is exactly one source of truth for what
   * an acceptable password is. A `min(8)` here would both contradict the
   * policy's minimum of 12 and shadow its WEAK_PASSWORD code with a generic
   * validation error, leaving the client unable to tell the user why.
   */
  password: z.string().min(1),
  roleId: z.string().min(1),
  managerId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  active: z.boolean().optional(),
});
export type UserCreate = z.infer<typeof UserCreateSchema>;

/**
 * POST /users/:id/reset-password — admin-initiated.
 *
 * The response never echoes the password: the admin already has it, and
 * nothing else should ever hold a copy.
 */
export const UserResetPasswordSchema = z.object({
  password: z.string().min(1),
});
export type UserResetPassword = z.infer<typeof UserResetPasswordSchema>;

/** PATCH /users/:id — partial edit. `password` (if present) is re-hashed. */
export const UserUpdateSchema = UserCreateSchema.partial().refine(
  (o) => Object.keys(o).length > 0,
  { message: "At least one field must be provided" },
);
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
