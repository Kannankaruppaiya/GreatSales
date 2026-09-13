-- One contact table for every record that names a human.
--
-- WHAT WAS WRONG
-- ----------------------------------------------------------------------------
-- "Who do I call at this account" had two encodings that could not be read or
-- written together:
--
--   * CustomerContact — nine columns, many rows per customer, and a service
--     that only ever selected `where isPrimary = true take 1`. The other rows
--     were unreachable through the API, and the table held zero rows anyway
--     because no seed or import ever wrote one.
--   * Lead.contactName / phone / whatsapp / sameAsMobile / email — a single
--     contact flattened into the lead itself, so a deal could name exactly one
--     person. A plant has a purchase manager AND a plant head, and a deal is
--     worked through both.
--
-- WHAT THIS DOES
-- ----------------------------------------------------------------------------
-- Introduces `Contact`, polymorphic on EntityType the way `Remark` and
-- `Attachment` already are, and folds both encodings into it. That is the call
-- this repo made once before: 20260910090000 folded `LeadActivity` into
-- `Remark` rather than keeping a parallel table per entity.
--
-- Nothing is dropped before its rows are copied, and a lead with no contact
-- details at all produces no row rather than an empty contact.

-- 1. The table ---------------------------------------------------------------
CREATE TABLE "Contact" (
    "id"           TEXT NOT NULL,
    "tenantId"     TEXT NOT NULL,
    "entityType"   "EntityType" NOT NULL,
    "entityId"     TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "designation"  TEXT,
    "phone"        TEXT,
    "whatsapp"     TEXT,
    "sameAsMobile" BOOLEAN NOT NULL DEFAULT true,
    "email"        TEXT,
    "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
    "sortOrder"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contact_tenantId_idx" ON "Contact"("tenantId");
CREATE INDEX "Contact_entityType_entityId_idx" ON "Contact"("entityType", "entityId");

ALTER TABLE "Contact" ADD CONSTRAINT "Contact_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Carry the customer contacts across --------------------------------------
-- CustomerContact carried no tenantId of its own; it is taken from the owning
-- customer. `mobile` and `phone` were two columns for one number in practice —
-- the mobile is the one every surface asked for, so it wins and the landline
-- falls back into it.
INSERT INTO "Contact" (
    "id", "tenantId", "entityType", "entityId", "name", "designation",
    "phone", "whatsapp", "sameAsMobile", "email", "isPrimary", "sortOrder",
    "createdAt", "updatedAt"
)
SELECT
    cc."id",
    c."tenantId",
    'Customer'::"EntityType",
    cc."customerId",
    cc."name",
    cc."designation",
    COALESCE(cc."mobile", cc."phone"),
    cc."whatsapp",
    cc."sameAsMobile",
    cc."email",
    cc."isPrimary",
    0,
    cc."createdAt",
    cc."updatedAt"
FROM "CustomerContact" cc
JOIN "Customer" c ON c."id" = cc."customerId";

-- 3. Carry the lead's flattened contact across -------------------------------
-- One primary contact per lead that actually names somebody or leaves a number.
-- A lead with none of the four produces no row — an empty contact is worse than
-- no contact, because it looks like somebody entered one.
INSERT INTO "Contact" (
    "id", "tenantId", "entityType", "entityId", "name", "designation",
    "phone", "whatsapp", "sameAsMobile", "email", "isPrimary", "sortOrder",
    "createdAt", "updatedAt"
)
SELECT
    'ct_' || l."id",
    l."tenantId",
    'Lead'::"EntityType",
    l."id",
    COALESCE(NULLIF(TRIM(l."contactName"), ''), 'Contact'),
    NULL,
    l."phone",
    l."whatsapp",
    l."sameAsMobile",
    l."email",
    true,
    0,
    l."createdAt",
    l."updatedAt"
FROM "Lead" l
WHERE COALESCE(NULLIF(TRIM(l."contactName"), ''), NULLIF(TRIM(l."phone"), ''),
               NULLIF(TRIM(l."email"), ''), NULLIF(TRIM(l."whatsapp"), '')) IS NOT NULL;

-- 4. Drop what has been replaced ---------------------------------------------
DROP TABLE "CustomerContact";

ALTER TABLE "Lead" DROP COLUMN "contactName";
ALTER TABLE "Lead" DROP COLUMN "phone";
ALTER TABLE "Lead" DROP COLUMN "whatsapp";
ALTER TABLE "Lead" DROP COLUMN "sameAsMobile";
ALTER TABLE "Lead" DROP COLUMN "email";

-- 5. Row-Level Security ------------------------------------------------------
-- ALTER DEFAULT PRIVILEGES (20260815000000_rls_policies) grants the runtime role
-- full DML on every FUTURE table, so a new tenant-owned table is writable by
-- every tenant the moment it is created and is protected only once a policy
-- exists. The policy ships with the table, never after it. Same shape as
-- PeriodLock and Remark: fail closed when app.tenant_id is unset, and FORCE so
-- the table owner cannot bypass it either.
ALTER TABLE "Contact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Contact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Contact";
CREATE POLICY tenant_isolation ON "Contact"
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));
