/**
 * Wire types for user, role, and team administration.
 *
 * These mirror the `@greatsales/shared` contracts and are kept as a LOCAL copy
 * so the Vite build does not need to consume the CJS `shared` dist. The API is
 * the source of truth — keep this in sync with `packages/shared/src/user.ts`,
 * `role.ts`, and `team.ts`.
 *
 * The wire shape never carries a password or a hash: `password` is write-only,
 * accepted on create/update and never returned.
 */

/* ── Users ──────────────────────────────────────────────────────────────── */

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
  /** ALL matching rows, not this page. Read this for any visible count. */
  total: number;
}

export type UserStatusFilter = "all" | "active" | "inactive";
export type UserSortField =
  | "name"
  | "email"
  | "username"
  | "createdAt"
  | "lastLoginAt";
export type SortDirection = "asc" | "desc";

export interface UserCreate {
  name: string;
  email: string;
  username: string;
  password: string;
  roleId: string;
  managerId?: string | null;
  teamId?: string | null;
  active?: boolean;
}

export type UserUpdate = Partial<UserCreate>;

/* ── Roles ──────────────────────────────────────────────────────────────── */

export interface RoleRow {
  id: string;
  name: string;
  /** Built-in roles may have their permissions edited, but not their identity. */
  isSystem: boolean;
  permissionKeys: string[];
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGroup {
  module: string;
  permissions: { key: string; label: string }[];
}

export interface RoleCreate {
  name: string;
  permissionKeys: string[];
}

export interface RoleUpdate {
  name?: string;
  permissionKeys?: string[];
}

/* ── Teams ──────────────────────────────────────────────────────────────── */

export interface TeamRow {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamCreate {
  name: string;
  managerId: string;
}

export interface TeamUpdate {
  name?: string;
  managerId?: string;
}

/* ── Error codes ────────────────────────────────────────────────────────── */

/**
 * The `code` values the API attaches to deliberate failures. The UI branches
 * on these, never on the human message, so server-side wording can change
 * without breaking a screen.
 */
export type ApiErrorCode =
  | "SELF_MUTATION_FORBIDDEN"
  | "LAST_ADMIN_PROTECTED"
  | "INVALID_MANAGER"
  | "WEAK_PASSWORD"
  | "INVALID_REFERENCE"
  | "DUPLICATE_IDENTITY"
  | "USER_NOT_FOUND"
  | "RESTORE_CONFLICT"
  | "SYSTEM_ROLE_PROTECTED"
  | "ROLE_IN_USE"
  | "LAST_ADMIN_ROLE_PROTECTED"
  | "ROLE_NOT_FOUND"
  | "TEAM_NOT_FOUND"
  | "WRONG_CURRENT_PASSWORD"
  | "PASSWORD_CHANGE_REQUIRED";

/* ── Permission keys the UI gates on ────────────────────────────────────── */

/**
 * Gating a control on these hides a button that would 403. It is a courtesy,
 * never a control: every one is enforced server-side and proved by a deny test
 * in `users.e2e-spec.ts`, `roles.e2e-spec.ts`, and `teams.e2e-spec.ts`.
 */
export const PERM_USER_MANAGE = "user.manage";
export const PERM_ROLE_MANAGE = "role.manage";
