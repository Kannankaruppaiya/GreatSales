-- Point a notification at the thing it is about.
--
-- The table shipped with a title, a body and a read flag and no way to say what
-- had happened to WHAT. A notification you cannot click is a label: "Order
-- SO-114 is out for delivery" with nowhere to go makes the reader search for it
-- by hand, which is most of the work the notification was supposed to save. The
-- console's existing derived alerts already navigate; these have to as well.
--
-- Nullable because a System notice is about the workspace rather than any one
-- row. Every other type sets both.
--
-- No backfill: the table has never held a row. Nothing in the application wrote
-- to it before this change.

ALTER TABLE "Notification"
  ADD COLUMN "entityType" "EntityType",
  ADD COLUMN "entityId" TEXT;

-- The bell's own query — this user's inbox, newest first. Without it the read
-- path orders a tenant-wide index scan to show twenty rows.
CREATE INDEX "Notification_userId_at_idx" ON "Notification"("userId", "at");
