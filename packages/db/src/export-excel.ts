/**
 * Export GreatSales Backup JSON into a Multi-Sheet Excel Workbook (.xlsx)
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

function sanitizeValue(val: any): any {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (val instanceof Date) return val.toISOString();
    return JSON.stringify(val);
  }
  return val;
}

function autoFitColumns(data: any[]): { wch: number }[] {
  if (!data || data.length === 0) return [];
  const keys = Object.keys(data[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const row of data.slice(0, 100)) {
      const valStr = String(row[key] ?? "");
      if (valStr.length > maxLen) {
        maxLen = Math.min(valStr.length, 50); // cap max width at 50 chars
      }
    }
    return { wch: Math.max(maxLen + 3, 10) };
  });
}

export function exportBackupToExcel(jsonBackupPath?: string, outputExcelPath?: string): string {
  const rootDir = path.resolve(__dirname, "../../..");
  const backupsDir = path.join(rootDir, "backups");

  const inputFile =
    jsonBackupPath ??
    path.join(backupsDir, "greatsales-backup-2026-09-05_14-24-05-103.json");

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Backup file not found at: ${inputFile}`);
  }

  const raw = fs.readFileSync(inputFile, "utf8");
  const backup = JSON.parse(raw);

  const wb = XLSX.utils.book_new();

  // 1. Summary Sheet
  const summaryRows = [
    { Property: "Backup Name", Value: path.basename(inputFile) },
    { Property: "Backup Timestamp", Value: backup.metadata?.timestamp ?? "N/A" },
    { Property: "Created At (UTC)", Value: backup.metadata?.createdAt ?? "N/A" },
    { Property: "Total Records", Value: backup.metadata?.totalRecords ?? 0 },
    { Property: "Exported At", Value: new Date().toISOString() },
    { Property: "", Value: "" },
  ];

  const tableSummary: { "Table / Sheet Name": string; "Record Count": number; "Status": string }[] = [];

  const tables = backup.tables || {};

  // Custom readable sheet names mapping
  const sheetDisplayNames: Record<string, string> = {
    customer: "Customers",
    product: "Products",
    mapping: "Customer_Product_Maps",
    payment: "Payments",
    projection: "Projections",
    lead: "Leads",
    leadProduct: "Lead_Products",
    salesOrder: "Sales_Orders",
    salesOrderItem: "Sales_Order_Items",
    orderStatusHistory: "Order_Status_History",
    principal: "Principals_Brands",
    user: "Users",
    team: "Teams",
    industry: "Industries",
    role: "Roles",
    rolePermission: "Role_Permissions",
    permission: "Permissions",
    tenant: "Tenants",
    platformUser: "Platform_Users",
    remark: "Remarks",
    refreshToken: "Refresh_Tokens",
  };

  for (const [key, rows] of Object.entries(tables)) {
    const rowList = Array.isArray(rows) ? rows : [];
    const displayName = sheetDisplayNames[key] ?? key;
    tableSummary.push({
      "Table / Sheet Name": displayName,
      "Record Count": rowList.length,
      "Status": rowList.length > 0 ? "Included" : "Empty",
    });
  }

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, { header: ["Property", "Value"] });
  XLSX.utils.sheet_add_json(summarySheet, tableSummary, { origin: "A8" });
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 35 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, "Overview");

  // 2. Add individual sheets for each table with records
  const orderedKeys = [
    "customer",
    "product",
    "mapping",
    "payment",
    "projection",
    "lead",
    "leadProduct",
    "salesOrder",
    "salesOrderItem",
    "orderStatusHistory",
    "principal",
    "user",
    "team",
    "industry",
    "role",
    "rolePermission",
    "permission",
    "tenant",
    "platformUser",
    "remark",
    "refreshToken",
  ];

  for (const key of orderedKeys) {
    const rows = tables[key];
    if (Array.isArray(rows) && rows.length > 0) {
      const sanitizedRows = rows.map((r) => {
        const sanitized: Record<string, any> = {};
        for (const [col, val] of Object.entries(r)) {
          sanitized[col] = sanitizeValue(val);
        }
        return sanitized;
      });

      const ws = XLSX.utils.json_to_sheet(sanitizedRows);
      ws["!cols"] = autoFitColumns(sanitizedRows);

      const rawSheetName = sheetDisplayNames[key] ?? key;
      // Excel sheet name max length is 31 chars
      const sheetName = rawSheetName.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  }

  const defaultOutPath = path.join(backupsDir, "GreatSales_Full_Backup.xlsx");
  const finalOut = outputExcelPath ?? defaultOutPath;

  XLSX.writeFile(wb, finalOut);
  console.log(`✅ Excel backup workbook successfully created at:\n   ${finalOut}`);

  return finalOut;
}

function main() {
  try {
    const inputArg = process.argv[2];
    const outArg = process.argv[3];
    exportBackupToExcel(inputArg, outArg);
  } catch (err: any) {
    console.error("❌ Excel export failed:", err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
