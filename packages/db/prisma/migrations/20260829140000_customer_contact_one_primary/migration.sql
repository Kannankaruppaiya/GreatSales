-- One primary contact per customer.
--
-- WHY
-- ----------------------------------------------------------------------------
-- The customer list row shows a single `primaryContactName`/`primaryContactPhone`,
-- resolved with `contacts: { where: { isPrimary: true }, take: 1 }`. With no
-- constraint, two contacts on the same customer could both carry isPrimary =
-- true, and which one the list showed would be arbitrary (whatever Postgres
-- returned first). The contacts sub-resource promotes a contact by demoting the
-- current primary first, so the app never writes a second primary — but that is
-- application logic, not a guarantee. This partial UNIQUE index makes a second
-- primary IMPOSSIBLE at the data layer, per customer.
--
-- Partial on WHERE "isPrimary": non-primary contacts are unconstrained (a
-- customer has many), and a customer with no contacts has no primary. Prisma
-- cannot express a filtered index, so it is defined here in raw SQL and
-- represented in schema.prisma only as a plain @@index, matching the RLS
-- policies and the Payment refNo backstop.
--
-- MIGRATION SAFETY (AGENTS.md §24): the build fails if a customer already has
-- two primary contacts. That is the exact inconsistency this prevents; the
-- failure surfaces it for an operator to resolve rather than masking it.
CREATE UNIQUE INDEX "CustomerContact_customerId_primary_key"
  ON "CustomerContact" ("customerId")
  WHERE "isPrimary";
