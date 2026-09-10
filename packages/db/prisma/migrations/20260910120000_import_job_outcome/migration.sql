-- What an import actually did, not just how big it was.
--
-- `ImportJob` recorded `total` and `errors` and nothing else, which cannot
-- answer the question a person asks after running one: how many are new, how
-- many did it change, how many did it leave alone. "417 rows, 3 errors" is
-- consistent with 414 accounts created and with 414 accounts silently
-- overwritten, and those are very different afternoons.
--
-- Derivable from `errors` only in part — total minus errors gives the rows that
-- succeeded, and says nothing about which of them were new. So the three
-- outcomes are stored.
--
-- Also `createdById`: an import is the single largest write anyone makes in
-- this product, and the row should say whose it was.

ALTER TABLE "ImportJob"
  ADD COLUMN "created" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updated" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skipped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "createdById" TEXT;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ImportJob_tenantId_createdAt_idx" ON "ImportJob"("tenantId", "createdAt");
