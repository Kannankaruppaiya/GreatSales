/**
 * The role segment that every signed-in URL carries.
 *
 * Before this, every role landed on `/managements/:id/dashboard` and stayed
 * there. The address bar said nothing about who was signed in, so an admin
 * session and a salesperson's session were indistinguishable by URL — you could
 * not tell from a screenshot, a bug report or a browser history which portal a
 * page had been reached through, and the four sign-in doors stopped mattering
 * the moment you were through one.
 *
 * Now the role is the first segment: `/admin/managements/:id/dashboard`,
 * `/sales/managements/:id/dashboard`. `RequireRolePath` in App.tsx checks the
 * segment against the session and redirects if they disagree, so the URL cannot
 * claim a role the token does not hold. This is a legibility and
 * defence-in-depth measure, not the authorization itself — every request is
 * still authorized by the API against the token.
 */
import type { Role } from "@/data/constants";
import { useAuthRole } from "@/store/auth";

/** Role → URL segment. These match the sign-in doors (`/admin/login`, …). */
export const ROLE_PATHS = {
  super_admin: "super-admin",
  admin: "admin",
  mgmt: "management",
  sales: "sales",
} as const satisfies Record<Role, string>;

export type RolePath = (typeof ROLE_PATHS)[Role];

/** URL segment → role. Accepts the aliases the login routes already redirect. */
const ROLE_BY_PATH: Record<string, Role> = {
  "super-admin": "super_admin",
  superadmin: "super_admin",
  admin: "admin",
  management: "mgmt",
  mgmt: "mgmt",
  sales: "sales",
};

export function rolePathFor(role: Role): RolePath {
  return ROLE_PATHS[role];
}

export function roleForPath(segment: string | undefined): Role | null {
  if (!segment) return null;
  return ROLE_BY_PATH[segment] ?? null;
}

/** The segment for the signed-in user. */
export function useRolePath(): RolePath {
  return rolePathFor(useAuthRole());
}

/** Where a role signs in. One door each; there is no shared one. */
export function loginPathFor(role: Role): string {
  return `/${ROLE_PATHS[role]}/login`;
}

/**
 * The sign-in door implied by a URL someone tried to open while signed out.
 *
 * Every signed-in URL leads with the role segment, so an expired session on
 * `/management/managements/m1/leads` can be sent back to `/management/login`
 * and no further. When the path carries no role — an old bookmark of
 * `/managements/...`, or a bare `/` — there is nothing to infer from and
 * nowhere safe to guess, so the caller gets null and shows the
 * "use your own address" page instead of a door that serves everybody.
 */
export function loginPathForPath(pathname: string): string | null {
  const first = pathname.split("/").filter(Boolean)[0];
  const role = roleForPath(first);
  return role ? loginPathFor(role) : null;
}
