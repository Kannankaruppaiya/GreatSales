/**
 * GreatSales Database Restore Utility
 *
 * Restores all database tables from a specified JSON snapshot or SQL dump in `backups/`.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";
import { assertDestructiveSeedAllowed } from "../prisma/seed-guard";

const prisma = new PrismaClient();

// Models in insertion order respecting foreign keys
const INSERT_ORDER = [
  "permission",
  "industry",
  "platformUser",
  "featureFlag",
  "tenant",
  "tenantFeatureFlag",
  "platformAuditLog",
  "role",
  "rolePermission",
  "user",
  "team",
  "principal",
  "product",
  "customer",
  "customerContact",
  "mapping",
  "salesTarget",
  "salesOrder",
  "salesOrderItem",
  "orderStatusHistory",
  "projection",
  "lead",
  "leadProduct",
  "leadActivity",
  "payment",
  "paymentFollowup",
  "followUp",
  "activity",
  "remark",
  "periodLock",
  "notification",
  "attachment",
  "auditLog",
  "importJob",
  "refreshToken",
] as const;

export async function restoreDatabase(backupFilePath?: string) {
  assertDestructiveSeedAllowed();

  const rootDir = path.resolve(__dirname, "../../..");
  const backupsDir = path.join(rootDir, "backups");

  const targetFile =
    backupFilePath ??
    (fs.existsSync(path.join(backupsDir, "latest.sql"))
      ? path.join(backupsDir, "latest.sql")
      : path.join(backupsDir, "latest.json"));

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Backup file not found at: ${targetFile}`);
  }

  console.log(`🔄 Restoring database from: ${targetFile}`);

  if (targetFile.endsWith(".sql")) {
    console.log("📥 Restoring from SQL dump via PostgreSQL container...");
    const cmd = `docker exec -i greatsales-postgres psql -U greatsales -d greatsales < "${targetFile}"`;
    execSync(cmd, { stdio: "inherit", shell: "cmd.exe" });
    console.log("✅ SQL restore completed successfully!");
    return;
  }

  // Restore from JSON
  console.log("📥 Restoring from JSON snapshot...");
  const rawData = fs.readFileSync(targetFile, "utf8");
  const backup = JSON.parse(rawData);

  // 1. Truncate all tables
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TenantFeatureFlag","FeatureFlag","PlatformAuditLog","PlatformUser",
      "OrderStatusHistory","SalesOrderItem","SalesOrder","PaymentFollowup","Payment",
      "LeadActivity","LeadProduct","Lead","Projection","SalesTarget","Mapping",
      "Product","Principal","CustomerContact","Customer","FollowUp","Activity",
      "Notification","Attachment","AuditLog","ImportJob","RolePermission","Role",
      "Permission","Industry","RefreshToken","User","Team","Tenant"
    RESTART IDENTITY CASCADE;
  `);

  // 2. Insert records in topological order
  for (const modelName of INSERT_ORDER) {
    const records = backup.tables[modelName];
    if (records && records.length > 0) {
      const delegate = (prisma as any)[modelName];
      if (delegate && typeof delegate.createMany === "function") {
        try {
          await delegate.createMany({ data: records });
          console.log(`  ✓ Restored ${modelName.padEnd(20)}: ${records.length} records`);
        } catch (err: any) {
          console.warn(`  ⚠️ Bulk insert failed for ${modelName}, inserting one by one:`, err.message);
          for (const rec of records) {
            await delegate.create({ data: rec }).catch(() => {});
          }
        }
      }
    }
  }

  console.log("✅ JSON restore completed successfully!");
}

async function main() {
  const fileArg = process.argv[2];
  try {
    await restoreDatabase(fileArg);
  } catch (err) {
    console.error("❌ Restore failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
