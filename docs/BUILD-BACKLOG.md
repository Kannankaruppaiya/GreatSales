# GreatSales — Module Build Backlog

> **Governing contract:** [`AGENTS.md`](../AGENTS.md). Every module below is built to the
> PRODUCTION-FIRST ENGINEERING DIRECTIVE. Nothing here ships as a demo, prototype, or mock.
>
> **Source of truth for behaviour:** `C:/Users/Kannan/Downloads/GreatSales_Tracker_POC_v6.html`
> (417 customers · 234 products · 883 mappings · 94 projections · 141 payments · 8 users ·
> 6 salespersons · 11 industrial areas).
>
> **Warning:** the repo-root audit reports (`POC_V6_ORIGINAL_DATA_AND_AUDIT_REPORT.md`,
> `PAGE-ANALYSIS-AUDIT-REPORT.md`, `STAGING-READINESS-REPORT.md`) claim parity that does not
> exist. Treat them as leads to verify, never as evidence. Verify against code.

---

## Where the codebase actually stands (verified 2026-08-23)

**API modules that exist** (`apps/api/src`): `auth`, `customers`, `followups`, `leads`, `orders`,
`payments`, `products` (+`principals`), `projections`, `users`, `common`, `prisma`, `config`.

**Endpoints that exist today — the complete list:**

| Controller | Endpoints |
| --- | --- |
| `app` | `GET /health` |
| `auth` | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| `customers` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `followups` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `leads` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `orders` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `payments` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `principals` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `products` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |
| `projections` | `GET`, `PATCH /:id` |
| `users` | `GET`, `POST`, `PATCH /:id`, `DELETE /:id` |

**Prisma models with NO API surface at all** — these are the real build gaps:
`Mapping`, `Industry`, `Team`, `SalesTarget`, `Remark`, `Activity`, `LeadActivity`, `LeadProduct`,
`CustomerContact`, `PaymentFollowup`, `OrderStatusHistory`, `Notification`, `Attachment`,
`AuditLog`, `ImportJob`, `PlatformUser`, `PlatformAuditLog`, `FeatureFlag`, `TenantFeatureFlag`,
`Tenant` (no management endpoint).

**Web still on mock stores** (`useTrackerStore` / `useManagementStore` / `useMockOwnerId`):
`components/modals/AddMappingModal.tsx`, `features/management/*` (7 files),
`features/users/UsersPage.tsx`, `hooks.ts`, `store/trackerStore.ts`.

**Test surface:** 15 API integration spec files (real Postgres, RLS-bound `greatsales_app` role),
37 web test files (Vitest + Testing Library).

**Roles:** `super_admin` (web vocabulary only), `admin`, `mgmt`, `sales`.
**Permissions:** 13 keys in `packages/shared/src/rbac.ts` — `<module>.<action>`.

---

## Standard prompt envelope

Every module prompt below is written to be pasted as-is. Each one already implies this envelope —
it is stated once here rather than repeated 16 times:

```
Read AGENTS.md first and hold it for the whole task.

Workflow (non-negotiable):
1. superpowers:brainstorming — resolve every open question with me BEFORE design.
2. Write the design spec to docs/superpowers/specs/<date>-<module>-design.md.
3. superpowers:writing-plans — write the task-by-task plan to
   docs/superpowers/plans/<date>-<module>.md.
4. superpowers:test-driven-development — test first, always. API tests are INTEGRATION
   tests against real Postgres via the RLS-bound greatsales_app role. Never mock Prisma.
5. superpowers:verification-before-completion — run `pnpm --filter api test`,
   `pnpm --filter web test`, `pnpm check-types`, `pnpm lint` and paste real output.

Hard rules for this repo:
- Authorization is enforced SERVER-SIDE. A web guard is UX, never security.
- Every tenant query carries an explicit tenantId filter — RLS is defence in depth, not
  the only defence.
- Sales role scope is derived from the caller's identity, never from request input.
- No new design tokens, no edits to apps/web/src/index.css, no font changes. Reuse
  @/components/ui.
- Any Prisma schema change ships with a migration + an index justified by a real query.
- Pagination is mandatory on every list endpoint. 417 customers today, 100k tomorrow.
- If you find the requirement insecure, non-scalable, or data-lossy — STOP and tell me
  (AGENTS.md §32).
- Do not claim done with any mock, TODO, or silent catch left in a production path
  (AGENTS.md §31).
```

---

# PHASE 0 — Foundation (nothing else is safe until these land)

## M0 — Seed strategy & test fixtures

**Why first:** there is uncommitted work in `packages/db/prisma/seed.ts` that replaces the
two-tenant fixture (`tenant_acme` / `tenant_globex`) with a single POC tenant
(`tenant_greatsales`). All 15 API spec files call `db:seed` in `beforeAll` and look up
`user_sales1_acme` / `role_admin_acme`. Committing as-is breaks the entire API test suite and
destroys the only cross-tenant RLS isolation proof.

**Depends on:** nothing. **Blocks:** every module.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M0-1 | As an engineer, I want the test seed and the real-data seed to be separate commands, so that running tests never destroys my working dataset and vice versa. | `pnpm --filter @greatsales/db db:seed` produces the deterministic 2-tenant fixture. A second command produces the POC dataset. Neither silently runs the other. |
| M0-2 | As a security reviewer, I want cross-tenant isolation proven by an automated test, so that a RLS regression cannot reach production. | A spec seeds ≥2 tenants and asserts tenant A's session reads zero of tenant B's rows across all 6 scoped services. Test fails loudly if RLS is dropped. |
| M0-3 | As an engineer, I want the real POC dataset loadable into any environment, so that performance and correctness are measured against real volumes, not toy data. | POC seed loads 417/234/883/94/141 records and prints verified counts. Re-running is idempotent. Load time recorded. |
| M0-4 | As an operator, I want seeds to be impossible to run against production, so that a mistyped command cannot truncate live data. | Seed refuses to run unless an explicit environment guard is satisfied. `TRUNCATE` path is unreachable in production config. Documented in DEPLOYMENT.md. |
| M0-5 | As a developer, I want dev login prefill to come from env, not hardcoded credentials, so that no credential ships in the production bundle. | Prefill values read from `VITE_DEMO_*`; when `PROD`, prefill renders empty. Test asserts the production build contains no seeded password string. |

### Prompt

