# POC v6 Parity, Sales-on-Web, and 100-User Scale — Design

**Date:** 2026-08-22
**Status:** Approved (design), pending implementation plan
**Source of truth:** `C:/Users/Kannan/Downloads/GreatSales_Tracker_POC_v6.html` (client-provided)
**Targets:** `apps/web`, `apps/api`, `packages/db`

---

## 1. Goal

Three outcomes, one delivery:

1. **Component parity** — every option, column, filter, and modal present in the client's POC v6 exists in `apps/web`.
2. **Sales on web** — salespersons can sign in and work on the web app, not just mobile.
3. **Production-grade at 100 concurrent users** — measured, not assumed.

### Explicit non-goal: visual restyling

The web app's current design system (`--color-brand: #059669`, Plus Jakarta Sans, Tailwind v4 tokens in `apps/web/src/index.css`) **stays as-is**. The POC's own palette (`--acc: #0E6B54`, Segoe UI, 10px radius) is **not** being ported.

This is a deliberate decision. Parity here means *functional and informational* parity — the same data, the same controls, the same actions — rendered in the existing design language. No token changes, no font changes, no spacing rewrites.

---

## 2. Correction to the prior audit

`POC_V6_ORIGINAL_DATA_AND_AUDIT_REPORT.md` states every page is "✅ 100% Identical" and that Projections has "Exact 16 columns matching POC layout". **That is not accurate.** Verified against the working tree on 2026-08-22:

- `ProjectionsPage.tsx` renders **12** `<th>` elements; the POC renders 17.
- The POC has no `InvoicePrintModal`; the report lists one as POC-derived.
- Payments reminder chips: the report says 3, the POC has **4** (`mail1`–`mail4`). The web implementation correctly has 4.

That report should be treated as superseded by this document for parity claims. The **dataset** counts it reports (417 customers, 234 products, 883 mappings) were not re-verified here and are out of scope.

---

## 3. Component parity — the gap list

Each row below was verified by reading both the POC source and the corresponding web file.

### 3.1 Projections (`/projections`) — largest gap

POC column order (17, incl. role-conditional):

`#` · `Customer` · `Salesperson`* · `Principal` · `Sub product` · `Price ₹` · `Proj qty` · `Proj value` · `Ach qty` · `Ach value` · `Ach %` · `Status` · `Next follow-up` · `Expected closure` · `Remarks` · `Follow-up log` · `Sales order` · `✕`†

\* hidden for `sales` role  †`admin` only

Web currently stops at `Status`. **Missing columns:**

| Column | Required behaviour |
|---|---|
| `Next follow-up` | Inline `<input type="date">`; persists on change; toast confirmation |
| `Expected closure` | Inline `<input type="date">`; persists on change |
| `Remarks` | Button with count badge → shared RemarksModal (`kind: "line"`) |
| `Follow-up log` | Button with count badge. Label = `Next {MM-DD}` when a follow-up date exists, else `Log follow-up`. Tone: red when `nextFollowUp < today`, amber when `=== today` |
| `Sales order` | If an SO exists for `(mappingId, period)` → button showing SO status, opens SO detail. Else if status ∈ {`Confirmed`, `PartiallyConfirmed`} → `+ Create SO`. Else `—` |
| `✕` (admin) | Delete mapping **and** its monthly projection lines, behind a confirm dialog |

**Also missing on this page:**

- Toolbar actions: `+ Add new customer`, `+ Map product to customer`, `Export CSV`
- **Category break rows** — when the customer's category changes between consecutive rows, insert a full-width band row showing `Platinum` / `Gold` / `Silver` / `Brass` / `Unclassified`
- **Customer group separator** — first row of each new customer carries a heavier top border
- **Sort order** — category rank (`Platinum:0, Gold:1, Silver:2, Brass:3, unset:4`), then customer name, then product name

The four line-filter chips (`All lines` / `Projected` / `Unprojected` / `Needs follow-up`) already exist and are correct.

### 3.2 Payments (`/payments`)

