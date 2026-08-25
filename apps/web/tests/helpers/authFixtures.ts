/**
 * Role → permission keys, for test fixtures.
 *
 * A LOCAL copy rather than an import from `@greatsales/shared`: the web app is
 * deliberately decoupled from that package's CJS dist (see
 * `features/users/types.ts`), so its tests must be too. Kept in sync with
 * `packages/shared/src/rbac.ts` — the API is the source of truth, and
 * `roles.service.spec.ts` is what proves the real grants match.
 */
export const TEST_ROLE_PERMISSIONS = {
  admin: [
    "customer.read",
    "customer.write",
    "lead.read",
    "lead.write",
    "projection.read",
    "projection.write",
    "order.read",
    "order.write",
    "payment.read",
    "payment.write",
    "user.manage",
    "role.manage",
    "report.view",
  ],
  mgmt: [
    "customer.read",
    "lead.read",
    "projection.read",
    "order.read",
    "payment.read",
    "report.view",
  ],
  sales: [
    "customer.read",
    "customer.write",
    "lead.read",
    "lead.write",
    "projection.read",
    "projection.write",
    "order.read",
    "order.write",
    "payment.read",
  ],
} as const satisfies Record<string, readonly string[]>;

export type TestRole = "super_admin" | keyof typeof TEST_ROLE_PERMISSIONS;

/**
 * The permission keys a session in `role` actually holds.
 *
 * `super_admin` is not a tenant role — it is the platform operator, and the
 * API resolves it against the tenant `admin` grants, so that is what it gets
 * here too.
 */
export function permissionsFor(role: TestRole): string[] {
  return [...TEST_ROLE_PERMISSIONS[role === "super_admin" ? "admin" : role]];
}
