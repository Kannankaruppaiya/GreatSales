-- F12 — Users, Roles & Teams
--
-- PRODUCTION NOTE ------------------------------------------------------------
-- Prisma runs migrations inside a transaction, so the index builds below take a
-- brief ACCESS EXCLUSIVE lock on "User". On a User table of thousands of rows
-- per tenant that is single-digit milliseconds and safe to run inline.
--
-- If "User" has grown past ~1M rows, do NOT run this file directly. Run the
-- CONCURRENTLY variants outside a transaction first, then mark this migration
-- applied with `prisma migrate resolve --applied 20260823120000_f12_users_roles_teams`.
-- The exact procedure is in DEPLOYMENT.md → "F12 index migration".
--
-- ROLLBACK -------------------------------------------------------------------
-- Reverting to the plain UNIQUE constraints FAILS if a soft-deleted row shares
-- an email or username with a live row — which is precisely the state this
-- migration makes legal. Before reverting, run:
--
--   SELECT "tenantId", "email", count(*) FROM "User"
--   GROUP BY 1, 2 HAVING count(*) > 1;
--
-- and hard-delete or re-key the soft-deleted duplicates. Recovery is documented
-- in DEPLOYMENT.md.
-- ---------------------------------------------------------------------------

-- 1. Forced password change after an admin-set credential --------------------
ALTER TABLE "User"
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- 2. Uniqueness becomes PARTIAL, so soft-delete frees the identity -----------
-- Prisma names a compound @@unique as a constraint; older databases may carry
-- it as a bare index. Drop both spellings so this is safe to re-run.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_username_key";
DROP INDEX IF EXISTS "User_tenantId_email_key";
DROP INDEX IF EXISTS "User_tenantId_username_key";

CREATE UNIQUE INDEX "User_tenantId_email_live_key"
  ON "User" ("tenantId", "email")
  WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "User_tenantId_username_live_key"
  ON "User" ("tenantId", "username")
  WHERE "deletedAt" IS NULL;

-- Prisma still models these pairs as plain indexes, so lookups by email or
-- username (the sign-in path) stay index-backed now that the unique constraint
-- no longer provides one.
CREATE INDEX IF NOT EXISTS "User_tenantId_email_idx"
  ON "User" ("tenantId", "email");
CREATE INDEX IF NOT EXISTS "User_tenantId_username_idx"
  ON "User" ("tenantId", "username");

-- 3. Serves the default user listing and its default `name asc` sort ---------
CREATE INDEX IF NOT EXISTS "User_tenantId_deletedAt_name_idx"
  ON "User" ("tenantId", "deletedAt", "name");
