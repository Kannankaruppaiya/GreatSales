-- Payment reference (refNo) de-duplication — the DB-level backstop for the
-- weekly Tally/ERP outstanding-invoice import.
--
-- WHY
-- ----------------------------------------------------------------------------
-- A payment `refNo` is the receipt/invoice reference from the source sheet. The
-- import used to skip duplicates only against the refNos already loaded in the
-- browser's PAGINATED list, so re-importing the same sheet while the list was
-- paged let duplicate receipts through and DOUBLE-COUNTED money. The service now
-- dedupes against the whole table inside one transaction, but application-level
-- dedupe alone is not integrity: a concurrent import, a direct SQL insert, or a
-- future code path could still create a second row with the same reference.
--
-- This partial UNIQUE index makes a duplicate live reference IMPOSSIBLE at the
-- data layer, per tenant. Prisma cannot model a filtered/partial index, so —
-- exactly like the RLS policies and the User identity indexes
-- (20260823120000_f12_users_roles_teams) — it is defined here in raw SQL and
-- represented in schema.prisma only as a plain @@index.
--
--   * WHERE "refNo" IS NOT NULL — a payment need not carry a reference (manual
--     entries), and many NULLs must coexist; only real references are unique.
--   * WHERE "deletedAt" IS NULL — uniqueness applies to LIVE rows only, so a
--     soft-deleted payment frees its reference for legitimate re-use, matching
--     how User email/username uniqueness was made partial.
--
-- Matching is EXACT on the stored (trimmed) reference — deterministic, and it
-- keeps the equality dedupe lookup index-backed at 1M+ rows. The application
-- trims a reference before storing it (normalizeRefNo), so " PAY-1 " and
-- "PAY-1" collide as intended; case is preserved and treated as significant.
--
-- MIGRATION SAFETY (AGENTS.md §24)
-- ----------------------------------------------------------------------------
-- Building a UNIQUE index FAILS if two live rows in one tenant already share a
-- reference. That is intentional: such rows ARE the double-count this change
-- exists to prevent, and the failure surfaces them so an operator resolves the
-- duplicates before the constraint goes live, rather than masking them.

-- Equality lookup index for the whole-table dedupe read (refNo IN (…) per
-- tenant). Named to match the plain @@index([tenantId, refNo]) now in the
-- Prisma schema, so migrate sees no drift. IF NOT EXISTS keeps it re-runnable.
CREATE INDEX IF NOT EXISTS "Payment_tenantId_refNo_idx"
  ON "Payment" ("tenantId", "refNo");

-- The hard backstop: one live reference per tenant.
CREATE UNIQUE INDEX "Payment_tenantId_refNo_live_key"
  ON "Payment" ("tenantId", "refNo")
  WHERE "refNo" IS NOT NULL AND "deletedAt" IS NULL;
