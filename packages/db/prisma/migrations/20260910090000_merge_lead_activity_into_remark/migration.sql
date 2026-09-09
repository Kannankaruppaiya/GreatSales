-- Fold LeadActivity into Remark, then remove it.
--
-- The two tables held the same thing: a dated note against one entity.
-- `Remark` is the one the product reads — RemarksService serves the timeline on
-- all five entity types, and `Remark.userId` is already nullable "for
-- system-generated notes", which is precisely what a LeadActivity row was.
-- `LeadActivity` had no reader at all, so every lead note the Promech seed
-- wrote (its POC remarks and its stage-change history) was invisible in the
-- application. Two tables for one concept is the defect; this keeps the rows
-- and retires the table.
--
-- LeadActivity carried no tenantId of its own — RLS reached it through Lead —
-- so the tenant comes from the parent lead on the way across.

INSERT INTO "Remark" ("id", "tenantId", "entityType", "entityId", "userId", "text", "at")
SELECT
  la."id",
  l."tenantId",
  'Lead'::"EntityType",
  la."leadId",
  NULL,
  la."note",
  la."date"
FROM "LeadActivity" la
JOIN "Lead" l ON l."id" = la."leadId"
ON CONFLICT ("id") DO NOTHING;

DROP TABLE "LeadActivity";
