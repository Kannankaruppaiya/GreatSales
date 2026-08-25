import { z } from "zod";

/**
 * Auth contracts shared by API and clients. The API validates inbound bodies
 * against these; clients infer request/response types from the same schemas so
 * the wire format can never silently diverge.
 */

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
}

/** Name of the httpOnly cookie carrying the refresh token. */
export const REFRESH_COOKIE = "gs_rt";

/** Shape attached to `req.user` after the JWT guard verifies an access token. */
export interface RequestUser {
  userId: string;
  tenantId: string;
  roleId: string;
}