```
Read AGENTS.md, then resolve the seed conflict in this repo.

Current state: packages/db/prisma/seed.ts is uncommitted and rewritten to seed ONLY
tenant_greatsales from packages/db/prisma/poc-v6-data.json (417 customers, 234 products,
883 mappings, 94 projections, 141 payments, 8 users). The previous seed created
tenant_acme + tenant_globex. All 15 API spec files under apps/api/src reseed via
`pnpm --filter @greatsales/db db:seed` in beforeAll and reference user_sales1_acme,
user_sales2_acme, user_admin_acme, role_sales_acme, tenant_globex. 103 references total.

Deliver:
1. A seed architecture where the deterministic test fixture and the real POC dataset are
   separate, explicitly-invoked commands, with shared helpers and zero duplicated
   business logic (AGENTS.md §17).
2. A production guard that makes TRUNCATE unreachable outside dev/test (AGENTS.md §8).
3. A cross-tenant RLS isolation spec covering all six scoped services.
4. Env-driven login prefill that renders empty in production builds; a test proving the
   production bundle carries no seeded credential (AGENTS.md §7, §19).
5. Measured load time and row counts for the POC seed (AGENTS.md §3).

Do not rewrite the 15 spec files unless brainstorming concludes that is genuinely the
better design — argue it with evidence either way. Commit only when both
`pnpm --filter api test` and `pnpm --filter web test` are green, with output pasted.
```

---

## M1 — Security & observability baseline

**Why here:** AGENTS.md §7 and §13 are not features, they are preconditions. Every module built
before this inherits the gaps.

**Depends on:** M0. **Blocks:** anything exposed to a network.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M1-1 | As an operator, I want the API to reject requests from unapproved origins, so that a hostile page cannot drive a logged-in user's session. | CORS allow-list is env-driven per environment. Wildcard origin is impossible in staging/production. Test asserts rejection. |
| M1-2 | As a security reviewer, I want auth endpoints rate-limited, so that credential stuffing is not free. | Login and refresh are throttled per IP and per account. Lockout/backoff behaviour is defined and tested. 429 returns a documented error contract. |
| M1-3 | As an engineer debugging an incident, I want every request traceable end to end, so that I can reconstruct what happened. | Every request carries a request id; it appears in structured logs and in the error response. Logs are JSON. No PII or secrets in log output. |
| M1-4 | As a security reviewer, I want stack traces never returned to clients, so that internals are not leaked. | Non-dev environments return the documented error contract only. A test asserts no stack frame reaches the response body. |
| M1-5 | As an operator, I want a real health check, so that orchestration can tell "process alive" from "service healthy". | Liveness and readiness are distinct. Readiness verifies DB reachability with a bounded timeout. Documented in DEPLOYMENT.md. |
| M1-6 | As a security reviewer, I want every request body validated at the boundary, so that malformed or over-large input never reaches business logic. | Global validation pipe with whitelist + forbid-unknown. Body size limit enforced. Test covers oversized and unknown-property payloads. |

### Prompt

```
Read AGENTS.md, then implement the security and observability baseline for apps/api.

Scope: CORS allow-list (env-driven), rate limiting on auth endpoints (per-IP and
per-account), structured JSON logging with request/correlation ids, an error contract that
never leaks stack traces outside dev, split liveness/readiness health checks with a bounded
DB probe, and a global validation pipe with whitelist + forbidUnknownValues + a body size
limit.

Constraints:
- Do not log PII, tokens, or password fields — assert this with a test.
- The error contract is a public API contract: version it, document it, and make every
  existing controller conform (AGENTS.md §10, §23).
- Rate limiting must survive multiple API instances — if the chosen store is in-memory,
  say so explicitly and document the horizontal-scaling consequence (AGENTS.md §5).
- Prove each control with a test, not with a description.
```

---

# PHASE 1 — Identity, tenancy, access

## M2 — Identity & access management

**Status today:** `auth` (login/refresh/me) and `users` CRUD exist. `Team`, `Role` management,
password lifecycle, and session revocation have no endpoints. `UsersPage.tsx` reads
`useMockOwnerId` instead of the real session.

**Depends on:** M1.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M2-1 | As an admin, I want to create, deactivate, and reassign users, so that staff changes never require a database edit. | Deactivation revokes active sessions immediately. A deactivated user's owned records remain intact and reassignable. Cannot delete the last admin. |
| M2-2 | As an admin, I want to define roles and grant permissions, so that access matches how the business actually works. | Role CRUD + permission grant/revoke, server-enforced. A role cannot grant a permission the granting admin lacks. Every change is audited (who/what/when/before/after). |
| M2-3 | As a user, I want to change my password and have all other sessions ended, so that a leaked password can be contained. | Password change requires current password, enforces a strength policy, re-hashes with argon2id, and revokes all other refresh tokens. |
| M2-4 | As an admin, I want to organise salespeople into teams with a manager, so that management can see team-level rollups. | Team CRUD; a user belongs to at most one team; a manager sees their team's records; the circular `User`↔`Team` FK is handled safely in migration and seed. |
| M2-5 | As a security reviewer, I want refresh tokens revocable and rotating, so that a stolen token has a short useful life. | Refresh rotates on use; reuse of a consumed token revokes the whole family and is logged as a security event. |
| M2-6 | As an admin, I want the Users page to reflect the real session, so that what I see is what the server will allow. | `useMockOwnerId` is deleted from the production path. `UsersPage` reads `useAuthUser()`. Permission-denied states render as real UI, not blank. |

### Prompt

```
Read AGENTS.md, then build Identity & Access Management to production standard.

Existing: apps/api/src/auth (login/refresh/me) and apps/api/src/users (CRUD).
Missing entirely: role management endpoints, permission grant/revoke, Team CRUD, password
change, session revocation, refresh-token rotation.
Web debt: apps/web/src/features/users/UsersPage.tsx imports useMockOwnerId from
@/lib/mockOwner instead of the real session.

Build:
- Role + permission administration, server-enforced, with privilege-escalation prevention
  (an admin cannot grant what they do not hold).
- Team CRUD, handling the circular User<->Team FK safely in both migration and seed.
- Password change with argon2id re-hash, strength policy, and revocation of other sessions.
- Refresh-token rotation with reuse detection that revokes the token family and emits a
  security audit event (AGENTS.md §7, §25).
- Immediate session revocation on user deactivation.
- Full audit trail: actor, action, target, before value, after value, timestamp, source.
- Delete useMockOwnerId from the production path and wire UsersPage to useAuthUser().

Every authorization rule needs an integration test proving the DENY path, not only the
allow path. Include tests for: sales cannot reach user.manage; a deactivated user's token
is rejected; the last admin cannot be removed.
```

