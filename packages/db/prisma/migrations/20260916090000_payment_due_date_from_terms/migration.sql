-- Clear the due dates the Tally import invented, so they derive from the
-- customer's real credit terms.
--
-- The import added a flat 30 days to every invoice date and stored the result
-- in `Payment.dueDate`, for every customer in the ledger. Nobody chose that
-- number for any of those invoices: it was not in the spreadsheet, which has
-- no due-date column, and it ignored `Customer.paymentTerms`, which the same
-- import already parses ("Credit 45") when it loads the customer. So a
-- cash-on-delivery customer was handed a month they never had, and a Credit45
-- customer was called overdue a fortnight early.
--
-- The import no longer does this, and the API derives a missing due date from
-- the customer's terms on read. But rows already in the table still carry the
-- invented value, and a stored due date deliberately WINS over the derivation
-- — somebody may have typed it into Add Payment, and a one-off arrangement is
-- a fact about that invoice, not something a rule gets to overwrite. The
-- invented ones are indistinguishable from typed ones except by their
-- fingerprint, which is what this matches.
--
-- Why this is safe to run:
--
--   * It touches only rows where `dueDate` is EXACTLY `invoiceDate + 30 days`.
--     A due date somebody typed is almost never exactly that, and where it is,
--     the customer is on Credit30 and the derivation reproduces the identical
--     date — so the value is either corrected or unchanged, never lost.
--   * It is recomputable. Every row it nulls gets its due date back on the
--     next read, from terms; nothing is destroyed.
--   * `dueDate` is nullable already, and the read path has always handled null.
--
-- Not touched: `Payment.agingDays`, a snapshot the API recomputes on every
-- read and never reads back, so what is in that column never reaches a screen.
--
-- `Payment.status` is a different matter and deliberately left alone. It is
-- recomputed on read like aging, but UNLIKE aging it is also filtered on in
-- the database (`GET /payments?status=`), so the stored value and the
-- displayed one can already disagree as the clock passes a due date with
-- nobody editing the row. That is a standing bug, older and wider than this
-- change, and rewriting the column here would paper over one day of it while
-- leaving the mechanism in place.
UPDATE "Payment"
SET "dueDate" = NULL
WHERE "invoiceDate" IS NOT NULL
  AND "dueDate" IS NOT NULL
  AND "dueDate" = "invoiceDate" + INTERVAL '30 days';
