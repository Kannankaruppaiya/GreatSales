/**
 * Server-side CSV rendering for the tenant export.
 *
 * The Data page used to build its CSV in the browser from whatever page of
 * results happened to be sitting in a paginated React Query cache — at most
 * 20-100 rows per entity, never the tenant's real count. Rendering here means
 * the export walks the same server-scoped `list()` queries the pages
 * themselves use (see ExportService), so it carries the WHOLE tenant dataset
 * (or the salesperson's own scope, for a sales-role caller) rather than
 * whatever the UI had already fetched.
 */

/**
 * Escapes one CSV field against both structural breakage and formula
 * injection (CSV/Excel DDE): a value that opens with `=`, `+`, `-`, `@`, a
 * tab or a carriage return is prefixed with `'` so spreadsheet software
 * treats it as text instead of evaluating it as a formula when the export is
 * opened. Ported from the client-side sanitizer that used to be the only
 * place this check ran (apps/web/src/features/data/DataPage.tsx) — now the
 * data leaves the server already safe, regardless of which client renders it.
 */
export function csvField(
  value: string | number | boolean | null | undefined,
): string {
  if (value == null) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** One entity's block: a title line, a header row, and its data rows. */
export function csvSection<T>(
  title: string,
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const lines = [
    `# ${title} (${rows.length})`,
    columns.map((c) => csvField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => csvField(c.value(row))).join(',')),
  ];
  return lines.join('\r\n');
}
