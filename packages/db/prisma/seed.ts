/**
 * GreatSales CRM — dev seed
 * Idempotent: wipes tenant data (dev DB only) then reinserts.
 * Creates TWO tenants (Acme, Globex) so RLS tenant-isolation can be verified.
 *
 * NOTE: every seeded user shares the dev password "Passw0rd!" (argon2id hash
 * below). For local testing only — never a real credential.
 */
import { PrismaClient, DealStage, OrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

// Real argon2id hash of "Passw0rd!" so the Auth module's login is testable
// end-to-end. Regenerate via @node-rs/argon2 `hash("Passw0rd!")` if rotated.
const PW =
  "$argon2id$v=19$m=19456,t=2,p=1$YMotFINPtldbJwk7BTyfWA$TlIBiSz3th5+VSEv55i/QkkxiTJSfHY+hhVvt4eSh3Q";

// Permission catalog (global, tenant-agnostic keys).
const PERMISSIONS: { key: string; module: string }[] = [
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
];

// Role → permission keys. Admin = all; Management = read + reports; Sales = own read/write.
const ROLE_PERMS: Record<string, string[]> = {
  admin: PERMISSIONS.map((p) => p.key),
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

async function reset() {
  // Dev DB only. TRUNCATE ... CASCADE avoids FK-ordering and the User<->Team
  // circular FK. Runs as the superuser (seed connection), so RLS does not block it.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE
    "TenantFeatureFlag","FeatureFlag","PlatformAuditLog","PlatformUser",
    "OrderStatusHistory","SalesOrderItem","SalesOrder","PaymentFollowup","Payment",
    "LeadActivity","LeadProduct","Lead","Projection","SalesTarget","Mapping",
    "Product","Principal","CustomerContact","Customer","FollowUp","Activity",
    "Notification","Attachment","AuditLog","ImportJob","RolePermission","Role",
    "Permission","Industry","User","Team","Tenant"
    RESTART IDENTITY CASCADE`);
}

/** Platform-layer seed: one super-admin operator + global feature flags. */
async function seedPlatform() {
  await prisma.platformUser.create({
    data: {
      id: "pu_super",
      name: "Platform Super Admin",
      email: "super@greatsales.io",
      passwordHash: PW,
      role: "SuperAdmin",
    },
  });

  await prisma.featureFlag.createMany({
    data: [
      { id: "ff_new_dash", key: "new-dashboard", description: "Revamped analytics dashboard", enabledGlobal: false, rolloutPercent: 25 },
      { id: "ff_bulk_import", key: "bulk-import", description: "Excel bulk import UI", enabledGlobal: true },
    ],
  });

  return "pu_super";
}

async function seedGlobals() {
  await prisma.permission.createMany({ data: PERMISSIONS });

  await prisma.industry.createMany({
    data: [
      { id: "ind_pharma", name: "Pharmaceutical", subIndustries: ["API", "Formulation", "R&D"] },
      { id: "ind_auto", name: "Automotive", subIndustries: ["OEM", "Tier-1", "Aftermarket"] },
      { id: "ind_food", name: "Food & Beverage", subIndustries: ["Processing", "Packaging"] },
    ],
  });
}

/** Seed one tenant end-to-end. `k` is a short key used to namespace ids. */
async function seedTenant(k: string, name: string, region: string, accountManagerId: string) {
  const t = `tenant_${k}`;

  await prisma.tenant.create({
    data: { id: t, name, plan: "free", status: "Active", region, accountManagerId },
  });

  // Per-tenant feature-flag override (turn new-dashboard ON for this tenant).
  await prisma.tenantFeatureFlag.create({
    data: { tenantId: t, featureFlagId: "ff_new_dash", enabled: true },
  });

  // Roles
  for (const r of ["admin", "mgmt", "sales"] as const) {
    await prisma.role.create({
      data: { id: `role_${r}_${k}`, tenantId: t, name: r, isSystem: true },
    });
  }

  // Role → permissions
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permId = (key: string) => perms.find((p) => p.key === key)!.id;
  for (const r of ["admin", "mgmt", "sales"] as const) {
    await prisma.rolePermission.createMany({
      data: ROLE_PERMS[r].map((key) => ({ roleId: `role_${r}_${k}`, permissionId: permId(key) })),
    });
  }

  // Users
  await prisma.user.create({
    data: { id: `user_admin_${k}`, tenantId: t, name: `${name} Admin`, email: `admin@${k}.test`, username: `admin_${k}`, passwordHash: PW, roleId: `role_admin_${k}` },
  });
  await prisma.user.create({
    data: { id: `user_mgr_${k}`, tenantId: t, name: `${name} Manager`, email: `manager@${k}.test`, username: `manager_${k}`, passwordHash: PW, roleId: `role_mgmt_${k}` },
  });
  // Team owned by the manager
  await prisma.team.create({ data: { id: `team_${k}`, tenantId: t, name: `${name} Team`, managerId: `user_mgr_${k}` } });
  // Salespeople report to the manager and belong to the team
  await prisma.user.create({
    data: { id: `user_sales1_${k}`, tenantId: t, name: `${name} Sales One`, email: `sales1@${k}.test`, username: `sales1_${k}`, passwordHash: PW, roleId: `role_sales_${k}`, managerId: `user_mgr_${k}`, teamId: `team_${k}` },
  });
  await prisma.user.create({
    data: { id: `user_sales2_${k}`, tenantId: t, name: `${name} Sales Two`, email: `sales2@${k}.test`, username: `sales2_${k}`, passwordHash: PW, roleId: `role_sales_${k}`, managerId: `user_mgr_${k}`, teamId: `team_${k}` },
  });

  // Products & principals
  await prisma.principal.create({ data: { id: `prin_${k}`, tenantId: t, name: `${name} Principal Co` } });
  await prisma.product.createMany({
    data: [
      { id: `prod_a_${k}`, tenantId: t, principalId: `prin_${k}`, name: "Product A", unit: "kg", basePrice: "100.00" },
      { id: `prod_b_${k}`, tenantId: t, principalId: `prin_${k}`, name: "Product B", unit: "ltr", basePrice: "250.00" },
    ],
  });

  // Customers (assigned to sales1)
  await prisma.customer.create({
    data: {
      id: `cust_1_${k}`, tenantId: t, name: `${name} Customer One`, category: "Gold",
      industryId: "ind_pharma", area: "North", paymentTerms: "Credit30", payZone: "GreenZone",
      salespersonId: `user_sales1_${k}`,
      contacts: { create: [{ name: "Primary Contact", designation: "Purchase Head", phone: "9000000001", email: `buyer@${k}.test`, isPrimary: true }] },
    },
  });

  // Mapping (recurring customer↔product) + projection
  await prisma.mapping.create({ data: { id: `map_1_${k}`, tenantId: t, customerId: `cust_1_${k}`, productId: `prod_a_${k}`, salespersonId: `user_sales1_${k}` } });
  await prisma.salesTarget.create({ data: { tenantId: t, salespersonId: `user_sales1_${k}`, period: "2026-08", targetValue: "500000.00" } });
  await prisma.projection.create({
    data: { tenantId: t, mappingId: `map_1_${k}`, period: "2026-08", committedQty: "1000", achievedQty: "600", price: "100.00", status: DealStage.NegotiationOralConfirmation },
  });

  // Lead
  await prisma.lead.create({
    data: {
      tenantId: t, customerName: `${name} Prospect`, salespersonId: `user_sales1_${k}`,
      stage: DealStage.NeedsAnalysis, leadStatus: "Silver", industryId: "ind_auto", area: "South",
      products: { create: [{ productName: "New Product X", brand: "BrandX", value: "75000.00" }] },
      activities: { create: [{ note: "Initial call — interested, sample requested." }] },
    },
  });

  // Order + payment
  const order = await prisma.salesOrder.create({
    data: {
      tenantId: t, customerId: `cust_1_${k}`, salespersonId: `user_sales1_${k}`,
      status: OrderStatus.Confirmed, total: "100000.00",
      items: { create: [{ productId: `prod_a_${k}`, qty: "1000", price: "100.00" }] },
      statusHistory: { create: [{ status: OrderStatus.Confirmed, changedById: `user_sales1_${k}` }] },
    },
  });
  await prisma.payment.create({
    data: {
      tenantId: t, customerId: `cust_1_${k}`, invoiceNo: `INV-${k}-001`, amount: "100000.00",
      dueDate: new Date("2026-09-15"), payZone: "GreenZone", status: "Pending",
      followups: { create: [{ note: "Invoice sent, awaiting payment.", nextFollowupDate: new Date("2026-09-01") }] },
    },
  });

  return order.id;
}

async function main() {
  console.log("🌱 Seeding GreatSales dev data…");
  await reset();
  await seedGlobals();
  const superAdminId = await seedPlatform();
  await seedTenant("acme", "Acme Corp", "in", superAdminId);
  await seedTenant("globex", "Globex Inc", "us", superAdminId);

  const counts = {
    tenants: await prisma.tenant.count(),
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    projections: await prisma.projection.count(),
    orders: await prisma.salesOrder.count(),
    platformUsers: await prisma.platformUser.count(),
    featureFlags: await prisma.featureFlag.count(),
    tenantFlagOverrides: await prisma.tenantFeatureFlag.count(),
  };
  console.log("✅ Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
