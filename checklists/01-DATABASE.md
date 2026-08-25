# A. Database — Production Checklist

> **PostgreSQL · Prisma · RLS · migrations · indexes**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 61

**Gate:** Foundation. Must be green before the backend layer can be trusted.

**Blocks:** everything. A tenancy defect here cannot be fixed in a higher layer.

## Status legend

| Symbol | Meaning |
| --- | --- |
| `[ ]` | **Not started** — no code, or nobody has looked. |
| `[~]` | **Code exists, UNVERIFIED.** An implementation is present but unproven against a production build. **This is not progress.** |
| `[x]` | **Verified in a production build**, with evidence recorded in the Evidence column. |
| `[-]` | **Deliberately out of scope for v1** — requires a written reason and a follow-up ticket. |

**Evidence rule.** A box may only be ticked when someone can point at proof a stranger
could re-run: a command plus its pasted output, a CI run URL, an `EXPLAIN (ANALYZE)` plan
with the measured number, a migration plus the rollback that was actually executed, or a
screenshot of the **production build**. "It looks right", "the code is there", and a unit
test with a mocked Prisma client are **not** evidence.

> ⚠️ Repo-root audit and readiness reports (`*-AUDIT-REPORT.md`, `*-READINESS*.md`,
> `FRONTEND-PRODUCTION-READINESS-QUESTIONNAIRE.md`) are historical and contain claims that
> do not match the code. **Never tick a box on their authority.** Re-verify against the code
> and a running production build, every time.

**Rules:** never delete a row (mark it `[-]` with a reason instead) · never tick in bulk ·
if a verified item regresses, set it back to `[ ]` and log it in
[O.3 Regression log](15-GO-LIVE.md) · update **Last reviewed** whenever you touch this file.

---

**Current shape (verified 2026-08-25):** 34 Prisma models, 6 migrations, 70 `@@index`
declarations, RLS applied via a dynamic loop in `20260815000000_rls_policies`, runtime role
`greatsales_app`, migration role `greatsales`.

> 🔴 **Standing hazard:** the database role used at runtime must NOT be able to bypass RLS.
> A superuser/owner role silently ignores every policy, and every tenant query then leaks.
> See §A.3.1 — this is the single highest-severity item in the entire tracker.

## A.1 Schema correctness

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.1.1 | Every model has an explicit primary key and a deterministic id strategy (cuid/uuid, never auto-increment for tenant-visible ids) | `[ ]` | |
| A.1.2 | Every tenant-owned table carries a non-nullable `tenantId` column | `[ ]` | |
| A.1.3 | `tenantId` is part of every unique constraint that must be unique *per tenant* (e.g. product SKU, user email, order number) — verified there is no cross-tenant collision and no accidental global uniqueness | `[ ]` | |
| A.1.4 | Every foreign key has an explicitly chosen `onDelete` / `onUpdate` behaviour (never left to default by accident) and the choice is documented | `[ ]` | |
| A.1.5 | No foreign key can point across tenants — enforced by constraint or by a documented, tested service-layer invariant | `[ ]` | |
| A.1.6 | All money columns use `Decimal` with an explicit precision/scale — never `Float`/`Double` | `[ ]` | |
| A.1.7 | All timestamps are `timestamptz` (UTC), never naive `timestamp`; timezone conversion happens at the presentation edge only | `[ ]` | |
| A.1.8 | Every table has `createdAt` and `updatedAt`; `updatedAt` is maintained on bulk writes too (Prisma `@updatedAt` is skipped on raw/`updateMany` paths — verified) | `[ ]` | |
| A.1.9 | Enums are database enums (not free-text strings) and every enum value used by the API exists in the DB enum | `[ ]` | |
| A.1.10 | Soft-delete strategy is consistent: which tables soft-delete, what the column is, and every query excludes deleted rows by default | `[ ]` | |
| A.1.11 | No orphan models — every one of the 34 models is either reachable from a shipped feature or explicitly marked "future" in this tracker | `[ ]` | |
| A.1.12 | Column-level `NOT NULL` matches the API's actual required/optional contract (no "optional in DB, required in UI" drift) | `[ ]` | |
| A.1.13 | Text columns that hold user input have a length bound (DB-level or validated) so a 10 MB paste cannot be stored | `[ ]` | |
| A.1.14 | `schema.prisma` is the single source of truth — no table exists in production that Prisma does not know about, and vice versa (`prisma migrate diff` clean) | `[ ]` | |

