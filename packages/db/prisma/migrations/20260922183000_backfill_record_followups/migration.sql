-- Backfill the mirrored follow-up tasks.
--
-- `Projection.nextFollowUp` and `Lead.nextFollowUp` are date columns on their
-- own rows, written by the projections worksheet's "Log follow-up" button and
-- the lead editor's "Next follow-up" field. The Follow-ups page, the dashboard
-- tile and the mobile screen all list `FollowUp` rows instead, so every date
-- already set on a record was invisible to all three.
--
-- The API now writes both on every edit (apps/api/src/followups/record-followup.ts).
-- This gives the dates that were set BEFORE that change the same treatment, so
-- the lists do not start out missing work that is already scheduled.
--
-- Derived ids, matching the application's `recordFollowUpId`, so re-saving a
-- record updates its task instead of adding a second one. ON CONFLICT DO
-- NOTHING makes the whole thing safe to re-run.

INSERT INTO "FollowUp" (
  id, "tenantId", "entityType", "entityId", "salespersonId",
  title, subtitle, amount, "dueDate", done, note, "createdAt", "updatedAt"
)
SELECT
  'fu_proj_' || p.id,
  p."tenantId",
  'Projection'::"EntityType",
  p.id,
  m."salespersonId",
  'Follow up — ' || c.name,
  pr.name || ' · ' || pri.name || ' · ' || p.period,
  p."committedQty" * COALESCE(p.price, m."customPrice", pr."basePrice", 0),
  p."nextFollowUp",
  false,
  NULL,
  now(),
  now()
FROM "Projection" p
JOIN "Mapping" m ON m.id = p."mappingId"
JOIN "Customer" c ON c.id = m."customerId"
JOIN "Product" pr ON pr.id = m."productId"
JOIN "Principal" pri ON pri.id = pr."principalId"
WHERE p."nextFollowUp" IS NOT NULL
  AND p."deletedAt" IS NULL
ON CONFLICT (id) DO NOTHING;

INSERT INTO "FollowUp" (
  id, "tenantId", "entityType", "entityId", "salespersonId",
  title, subtitle, amount, "dueDate", done, note, "createdAt", "updatedAt"
)
SELECT
  'fu_lead_' || l.id,
  l."tenantId",
  'Lead'::"EntityType",
  l.id,
  l."salespersonId",
  'Follow up — ' || l."customerName",
  -- The stage is a PascalCase enum; split it into words the way the API's
  -- `leadSubtitle` does, and drop the separator when there is no area.
  concat_ws(
    ' · ',
    regexp_replace(l.stage::text, '([a-z])([A-Z])', '\1 \2', 'g'),
    NULLIF(l.area, '')
  ),
  NULL,
  l."nextFollowUp",
  false,
  NULL,
  now(),
  now()
FROM "Lead" l
WHERE l."nextFollowUp" IS NOT NULL
  AND l."deletedAt" IS NULL
ON CONFLICT (id) DO NOTHING;
