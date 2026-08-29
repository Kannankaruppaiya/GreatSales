import { z } from "zod";
import { LoginResponseSchema } from "./auth";

/**
 * Platform (owner / super-admin) contracts — F14 "multi-management" shell.
 *
 * A **management** is a tenant. The platform owner is a `PlatformUser`, a
 * principal that lives OUTSIDE any tenant (separate table, separate auth — see
 * ADMIN-CAPABILITIES.md Part B). This surface is deliberately distinct from the
 * tenant auth in ./auth: a platform token carries no `tid`, and the tenant JWT
 * guard rejects it. The two never mix.
 *
 * Flow: the owner signs in here (`/platform/auth/login`), lists managements,
 * creates new ones (provisioning a real tenant), and "opens" one via an audited
 * token-exchange (`/platform/managements/:id/assume`) that mints an ordinary
 * tenant session — so every existing tenant endpoint works unchanged, still
 * under RLS.
 */

/** Platform-internal roles (mirrors the DB `PlatformRole` enum). */
export const PLATFORM_ROLES = [
  "SuperAdmin",
  "Ops",
  "Support",
  "Billing",
  "ReadOnly",
] as const;
export type PlatformRoleValue = (typeof PLATFORM_ROLES)[number];
export const PlatformRoleSchema = z.enum(PLATFORM_ROLES);

/** The platform roles allowed to create and open managements. */
export const MANAGEMENT_ADMIN_ROLES: PlatformRoleValue[] = ["SuperAdmin", "Ops"];

/**
 * Platform access-token claims. `sub` = PlatformUser id. No `tid`: a platform
 * principal is not scoped to a tenant. `typ: "platform"` keeps it from being
 * accepted anywhere a tenant access token is expected, and vice versa.
 */
export interface PlatformJwtClaims {
  sub: string;
  prole: PlatformRoleValue;
  typ: "platform";
}

/** POST /platform/auth/login. Email is globally unique for PlatformUser. */
export const PlatformLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type PlatformLoginInput = z.infer<typeof PlatformLoginSchema>;

/** Public-safe platform principal (never carries the password hash). */
export const PlatformUserViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: PlatformRoleSchema,
});
export type PlatformUserView = z.infer<typeof PlatformUserViewSchema>;

export const PlatformLoginResponseSchema = z.object({
  accessToken: z.string(),
  /** Seconds until `accessToken` expires. */
  expiresIn: z.number().int().positive(),
  platformUser: PlatformUserViewSchema,
});
export type PlatformLoginResponse = z.infer<typeof PlatformLoginResponseSchema>;

/** One management (tenant) as the owner sees it on the Home grid. */
export interface ManagementSummary {
  id: string;
  name: string;
  status: string;
  region: string | null;
  industry: string | null;
  /** Display currency, read from Tenant.config. Null until provisioning sets it. */
  currency: string | null;
  /** Active, non-deleted users in the tenant. */
  userCount: number;
  /** Sum of this calendar month's sales-order value, in major currency units. */
  salesThisMonth: number;
  createdAt: string;
}

export type ManagementListResponse = ManagementSummary[];

/**
 * POST /platform/managements — provision a new management (tenant).
 *
 * Creates the Tenant, its system roles + permission matrix, and a first admin
 * user who must change their password on first sign-in.
 */
export const CreateManagementSchema = z.object({
  name: z.string().min(1).max(120),
  industry: z.string().max(80).nullable().optional(),
  region: z.string().max(40).nullable().optional(),
  currency: z.string().max(24).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  fiscalYearStart: z.string().max(24).nullable().optional(),
  adminName: z.string().min(1).max(120),
  adminEmail: z.string().email(),
});
export type CreateManagementInput = z.infer<typeof CreateManagementSchema>;

export const CreateManagementResponseSchema = z.object({
  management: z.custom<ManagementSummary>(),
  adminEmail: z.string(),
  /**
   * A one-time temporary password for the first admin, returned to the owner
   * exactly once (no email delivery exists yet). The admin must change it on
   * first sign-in. Never stored or logged in the clear.
   */
  tempPassword: z.string(),
});
export type CreateManagementResponse = z.infer<
  typeof CreateManagementResponseSchema
>;

/**
 * POST /platform/managements/:id/assume — the token-exchange. The response is
 * an ordinary tenant login response (access token in body, refresh in the
 * httpOnly cookie), for the tenant's own admin user. From the client's point of
 * view the owner is now signed into that management as its admin.
 */
export const AssumeManagementResponseSchema = LoginResponseSchema;
export type AssumeManagementResponse = z.infer<
  typeof AssumeManagementResponseSchema
>;
