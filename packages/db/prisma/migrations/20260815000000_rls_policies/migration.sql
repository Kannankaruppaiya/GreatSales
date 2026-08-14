-- RLS policies + restricted application role for GreatSales CRM
-- ============================================================
-- Enforcement model (READ THIS):
--   * Migrations + seed run as the SUPERUSER role (greatsales) which BYPASSES RLS.
--   * The running API MUST connect as the restricted role `greatsales_app`
--     (non-superuser → RLS applies) and set the tenant per request/transaction:
--         SET LOCAL app.tenant_id = '<tenantId>';
--   * current_setting('app.tenant_id', true) returns NULL when unset → policies
--     match zero rows (FAIL CLOSED). Forgetting to set the tenant leaks nothing.
--   * RLS is the DB backstop; API guards are the primary layer (defense in depth).

-- 1. Restricted application role -----------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'greatsales_app') THEN
    CREATE ROLE greatsales_app LOGIN PASSWORD 'greatsales_app';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO greatsales_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO greatsales_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO greatsales_app;
-- Future tables created by the owner inherit these grants automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO greatsales_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO greatsales_app;

-- 2. Tenant table (keyed on id) ------------------------------------------
ALTER TABLE "Tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tenant" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Tenant";
CREATE POLICY tenant_isolation ON "Tenant"
  USING ("id" = current_setting('app.tenant_id', true))
  WITH CHECK ("id" = current_setting('app.tenant_id', true));

-- 3. Tables with a direct tenantId column --------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'User','Team','Role','Customer','Principal','Product','Mapping',
    'SalesTarget','Projection','Lead','SalesOrder','Payment','FollowUp',
    'Activity','Notification','Attachment','AuditLog','ImportJob'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("tenantId" = current_setting(''app.tenant_id'', true)) '
      'WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;

-- 4. Child tables (no tenantId) — isolated via their parent --------------
-- CustomerContact → Customer
ALTER TABLE "CustomerContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomerContact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "CustomerContact";
CREATE POLICY tenant_isolation ON "CustomerContact"
  USING (EXISTS (SELECT 1 FROM "Customer" p WHERE p."id" = "CustomerContact"."customerId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "Customer" p WHERE p."id" = "CustomerContact"."customerId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- RolePermission → Role
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "RolePermission";
CREATE POLICY tenant_isolation ON "RolePermission"
  USING (EXISTS (SELECT 1 FROM "Role" p WHERE p."id" = "RolePermission"."roleId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "Role" p WHERE p."id" = "RolePermission"."roleId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- LeadProduct → Lead
ALTER TABLE "LeadProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadProduct" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LeadProduct";
CREATE POLICY tenant_isolation ON "LeadProduct"
  USING (EXISTS (SELECT 1 FROM "Lead" p WHERE p."id" = "LeadProduct"."leadId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "Lead" p WHERE p."id" = "LeadProduct"."leadId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- LeadActivity → Lead
ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeadActivity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "LeadActivity";
CREATE POLICY tenant_isolation ON "LeadActivity"
  USING (EXISTS (SELECT 1 FROM "Lead" p WHERE p."id" = "LeadActivity"."leadId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "Lead" p WHERE p."id" = "LeadActivity"."leadId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- SalesOrderItem → SalesOrder
ALTER TABLE "SalesOrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesOrderItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SalesOrderItem";
CREATE POLICY tenant_isolation ON "SalesOrderItem"
  USING (EXISTS (SELECT 1 FROM "SalesOrder" p WHERE p."id" = "SalesOrderItem"."orderId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "SalesOrder" p WHERE p."id" = "SalesOrderItem"."orderId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- OrderStatusHistory → SalesOrder
ALTER TABLE "OrderStatusHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderStatusHistory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderStatusHistory";
CREATE POLICY tenant_isolation ON "OrderStatusHistory"
  USING (EXISTS (SELECT 1 FROM "SalesOrder" p WHERE p."id" = "OrderStatusHistory"."orderId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "SalesOrder" p WHERE p."id" = "OrderStatusHistory"."orderId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- PaymentFollowup → Payment
ALTER TABLE "PaymentFollowup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PaymentFollowup" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PaymentFollowup";
CREATE POLICY tenant_isolation ON "PaymentFollowup"
  USING (EXISTS (SELECT 1 FROM "Payment" p WHERE p."id" = "PaymentFollowup"."paymentId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)))
  WITH CHECK (EXISTS (SELECT 1 FROM "Payment" p WHERE p."id" = "PaymentFollowup"."paymentId"
                 AND p."tenantId" = current_setting('app.tenant_id', true)));

-- Global master tables (Permission, Industry) intentionally have NO RLS —
-- they are shared, tenant-agnostic reference data. API guards restrict writes.
