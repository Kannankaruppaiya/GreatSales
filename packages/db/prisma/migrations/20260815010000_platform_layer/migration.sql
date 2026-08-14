-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('Trial', 'Active', 'Suspended', 'Churned');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SuperAdmin', 'Ops', 'Support', 'Billing', 'ReadOnly');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "accountManagerId" TEXT,
ADD COLUMN     "contractEnd" TIMESTAMP(3),
ADD COLUMN     "contractStart" TIMESTAMP(3),
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "status" "TenantStatus" NOT NULL DEFAULT 'Trial';

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'Support',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastIp" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditLog" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "tenantId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "enabledGlobal" BOOLEAN NOT NULL DEFAULT false,
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureFlagId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,

    CONSTRAINT "TenantFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

-- CreateIndex
CREATE INDEX "PlatformUser_deletedAt_idx" ON "PlatformUser"("deletedAt");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_platformUserId_idx" ON "PlatformAuditLog"("platformUserId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditLog_tenantId_idx" ON "PlatformAuditLog"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "TenantFeatureFlag_tenantId_idx" ON "TenantFeatureFlag"("tenantId");

-- CreateIndex
CREATE INDEX "TenantFeatureFlag_featureFlagId_idx" ON "TenantFeatureFlag"("featureFlagId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureFlag_tenantId_featureFlagId_key" ON "TenantFeatureFlag"("tenantId", "featureFlagId");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditLog" ADD CONSTRAINT "PlatformAuditLog_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureFlag" ADD CONSTRAINT "TenantFeatureFlag_featureFlagId_fkey" FOREIGN KEY ("featureFlagId") REFERENCES "FeatureFlag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Platform-layer access control (custom, appended)
-- The prior RLS migration set ALTER DEFAULT PRIVILEGES granting the tenant app
-- role SELECT/INSERT/UPDATE/DELETE on all FUTURE tables. Those grants landed on
-- these new platform tables too — lock them back down.
-- ============================================================

-- Platform-only tables: tenant app role must NOT touch them at all.
REVOKE ALL ON "PlatformUser" FROM greatsales_app;
REVOKE ALL ON "PlatformAuditLog" FROM greatsales_app;

-- Feature flags are platform-managed; the tenant app may only READ them to
-- resolve which features are on. Strip write access.
REVOKE INSERT, UPDATE, DELETE ON "FeatureFlag" FROM greatsales_app;
REVOKE INSERT, UPDATE, DELETE ON "TenantFeatureFlag" FROM greatsales_app;

-- TenantFeatureFlag carries tenantId → tenant-scope it under RLS so a tenant
-- reads only its own overrides (same fail-closed model as the rest).
ALTER TABLE "TenantFeatureFlag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantFeatureFlag" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TenantFeatureFlag";
CREATE POLICY tenant_isolation ON "TenantFeatureFlag"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
