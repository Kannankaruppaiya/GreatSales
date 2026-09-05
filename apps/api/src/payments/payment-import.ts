/**
 * Pure import de-duplication planner — no Prisma, no I/O — so the money-critical
 * "which rows are safe to insert" decision is unit-testable in isolation
 * (mirrors payment-engine / order-engine). The service does the I/O: it reads
 * the tenant's existing refNos, calls this, then inserts the survivors inside
 * ONE transaction. The DB partial-unique index on (tenantId, refNo) is the hard
 * backstop for anything that races past this check.
 */

/**
 * Trim a raw reference; a blank/whitespace-only reference becomes `null` — "no
 * reference". Normalisation happens both when the service dedupes AND when it
 * stores, so the in-memory check and the DB unique index compare the same
 * value.
 */
export function normalizeRefNo(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim();
  return t.length > 0 ? t : null;
}

/** Why a row was skipped — surfaced verbatim intent in the per-row report. */
export type SkipReason = 'duplicate_existing' | 'duplicate_in_batch';

export type ImportDecision =
  | { action: 'insert'; refNo: string | null }
  | { action: 'skip'; refNo: string; reason: SkipReason };

/**
 * Decide, for each incoming row in order, whether to INSERT it or SKIP it as a
 * duplicate — FLAGGED-SKIP policy: a repeat reference is skipped and reported,
 * the rest of the sheet still imports.
 *
 * Two duplicate sources are caught:
 *   1. `duplicate_existing` — a reference already live in the ledger
 *      (`existingRefNos`, which the caller passes already normalised).
 *   2. `duplicate_in_batch` — a reference repeated earlier in THIS sheet; the
 *      first occurrence inserts, later ones skip.
 *
 * Rows with no reference (`null` after {@link normalizeRefNo}) are never
 * duplicates of one another and always insert. The returned array is
 * index-aligned to `rows`.
 */
export function planPaymentImport(
  rows: { refNo?: string | null }[],
  existingRefNos: Iterable<string>,
): ImportDecision[] {
  const existing = new Set(existingRefNos);
  const seen = new Set<string>();

  return rows.map((row) => {
    const refNo = normalizeRefNo(row.refNo);
    if (refNo === null) return { action: 'insert', refNo: null };
    if (existing.has(refNo)) {
      return { action: 'skip', refNo, reason: 'duplicate_existing' };
    }
    if (seen.has(refNo)) {
      return { action: 'skip', refNo, reason: 'duplicate_in_batch' };
    }
    seen.add(refNo);
    return { action: 'insert', refNo };
  });
}
