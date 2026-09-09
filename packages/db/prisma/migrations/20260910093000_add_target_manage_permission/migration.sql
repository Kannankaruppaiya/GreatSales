-- `target.manage` — the key that guards setting a monthly sales target.
--
-- The permission catalogue lives in packages/shared/src/rbac.ts and the seeds
-- read it from there, so a fresh database gets this key without any help. An
-- existing one does not: its Permission rows were written by whichever seed ran
-- at the time, and a role cannot be granted a permission that has no row. Every
-- attempt to set a target in an already-provisioned workspace would 403 while
-- the code insisted admin held the key — the same failure `period.manage` had.
--
-- Granted to admin (which holds everything) and to mgmt (which sets targets).
-- Deliberately NOT to sales: a salesperson must not be able to lower the number
-- they are measured against. Custom roles are left alone — a permission this
-- migration invents for a role someone designed themselves would be a surprise.

INSERT INTO "Permission" ("id", "key", "module")
VALUES ('perm_target_manage', 'target.manage', 'report')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p."key" = 'target.manage'
  AND r."isSystem" = true
  AND r."name" IN ('admin', 'mgmt')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