## A.2 Migrations

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.2.1 | `prisma migrate deploy` (never `migrate dev`) is the only command used against staging/production — `migrate dev` resets the database | `[ ]` | |
| A.2.2 | Migration history is linear and `migration_lock.toml` is committed and matches the production provider | `[ ]` | |
| A.2.3 | Every migration has been applied to a **restored copy of production-sized data** and the wall-clock duration recorded | `[ ]` | |
| A.2.4 | Every migration reviewed for **lock duration**: no `ALTER TABLE … SET NOT NULL`, type change, or unindexed FK add on a large table without the concurrent/backfill pattern | `[ ]` | |
| A.2.5 | Every index added on a large table uses `CREATE INDEX CONCURRENTLY` (and therefore lives in its own transaction-less migration) | `[ ]` | |
| A.2.6 | **Rollback path written and executed** for every migration — not just documented, actually run once | `[ ]` | |
| A.2.7 | Expand/contract discipline: no migration both removes a column and ships the code that stops using it in the same deploy | `[ ]` | |
| A.2.8 | Data backfills are idempotent, batched, resumable, and do not run inside the schema migration | `[ ]` | |
| A.2.9 | A migration failure mid-way leaves the DB in a known state, and the recovery procedure is written down and rehearsed | `[ ]` | |
| A.2.10 | Migrations run as the **owner** role (`greatsales`), the app runs as the **restricted** role (`greatsales_app`) — enforced by separate `DIRECT_URL` / `DATABASE_URL` and verified in the container | `[ ]` | |