---

## M3 — Tenancy & platform operations

**Status today:** `Tenant`, `PlatformUser`, `PlatformAuditLog`, `FeatureFlag`,
`TenantFeatureFlag` models exist. Zero endpoints. Web has `/super-admin` routes and a
`ManagementSwitcher` that mutates local Zustand state while the JWT stays bound to one tenant —
the switcher currently lies to the user.

**Depends on:** M2.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M3-1 | As a platform operator, I want to provision a tenant with its admin and default roles in one transaction, so that onboarding cannot leave a half-created tenant. | Provisioning is atomic; failure leaves no partial rows. Default roles and permission grants derive from `ROLE_PERMISSIONS`, never hand-written. |
| M3-2 | As a platform operator, I want to suspend or churn a tenant, so that non-payment or abuse can be stopped without deleting data. | Suspended tenant's users cannot authenticate; data is retained; status transitions are audited and reversible. |
| M3-3 | As a platform operator, I want feature flags per tenant, so that a capability can be rolled out gradually and killed instantly. | Flag evaluation is server-side and cached with a bounded TTL; a kill switch takes effect without redeploy; flag reads are cheap at 1000+ tenants. |
| M3-4 | As a user with access to several managements, I want switching to change what the server returns, so that the switcher is not a lie. | Switching re-issues a session bound to the target tenant, or the UI is removed. No client-only tenant state remains in a production path. |
| M3-5 | As a security reviewer, I want platform-operator actions separated from tenant-admin actions, so that operator access is auditable and least-privilege. | `PlatformRole` is enforced server-side; every operator action writes to `PlatformAuditLog`; operators cannot read tenant business data without an explicit, logged reason. |

### Prompt

```
Read AGENTS.md, then build the tenancy and platform-operations layer.

Models exist with zero endpoints: Tenant, PlatformUser, PlatformAuditLog, FeatureFlag,
TenantFeatureFlag. The web app has /super-admin routes and a ManagementSwitcher
(apps/web/src/features/management/*) backed entirely by a mock Zustand store — it changes
local UI state while the JWT stays bound to a single tenant. That is a correctness and
security defect, not cosmetic.

Build:
- Atomic tenant provisioning (tenant + admin user + system roles + permission grants) in
  one transaction, with default grants derived from ROLE_PERMISSIONS (AGENTS.md §8).
- Tenant lifecycle: Trial -> Active -> Suspended -> Churned, with suspension blocking
  authentication while retaining data, fully audited and reversible.
- Per-tenant feature flags with server-side evaluation, bounded-TTL caching, and an
  instant kill switch. State the cost of flag evaluation at 1,000 and 100,000 tenants
  (AGENTS.md §5, §21).
- PlatformRole enforcement, distinct from tenant RBAC, with every operator action written
  to PlatformAuditLog (AGENTS.md §25, §26).
- Resolve the management switcher honestly: either issue a real tenant-scoped session on
  switch, or remove the control. Do not ship a switcher that misleads.

Decide and document how operator access to tenant business data is justified and logged
before writing code.
```

---

# PHASE 2 — Master data

## M4 — Customers, contacts & industries

**Status today:** `customers` CRUD exists with sales-ownership scoping. `CustomerContact` and
`Industry` have models and no endpoints. POC carries 417 customers, 11 industrial areas, and an
industry taxonomy.

**Depends on:** M2.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M4-1 | As a salesperson, I want to see only my own customers, and as an admin all of them, so that scope matches responsibility. | Scope derives from caller identity; an explicit `ownerId` cannot widen a salesperson's view (already tested — keep it green). |
| M4-2 | As an admin, I want to search and filter 417+ customers without the page stalling, so that the list stays usable as we grow. | Server-side pagination, search, and filtering (category, division, type, zone, salesperson, area). Measured p95 at 10k and 100k rows. Indexes justified by the actual query plan. |
| M4-3 | As a salesperson, I want multiple contacts per customer with one marked primary, so that I call the right person. | Contact CRUD scoped to the customer; exactly one primary enforced at the DB level, not in application code alone. |
| M4-4 | As an admin, I want customers classified by industry and area, so that reporting reflects the POC taxonomy. | Industry taxonomy and area list are server-owned reference data, not client constants. Adding a value needs no redeploy. |
| M4-5 | As an admin, I want customer reassignment between salespeople, so that territory changes do not orphan accounts. | Reassignment moves the account and records the change; related projections/leads/orders/payments follow a documented, tested rule. |
| M4-6 | As an admin, I want deletion to be safe, so that removing a customer never silently destroys history. | Referenced customers cannot be hard-deleted; soft-delete or block with a clear error. Behaviour identical at API and UI. |

### Prompt

```
Read AGENTS.md, then bring the Customer domain to production standard.

Existing: apps/api/src/customers CRUD with sales-ownership scoping (keep every existing
test green, especially the ownerId-cannot-widen-scope proof in
apps/api/src/common/sales-scope.spec.ts).
Missing: CustomerContact endpoints, Industry endpoints, area reference data, reassignment,
safe-delete semantics, server-side search/filter/pagination.

Build:
- Server-side pagination, search, and filtering (category, division, type, payZone,
  salesperson, industry, area). Prove p95 latency at 10k and 100k rows and justify every
  index with an EXPLAIN plan (AGENTS.md §3, §4, §9).
- CustomerContact CRUD with exactly-one-primary enforced by a DB constraint, not only
  application code (AGENTS.md §8).
- Industry taxonomy and industrial areas as server-owned reference data seeded from the
  POC dataset — remove any client-side hardcoded copy.
- Customer reassignment between salespeople, with an explicit, tested rule for what
  happens to related projections, leads, orders, and payments (AGENTS.md §30).
- Safe deletion: referenced customers cannot be hard-deleted. Same behaviour at API and UI.

The 417 POC customers are the correctness fixture; 100k synthetic rows are the performance
fixture. Report both.
```

---

## M5 — Product catalog

**Status today:** `products` and `principals` CRUD exist. `AddProductModal` generates SKUs with
`Math.random()`; `AddPrincipalModal` is wired to the mock store. POC carries 234 products across
principal brands with division codes and default prices.