Missing three columns: `Reason` (inline editable text), `Next follow-up` (inline date), `Remarks` (button + count → RemarksModal, `kind: "pay"`).

Everything else matches: aging badges with 6 buckets, 4 zone selects, 4 reminder chips, zone-wise / salesperson-wise / organization-wise reports, and the Excel import with header auto-detection.

### 3.3 Customers (`/customers`)

Missing: `Mobile / WhatsApp` column (renders `mobile`, and ` / {whatsapp}` only when it differs from mobile), and `Products mapped` count.

The web-only `Outstanding` column is an improvement over the POC and stays.

### 3.4 Users (`/users`)

Missing:
- `Customers` count column — number of customers assigned; `—` for non-sales roles
- **`Assign customers` bulk modal** — searchable checkbox list of all customers; already-assigned ones show checked and disabled with an "already assigned" hint. Saving moves each selected customer **and all of its product mappings** to the target salesperson.

The role permission matrix already exists and matches.

### 3.5 Leads (`/leads`)

Missing: `Remarks` column (button + count → RemarksModal, `kind: "lead"`).

Kanban with drag-to-stage, 9 pipeline stages, stage filter chips, and the add-lead modal (industry taxonomy, industrial areas, same-as-mobile WhatsApp) all match.

### 3.6 Products (`/products`)

Missing: `Customers mapped` count column.

### 3.7 Orders (`/orders`)

Missing: status filter chips — `All` plus the 7 SO statuses (`Created`, `Acknowledged`, `Delivery Partner Assigned`, `Delivered from Warehouse`, `Delivered to Customer`, `Customer Receipt Confirmed`, `Cancelled`).

Search and the 13-column fulfilment SLA report already match exactly.

### 3.8 Follow-ups (`/followups`)

The grouped-by-date stream exists. Missing the POC's **second card**: "Recurring sales follow-up queue — {month}", a table with:

`●` (urgency dot) · `Customer` · `Principal` · `Sub product` · `Status` · `Prob %` · `Next date` · `Last note` · `Open`

Urgency dot colours by bucket: overdue red, today amber, upcoming blue, never-followed-up grey. Sort: bucket, then date. Rows include open lines that have a projected qty but no follow-up history at all.

### 3.9 Dashboard (`/dashboard`)

The KPI set differs from the POC. Align to the POC's six:

| KPI | Value | Sub-label |
|---|---|---|
| Recurring sales committed value | Σ projected value | `{n} lines projected` |
| New sales customer committed value | Σ open lead value | `{n} active leads` |
| Total achieved value | recurring achieved + closed-won | `recurring + closed-won` |
| Achievement % | combined achieved ÷ combined committed | tone: ≥70 good, ≥40 warn, else bad |
| Commitment gap | `100 − achievement%` | `{₹} pending` |
| Follow-ups | overdue + due today | `{n} overdue · {n} due today` |

The two-perspective split (sales vs admin/mgmt), the salesperson comparison chart, principal performance bars, category mix bars, oral-confirmation list, and top-open-projections list all already exist.

### 3.10 Shared: RemarksModal

The POC uses **one** remarks modal across three entity kinds (`line`, `lead`, `pay`), differing only in its subtitle. `RemarksModal.tsx` exists; it needs to serve all three kinds and be wired into Projections, Leads, and Payments. Remarks are append-only, newest first, stamped with the date.

---

## 4. Sales role on web

### 4.1 What blocks it today

`apps/web/src/store/auth.ts:20` defines `SalesWebLoginError` and throws it when `mapRole(res.user.role) === "sales"`. `LoginRole` in `LoginPage.tsx:22` is `"super_admin" | "admin" | "mgmt"`. `NAVS` in `data/constants.ts:270` has no `sales` key.

### 4.2 Changes