## A.3 Row-Level Security (multi-tenancy)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.3.1 | 🔴 **The runtime DB role is NOT superuser and does NOT have `BYPASSRLS`.** Proven by `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='greatsales_app';` returning `f, f` **in the production database** | `[~]` | Asserted in THREE places now: `PrismaService.onModuleInit` refuses to boot on superuser or `rolbypassrls`; `tenant-isolation.spec.ts` asserts both are false against a real database; CI asserts it before any test runs. **Still `[~]` for one reason only: there is no production database yet.** Re-run `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='greatsales_app'` against production on day one. |
| A.3.2 | RLS is `ENABLE`d **and** `FORCE`d on every tenant-owned table (`FORCE` matters — the table owner ignores plain `ENABLE`) | `[x]` | VERIFIED 2026-08-25 by `tenant-isolation.spec.ts`: all 29 policied tables have `relrowsecurity` AND `relforcerowsecurity` true. FORCE is the half that matters — plain ENABLE is ignored for the table owner. |
| A.3.3 | A generated inventory proves **every** tenant-owned table has RLS on — no table added later silently missed the dynamic loop. Run `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class …` and diff against the model list | `[x]` | VERIFIED by a DYNAMIC inventory test, not a hardcoded list. It reads `pg_class` and fails for any `public` table that is not RLS-protected and not on an explicit `RLS_EXEMPT` map, where every exemption carries a written reason. A second test fails if any EXEMPT table ever grows a `tenantId` column. A new tenant-owned table therefore cannot ship unprotected. |
| A.3.4 | Every RLS policy covers all four commands (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) — a `SELECT`-only policy still allows cross-tenant writes | `[x]` | VERIFIED: all 29 policies are `FOR ALL`, so SELECT/INSERT/UPDATE/DELETE are covered by one rule — no command left open. |
| A.3.5 | `INSERT`/`UPDATE` policies use `WITH CHECK`, not only `USING` — otherwise a row can be written into another tenant | `[x]` | VERIFIED: a test fails on any `ALL`/`INSERT`/`UPDATE` policy with a NULL `with_check`. USING filters what you can SEE; without WITH CHECK a write can still place a row into another tenant. Currently zero such policies. |
| A.3.6 | The tenant context variable is set **inside the same transaction/connection** as every query, and cannot leak between pooled connections | `[ ]` | |
| A.3.7 | A pooled connection returned to the pool cannot carry a stale tenant setting into the next request (proven under concurrency, not by inspection) | `[ ]` | |
| A.3.8 | 🔴 **Defence in depth:** every service-layer query also carries an explicit `where: { tenantId }` filter. RLS is the net, not the plan. Grepped and proven for every repository method | `[x]` | DONE 2026-08-25. The raw-query surface was audited (only 6 call sites outside infrastructure) and a real **fail-OPEN** hazard was found and fixed in `user-invariants.ts`: `assertNotLastAdmin` relied solely on ambient `app.tenant_id`, and its `RawQueryable` parameter is STRUCTURAL — any object with `$queryRaw` satisfies it. Called without tenant context, RLS returns zero rows, `targetIsAdmin` comes back empty, and the guard concludes "never an administrator" and RETURNS, permitting the write it exists to refuse. `tenantId` is now a required parameter and bound into every predicate there and in `roles.service.ts`. Model-level queries all go through `forTenant()`, which sets the tenant per operation. NOTE: `RolePermission` carries no tenantId — it inherits tenancy from its parent Role, so those joins scope through `Role`. |
| A.3.9 | Raw SQL / `$queryRaw` / `$executeRaw` call sites inventoried — each one is parameterised and tenant-scoped | `[x]` | VERIFIED 2026-08-25. Six raw call sites outside infrastructure: 3 in `user-invariants.ts`, 1 in `roles.service.ts`, 1 `SELECT 1` readiness probe, and the tenant `set_config` in `prisma.service.ts`. **All parameterised** — no string interpolation of user input anywhere. The only interpolated identifier is a table name in the isolation spec, which comes from `pg_catalog` and is pattern-checked before use. |
| A.3.10 | Cross-tenant integration test exists: tenant A authenticated, attempts read **and** write of tenant B's row for **every** resource, gets denied | `[x]` | VERIFIED by `tenant-isolation.spec.ts` — 32 assertions against a real database. For 11 resources (customer, lead, salesOrder, payment, product, principal, projection, followUp, user, role, team) tenant A cannot READ tenant B's row (`findFirst` -> null) and **cannot WRITE it** (`updateMany`/`deleteMany` -> count 0) — the dangerous half a SELECT-only check misses. Also: a list query returns exactly one tenantId, and the unscoped client sees ZERO rows, proving policies fail CLOSED. Extended 2026-08-25 with a DYNAMIC sweep enumerated from `pg_class`: for EVERY RLS table with an id column, the id sets visible to A and to B must be disjoint — so sub-resources whose policies reach through a parent with EXISTS (SalesOrderItem, LeadProduct, CustomerContact, OrderStatusHistory, PaymentFollowup, RolePermission, Mapping, SalesTarget) are now covered, and a table added later is covered the day it appears. **Still NOT proven, and reported by the test rather than hidden:** Activity, Attachment, AuditLog, ImportJob, Notification, RefreshToken, Remark have no fixtures in either tenant, and an empty table is not evidence of isolation. |
| A.3.11 | The platform/super-admin layer (`PlatformUser`, `FeatureFlag`, `TenantFeatureFlag`) has its own explicit policy — it is not accidentally readable by tenant users | `[x]` | VERIFIED, and stronger than a policy: `PlatformUser` and `PlatformAuditLog` grant `greatsales_app` **nothing at all** — the role cannot reach them by any query. Asserted by the RLS_EXEMPT map, which records that reason. |
| A.3.12 | Seed scripts and the seed guard cannot run against production (guard verified by actually pointing it at a prod-shaped URL and watching it refuse) | `[x]` | VERIFIED: `reseedTestDatabase()` refuses unless BOTH URLs name a database ending in `_test`, and `seed-guard.ts` refuses unless NODE_ENV permits and the host is not a protected provider. A full test run was executed and the dev database (tenant_promech, 417 customers) was left untouched. |

