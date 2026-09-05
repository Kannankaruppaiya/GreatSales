-- Row-Level Security for PeriodLock (new) and Remark (pre-existing).
--
-- WHY THIS IS PART OF THE SAME CHANGE
-- ----------------------------------------------------------------------------
-- ALTER DEFAULT PRIVILEGES (20260815000000_rls_policies) grants the runtime
-- role full DML on every FUTURE table. A new tenant-owned table is therefore
-- WRITABLE by every tenant the moment it is created, and is protected only once
-- a policy exists. So the policy ships with the table, not after it.
--
-- Remark is not new: it shipped in the schema with relations from Projection,
-- Lead, Payment, SalesOrder and Customer, but was left out of the table array
-- in 20260815000000_rls_policies. Nothing ever read or wrote it, so no data
-- crossed a tenant boundary — but the grant was always there, and the remarks
-- endpoints added alongside this migration are what would have turned that
-- grant into a live cross-tenant read/write. Fixed here rather than separately,
-- because shipping the endpoint first is what makes it exploitable.
--
-- Both tables carry a direct tenantId, so they take the same policy shape as
-- the tables in section 3 of the original migration: fail closed when
-- app.tenant_id is unset, and FORCE so the table owner cannot bypass it either.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['PeriodLock', 'Remark'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING ("tenantId" = current_setting(''app.tenant_id'', true)) '
      'WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))', t);
  END LOOP;
END $$;
