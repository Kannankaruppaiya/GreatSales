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
  { key: "period.manage", module: "admin" },
  { key: "report.view", module: "report" },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

/**
 * Human labels for the permission matrix.
 *
 * Lives here rather than in the web app so the wording cannot drift from the
 * keys it describes, and so a new permission added to PERMISSIONS without a
 * label is a TYPE error rather than a raw `customer.write` shown to a user.
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "customer.read": "View customers",
  "customer.write": "Create and edit customers",
  "lead.read": "View leads",
  "lead.write": "Create and edit leads",
  "projection.read": "View projections",
  "projection.write": "Create and edit projections",
  "order.read": "View sales orders",
  "order.write": "Create and edit sales orders",
  "payment.read": "View payments",
  "payment.write": "Record payments",
  "user.manage": "Manage users",
  "role.manage": "Manage roles and permissions",
  "period.manage": "Lock and unlock reporting periods",
  "report.view": "View reports and dashboards",
};

/** Human labels for the module each permission belongs to. */
export const MODULE_LABELS: Record<string, string> = {
  customer: "Customers",
  lead: "Leads",
  projection: "Projections",
  order: "Sales orders",
  payment: "Payments",
  admin: "Administration",
  report: "Reports",
};

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
    "period.manage",
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
