/**
 * RBAC constants — the single source of truth for permission keys and system
 * role names. The DB seed and the API's authorization guards both derive from
 * these, so a permission never drifts between "what we grant" and "what we check".
 */

/** Every permission key the system understands. `<module>.<action>`. */
export const PERMISSIONS = [
  { key: "customer.read", module: "customer" },
  { key: "customer.write", module: "customer" },
  { key: "lead.read", module: "lead" },
  { key: "lead.write", module: "lead" },
  { key: "projection.read", module: "projection" },
  { key: "projection.write", module: "projection" },
  { key: "order.read", module: "order" },
  { key: "order.write", module: "order" },
  { key: "payment.read", module: "payment" },
  { key: "payment.write", module: "payment" },
  { key: "user.manage", module: "admin" },
  { key: "role.manage", module: "admin" },
  { key: "report.view", module: "report" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** Built-in tenant role slugs. Custom roles may exist beyond these. */
export const SYSTEM_ROLES = ["admin", "mgmt", "sales"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * Default permission grants per system role. Admin = all; Management = read +
 * reports; Sales = own read/write. Kept in sync with the seed.
 */
export const ROLE_PERMISSIONS: Record<SystemRole, PermissionKey[]> = {
  admin: PERMISSION_KEYS,
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
};
