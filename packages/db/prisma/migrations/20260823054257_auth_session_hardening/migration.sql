-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "replacedById" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshToken_tenantId_userId_idx" ON "RefreshToken"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Row Level Security for RefreshToken
-- ============================================================
-- Every other tenant-scoped table is isolated in
-- 20260815000000_rls_policies. A new table is NOT covered by that migration,
-- so it must enable RLS here or it silently becomes the one table the
-- restricted role can read across tenants.
--
-- The refresh flow knows the tenant from the presented token's `tid` claim and
-- runs under `prisma.forTenant(tid)`, so the policy below is satisfied on every
-- legitimate path and fails closed when app.tenant_id is unset.
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RefreshToken";
CREATE POLICY tenant_isolation ON "RefreshToken"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- ============================================================
-- Migration safety notes (AGENTS.md §24)
-- ============================================================
-- Lock duration: both ALTER TABLE "User" ADD COLUMN statements add a column
--   with a non-volatile default. On PostgreSQL 11+ this is metadata-only — no
--   table rewrite, no long ACCESS EXCLUSIVE hold — so it is safe on a large
--   User table.
-- Backward compatibility: purely additive. An older API build ignores the new
--   columns and the new table, so this migration can be deployed BEFORE the
--   application code (expand phase).
-- Rollback:
--   DROP TABLE "RefreshToken";
--   ALTER TABLE "User" DROP COLUMN "failedLoginAttempts", DROP COLUMN "lockedUntil";
--   Effect: every issued refresh token becomes unverifiable, so all users are
--   signed out at their next refresh. Access tokens remain valid until their
--   TTL expires. No business data is lost.
