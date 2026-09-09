import { z } from "zod";

/**
 * Auth contracts shared by API and clients. The API validates inbound bodies
 * against these; clients infer request/response types from the same schemas so
 * the wire format can never silently diverge.
 */

/**
 * Which application a session was opened from, and which door was used.
 *
 * RFC 6749 §10.3 puts this squarely on the server: "The authorization server
 * SHOULD take the client identity into account when choosing how to honor the
 * requested scope and MAY issue an access token with less rights than
 * requested." So the rule that an administrator cannot sign in from the phone
 * is enforced where tokens are minted, not by hiding a button — a client is
 * whatever the caller says it is until the server checks the credential behind
 * it, and anyone can post to /auth/login with curl.
 */
export const AUTH_CLIENTS = ["web", "mobile"] as const;
export type AuthClient = (typeof AUTH_CLIENTS)[number];

/** The four sign-in doors on web. Each is a distinct URL; none is shared. */
export const PORTALS = ["super_admin", "admin", "mgmt", "sales"] as const;
export type Portal = (typeof PORTALS)[number];

/**
 * Which role names may open a session from which client.
 *
 * The mobile app is a field-sales tool: it has no user administration, no role
 * editor, no period locks and no tenant settings, so an administrator signing
 * in there gains nothing and only widens where an admin credential can be
 * phished or left logged in on a personal phone. Change the list here and both
 * the API and the two clients follow.
 */
export const CLIENT_ROLE_ALLOWLIST: Record<AuthClient, readonly string[]> = {
  mobile: ["sales"],
  web: ["super_admin", "admin", "mgmt", "sales"],
};

/**
 * Permissions that make a role an administrative one whatever it is called.
 *
 * A tenant can define its own roles, so the allowlist above cannot be the only
 * gate — "Branch Head" is not in it and neither is it in any deny list. Any
 * role holding one of these is an admin in effect and is refused on mobile
 * regardless of its name.
 */
export const ADMIN_PERMISSION_KEYS = [
  "user.manage",
  "role.manage",
  "period.manage",
] as const;

export function isAdminLikeRole(permissionKeys: readonly string[]): boolean {
  return permissionKeys.some((k) =>
    (ADMIN_PERMISSION_KEYS as readonly string[]).includes(k),
  );
}

/** Both gates: the name allowlist, then the permission backstop. */
export function roleAllowedOnClient(
  client: AuthClient,
  roleName: string | null | undefined,
  permissionKeys: readonly string[] = [],
): boolean {
  const named = CLIENT_ROLE_ALLOWLIST[client] ?? [];
  if (!roleName || !named.includes(roleName)) return false;
  if (client === "mobile" && isAdminLikeRole(permissionKeys)) return false;
  return true;
}

/**
 * Whether a role may use a given web door.
 *
 * Without this the per-role URLs are decoration: /sales/login and /admin/login
 * posted the same body to the same endpoint, so the address bar said one thing
 * and the session was another.
 */
export function roleMatchesPortal(
  portal: Portal,
  roleName: string | null | undefined,
): boolean {
  return roleName === portal;
}

// Tenant discriminator is required at login because email is unique *per tenant*
// (`@@unique([tenantId, email])`), not globally. Production will resolve tenantId
// from a workspace subdomain/slug; until slugs exist, the client sends it.
export const LoginSchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
  /**
   * Where the refresh token is delivered.
   *
   * `cookie` (default) — the server sets an httpOnly, SameSite cookie and the
   * response body carries NO refresh token. Browser clients must use this: a
   * refresh token readable by JavaScript is a long-lived credential one XSS
   * away from theft.
   *
   * `body` — the refresh token is returned in the response for clients that
   * cannot hold cookies (native apps storing it in the OS keychain). Never
   * select this from a browser.
   */
  tokenDelivery: z.enum(["cookie", "body"]).default("cookie"),
  /**
   * Which application is asking. Defaults to `web` so an omitted field can only
   * ever be the LESS privileged mistake — a mobile build that forgets to send
   * it is refused nothing, but nothing can quietly acquire mobile's narrower
   * gate by staying silent either.
   */
  client: z.enum(AUTH_CLIENTS).default("web"),
  /** Which web sign-in door was used. The server checks the role matches it. */
  portal: z.enum(PORTALS).optional(),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Refresh and logout read the token from the httpOnly cookie when the body
 * omits it, so `refreshToken` is optional on the wire — but exactly one source
 * must supply it, which the server enforces.
 */
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
  /** Revoke every session for this user, not just the presented family. */
  allSessions: z.boolean().default(false),
});
export type LogoutInput = z.infer<typeof LogoutSchema>;

/**
 * POST /auth/change-password.
 *
 * Requires the CURRENT password, not merely a valid access token: a stolen
 * token must not be enough to take an account over permanently. The strength
 * policy is applied server-side against the shared rules, not here, so a
 * client cannot be tricked into believing a weak password is acceptable.
 */
export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/** Public-safe user shape returned to clients (never includes passwordHash). */
export const AuthUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  roleId: z.string(),
  role: z.string().nullable(),
  /**
   * The caller's resolved permission keys. The web uses these to decide which
   * controls to render; the server still enforces every one of them
   * independently, so hiding a button is a courtesy, never a control
   * (AGENTS.md §7).
   */
  permissions: z.array(z.string()),
  /**
   * True while an ADMIN-set password has not yet been replaced by the user.
   * While true the session may reach only /auth/me, /auth/change-password and
   * /auth/logout — enforced by a guard, not by the client honouring this flag.
   */
  mustChangePassword: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  /** Absent under `tokenDelivery: "cookie"` — the cookie carries it instead. */
  refreshToken: z.string().optional(),
  /** Seconds until `accessToken` expires, so clients need not decode the JWT. */
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const LoginResponseSchema = AuthTokensSchema.extend({
  user: AuthUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;


/**
 * JWT access-token claims. `sub` = user id. `tid` = tenant id (drives RLS
 * `SET app.tenant_id` on every request). `typ` distinguishes access vs refresh
 * so a refresh token can never be replayed as an access token.
 */
export interface JwtAccessClaims {
  sub: string;
  tid: string;
  roleId: string;
  typ: "access";
}

export interface JwtRefreshClaims {
  sub: string;
  tid: string;
  typ: "refresh";
  /** Token id — the primary key of the RefreshToken row backing this token. */
  jti: string;
  /** Rotation family. Replaying a consumed token revokes the whole family. */
  fid: string;
  /**
   * The client this session was opened from. Re-checked on every rotation:
   * without it, an admin session opened on web could be refreshed by the mobile
   * app and the client restriction would hold only for the first request.
   * Optional so refresh tokens issued before this shipped still verify — they
   * are treated as `web`, which is the wider of the two.
   */
  cli?: AuthClient;
}

/** Name of the httpOnly cookie carrying the refresh token. */
export const REFRESH_COOKIE = "gs_rt";

/** Shape attached to `req.user` after the JWT guard verifies an access token. */
export interface RequestUser {
  userId: string;
  tenantId: string;
  roleId: string;
}