- Delete `SalesWebLoginError` and its throw site.
- Add `"sales"` to `LoginRole`, with a login card config and a `/login/sales` route.
- Add `NAVS.sales` — the POC's seven items, in order: Dashboard · Recurring Sales Projections · New Sales Customers · Sales orders · Payments Follow-up · Follow-ups · **My customers**.
- `RoleGuard`: `sales` is denied `/users` and `/data`. `/products` is also excluded (POC's sales nav omits it; products are reachable through the worksheet's inline selects).
- Topbar: hide the salesperson filter for `sales` (month and principal filters stay).
- Tables: hide the `Salesperson` column for `sales` across Projections, Leads, Orders, Follow-ups.
- Write actions: `sales` may create and edit their own records. Delete actions (mapping, customer, lead, payment) stay `admin`-only, matching the POC.

### 4.3 Server-side enforcement

Client-side hiding is presentation only. The authority is `resolveOwnerScope` in each service, which already forces `ownerId = user.userId` for the sales role. That code path exists, but its current test coverage has not been assessed — so this work adds an explicit ownership test to every one of the 8 feature modules: a sales user must not be able to read or write another salesperson's row through any endpoint, including by passing an explicit `ownerId`.

Until those tests exist and pass, the web login block is not removed. Opening a new surface to a role whose scoping is unverified would be the wrong order of operations.

---

## 5. Scale to 100 concurrent users

### 5.1 Measure first

No optimization lands before a baseline exists. A k6 scenario models a realistic mix — dashboard load, projections worksheet, a cell edit, payments list — ramped to 100 virtual users against a seeded database.

**Acceptance gate (and the definition of done for this section):**

- p95 latency < 500 ms on `/projections` and the dashboard endpoint
- zero Prisma pool-timeout errors
- error rate < 0.1 %

The same script runs after each fix, so every change is justified by a delta rather than by intuition.

### 5.2 Finding — role lookup hits the database on every permission check

`isSalesOnly()` runs `db.role.findUnique({ where: { id: roleId } })`. There are **23 call sites** across the services, and `resolveOwnerScope` calls it on every list request.

The role name is already in the JWT — `auth.service.ts:149` puts `role: user.role?.name` into the token payload. The fix is to read it from `RequestUser` and make `isSalesOnly` a pure in-memory comparison. This removes one database round trip per permission check.

Because role changes then live in an already-issued token until it expires, deactivating or re-roling a user must invalidate their refresh token — otherwise a demoted user keeps elevated scope for the remainder of the access-token lifetime. That invalidation is part of this change, not a follow-up.

### 5.3 Finding — every Prisma operation opens its own transaction

`PrismaService.forTenant()` (`prisma.service.ts:68`) extends `$allOperations` so that each query becomes `$transaction([set_config(...), query])`. A single list request that also checks permissions therefore opens at least two transactions, each holding a pool connection for its duration.

Fix: hold **one** tenant-scoped interactive transaction per HTTP request, established in middleware and carried through `AsyncLocalStorage`, so `set_config('app.tenant_id', …, true)` runs once per request instead of once per query. `forTenant()` keeps its current signature; only its backing changes.

Two constraints on this change, both non-negotiable:

- **RLS must remain fail-closed.** The point of the current design is that a forgotten `where` clause cannot leak across tenants. The replacement must preserve that, verified by the existing RLS tests plus a new one asserting that a request without a tenant context sees zero rows.
- **Transactions must be bounded.** A per-request transaction that outlives a slow handler will exhaust the pool faster than the problem it fixes. An explicit timeout is required, and read-only endpoints that do not need write atomicity should be measured both ways before committing to the approach.

If measurement shows the batched form was already cheap, this change does not ship. The finding is a hypothesis with a plausible mechanism, not a confirmed bottleneck.

### 5.4 Finding — projections fetches and filters everything in JavaScript

`projections.service.ts:65` runs `findMany` with `PROJECTION_INCLUDE` (customer → contacts, product → principal) filtered only by `period`, `deletedAt`, and optional owner. `principalId`, `search`, and `lineFilter` are then applied **in JS** by `applyFilters`, and totals computed by `summarize` over the hydrated array.

With 883 mappings, an admin request hydrates every row and its joins regardless of which filters the user set. Filters currently reduce nothing at the database layer.

Fix, in order:

