/**
 * GreatSales Database Backup Utility
 *
 * Dumps all tables to a timestamped JSON snapshot in `backups/` and
 * executes pg_dump against the PostgreSQL container for a complete SQL dump.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Models in dependency order for clean serialization/restoration
const TABLE_MODELS = [
  "tenant",
  "platformUser",
  "platformAuditLog",
  "featureFlag",
  "tenantFeatureFlag",
  "permission",
  "industry",
  "role",
  "rolePermission",
  "team",
  "user",
  "refreshToken",
  "principal",
  "product",
  "customer",
  "customerContact",
  "mapping",
  "salesTarget",
  "projection",
  "lead",
  "leadProduct",
  "leadActivity",
  "salesOrder",
  "salesOrderItem",
  "orderStatusHistory",
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
] as const;

export async function backupDatabase(customOutputDir?: string): Promise<{
  jsonPath: string;
  sqlPath?: string;
  totalRecords: number;
  tableCounts: Record<string, number>;
}> {
  const rootDir = path.resolve(__dirname, "../../..");
  const backupsDir = customOutputDir ?? path.join(rootDir, "backups");

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");
  const baseFilename = `greatsales-backup-${timestamp}`;

  console.log(`📦 Starting database backup (${timestamp})...`);

  // 1. Export structured JSON from Prisma
  const backupData: {
    metadata: {
      timestamp: string;
      createdAt: string;
      totalRecords: number;
      tableCounts: Record<string, number>;
    };
    tables: Record<string, any[]>;
  } = {
    metadata: {
      timestamp,
      createdAt: now.toISOString(),
      totalRecords: 0,
      tableCounts: {},
    },
    tables: {},
  };

  let totalRecords = 0;
  const tableCounts: Record<string, number> = {};

  for (const modelName of TABLE_MODELS) {
    const delegate = (prisma as any)[modelName];
    if (delegate && typeof delegate.findMany === "function") {
      try {
        const records = await delegate.findMany();
        backupData.tables[modelName] = records;
        tableCounts[modelName] = records.length;
        totalRecords += records.length;
        console.log(`  ✓ ${modelName.padEnd(20)}: ${records.length} records`);
      } catch (err: any) {
        console.warn(`  ⚠️ Could not read table ${modelName}:`, err.message);
        backupData.tables[modelName] = [];
        tableCounts[modelName] = 0;
      }
    }
  }

  backupData.metadata.totalRecords = totalRecords;
  backupData.metadata.tableCounts = tableCounts;

  const jsonPath = path.join(backupsDir, `${baseFilename}.json`);
  const latestJsonPath = path.join(backupsDir, `latest.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(backupData, null, 2), "utf8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(backupData, null, 2), "utf8");
  console.log(`\n💾 Saved JSON snapshot to:\n   ${jsonPath}`);

  // 2. Try native PostgreSQL dump via docker if available
  let sqlPath: string | undefined;
  try {
    const candidateSqlPath = path.join(backupsDir, `${baseFilename}.sql`);
    const latestSqlPath = path.join(backupsDir, `latest.sql`);

    // Run pg_dump inside docker container
    const cmd = `docker exec greatsales-postgres pg_dump -U greatsales -d greatsales --clean --if-exists`;
    const sqlDump = execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], maxBuffer: 100 * 1024 * 1024 });

    if (sqlDump && sqlDump.length > 0) {
      fs.writeFileSync(candidateSqlPath, sqlDump, "utf8");
      fs.writeFileSync(latestSqlPath, sqlDump, "utf8");
      sqlPath = candidateSqlPath;
      console.log(`💾 Saved SQL dump to:\n   ${candidateSqlPath}`);
    }
  } catch (err: any) {
    console.log(`ℹ️ Native docker pg_dump skipped or not available (${err.message}). JSON snapshot is complete.`);
  }

  console.log(`\n✅ Backup complete! Total records backed up: ${totalRecords}`);

  return {
    jsonPath,
    sqlPath,
    totalRecords,
    tableCounts,
  };
}

async function main() {
  try {
    await backupDatabase();
  } catch (err) {
    console.error("❌ Backup failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}
