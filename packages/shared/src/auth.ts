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
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof RefreshSchema>;

/** Public-safe user shape returned to clients (never includes passwordHash). */
export const AuthUserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  email: z.string(),
  username: z.string(),
  roleId: z.string(),
  role: z.string().nullable(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
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
}

/** Shape attached to `req.user` after the JWT guard verifies an access token. */
export interface RequestUser {
  userId: string;
  tenantId: string;
  roleId: string;
}