**Depends on:** M2.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M5-1 | As an admin, I want SKUs to be unique and meaningful, so that catalog data stays trustworthy. | SKU is user-supplied or server-generated deterministically; uniqueness enforced by a DB constraint; `Math.random()` removed from the production path. |
| M5-2 | As an admin, I want to manage principal brands against the real API, so that a new brand is actually persisted. | `AddPrincipalModal` posts to `/principals`; the mock store import is deleted; optimistic UI reconciles with the server response. |
| M5-3 | As a salesperson, I want to browse the catalog but not change it, so that pricing integrity is protected. | Sales holds read-only catalog access, enforced server-side and proven by a deny-path test. |
| M5-4 | As an admin, I want price changes to be historical, so that past projections and orders keep the price they were made at. | Price changes never mutate historical projection/order lines. A test proves an old order's value is unchanged after a catalog price edit. |
| M5-5 | As an admin, I want products scoped by division (LUB/WES), so that filters reflect the business lines. | Division filtering is server-side; a product without a division is handled explicitly, not silently dropped. |

### Prompt

```
Read AGENTS.md, then bring the Product Catalog to production standard.

Existing: apps/api/src/products (CRUD) and products/principals.controller.ts (CRUD).
Defects: apps/web/src/features/products/AddProductModal.tsx generates SKUs with
Math.random(); AddPrincipalModal.tsx is wired to the mock useTrackerStore and never reaches
the API.

Build:
- Deterministic, unique SKUs with a DB uniqueness constraint. Delete Math.random() from the
  production path (AGENTS.md §31).
- Wire AddPrincipalModal to POST /principals and delete the mock store import.
- Server-side read-only catalog access for the sales role, proven by a deny-path
  integration test.
- Price history: prove with a test that editing a product price does not retroactively
  change any existing projection or sales-order line value (AGENTS.md §8).
- Server-side division (LUB/WES) filtering, with explicit handling of null-division rows.

Seed fixture is the 234 POC products. State how catalog reads perform at 234 vs 50,000 SKUs
and what caching, if any, is justified (AGENTS.md §4, §21).
```

---

## M6 — Customer ↔ product mappings

**Status today:** `Mapping` model exists. **No controller, no service, no endpoint.**
`AddMappingModal.tsx` writes to the mock `useTrackerStore` — "map product to customer" is
non-functional against the database today. POC has 883 mappings.

**Depends on:** M4, M5. **Blocks:** M7 (projections are keyed on mappings).

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M6-1 | As an admin, I want to map a product to a customer with an owner and an optional custom price, so that recurring projections have a basis. | `POST /mappings` persists to Postgres. The mock store path is deleted. Duplicate (customer, product) is rejected by a DB constraint. |
| M6-2 | As a salesperson, I want to see only mappings for my own customers, so that scope is consistent with every other module. | Ownership scoping derives from caller identity; the `ownerId`-cannot-widen rule is extended to mappings and tested. |
| M6-3 | As an admin, I want to bulk-create mappings, so that onboarding 883 rows is not 883 clicks. | Bulk endpoint is transactional and idempotent; partial failure reports per-row outcomes without committing a broken half. |
| M6-4 | As an admin, I want a custom price to override the catalog price, so that negotiated pricing is respected. | Price resolution order is documented and tested: mapping custom price → product default → explicit error. No silent zero. |
| M6-5 | As an admin, I want mapping removal to be safe, so that deleting one does not orphan projection history. | A mapping with projections cannot be hard-deleted; deactivation preserves history and stops future projection generation. |

### Prompt

```
Read AGENTS.md, then build the Mapping module from scratch — it does not exist.

Reality check: the Mapping model is in packages/db/prisma/schema.prisma with 883 rows in
the POC dataset, but there is NO mappings controller, service, or endpoint in
apps/api/src. apps/web/src/components/modals/AddMappingModal.tsx writes to the mock
useTrackerStore, so "map product to customer" currently persists nothing. Projections are
keyed on mappingId, which makes this a blocker for the projections module.

Build:
- Full Mapping module: controller, service, DTOs, RLS-aware queries, sales-ownership
  scoping identical to the other six services, and a DB uniqueness constraint on
  (tenantId, customerId, productId).
- A transactional, idempotent bulk-create endpoint that reports per-row outcomes and never
  commits a partial batch (AGENTS.md §8, §10).
- Documented and tested price resolution: mapping custom price -> product default ->
  explicit error. Never fall back to zero silently (AGENTS.md §31).
- Safe removal: a mapping with projection history cannot be hard-deleted.
- Rewire AddMappingModal to the real API and delete the useTrackerStore import.

Extend apps/api/src/common/sales-scope.spec.ts to cover mappings — an explicit ownerId
naming another salesperson must not widen scope. State query cost at 883 vs 500,000
mappings and justify indexes (AGENTS.md §3, §9).
```

---

# PHASE 3 — Sales execution

## M7 — Recurring sales projections

**Status today:** `projections` has only `GET` and `PATCH /:id`. No create, no period rollover,
no aggregation. `SalesTarget` model has no endpoint. POC: 16-column worksheet, 13 `ProjStatus`
values, monthly period, footer totals.

**Depends on:** M6.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M7-1 | As an admin, I want projections generated for a new month from active mappings, so that the team starts each month with a worksheet. | Period generation is idempotent — running twice creates no duplicates. Runs as a transaction. Reports created/skipped counts. |
| M7-2 | As a salesperson, I want to record projected qty, achieved qty, status, next follow-up and expected closure, so that the worksheet reflects reality. | Writes are scoped to owned rows; the 13 `ProjStatus` transitions that are invalid are rejected server-side, not just hidden in the UI. |
| M7-3 | As a manager, I want footer totals and achievement % computed by the server, so that every viewer sees the same numbers. | Aggregates come from a single SQL aggregation, not client summation over a paginated page. Correct when the list is filtered. |
| M7-4 | As a salesperson, I want the worksheet to stay fast with 883+ rows, so that monthly planning is not painful. | Server-side pagination + filtering; measured p95 at 1k, 10k, 100k rows; no N+1 on customer/product/salesperson joins. |
| M7-5 | As an admin, I want to set monthly targets per salesperson, so that achievement is measured against a commitment. | `SalesTarget` CRUD; target vs achieved is a server-computed comparison; missing target is an explicit state, not zero. |
| M7-6 | As a manager, I want concurrent edits not to silently overwrite each other, so that two people editing one row do not lose data. | Optimistic concurrency (version or updatedAt precondition); a conflicting write returns a documented 409, and the UI offers a real resolution (AGENTS.md §8). |
| M7-7 | As a user, I want to export the worksheet, so that offline review matches what I see. | Export reflects active filters, streams rather than buffering, and is generated server-side. |

