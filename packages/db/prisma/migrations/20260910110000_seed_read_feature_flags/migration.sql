-- The feature flags the application actually reads.
--
-- Until now nothing read this table, so its rows described intentions:
-- "new-dashboard" gated a page that was never built. The application now
-- resolves flags for real, and it resolves a MISSING key to off — which is the
-- only safe default, but it means an existing workspace would lose customer
-- location pinning the moment this ships, because no row says it has it.
--
-- So the rows are created here rather than only in the seeds. Seeds build a
-- fresh database; a provisioned one is never re-seeded.
--
-- "new-dashboard" is left alone rather than deleted: an operator may have set
-- tenant overrides against it, and dropping a row somebody configured is not
-- this migration's business. It simply stops being consulted.

INSERT INTO "FeatureFlag" ("id", "key", "description", "enabledGlobal", "rolloutPercent", "createdAt", "updatedAt")
VALUES
  ('ff_customer_location', 'customer-location',
   'Pin and share a customer''s GPS location', true, 0, now(), now()),
  ('ff_bulk_import', 'bulk-import',
   'Load customers from a spreadsheet', true, 0, now(), now())
ON CONFLICT ("key") DO NOTHING;
