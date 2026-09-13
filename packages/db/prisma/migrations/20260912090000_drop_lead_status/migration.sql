-- Two columns for one idea, and one of them had no way in or out.
--
-- `Lead` carried both `tier` (CustomerCategory: Platinum, Gold, Silver, Brass)
-- and `leadStatus` (LeadStatus: Platinum, Gold, Silver, Bronze) — the same
-- grading of an account under two names, in two enums that differ only in their
-- fourth value. `tier` is the one the product uses: the create form offers it,
-- the list has a column for it, and Customer grades itself the same way with
-- the same enum. `leadStatus` travelled the whole stack — row, create, patch —
-- and no screen has ever read or written it.
--
-- Two spellings of one field is not a redundancy, it is a bug waiting: the
-- API's own test fixture already stored the tier value "Gold" in `leadStatus`,
-- which is exactly the confusion a duplicate invites. The column goes, and the
-- enum with it.
--
-- Nothing is lost. Every live row has `leadStatus` NULL; a grade that was set
-- would have to be re-read from `tier` anyway, which is where the product puts
-- it.

ALTER TABLE "Lead" DROP COLUMN "leadStatus";

DROP TYPE "LeadStatus";
