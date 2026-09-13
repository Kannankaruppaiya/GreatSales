-- GST on a sales order, as an explicit mode rather than a number in a modal.
--
-- The schema had no tax column at all. The web console's create-order dialog
-- nonetheless showed "Order Total ₹11,800 (incl. 18% GST)" while posting only
-- the line items, so the server stored ₹10,000; the invoice preview then added
-- its own 18% back on top of that stored figure, and the mobile app showed the
-- raw ₹10,000. Three surfaces, three different values for one order.
--
-- The Promech export this workspace is seeded from carries `subtotal`, `tax`
-- and `grandTotal` per order, with `tax` equal to 18% of the net subtotal on
-- every one of the six — which is what establishes that a line price here is
-- GST-EXCLUSIVE and the tax is added on top. 18% is what that dataset happens
-- to use; it is not a rule, so the rate is a column and not a constant, and an
-- order can carry a reconciled GST figure or none at all instead.
--
-- Backfill: every existing order becomes taxMode = 'None' with subtotal equal
-- to its stored total and zero tax. That preserves each order's value to the
-- rupee — `total` already WAS the pre-tax line sum — and says the only honest
-- thing about a row raised before the column existed, which is that no GST was
-- ever recorded against it.

CREATE TYPE "TaxMode" AS ENUM ('None', 'Percentage', 'Amount');

ALTER TABLE "SalesOrder"
  ADD COLUMN "subtotal"  DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "taxMode"   "TaxMode"     NOT NULL DEFAULT 'None',
  ADD COLUMN "taxRate"   DECIMAL(5,2),
  ADD COLUMN "taxAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "SalesOrder" SET "subtotal" = "total";