### Prompt

```
Read AGENTS.md, then complete the Recurring Projections module.

Existing: apps/api/src/projections exposes ONLY GET and PATCH /:id. There is no create, no
monthly period generation, no server-side aggregation, and SalesTarget has no endpoint at
all. The POC worksheet has 16 columns, 13 ProjStatus values, monthly periods, and footer
totals.

Build:
- Idempotent monthly period generation from active mappings, transactional, reporting
  created/skipped counts. Running it twice must not duplicate (AGENTS.md §8).
- Server-enforced ProjStatus transition rules across all 13 states. Invalid transitions are
  rejected by the API, not merely hidden in the UI.
- Server-side aggregation for footer totals and achievement %, correct under filtering and
  pagination. Client-side summation over one page is wrong — do not do it (AGENTS.md §1).
- Optimistic concurrency with a documented 409 contract and a real UI resolution path.
- SalesTarget CRUD and target-vs-achieved comparison, with "no target set" as an explicit
  state, never silently zero.
- Streaming server-side export honouring active filters.

Performance: measure p95 at 1k / 10k / 100k projection rows, eliminate N+1 on
customer/product/salesperson joins, and justify every index with an EXPLAIN plan
(AGENTS.md §3, §4, §9).
```

---

## M8 — Leads & sales pipeline

**Status today:** `leads` CRUD exists. `LeadProduct` and `LeadActivity` have no endpoints, so
multi-product leads and activity history are not persisted through the API. POC: 9 `DealStage`
values, kanban + table views, stage stepper, remarks and follow-up history.

**Depends on:** M4, M5.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M8-1 | As a salesperson, I want to create a lead with several product lines in one submit, so that the enquiry is captured completely. | `LeadProduct` rows persist transactionally with the lead. Partial write is impossible. |
| M8-2 | As a salesperson, I want to move a lead through the 9 stages, so that the pipeline reflects reality. | Stage transitions validated server-side; each transition writes a `LeadActivity` row with actor and timestamp; illegal jumps rejected. |
| M8-3 | As a manager, I want drag-and-drop kanban moves to survive a failed request, so that the board never shows a state the server rejected. | Optimistic move rolls back visibly on failure with an actionable error. Concurrent moves of the same card resolve deterministically. |
| M8-4 | As a salesperson, I want a lead's full history, so that I know what was already tried. | Activity and remark history is server-persisted, paginated, and attributed. |
| M8-5 | As an admin, I want to convert a won lead into a customer, so that the pipeline feeds the recurring business. | Conversion is atomic: customer created, lead marked won, linkage recorded, no duplicate customer. Idempotent under double submit. |
| M8-6 | As a manager, I want the board to stay usable with thousands of leads, so that scale does not force us back to spreadsheets. | Per-column pagination or virtualisation; measured at 10k leads; no full-table fetch to render a board. |

### Prompt

```
Read AGENTS.md, then complete the Leads / Pipeline module.

Existing: apps/api/src/leads CRUD. Missing: LeadProduct and LeadActivity have models but no
endpoints, so multi-product leads and stage history are not persisted through the API. The
POC has 9 DealStage values, a kanban board, a table view, a stage stepper, and remark +
follow-up history.

Build:
- Transactional lead creation with multiple LeadProduct lines — partial writes impossible.
- Server-validated stage transitions across all 9 DealStage values, each writing a
  LeadActivity row with actor, timestamp, from-stage and to-stage (AGENTS.md §25).
- Kanban drag-and-drop that rolls back visibly when the server rejects the move, with
  deterministic resolution of concurrent moves of the same card (AGENTS.md §6, §11).
- Paginated, attributed activity and remark history.
- Atomic, idempotent lead-to-customer conversion — double submit must not create two
  customers (AGENTS.md §8).
- A board that does not fetch every lead to render: per-column pagination or
  virtualisation, measured at 10,000 leads (AGENTS.md §3, §4).

Every stage-transition rule needs a test for the rejected path.
```

---

## M9 — Sales orders & fulfilment

**Status today:** `orders` CRUD exists. `OrderStatusHistory` and `SalesOrderItem` have no
dedicated endpoints; the 7-step lifecycle is advanced through a generic `PATCH`. No SLA
computation on the server. `InvoicePrintModal` has no print stylesheet.

**Depends on:** M4, M5, M6.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M9-1 | As a salesperson, I want to create an order with several line items, so that a real order can be placed. | Items persist transactionally; totals are computed server-side; a client-sent total is never trusted. |
| M9-2 | As a warehouse user, I want to advance an order one lifecycle step at a time, so that the timeline is truthful. | A dedicated transition endpoint validates the 7-step order; skipping steps is rejected; each transition writes `OrderStatusHistory` with actor and timestamp. |
| M9-3 | As a manager, I want SLA metrics computed by the server, so that fulfilment reporting is consistent. | Ack time, prep time, transit time, total, and confirm lag are computed server-side from history timestamps, not in the browser. |
| M9-4 | As a salesperson, I want double-submit not to create two orders, so that the customer is not billed twice. | Order creation is idempotent under a client-supplied idempotency key. Test proves duplicate submit yields one order (AGENTS.md §8). |
| M9-5 | As an admin, I want cancellation to be controlled, so that a delivered order cannot be silently voided. | Cancellation is allowed only from defined states, requires a reason, and is audited. |
| M9-6 | As a user, I want the invoice to print correctly, so that the paper copy is usable. | Print stylesheet produces a clean single-purpose invoice; no nav, no buttons; tested at A4. |
| M9-7 | As a manager, I want stock or availability conflicts surfaced at order time, so that we do not promise what we cannot deliver. | Availability rule is defined explicitly during brainstorming and enforced server-side, or documented as deliberately out of scope. |

### Prompt

