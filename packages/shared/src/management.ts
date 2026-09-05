import { z } from "zod";

/**
 * Management (workspace / tenant) contracts, shared by the API and web.
 *
 * "Management" is the product's word for what the schema calls a Tenant: one
 * customer company's workspace, with its own users, catalog and ledger.
 *
 * SCOPE, and it is a narrow one: a `User` row carries exactly one `tenantId`,
 * so a signed-in user can reach exactly one management. `GET /managements`
 * therefore returns a single-element list today. The list shape is deliberate
 * rather than optimistic — the switcher and the home page both want a list —
 * but genuine cross-tenant access needs `PlatformUser` auth, which does not
 * exist yet. Until it does, this resource is honest about returning one.
 */

export const ManagementCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(120).optional(),
  region: z.string().trim().max(40).optional(),
  plan: z.string().trim().max(40).default("free"),
  /** The first admin of the new workspace. A password is generated and must be changed on first login. */
  adminName: z.string().trim().min(2).max(120),
  adminEmail: z.string().trim().toLowerCase().email(),
});
export type ManagementCreate = z.infer<typeof ManagementCreateSchema>;

export const ManagementUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    industry: z.string().trim().max(120).nullable(),
    region: z.string().trim().max(40).nullable(),
  })
  .partial();
export type ManagementUpdate = z.infer<typeof ManagementUpdateSchema>;

export interface ManagementRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  industry: string | null;
  region: string | null;
  createdAt: string;
  /** Live counts, so the workspace card does not have to page every list to fill itself in. */
  userCount: number;
  customerCount: number;
  productCount: number;
  /**
   * Earliest reporting period that has data, `YYYY-MM`, or null when none does.
   *
   * The floor for every month selector. It is NOT `createdAt`: a workspace
   * created today can be imported with years of history — the Promech tenant is
   * exactly that, seeded in one run with months of projections behind it — so a
   * selector built from the tenant's creation date would refuse to show the
   * data the tenant actually has.
   */
  firstPeriod: string | null;
}

/** POST /managements response — carries the generated first-login password ONCE. */
export interface ManagementCreated {
  management: ManagementRow;
  adminEmail: string;
  /**
   * Shown to the operator a single time so they can hand it over. It is never
   * stored in plaintext and never returned again; the new admin must change it
   * on first login (`mustChangePassword`).
   */
  temporaryPassword: string;
}
