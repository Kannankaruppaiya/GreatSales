-- Take WRITE access to the shared, non-tenant-scoped tables away from the
-- runtime role.
--
-- WHY
-- ----------------------------------------------------------------------------
-- Row-Level Security scopes a table BY TENANT. It cannot protect a table that
-- has no tenant: `Industry` and `Permission` are global catalogues every tenant
-- reads, and `Tenant` is the tenancy registry itself. All three had full
-- INSERT/UPDATE/DELETE granted to `greatsales_app`, and RLS either does not
-- apply to them or (for `Tenant`) permits a tenant to write its OWN row.
--
-- Proven against the running database before this migration:
--
--     psql -U greatsales_app -c 'INSERT INTO "Permission" ...'
--     INSERT 0 1
--
-- That is one tenant's connection editing the RBAC catalogue every other
-- tenant's authorization is computed from. For `Tenant` the equivalent is a
-- tenant flipping its own `status` from Suspended back to Active.
--
-- No endpoint does any of this today — the API only ever writes
-- `RolePermission`, which is tenant-scoped and does have RLS. The grant is the
-- vulnerability, not the code: it is what turns a future bug or an injected
-- statement into cross-tenant privilege escalation. Least privilege means the
-- capability should not exist at all.
--
-- SELECT is deliberately kept: the app must read the catalogues to resolve
-- permissions and to render industry pickers, and must read its own Tenant row.
-- This matches how `FeatureFlag` was already treated (SELECT only).
--
-- Seeds and migrations are unaffected — they connect as the OWNER
-- (`greatsales`), not as `greatsales_app`.

REVOKE INSERT, UPDATE, DELETE ON "Industry"   FROM greatsales_app;
REVOKE INSERT, UPDATE, DELETE ON "Permission" FROM greatsales_app;
REVOKE INSERT, UPDATE, DELETE ON "Tenant"     FROM greatsales_app;

-- ALTER DEFAULT PRIVILEGES (set in 20260815000000_rls_policies) grants full DML
-- on every FUTURE table to greatsales_app. That default is right for
-- tenant-owned tables and wrong for global ones, so any new global table must
-- repeat the revoke above. checklists/01-DATABASE.md A.3.11 tracks this, and
-- the tenant-isolation spec fails if a global table is writable by the app role.