```
Read AGENTS.md, then complete Sales Orders & Fulfilment.

Existing: apps/api/src/orders CRUD. Gaps: the 7-step lifecycle (Created, Acknowledged,
DeliveryPartnerAssigned, DeliveredFromWarehouse, DeliveredToCustomer,
CustomerReceiptConfirmed, Cancelled) is advanced through a generic PATCH with no transition
validation; OrderStatusHistory and SalesOrderItem have no dedicated endpoints; SLA metrics
are not computed server-side; apps/web/src/features/orders/InvoicePrintModal.tsx has no
print stylesheet.

Build:
- Transactional multi-item order creation with server-computed totals. Never trust a
  client-sent total (AGENTS.md §7, §12).
- A dedicated transition endpoint enforcing the 7-step order, rejecting skipped steps, and
  writing OrderStatusHistory with actor and timestamp on every move.
- Server-computed SLA metrics (ack, prep, transit, order-to-delivery total, confirm lag)
  derived from history timestamps.
- Idempotent order creation keyed on a client-supplied idempotency key, with a test proving
  double submit yields exactly one order (AGENTS.md §8).
- Controlled cancellation: allowed states only, mandatory reason, audited.
- A real @media print stylesheet for the invoice, verified at A4.

During brainstorming, decide explicitly whether stock/availability is enforced at order
time. If it is out of scope, say so in the spec — do not leave it ambiguous (AGENTS.md §1).
```

---

## M10 — Payments & collections

**Status today:** `payments` CRUD exists. `PaymentFollowup` has no endpoint. Aging and zone
derivation currently happen in the seed, not as live business logic. `ImportPaymentsModal` is not
connected. POC: 141 payments, 6 aging buckets, 4 zones, 4 reminder chips.

**Depends on:** M4.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M10-1 | As a collections user, I want aging buckets and risk zones computed live, so that the list is correct today, not at seed time. | Bucket (0-30 … 150+) and zone are derived server-side from current date and payment state, consistently in list, detail, and reports. |
| M10-2 | As a salesperson, I want to record a follow-up against my own overdue invoice, so that collection effort is tracked. | Scoped `payment.write` for sales; a salesperson can edit their own invoices only, proven by a deny-path test on someone else's. |
| M10-3 | As a collections user, I want the four reminder chips and reason persisted, so that follow-up history survives a refresh. | `PaymentFollowup` endpoints persist chips, reason, next follow-up date, with actor attribution. |
| M10-4 | As an admin, I want to import a payment batch from file, so that reconciliation is not manual. | Real upload endpoint backed by `ImportJob`; validation reports per-row errors; import is idempotent and transactional; large files stream. `animate-bounce` placeholder removed. |
| M10-5 | As a manager, I want customer-level outstanding to reconcile with invoice-level data, so that the two views never disagree. | Outstanding is derived from payments by a single documented rule; a test asserts customer total equals the sum of its open invoices. |
| M10-6 | As a finance user, I want payment amounts handled without float error, so that totals are exact. | Decimal handling end to end — DB, API, and UI. A test proves no floating-point drift across a large aggregation (AGENTS.md §8). |

### Prompt

```
Read AGENTS.md, then complete Payments & Collections.

Existing: apps/api/src/payments CRUD. Gaps: PaymentFollowup has a model and no endpoint;
aging buckets and PayZone are computed in the seed script rather than as live business
logic; apps/web/src/features/payments/ImportPaymentsModal.tsx is a placeholder with an
animate-bounce and no backing endpoint. POC data: 141 payments, 6 aging buckets
(0-30/31-60/61-90/91-120/121-150/150+), 4 zones, 4 reminder chips.

Build:
- Live server-side derivation of aging bucket and PayZone from current date and payment
  state, identical in list, detail, and report paths (AGENTS.md §1).
- Scoped payment.write for the sales role: a salesperson edits their own invoices only.
  Prove the deny path against another salesperson's invoice (AGENTS.md §7).
- PaymentFollowup endpoints persisting the four reminder chips, reason, and next follow-up
  date with actor attribution.
- A real import pipeline backed by ImportJob: streaming upload, per-row validation
  reporting, transactional and idempotent application, and progress the user can trust.
  Remove the animate-bounce placeholder (AGENTS.md §31).
- One documented rule deriving customer outstanding from payments, with a test asserting
  the customer total equals the sum of its open invoices.
- Exact decimal money handling in DB, API, and UI, with a test proving no float drift over
  a large aggregation (AGENTS.md §8).
```

---

## M11 — Follow-ups, remarks & activity

**Status today:** `followups` CRUD exists. `Remark` and `Activity` models have no endpoints, so
cross-entity remarks and the audit-style activity feed are not reachable.

**Depends on:** M7, M8, M9, M10.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M11-1 | As a salesperson, I want one follow-up inbox across projections, leads, orders, and payments, so that nothing is missed. | A single query returns due/overdue/upcoming across all `EntityType` values, scoped to the caller, paginated, without N+1. |
| M11-2 | As a salesperson, I want to add a remark to any record type, so that context stays with the record. | Polymorphic `Remark` endpoints with entity-type validation; a remark cannot attach to a record the caller cannot see. |
| M11-3 | As a manager, I want an activity feed per record, so that I can see what happened without reading the database. | `Activity` rows written by the domain services, not the client; feed is paginated and attributed. |
| M11-4 | As a salesperson, I want overdue counts to be accurate, so that the badge means something. | Counts are server-computed with the same rule as the list. No client-side recount. |
| M11-5 | As a user, I want completing a follow-up to prompt the next one, so that the loop is not dropped. | Completion captures outcome and optionally schedules the next follow-up in one transaction. |

### Prompt

```
Read AGENTS.md, then complete Follow-ups, Remarks & Activity.

Existing: apps/api/src/followups CRUD. Missing: Remark and Activity models have no
endpoints, so cross-entity remarks and the activity feed are unreachable from the API. The
EntityType enum already covers Customer, Lead, Order, Payment, Projection.

Build:
- A unified follow-up inbox across all EntityType values — due, overdue, upcoming — scoped
  to the caller, paginated, and free of N+1 queries (AGENTS.md §4).
- Polymorphic Remark endpoints with entity-type validation and an authorization check that
  a remark cannot attach to a record the caller cannot read (AGENTS.md §7).
- Activity rows written by the domain services themselves, never accepted from the client.
  Paginated, attributed feed per record (AGENTS.md §25).
- Server-computed overdue counts using exactly the same rule as the list query — one rule,
  one implementation, no client recount.
- Transactional "complete this follow-up and schedule the next" in a single operation.

Design the polymorphic query for scale: state how the inbox performs at 100k follow-up rows
and justify the indexes (AGENTS.md §3, §9).
```