## A.4 Indexing & query performance

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.4.1 | Every one of the 70 indexes is justified — either by an `EXPLAIN` plan that uses it, or it is dropped | `[ ]` | |
| A.4.2 | Every index on a tenant-owned table leads with `tenantId` (or is proven better without it) | `[ ]` | |
| A.4.3 | Every foreign key column is indexed (unindexed FKs make deletes and joins scan) | `[ ]` | |
| A.4.4 | Every list endpoint's default query has an `EXPLAIN (ANALYZE, BUFFERS)` plan captured at **100k+ rows per tenant**, with the time written down | `[ ]` | |
| A.4.5 | No sequential scan on any table above 10k rows in a request-path query | `[ ]` | |
| A.4.6 | No N+1: every list endpoint's SQL count is measured and constant with respect to page size | `[ ]` | |
| A.4.7 | Sort columns used by the UI are indexed, including the composite (`tenantId`, sortCol, id) needed for stable pagination | `[ ]` | |
| A.4.8 | Search/filter columns have appropriate indexes (`gin`/`pg_trgm` for text search, not `LIKE '%x%'` on a b-tree) | `[ ]` | |
| A.4.9 | Aggregate/dashboard queries are measured; anything over 200 ms has a documented plan (materialised view, cache, or precomputation) | `[ ]` | |
| A.4.10 | `pg_stat_statements` is enabled in production and the top-20 by total time has been reviewed at least once | `[ ]` | |

## A.5 Data integrity & business rules

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.5.1 | Every money/quantity invariant that must always hold is a DB `CHECK` constraint, not only application code | `[ ]` | |
| A.5.2 | Order totals, payment allocations, and projection sums are proven consistent under concurrent writes (not just single-threaded tests) | `[ ]` | |
| A.5.3 | Optimistic concurrency (version column or `updatedAt` precondition) on every entity two users can edit simultaneously | `[ ]` | |
| A.5.4 | Multi-step writes run inside a single transaction with an explicit isolation level chosen and justified | `[ ]` | |
| A.5.5 | `$transaction` timeout and max-wait are set explicitly (Prisma's defaults are short and fail silently under load) | `[ ]` | |
| A.5.6 | Deadlock-prone paths identified; lock ordering is consistent; retry-on-serialization-failure implemented where needed | `[ ]` | |
| A.5.7 | `updateMany`/`deleteMany` call sites reviewed — they return a **count**, not rows, and skip `@updatedAt` and middleware | `[ ]` | |
| A.5.8 | Uniqueness races (two users creating the same SKU/email at once) resolve to a clean 409, proven by a concurrent test | `[ ]` | |

## A.6 Connections, pooling & capacity

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| A.6.1 | Connection pool size chosen deliberately and documented (`connection_limit` in `DATABASE_URL`), and `pool × instances < max_connections` | `[ ]` | |
| A.6.2 | Behaviour under pool exhaustion is defined: fail fast with 503, not hang forever | `[ ]` | |
| A.6.3 | `statement_timeout` and `idle_in_transaction_session_timeout` set at the role level so one bad query cannot pin a connection | `[ ]` | |
| A.6.4 | Prisma client is a singleton per process; no client is created per request | `[ ]` | |
| A.6.5 | Graceful shutdown disconnects the client and drains in-flight queries | `[ ]` | |
| A.6.6 | Database sizing (CPU/RAM/IOPS/storage) chosen with a written growth projection to 10M+ rows | `[ ]` | |
| A.6.7 | Autovacuum settings reviewed for the highest-churn tables | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
