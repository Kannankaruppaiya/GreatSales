/**
 * GreatSales CRM — Data Cleanup Script
 *
 * Automatically backs up current data first, then clears all customer, product,
 * lead, order, payment, projection, and other transactional records across the
 * entire application, keeping strictly the default Tenant, System Roles/Permissions,
 * Platform SuperAdmin, and the Admin user login.
 */

import { PrismaClient } from "@prisma/client";
import { assertDestructiveSeedAllowed } from "../prisma/seed-guard";
import { backupDatabase } from "./backup";
import { PERMISSIONS, ROLE_PERMISSIONS as ROLE_PERMS } from "@greatsales/shared";

const prisma = new PrismaClient();

const TENANT_ID = "tenant_promech";
const TENANT_NAME = "Promech Industrial Sales";

// argon2id hash of "admin" and "Passw0rd!"
const PW_ADMIN =
  "$argon2id$v=19$m=19456,t=2,p=1$PXG/62M4okQJXMC6W+qhXw$GfLM1P7AJ8gifaHC42aolsL4tghggmv4tacSH3gm6I4"; // "admin"
const PW_PLATFORM =
  "$argon2id$v=19$m=19456,t=2,p=1$YMotFINPtldbJwk7BTyfWA$TlIBiSz3th5+VSEv55i/QkkxiTJSfHY+hhVvt4eSh3Q"; // "Passw0rd!"

export async function clearAllDataExceptAdmin(options?: { skipBackup?: boolean }) {
  assertDestructiveSeedAllowed();

  console.log("🧹 =========================================================");
  console.log("🧹 GreatSales Data Purge — Keeping Only Admin Login");
  console.log("🧹 =========================================================");

  // Step 1: Automatic Backup
  if (!options?.skipBackup) {
    console.log("\n1️⃣ Performing safety backup before clearing data...");
    const backupRes = await backupDatabase();
    console.log(`   Backup secured: ${backupRes.totalRecords} records saved to ${backupRes.jsonPath}`);
  }

  // Step 2: Clear transactional & application data
  console.log("\n2️⃣ Clearing all business & transactional tables...");

  // TRUNCATE all transactional & entity tables with CASCADE
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TenantFeatureFlag",
      "FeatureFlag",
      "PlatformAuditLog",
      "OrderStatusHistory",
      "SalesOrderItem",
      "SalesOrder",
      "PaymentFollowup",
      "Payment",
      "LeadActivity",
      "LeadProduct",
      "Lead",
      "Projection",
      "SalesTarget",
      "Mapping",
      "Product",
      "Principal",
      "CustomerContact",
      "Customer",
      "FollowUp",
      "Activity",
      "Remark",
      "PeriodLock",
      "Notification",
      "Attachment",
      "AuditLog",
      "ImportJob",
      "RefreshToken",
      "Team"
    RESTART IDENTITY CASCADE;
  `);

  console.log("   ✓ Cleared orders, payments, leads, customers, products, mappings, projections, activities & teams.");

  // Step 3: Remove all non-admin users
  console.log("\n3️⃣ Purging non-admin users...");
  await prisma.$executeRawUnsafe(`
    DELETE FROM "User"
    WHERE username != 'admin' AND email != 'admin@greatsales.local';
  `);

  // Step 4: Ensure system infrastructure is solid & intact
  console.log("\n4️⃣ Ensuring tenant, roles, permissions, and admin user exist...");

  // Ensure Permissions
  const existingPermCount = await prisma.permission.count();
  if (existingPermCount === 0) {
    await prisma.permission.createMany({ data: PERMISSIONS, skipDuplicates: true });
    console.log("   ✓ Created system permissions.");
  }

  // Ensure Platform User
  await prisma.platformUser.upsert({
    where: { email: "super@greatsales.io" },
    update: { active: true, passwordHash: PW_PLATFORM, role: "SuperAdmin" },
    create: {
      id: "pu_super",
      name: "Platform Super Admin",
      email: "super@greatsales.io",
      passwordHash: PW_PLATFORM,
      role: "SuperAdmin",
      active: true,
    },
  });

  // Ensure Tenant
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {
      name: TENANT_NAME,
      status: "Active",
      deletedAt: null,
      accountManagerId: "pu_super",
    },
    create: {
      id: TENANT_ID,
      name: TENANT_NAME,
      plan: "free",
      status: "Active",
      region: "in",
      accountManagerId: "pu_super",
    },
  });

  // Ensure Roles
  for (const r of ["admin", "mgmt", "sales"] as const) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId: TENANT_ID, name: r } },
      update: { isSystem: true },
      create: { id: "role_" + r, tenantId: TENANT_ID, name: r, isSystem: true },
    });
  }

  // Ensure RolePermissions
  const perms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permMap = new Map(perms.map((p) => [p.key, p.id]));
  for (const r of ["admin", "mgmt", "sales"] as const) {
    const requiredKeys = ROLE_PERMS[r] ?? [];
    for (const key of requiredKeys) {
      const pId = permMap.get(key);
      if (pId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: "role_" + r, permissionId: pId } },
          update: {},
          create: { roleId: "role_" + r, permissionId: pId },
        });
      }
    }
  }

  // Ensure Admin User
  await prisma.user.upsert({
    where: { id: "user_admin" },
    update: {
      tenantId: TENANT_ID,
      name: "Administrator",
      email: "admin@greatsales.local",
      username: "admin",
      passwordHash: PW_ADMIN,
      roleId: "role_admin",
      managerId: null,
      teamId: null,
      active: true,
      deletedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      mustChangePassword: false,
    },
    create: {
      id: "user_admin",
      tenantId: TENANT_ID,
      name: "Administrator",
      email: "admin@greatsales.local",
      username: "admin",
      passwordHash: PW_ADMIN,
      roleId: "role_admin",
      active: true,
      mustChangePassword: false,
    },
  });

  console.log("   ✓ Admin user verified: admin@greatsales.local (role: role_admin)");

  // Step 5: Verification Report
  console.log("\n5️⃣ Final Database State Summary:");
  const summary = {
    Tenants: await prisma.tenant.count({ where: { deletedAt: null } }),
    Users: await prisma.user.count({ where: { deletedAt: null } }),
    Customers: await prisma.customer.count({ where: { deletedAt: null } }),
    Products: await prisma.product.count({ where: { deletedAt: null } }),
    Mappings: await prisma.mapping.count({ where: { deletedAt: null } }),
    Leads: await prisma.lead.count({ where: { deletedAt: null } }),
    SalesOrders: await prisma.salesOrder.count({ where: { deletedAt: null } }),
    Payments: await prisma.payment.count({ where: { deletedAt: null } }),
    Projections: await prisma.projection.count({ where: { deletedAt: null } }),
    FollowUps: await prisma.followUp.count(),
    Activities: await prisma.activity.count(),
  };

  for (const [table, count] of Object.entries(summary)) {
    console.log(`   • ${table.padEnd(15)}: ${count}`);
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, roleId: true, active: true },
  });

  console.log("\n🔑 Active Users in Application:");
  users.forEach((u) => {
    console.log(`   - [${u.id}] ${u.username} (${u.email}) - Role: ${u.roleId} - Active: ${u.active}`);
  });

  console.log("\n✨ Database clear complete! Only admin login remains.");
}

async function main() {
  try {
    await clearAllDataExceptAdmin();
  } catch (err) {
    console.error("❌ Data purge failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
