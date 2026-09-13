/**
 * The Data page's "Export" button — a full, server-generated tenant export,
 * not a CSV built from whatever page of results the browser already had
 * cached (see GET /export/tenant.csv, apps/api/src/export).
 */
import { apiFetchBlob } from "@/lib/api";

/**
 * Fetched rather than linked, same reason `downloadAttachment` is
 * (apps/web/src/features/attachments/queries.ts): a plain `<a href>` sends no
 * Authorization header, and this route requires one.
 */
export async function downloadTenantExport(filename: string): Promise<void> {
  const blob = await apiFetchBlob("/export/tenant.csv");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