---

# PHASE 4 — Intelligence layer

## M12 — Dashboard & reporting

**Status today:** `DashboardPage.tsx` loops `fetchNextPage` until every page is loaded, then
aggregates in the browser. There is no reporting endpoint. This breaks at real data volume.

**Depends on:** M7–M11.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M12-1 | As any user, I want the dashboard to load in one request, so that it is fast and correct. | A dedicated aggregation endpoint returns all KPIs. The client-side infinite fetch loop is deleted. Single round trip. |
| M12-2 | As a salesperson, I want my personal numbers, and as a manager the team's, so that each role sees the right scope. | Role-aware aggregation server-side; a salesperson's totals cannot include another's data, proven by test. |
| M12-3 | As a manager, I want salesperson-vs-salesperson comparison, so that performance is visible. | Comparison computed server-side; consistent with the projections worksheet totals to the rupee. |
| M12-4 | As a manager, I want reports to stay fast as data grows, so that the dashboard does not become the bottleneck. | Measured p95 at 100k+ rows; caching or materialisation justified with numbers, with a documented staleness bound (AGENTS.md §4, §5, §21). |
| M12-5 | As a user, I want partial data failure to be visible, so that I never act on a silently wrong number. | A failed widget renders an explicit error state; the page never shows zero in place of "unknown" (AGENTS.md §31). |

### Prompt

```
Read AGENTS.md, then replace the dashboard's client-side aggregation with real reporting.

Current defect: apps/web/src/features/dashboard/DashboardPage.tsx calls fetchNextPage in a
loop until every page is loaded and then sums in the browser. With 417 customers that is
merely slow; at production volume it is a hard failure. There is no reporting endpoint.

Build:
- A dedicated server-side aggregation endpoint returning every dashboard KPI in one round
  trip. Delete the client-side infinite fetch loop (AGENTS.md §4).
- Role-aware aggregation: a salesperson's totals never include another salesperson's data.
  Prove it with a test.
- Salesperson-vs-salesperson comparison that reconciles to the rupee with the projections
  worksheet totals — one aggregation rule, not two (AGENTS.md §1).
- Measured p95 at 100k+ rows. If caching or materialised aggregates are justified, state
  the numbers, the staleness bound, and the invalidation strategy (AGENTS.md §5, §21).
- Explicit per-widget error states. A widget that failed must never render zero as if it
  were data (AGENTS.md §31).
```

---

## M13 — Notifications & global search

**Status today:** sidebar and topbar badges read `useTrackerStore` — they never change when the
database changes. The Cmd+K command palette searches static in-memory seed data, so live records
are unfindable. `Notification` model has no endpoint.

**Depends on:** M11, M12.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M13-1 | As a user, I want badge counts to reflect the database, so that the numbers are trustworthy. | Badges read server-computed counts. The mock store path is deleted. Counts refresh on a defined cadence or event. |
| M13-2 | As a user, I want Cmd+K to find records I just created, so that search is actually useful. | Search hits the server across customers, leads, orders, payments; results respect the caller's scope; debounced and paginated. |
| M13-3 | As a user, I want in-app notifications for follow-ups due and payment reminders, so that I act in time. | `Notification` endpoints with read/unread state; generation is server-side and idempotent — no duplicate notification per event. |
| M13-4 | As a manager, I want search to stay fast, so that it does not degrade as data grows. | Full-text or trigram indexing justified by an EXPLAIN plan; p95 measured at 100k+ records. |
| M13-5 | As a user, I want search never to leak records I cannot see, so that scoping is airtight. | A sales user's search cannot surface another salesperson's records; proven by test. |

### Prompt

```
Read AGENTS.md, then build Notifications & Global Search.

Current defects: apps/web/src/components/layout.tsx reads overdue-follow-up and red-zone
badge counts from the mock useTrackerStore, so the badges never change when the database
changes. apps/web/src/components/CommandPaletteModal.tsx searches static in-memory seed
data, so a record created a minute ago cannot be found. The Notification model has no
endpoint.

Build:
- Server-computed badge counts using the same rules as the underlying lists. Delete the
  mock store path (AGENTS.md §31).
- Server-side global search across customers, leads, orders, and payments, scoped to the
  caller, debounced and paginated. Prove by test that a sales user cannot surface another
  salesperson's records (AGENTS.md §7).
- Notification endpoints with read/unread state and idempotent server-side generation for
  follow-up-due and payment-reminder events — one event must not produce duplicate
  notifications (AGENTS.md §6, §8).
- Search indexing (full-text or trigram) justified by an EXPLAIN plan, with p95 measured at
  100k+ records (AGENTS.md §4, §9).

State explicitly how notification delivery behaves if the generating job runs twice or
fails halfway.
```

---

# PHASE 5 — Operations

## M14 — Import, export & attachments

**Status today:** `ImportJob` and `Attachment` models exist with no endpoints. `DataPage.tsx` is a
prototype debug screen whose "Reset to Sample Data" and "Clear All Data" buttons only wipe local
Zustand state — they claim to touch the database and do not.

**Depends on:** M4–M10.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M14-1 | As an admin, I want bulk import for customers, products, mappings, and payments, so that onboarding is not manual. | One import pipeline, per-entity validators; per-row error reporting; transactional apply; idempotent re-run; streams large files. |
| M14-2 | As an admin, I want import progress and history, so that I know what a job did. | `ImportJob` records status, counts, errors, actor, and timing. A failed job is diagnosable after the fact. |
| M14-3 | As a user, I want to attach documents to records, so that POs and proofs live with the deal. | Upload with type and size validation, malware-safe handling, access control matching the parent record, and a documented storage backend. |
| M14-4 | As an operator, I want the misleading DataPage removed, so that no one believes they reset production. | The prototype debug screen is removed from the app or gated to development only, with the misleading buttons deleted (AGENTS.md §31). |
| M14-5 | As a user, I want exports to reflect my filters and my scope, so that the file matches the screen. | Server-side, streamed export honouring filters and caller scope; large exports do not exhaust memory. |

### Prompt

