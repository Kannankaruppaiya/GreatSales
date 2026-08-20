/**
 * Wire types for the users (team) API. These mirror the `@greatsales/shared`
 * UserRow / UserListResponse contracts; kept as a local copy so the Vite
 * build does not need to consume the CJS `shared` dist. The API is the
 * source of truth — keep this in sync with packages/shared/src/user.ts.
 *
 * The wire shape never carries a password hash — `password` is write-only
 * (accepted on create/update, never returned).
 */

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