1. Push `principalId` and `search` into the Prisma `where`.
2. Compute footer totals with `aggregate` / `groupBy` rather than by summing hydrated rows, so totals stay correct while rows are paginated.
3. Add cursor pagination to the endpoint.
4. Virtualize the worksheet body on the client (`react-window`), so a long period renders a bounded number of DOM rows.

`lineFilter: "due"` depends on `today`, which the service already accepts as a parameter — it can be expressed as a date comparison in the `where` rather than in JS.

### 5.5 Finding — the dashboard composes itself from list endpoints

Commit `40bb0f9` wired dashboard KPIs "composed from list hooks", so one dashboard render fans out into several list requests, each paying the full include-and-hydrate cost. At 100 concurrent users this multiplies.

Fix: a single `GET /dashboard/summary` returning the six KPIs plus the chart series, computed with database aggregates. The client keeps one query instead of N.

### 5.6 Connection pool and indexes

- Set `connection_limit` and `pool_timeout` explicitly on `DATABASE_URL` rather than relying on Prisma's `num_cpus * 2 + 1` default.
- Put PgBouncer in transaction-pooling mode in front of Postgres. Note that transaction pooling and session-level state interact badly — this must be validated against the tenant-context change in 5.3, not assumed compatible.
- Audit composite indexes for the hot paths: `(tenantId, period)` on projections, `(tenantId, deletedAt)` on soft-deleted models, and the mapping foreign keys. Verify with `EXPLAIN ANALYZE` against seeded data, not by inspection.

### 5.7 Client-side

- `staleTime` on reference data (customers, products, principals, users) so navigating between pages does not refetch catalogs that change rarely.
- Debounce the search inputs that currently trigger a query per keystroke.
- Keep the existing route-level code splitting.

---

## 6. Testing

Parity work is UI-shaped, so tests target behaviour rather than markup:

- **Projections** — each new column renders, persists its edit, and shows the correct tone; category break rows appear at the right boundaries; the sales role sees no Salesperson column and no delete control.
- **Assign customers** — moving a customer also moves its mappings; already-assigned customers cannot be re-selected.
- **RemarksModal** — serves all three entity kinds; remarks are append-only and ordered newest first.
- **Sales-on-web authorization** — for each of the 8 modules, a sales user cannot read or write another salesperson's row, including when passing an explicit `ownerId`. This is the security-critical suite.
- **Scale** — the k6 scenario from 5.1, run before and after each optimization.

The API suite is currently 94 tests green; the new API tests extend it rather than replacing anything.

---

## 7. Sequencing

The work splits into four groups, ordered so that nothing is built twice:

1. **Sales role on web** — unblocks the role, adds `NAVS.sales`, and lands the ownership test suite. Done first because the parity work in group 2 has role-conditional columns that need the role to exist.
2. **Component parity** — Projections first (largest gap, and it establishes the shared RemarksModal and follow-up patterns the other pages reuse), then Payments, Users, Follow-ups, Dashboard, then the single-column additions to Customers, Products, Leads, Orders.
3. **Scale** — baseline measurement, then the fixes in 5.2–5.7, each re-measured.
4. **Verification** — full suite, load test against the gate, and a pass over every POC page confirming each listed gap is closed.

Group 3 is deliberately last: optimizing the projections query before its final column set is known would mean tuning a query that is about to change.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Per-request transaction (5.3) regresses pool behaviour instead of improving it | Gate on measurement; do not ship if the delta is not positive. Preserve fail-closed RLS, verified by test. |
| PgBouncer transaction pooling conflicts with request-scoped session state | Validate together, not separately. Session-level `set_config` and transaction pooling are known to interact badly. |
| JWT-carried role (5.2) lets a demoted user keep scope until token expiry | Refresh-token invalidation on role change ships with the same commit. |
| Opening web access to the sales role widens the attack surface | Server-side ownership tests for all 8 modules are a blocking deliverable, not a follow-up. |
| Parity list is incomplete | Each item was verified by reading both sources; group 4 re-walks every page against this document. |

---

## 9. Open items

None. All decisions in this document are settled; anything requiring measurement is explicitly gated on that measurement rather than left undecided.