```
Read AGENTS.md, then build Import, Export & Attachments.

Existing models with no endpoints: ImportJob, Attachment. Existing defect:
apps/web/src/features/data/DataPage.tsx is an early prototype debug screen whose "Reset to
Sample Data" and "Clear All Data" buttons wipe local Zustand memory while implying they
affect PostgreSQL. That is a misleading production path and must go.

Build:
- One import pipeline with per-entity validators (customers, products, mappings, payments):
  streaming file handling, per-row validation errors, transactional apply, idempotent
  re-run (AGENTS.md §8).
- ImportJob records with status, counts, error detail, actor, and timing so a failed job is
  diagnosable afterwards (AGENTS.md §13).
- Attachment upload with content-type and size validation, safe filename handling, access
  control inherited from the parent record, and an explicitly chosen storage backend with
  its cost stated (AGENTS.md §7, §21).
- Remove or development-gate DataPage and delete the misleading reset buttons.
- Server-side streamed export honouring active filters and caller scope, memory-bounded for
  large result sets (AGENTS.md §4).
```

---

## M15 — Audit, compliance & data lifecycle

**Status today:** `AuditLog` and `PlatformAuditLog` models exist with no read endpoint and no
guaranteed write path. Nothing enforces retention or deletion.

**Depends on:** M2–M14.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M15-1 | As an admin, I want every business-significant change recorded, so that disputes can be settled with evidence. | Audit writes happen in the same transaction as the change — an audited action cannot succeed without its audit row. |
| M15-2 | As an admin, I want to search the audit trail, so that investigation does not require DB access. | Scoped, paginated audit search by actor, entity, action, and date range. Audit rows are immutable. |
| M15-3 | As a compliance owner, I want personal data handled deliberately, so that we can answer an access or deletion request. | Personal fields are inventoried; export-my-data and delete-my-data paths are defined; deletion preserves financial records where legally required (AGENTS.md §26). |
| M15-4 | As an operator, I want retention and archival defined, so that the database does not grow without bound. | Retention policy per table; archival or partitioning strategy for the highest-growth tables, chosen from measured growth rates (AGENTS.md §3). |

### Prompt

```
Read AGENTS.md, then build the Audit, Compliance & Data Lifecycle layer.

Existing: AuditLog and PlatformAuditLog models with no read endpoint and no guaranteed
write path — audit coverage today is incidental, not enforced.

Build:
- Transactional audit writes: an audited business action and its audit row commit together
  or not at all. Capture actor, action, entity, before value, after value, timestamp, and
  source (AGENTS.md §25).
- Immutable audit rows enforced at the database level, with scoped paginated search by
  actor, entity, action, and date range.
- A personal-data inventory across the schema, plus defined export-my-data and
  delete-my-data paths that preserve financial records where retention is legally required
  (AGENTS.md §26).
- Per-table retention policy and an archival or partitioning strategy for the
  highest-growth tables, chosen from measured growth rates (AGENTS.md §3).

State which tables grow fastest at 1,000 tenants and what breaks first.
```

---

## M16 — Deployment, migrations & disaster recovery

**Status today:** `docker-compose.staging.yml` and `DEPLOYMENT.md` exist. There is no tested
rollback, no verified restore, and no post-deployment verification gate.

**Depends on:** all.

### User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| M16-1 | As an operator, I want migrations that are safe on live data, so that a deploy never locks or loses the table. | Every migration is reviewed for lock duration and backward compatibility; expand/contract pattern for breaking changes; rollback documented per migration. |
| M16-2 | As an operator, I want a tested rollback, so that a bad deploy is a five-minute problem. | Rollback procedure executed at least once against staging and documented with real timings. |
| M16-3 | As an operator, I want restores proven, so that backups are more than a checkbox. | A restore is performed end to end against a real backup; RTO and RPO measured and recorded (AGENTS.md §16). |
| M16-4 | As an operator, I want post-deployment verification, so that a broken release is caught by the system, not the customer. | Automated smoke checks run after deploy and fail the release on error. |
| M16-5 | As an engineer, I want CI to block merges that break tests, types, or lint, so that main stays deployable. | CI runs API tests against real Postgres, web tests, type-check, and lint. A red pipeline blocks merge. |

### Prompt

```
Read AGENTS.md, then make deployment, migrations, and recovery production-safe.

Existing: docker-compose.staging.yml and DEPLOYMENT.md. Missing: tested rollback, verified
restore, post-deployment verification, and CI gating.

Build:
- A migration review standard: lock duration, backward compatibility, expand/contract for
  breaking changes, and a documented rollback for every migration (AGENTS.md §24).
- A rollback procedure actually executed against staging, with real measured timings.
- An end-to-end restore from a real backup, with RTO and RPO measured and recorded
  (AGENTS.md §16).
- Automated post-deployment smoke verification that fails the release on error.
- CI that runs API integration tests against real Postgres, web tests, check-types, and
  lint, and blocks merge when red.

Do not document a procedure you have not executed. If a step was not actually run, label it
as untested (AGENTS.md §31).
```

---

## Build order summary

| # | Module | Depends on | Why this position |
| --- | --- | --- | --- |
| M0 | Seed strategy & test fixtures | — | Test suite is broken until resolved |
| M1 | Security & observability baseline | M0 | Precondition, not a feature |
| M2 | Identity & access management | M1 | Everything is authorized against it |
| M3 | Tenancy & platform operations | M2 | Multi-tenant correctness |
| M4 | Customers, contacts & industries | M2 | Master data root |
| M5 | Product catalog | M2 | Master data root |
| M6 | Customer ↔ product mappings | M4, M5 | **Missing entirely; blocks projections** |
| M7 | Recurring projections | M6 | Core revenue workflow |
| M8 | Leads & pipeline | M4, M5 | New-business workflow |
| M9 | Sales orders & fulfilment | M4, M5, M6 | Execution workflow |
| M10 | Payments & collections | M4 | Cash workflow |
| M11 | Follow-ups, remarks & activity | M7–M10 | Cross-cutting, needs its subjects |
| M12 | Dashboard & reporting | M7–M11 | Aggregates everything |
| M13 | Notifications & global search | M11, M12 | Depends on real counts |
| M14 | Import, export & attachments | M4–M10 | Needs stable schemas |
| M15 | Audit, compliance & lifecycle | M2–M14 | Cross-cutting, needs all writers |
| M16 | Deployment, migrations & DR | all | Ships the result |

**Critical path to a usable product:** M0 → M1 → M2 → M4 → M5 → **M6** → M7 → M10.
M6 is the sharpest gap — it has no code at all, and projections cannot be correct without it.
