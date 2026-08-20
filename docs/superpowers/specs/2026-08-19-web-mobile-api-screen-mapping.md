# GreatSales — Web + Mobile Screen → API Mapping

**Date:** 2026-08-19
**Status:** Analysis only (no source edits). Source of truth = `packages/shared/src/*.ts` + the built NestJS API (`/api/v1`, cursor-paginated lists → `{items, nextCursor}`).
**Purpose:** For every web page and mobile screen, map each UI section to the real endpoint(s), do a field-by-field mock⇄API diff (flagging name mismatches), list the mutations, and separate client-only bits. Then a shared GAP list + recommended wiring order.

> Reference wiring already done: web **Projections** (`apps/web/src/features/projections/{types,queries}.ts` + `store/auth.ts` + `lib/api.ts`). Study this before wiring anything else. Golden rules from it:
> - `@greatsales/shared` is CJS dist → **do NOT import it into Vite/Metro**. Copy wire-types LOCALLY per feature (`web: features/<x>/types.ts`; `mobile: gs/domain.ts` is already local).
> - API returns **denormalized names** (`salespersonName`, `principalName`, `customerName`, `productName`) → the frontends' `custMap/prodMap/userMap` joins mostly disappear once wired.
> - Enum values on the wire are **PascalCase DB values** (`POExpected`, `NewEnquiries`, `RedZone`, `Credit30`). Both frontends currently hold **display labels** ("PO Expected", "New Enquiries", "Red Zone", "30 Days Credit"). Every enum field needs a label⇄value map.

---

## Global name-mismatch cheat sheet (applies to nearly every screen)

| Concept | Web mock field | Mobile mock field | API Row field | Notes |
|---|---|---|---|---|
| Owning salesperson | `ownerId` | (implicit — sales scope) | **`salespersonId`** (+ `salespersonName`) | Rename everywhere. On mobile, `sales` role → API auto-scopes lists to caller, so ownerId filter is implicit. |
| Customer grade | `tier` (Customer) | `tier` (Customer) | **`category`** (`CustomerRow.category`) | ⚠ Only on **Customer**. On **Lead** the API field IS `tier`. |
| Projection month | `month` / `MONTH` | `MONTH` (const) | **`period`** (`YYYY-MM`) | Projections query param. |
| Projected qty | `projectedQty` | `projectedQty` | **`committedQty`** | Projection line. |
| Proj/Ach value | computed `qty*price` | computed `qty*price` | **`projValue` / `achValue` / `achPct`** | API computes; drop client math. |
| Lead account name | `name` (Lead) | `name` (Lead) | **`customerName`** (LeadRow) | |
| Lead deal value | `products[].value` sum | `value` (scalar) | **`totalValue`** (+ `products[]`) | Mobile has NO products array in domain (LeadX adds optional). |
| Order total | `lines[]` computed | `value` | **`total`** (server-derived) | |
| Order line items | `lines: OrderLine[]` | `productName` (single) | **`items: OrderItemRow[]`** | Mobile list shows one product string only. |
| Order ship-to | `deliveryAddress` | `shipTo` | **`deliveryAddress`** | Mobile rename. |
| Order history | `history: OrderStatusHistory[]` (`timestamp`,`by`,`note`) | `timeline: OrderStep[]` (`label`,`at`,`by`) | **`statusHistory: OrderStatusHistoryRow[]`** (`status`,`at`,`changedByName`,`note`) | Shape differs; API is authoritative trail. |
| Payment zone | `zone` (PayZone label) | `zone` (PayZone label) | **`payZone`** (enum `RedZone`…) | Rename + label⇄value. |
| Payment delay reason | `delayReason` | `reason` | **`delayReason`** | Mobile rename. |
| Payment mail flags | `mail1..4: boolean` | `mail1..4: 'Yes'/'No'` (+`mails` count) | **`mail1..4: boolean`** | Mobile stores strings → convert. |
| Payment invoice date | `invoiceDate` | `date` (or `dueDate`) | **`invoiceDate`** | Mobile rename. |
| Payment aging | computed `agingDays()` | computed `agingDays()` | **`agingDays`** (server) | Can drop client calc or keep as fallback. |
| FollowUp entity kind | `kind` (`projection`/`lead`/`payment`) | `kind` | **`entityType`** (`Projection`/`Lead`/…) | Capitalized enum. |
| FollowUp target | `targetId` | `targetId` | **`entityId`** | |
| User role | `role` (slug string) | n/a | **`roleId`** (+ `roleName`) | Web stores slug; API keys off roleId. |
| User last login | `lastLogin` | n/a | **`lastLoginAt`** | |
| Product price | `listPrice` | `price` (in mappings) | **`basePrice`** | |
| Payment terms | `"30 Days Credit"` | `"30 Days Credit"` | **`Credit30`** (enum) | Label⇄value map. |
| Delivery mode | `"Transport (LR)"` | `"Transport (LR)"` | **`TransportLR`** (enum) | Label⇄value map. |

Enum label⇄value maps needed (build once, share web+mobile): **ProjStatus** (13), **DealStage** (9), **OrderStatus** (7), **PayZone** (4), **PaymentTerms** (7), **DeliveryMode** (5), **CustomerCategory** (4). Projections already ships `PROJ_STATUS_LABELS` + `projStatusFromLabel` — replicate that pattern for the rest.

---

# PART A — WEB (`apps/web/src/pages/`)

Web audience = `super_admin | admin | mgmt` (RBAC: admin→full, mgmt→read-only). `sales` is data-only (mobile). Filters come from `store/ui.ts` (`month`, `principalId`, `ownerFilter`, `role`, `ownerId`).

## A0. LoginPage.tsx — 🔴 not wired (mock `useUi.login`)

| UI section | Data needed | Endpoint | Notes |
|---|---|---|---|
| Portal tabs (super_admin/admin/mgmt) | none | client-only | UI routing only. |
| Workspace tenant field | `tenantId` | `POST /auth/login {tenantId,email,password}` | ⚠ Field collects a **slug** ("greatsales") but API wants **tenantId** ("tenant_acme"). No slug→tenantId resolver exists (see GAP). |
| Email / Password | credentials | same | |
| Submit | JWT pair + user | `LoginResponse {accessToken, refreshToken, user}` | Currently calls mock `useUi.login(role)` with a `setTimeout`; must call real `useAuth.login` (already exists, used by ProjectionsPage). |

- **Mutations:** `POST /auth/login`; later `POST /auth/refresh`, `GET /auth/me`.
- **Client-only:** portal tab selection, hero panel, role→destination routing.
- **Mismatch/gap:** LoginPage uses the **mock** `useUi` auth; ProjectionsPage uses the **real** `useAuth`. Two disconnected auth systems — unify (see `docs/superpowers/specs/2026-08-19-projections-auth-unify-design.md`). `role` for routing should derive from `user.role` in the login response, not be chosen at the tab.

## A1. DashboardPage.tsx — 🔴 not wired · read-heavy aggregation

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| 6 KPI cards (recurring committed/achieved, new committed/won, total, follow-ups due) | projections (period) + leads | `GET /projections?period` + `GET /leads` | All KPIs are **client-derived**. No `/reports` endpoint. |
| Salesperson bar chart (`spChartItems`) | per-salesperson committed vs achieved | aggregate `GET /projections` + `GET /leads` client-side | Needs all owners → admin/mgmt only. |
| Deals at Oral Confirmation table | leads where `stage = NegotiationOralConfirmation` | `GET /leads?stage=NegotiationOralConfirmation` | |
| Top open projections (sales view) | open projection lines sorted by value | `GET /projections?period&lineFilter=projected` | client sort/slice(10). |
| Principal performance bars | committed/achieved by principalId | aggregate `GET /projections` client-side | |
| Customer category mix | committed/achieved by customer `category` | aggregate `GET /projections` (has `tier`) client-side | ProjectionLine already carries `tier`. |
| Quick actions (New Lead / Add Customer / Create Order) | — | open modals → POST endpoints | |

- **Field diffs:** `Projection.projectedQty→committedQty`, `month→period`, `Lead.name→customerName`, `products[].value→totalValue`, `ownerId→salespersonId`. Dashboard's `custMap/prodMap/userMap` joins become unnecessary (names denormalized).
- **Mutations:** via modals — `POST /leads`, `POST /customers`, `POST /orders`, and follow-up save → `PATCH /projections/:id` (nextFollowUp/probability/status) + a remark (no remark endpoint — see GAP).
- **Client-only:** month/principal/ownerFilter selectors, chart rendering, modal open state.
- **GAP:** all dashboard analytics are client-aggregated from list endpoints. Decision: **aggregate client-side (v1)** vs **add `GET /reports/*` (report.view perm already exists)**. Recommend v1 client-side; revisit if payloads get large (lists are cursor-capped at 100/page → aggregation needs full fetch or a report endpoint).

## A2. ProjectionsPage.tsx — ✅ DONE (reference)

`GET /projections?period&search&principalId&lineFilter&ownerId` → `{lines, summary}`; inline edits `PATCH /projections/:id` (achievedQty, status, price, committedQty, probability, nextFollowUp, targetDate). Uses `useAuth` (real JWT) + react-query. `ProjectionsPage.mock.tsx` is the retired mock copy. **Nothing to do** except fold its ConnectPanel into the unified auth.

## A3. LeadsPage.tsx — 🔴 not wired · full CRUD

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Search + stage chips + list/kanban | leads scoped by owner/stage/principal/search | `GET /leads?search&stage&ownerId` | `stage` needs label→enum. principal filter has no API param → client-filter on `products[].principalId`. |
| List columns: Customer, Contact, Mobile, Industry, Status(tier), Deal stage, Value, Next FU, Exp closure, Salesperson, Remarks | LeadRow | same | |
| Kanban (drag between stages) | leads grouped by stage | list + `PATCH /leads/:id {stage}` | |
| Add Lead modal | create | `POST /leads` | body needs `customerName`, `salespersonId`, `products[]`. |
| Lead detail / remarks | LeadRow | `PATCH /leads/:id` | remarks have **no endpoint** (see GAP). |

- **Field diffs:** `name→customerName`, `industry→industryName`(+`industryId`), `tier`=`tier` (matches!), `products[].value` sum → `totalValue`, `ownerId→salespersonId`, `stage` label→enum. `LeadRow` adds `leadStatus` (Platinum/Gold/Silver/**Bronze**) — a separate axis the web mock lacks; also `whatsapp`, `sameAsMobile`, `expClose`, `stageUpdatedAt`, `nextFollowUp`.
- **Mutations:** `POST /leads`, `PATCH /leads/:id` (stage change + scalar edits), `DELETE /leads/:id`. Stage move on kanban = `PATCH {stage}`. Note `LeadUpdate` omits `products` (scalar-only patch) — product-line edits not supported by PATCH.
- **Client-only:** view mode (list/kanban), stage filter chip, drag-drop mechanics, search box.

## A4. OrdersPage.tsx — 🔴 not wired · CRUD + status transitions

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Orders list (SO no, customer, product SKU, qty, value, salesperson, issued, status) | OrderRow + items | `GET /orders?search&status&ownerId` | qty/value = sum of `items[]`; API also gives `total`. `status` label→enum. |
| Status filter chips | by status | `GET /orders?status=` | |
| Create SO modal | create | `POST /orders` | body: `code`, `customerId`, `salespersonId`, `items[]` (min 1). `total` server-derived. |
| SO detail (view/edit + advance status) | OrderRow + statusHistory | `PATCH /orders/:id {status,statusNote}` | Cancel → `{status:Cancelled, cancelReason}`. |
| Fulfilment SLA report tab | per-order timing from statusHistory | `GET /orders` (client-computes durations) | No report endpoint; durations derived from `statusHistory[].at`. |
| Invoice print modal | OrderRow | client-only render | |

- **Field diffs:** `ownerId→salespersonId`, `lines→items` (`OrderLine.qty/price` → `OrderItemRow.qty/price/lineTotal`), `history→statusHistory` (`timestamp→at`, `by→changedByName`, statuses label→enum), `customerName` denormalized (drop lookup), `code` present both. `createdAt` present. Web computes `total` from lines → use API `total`.
- **Mutations:** `POST /orders`, `PATCH /orders/:id` (status transition appends history; Cancelled stamps `cancelReason`/`cancelledAt`), `DELETE /orders/:id`. **No `code` generator on client** — web currently mints `SO/26-27/NNNN`; API requires `code` in body → decide who generates (see GAP).
- **Client-only:** list/report tab, status chips, search, SLA duration math, invoice print.

## A5. PaymentsPage.tsx — 🔴 not wired · CRUD + inline edits

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| 4 KPI cards (total pending, red zone, 90+, FU due) | payments scoped | `GET /payments?ownerId` | client-aggregated. |
| Invoices table | PaymentRow | `GET /payments?search&status&customerId&ownerId` | zone filter → client or `status`? Note API filter is `status` (PaymentStatus), zone is `payZone` — **no zone query param** → client-filter. |
| Inline salesperson `<select>` | reassign | `PATCH /payments/:id {salespersonId}` | |
| Inline zone `<select>` | zone change | `PATCH /payments/:id {payZone}` | label→enum. |
| Inline delay reason / next FU / mail chips | edits | `PATCH /payments/:id` | mail1..4 booleans. |
| Add Invoice / Import Tally Excel | create / bulk | `POST /payments` (loop for import) | admin only. No bulk endpoint. |
| Aging matrix reports tab | zone/salesperson/org aggregates | `GET /payments` client-aggregated | uses server `agingDays`. |
| WhatsApp remind | external `wa.me` link | client-only | |
| Delete | remove | `DELETE /payments/:id` | admin only. |

- **Field diffs:** `ownerId→salespersonId`, `zone→payZone` (label→enum), `invoiceDate` matches, `pending`/`received`/`amount` match, `delayReason` matches, `agingDays` now server-provided, PaymentRow adds `status` (PaymentStatus, server-derived) + `followups[]` + `payZone` nullable + `refNo` nullable. Web `customerName` may be free-text (manual) — API allows `customerId` null + `customerName`.
- **Mutations:** `POST /payments`, `PATCH /payments/:id`, `DELETE /payments/:id`. Import = N× POST (no batch). WhatsApp = client `window.open`.
- **Client-only:** list/report tab, zone chip, search, aging buckets, WhatsApp compose.

## A6. FollowUpsPage.tsx — 🔴 not wired · ⚠ architecture mismatch

The web page **synthesizes** the agenda from `projections + leads + payments` client-side (not from a FollowUp table). Two sections:

| UI section | Current source | Real-API options |
|---|---|---|
| "All Follow-Ups by Date" (Recurring+New Sales+Payments) | derived: projections.nextFollowUp + leads.nextFollowUp + payments.nextFollowUp | **Option 1:** keep deriving from `GET /projections` + `/leads` + `/payments` (filter `nextFollowUp` set). **Option 2:** read `GET /followups` (real persisted table). |
| "Recurring follow-up queue" | projections for month | `GET /projections?period&lineFilter=due` |
| Log follow-up modal | writes projection nextFollowUp + remark | `PATCH /projections/:id {nextFollowUp,probability,status}` (+ remark: no endpoint) |

- **⚠ Key decision:** the API has a first-class `/followups` CRUD (`entityType`, `entityId`, `salespersonId`, `dueDate`, `done`, `note`, `amount`, `title`, `subtitle`) that **neither frontend uses**. Web derives; mobile seeds a mock array. Pick a model: (a) derive agenda from entity `nextFollowUp` fields (matches current UX, no dedicated table writes), or (b) adopt `/followups` as the system of record and write follow-ups there. Recommend **(a) for parity now**, migrate to `/followups` later.
- **Field diffs (if adopting /followups):** `kind→entityType` (cap enum), `targetId→entityId`, `ownerId→salespersonId`, plus `done`/`note`.
- **Mutations:** projection follow-up save → `PATCH /projections/:id`. If adopting followups table: `POST/PATCH/DELETE /followups` (`PATCH {done:true}` to complete).

## A7. CustomersPage.tsx — 🔴 not wired · CRUD

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Search + count + list | customers scoped | `GET /customers?search&ownerId&category&active` | tier filter (client sort by rank) → `category`. |
| Columns: Customer, Contact, Mobile/WhatsApp, Category, Payment terms, Salesperson, SKUs mapped | CustomerRow | same | "SKUs mapped" = count of projection lines per customer → derive from `GET /projections` or add count (GAP). |
| Add / Edit customer modals | create/update | `POST /customers`, `PATCH /customers/:id` | |
| 360 drawer (CustomerDrawer) | customer + its orders/payments/projections | `GET /customers/:id`? (no single-get) + `GET /orders?customerId` + `GET /payments?customerId` + `GET /projections` | ⚠ no `GET /customers/:id` — use row from list or add endpoint. |
| Delete | remove + cascade mappings | `DELETE /customers/:id` | admin only. |

- **Field diffs:** `tier→category` (⚠), `ownerId→salespersonId`, `industry(string)→industryName`(+`industryId`), `phone/mobile/whatsapp` → `primaryContactPhone`/`whatsapp` (CustomerRow has `primaryContactName`/`primaryContactPhone`, no separate mobile/whatsapp split — reconcile), `paymentTerms` label→enum, `payZone` label→enum, `outstanding` matches (server number), `collectorId`/`collectorName` present in API (web has `collectorId`). `type` (Existing/New) matches.
- **Mutations:** `POST /customers` (needs `salespersonId`), `PATCH /customers/:id`, `DELETE /customers/:id`. "SKUs mapped" count has no direct source.
- **Client-only:** search, tier-rank sort, drawer open state.
- **GAP:** no single-customer GET; the 360 drawer must compose from list rows + filtered child lists. "Product mappings" (customer×product) have no dedicated endpoint — currently modeled as projection lines.

## A8. ProductsPage.tsx — 🟡 partial (products yes, principals no)

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Principal master card (chips + counts) | principals + product counts | ❌ no `/principals` endpoint | Derive principals from `GET /products` (`principalId`/`principalName`), like ProjectionsPage derives them. |
| Add principal | create principal | ❌ none | No principal CRUD → AddPrincipalModal has no backend. |
| Sub-products table (Principal, Sub product, Default price, Customers mapped) | ProductRow | `GET /products?search&principalId&active` | read = `order.read`. |
| Inline price edit | update basePrice | `PATCH /products/:id {basePrice}` | write = `user.manage` (**admin only**). |
| Add product | create | `POST /products` | needs `principalId`. |

- **Field diffs:** `listPrice→basePrice`, `principalName` denormalized (matches), `sku`/`division`/`unit`/`active` match. "Customers mapped" count = projection lines per product → derive from `GET /projections` (GAP: no count field).
- **Mutations:** `POST /products`, `PATCH /products/:id`, `DELETE /products/:id`. **No principal create/read/update.**
- **GAP:** Principals aren't a queryable resource — only surfaced denormalized on products/projections. Either (a) derive the principal list client-side from products, dropping "Add Principal", or (b) add a `/principals` endpoint. Recommend (a) for now.
- **RBAC note:** mgmt has neither `order.read` nor `user.manage` for products in the seed → Products nav is hidden for mgmt already (`NAVS.mgmt` omits products). Fine.

## A9. UsersPage.tsx — 🔴 not wired · admin-only CRUD

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| User table (Name, Username, Role, Customers, Status) | UserRow | `GET /users?search&roleId&active` | perm `user.manage` (admin). "Customers" count = customers per owner → derive from `GET /customers` or add count. |
| Add / Edit user | create/update | `POST /users`, `PATCH /users/:id` | password plaintext inbound, hashed server-side. |
| Activate/Deactivate | toggle active | `PATCH /users/:id {active}` | |
| Assign customers (reassign) | bulk reassign owner | ❌ no bulk endpoint → N× `PATCH /customers/:id {salespersonId}` | web `reassignCustomers` also repoints projections/leads — API PATCH is per-record. |
| Role permissions matrix card | static reference | client-only (or `packages/shared/rbac.ts`) | pure display. |

- **Field diffs:** `role`(slug)→`roleId`(+`roleName`), `lastLogin→lastLoginAt`, UserRow adds `managerId/Name`, `teamId/Name`. Web `password` write-only matches (`UserCreate.password` min 8).
- **Mutations:** `POST /users`, `PATCH /users/:id`, `DELETE /users/:id`. Reassign = loop of customer PATCHes.
- **GAP:** no bulk reassign; no `role.manage` UI (roles are seeded). "Customers per user" count derived.

## A10. DataPage.tsx — 🟢 mostly client-only (governance/dev)

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Dataset stat cards (counts) | list counts | could use list `nextCursor`/length | Currently counts local arrays. Real counts need a count field or full fetch → low priority; leave client/dev-only. |
| Role/persona switcher | local | client-only (mock) | This is a **mock-role simulator**; disappears once real auth drives role. |
| Period lock toggle | local flag | ❌ no endpoint | No period-lock in API → stays local or future feature. |
| Reset/Clear demo data | zustand reset | client-only | Dev tooling on the mock store; **N/A for real API** (would be dangerous). |

- **Verdict:** Data page is dev/demo scaffolding around the mock store. When wiring real API, most of it becomes obsolete (role from JWT, no local DB to reset). Keep counts as a thin `/health`-style dashboard at most. **Wire last / retire.**

---

# PART B — MOBILE (`apps/mobile/src/app/(app)/`)

Mobile audience = **`sales` role only** (owner = "Sankar Prasad"). API auto-scopes every list to the caller → `ownerId`/`salespersonId` filters are **implicit** (don't send `ownerId`). Store = `gs/store.ts` (in-memory `useSyncExternalStore`, seeded from `gs/mock.ts`). **Prerequisite:** mobile has **no api/auth/query layer at all** (see GAP B-0).

## B0. app/index.tsx (Login) — 🔴 mock (router.replace)

- Hardcoded workspace "Acme Industrials", `sankar@acme.test`. Button just `router.replace('/(app)')`.
- **Wire:** `POST /auth/login {tenantId,email,password}` → persist JWT in AsyncStorage → attach bearer. Mirror web `store/auth.ts`. `role` will be `sales`.
- **GAP B-0 (prerequisite):** install + build a mobile `lib/api` (typed fetch + bearer), an auth store (AsyncStorage-persisted), and `@tanstack/react-query` (none installed — only AsyncStorage present). This blocks ALL mobile wiring.

## B1. (app)/index.tsx (Dashboard) — 🔴 read aggregation

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Zone3 KPI strip (Achieved/Target/Receivables/Follow-ups) | projections+leads+payments+followups | `GET /projections?period` + `/leads` + `/payments` | client-aggregated (same as web dashboard). |
| Target achievement hero (recurring/new/pipeline) | projections+leads | same | `weightedPipeline = Σ committedQty*price*prob/100` client math. |
| Quick action bar | nav | client-only | |
| Deals at Oral Confirmation (horizontal cards) | `stage=NegotiationOralConfirmation` | `GET /leads?stage=NegotiationOralConfirmation` | |
| Top open projections | open lines by value | `GET /projections?period&lineFilter=projected` | |
| Follow-ups feed (first 4) | followups | derive from entity `nextFollowUp` OR `GET /followups` | same decision as web A6. |

- **Field diffs:** `projectedQty→committedQty`, `principal→principalName`, `product→productName`, `Lead.value→totalValue`, `Lead.name→customerName`, MonthBar local year/month → `period` string.
- **Client-only:** MonthBar state, refresh spinner, hero styling.

## B2. (app)/projections.tsx — 🔴 CRUD + follow-up log + create order

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| KPI strip (Committed/Achieved/Achievement/Needs FU) | projections | `GET /projections?period` | client-aggregated. |
| Brand chips (PRINCIPALS const) | principal filter | `GET /projections?principalId=` | ⚠ mobile filters on `p.principal` **string equality** vs a hardcoded PRINCIPALS list → must switch to `principalId` from data. |
| Filter chips (all/projected/unprojected/followup) | line filter | `GET /projections?lineFilter=` | maps to `all/projected/blank/due`. mobile "unprojected"=`blank`, "followup"=`due`. |
| Search | search | `?search=` | |
| Line list (customer, principal·product, qty/ach/rate/value, confidence, next FU) | ProjectionLine | same | |
| Line detail: edit product/price/expClose | update | `PATCH /projections/:id {price,targetDate}` | ⚠ `product`/`principal` are **free-text strings** in mobile; API keys off `productId`/`principalId` — the API PATCH has **no product/principal fields** (projection line's product is fixed). Editing product name is not an API op → drop or model as new line. |
| Edit qty + status | update | `PATCH /projections/:id {committedQty,achievedQty,status}` | status label→enum. |
| Log follow-up (mode/prob/next/notes) | append log | `PATCH /projections/:id {probability,nextFollowUp}` | ⚠ `mode`/`notes`/log history have **no API field** — projection has no follow-up log table (only `nextFollowUp`). Remarks/logs = GAP. |
| Remarks | append | ❌ no endpoint | GAP (no projection remark endpoint). |
| Map product to customer (modal) | create line | ❌ no direct endpoint | "Add customer×product mapping" → creates a projection line locally; API has no "create projection line" POST (projections are generated, not POSTed). GAP. |
| Create Sales Order (from confirmed line) | create order | `POST /orders` | needs `customerId`+`items[]` with `productId` — mobile line lacks IDs (free-text). Blocker until IDs flow through. |

- **Field diffs:** `projectedQty→committedQty`, `principal→principalName`, `product→productName`, plus API-only `projValue/achValue/achPct/salespersonName/tier/contactName/salesOrderId/salesOrderStatus`.
- **⚠ Structural gap:** mobile treats principal/product as editable free-text; API treats them as FK refs with denormalized names. Mobile "Map product", "Change product", follow-up logs, and remarks have **no backing endpoints**. Projections API supports only **cell edits** on existing lines (price/qty/status/probability/dates).

## B3. (app)/leads.tsx — 🔴 CRUD

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| Pipeline KPI strip | leads | `GET /leads` | client-aggregated. |
| Search + list/kanban + stage chips | leads | `GET /leads?search&stage` | stage label→enum. |
| Lead card (name, contact·area, industry·sub, tier, stage, value, days-in-stage) | LeadRow | same | `value→totalValue`, `name→customerName`. |
| Kanban move | stage change | `PATCH /leads/:id {stage}` | |
| Add lead form (multi-product rows, industry cascade, WhatsApp toggle) | create | `POST /leads` | body: `customerName`, `salespersonId`(implicit/caller), `products[]`, `stage`, `tier`, industry, area, contact, phone, whatsapp, sameAsMobile. |
| Lead detail: move stage / dates / remarks | update | `PATCH /leads/:id {stage,nextFollowUp,expClose}` | remarks: ❌ no endpoint (GAP). |

- **Field diffs:** `name→customerName`, `value→totalValue`(+`products[]`), `industry→industryName`, `stage` label→enum, `stageUpdatedAt` server-provided. LeadRow adds `leadStatus`, `division`, `type`, `whatsapp`, `sameAsMobile`.
- **Mutations:** `POST /leads`, `PATCH /leads/:id`, (`DELETE` unused on mobile). Remarks unsupported.

## B4. (app)/orders.tsx — 🔴 read + status advance + cancel

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| KPI strip (Total/In-transit/Urgent/Completed) | orders | `GET /orders` | client-aggregated. |
| Search + status chips + list | orders | `GET /orders?search&status` | status label→enum. |
| Order card (code, customer, product, value, 6-step progress, mode·ETA) | OrderRow + items | same | `value→total`, `productName` = first of `items[]`. |
| Order detail timeline | statusHistory | `GET /orders/:id`? none → use row | `timeline→statusHistory`. |
| Advance to next status (+partner) | transition | `PATCH /orders/:id {status,statusNote}` | mobile auto-advances via SO_FLOW; API takes explicit `status`. partner→`transporterName`? (API field is `transporterName`, not "partner"). |
| Cancel order (+reason) | cancel | `PATCH /orders/:id {status:Cancelled,cancelReason}` | |
| SLA report tab (fulfilment by status) | orders | `GET /orders` client-aggregated | |

- **Field diffs:** `value→total`, `shipTo→deliveryAddress`, `productName`(single)→`items[]`, `timeline(label/at/by)→statusHistory(status/at/changedByName/note)`, `partner→transporterName`, statuses label→enum. `createdBy→createdById`.
- **Mutations:** `PATCH /orders/:id` (advance/cancel). `POST /orders` reached from projections line. `deliveryMode` label→enum.

## B5. (app)/payments.tsx — 🔴 CRUD + inline edits

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| KPI strip (Outstanding/Red/Over90/FU due) | payments | `GET /payments` | client-aggregated; over90 uses `agingDays`. |
| Search + zone chips + list | payments | `GET /payments?search&status&customerId` | ⚠ zone filter → client (no `payZone` query param; API filter is `status`). |
| Pay card (party, ref, aging, opening, pending, reason, mail chips, next FU) | PaymentRow | same | `zone→payZone`, `reason→delayReason`, `date→invoiceDate`, `opening`≈`amount`. |
| Toggle mail1..4 | update | `PATCH /payments/:id {mail1:true,...}` | ⚠ mobile stores `'Yes'/'No'` strings + `mails` count → convert to booleans. |
| Detail: zone / reason / next FU / remarks | update | `PATCH /payments/:id {payZone,delayReason,nextFollowUp}` | remarks: ❌ no endpoint (API `followups[]` exist on row but no write path shown for payment-followup). |
| Add invoice form | create | `POST /payments` | `amount` required; `customerName` free-text ok. |
| Aging report tab (zone / bucket bars / party ranking) | payments | `GET /payments` client-aggregated | |

- **Field diffs:** `zone→payZone`(label→enum), `reason→delayReason`, `date→invoiceDate`, `mail1..4` string→bool, `opening` no API field (use `amount`), `received` matches, `agingDays` server-provided, PaymentRow adds server `status` (PaymentStatus) + `followups[]` + `salespersonName`.
- **Mutations:** `POST /payments`, `PATCH /payments/:id`. No bulk import on mobile.

## B6. (app)/customers.tsx — 🔴 CRUD + mappings

| UI section | Data needed | Endpoint(s) | Notes |
|---|---|---|---|
| KPI strip (Total/Platinum/Gold/Receivables) | customers + payments | `GET /customers` + `/payments` | receivables from payments pending. |
| Search + tier chips + list | customers | `GET /customers?search&category` | tier→`category`. |
| Cust card (name, area·industry, tier, payZone, outstanding, Call/WhatsApp, terms) | CustomerRow | same | Call/WhatsApp = `Linking` (client). `outstanding` server number. |
| 360 detail (contact, terms, industry, mapped products) | CustomerRow + mappings | `GET /customers` row + `GET /projections` | "mapped products" = projection lines; mobile seeds `mappings[]` locally (GAP). |
| Add mapping (principal/product/price) | create line | ❌ no endpoint | Same as B2 "Map product" gap — no projection-line POST. |
| Add customer form (mappings, WhatsApp toggle, pay terms) | create | `POST /customers` | `salespersonId` = caller. `paymentTerms`/`payZone`/`category` label→enum. `mappings` have nowhere to persist. |

- **Field diffs:** `tier→category`(⚠), `payZone` label→enum, `paymentTerms` label→enum, `industry→industryName`, `whatsapp`/`sameAsMobile` map to CustomerRow fields (note CustomerRow has `primaryContactPhone`, not `phone`/`mobile`/`whatsapp` triple — reconcile). `outstanding` server-computed.
- **Mutations:** `POST /customers`, `PATCH /customers/:id`. Product mappings unsupported by API.

## B7. (app)/followups.tsx — 🔴 ⚠ mock-array only

- Reads `store.followups` (seeded mock `FollowUp[]`), groups overdue/today/upcoming. Actions: **Done** (`markFollowUpDone` = removes), **Snooze +N days** (`snoozeFollowUp`), Open module.
- **This is the one screen that maps 1:1 to the real `/followups` CRUD** (`entityType`, `entityId`, `salespersonId`, `dueDate`, `done`, `amount`, `title`, `subtitle`):
  - list: `GET /followups?done=false&ownerId`(implicit) 
  - Done: `PATCH /followups/:id {done:true}`
  - Snooze: `PATCH /followups/:id {dueDate:<+N>}`
  - add: `POST /followups`
- **Field diffs:** `kind→entityType`(cap), `targetId→entityId`, no `done` in mobile type (Done just deletes) → adopt `done`.
- **Decision (mirrors A6):** if the app derives follow-ups from entity `nextFollowUp` fields elsewhere, this screen still can be the `/followups` reader — but then something must **write** follow-ups into `/followups`. Recommend: adopt `/followups` as the follow-up system-of-record on mobile (this screen is the natural home), and have projection/lead/payment "set next follow-up" also `POST /followups`.

## B8. (app)/more.tsx & profile.tsx — 🟡 mostly local

- **more.tsx:** KPI strip + scorecard + nav links, all client-aggregated from lists (`GET /orders`,`/payments`,`/customers`,`/leads`,`/projections`,`/followups`). Sign-out → `router.replace('/')` should also clear the auth store. No new endpoints.
- **profile.tsx:** static `ME` + `kpis()` from mock. Wire to `GET /auth/me` for name/email/role; achievement KPIs from `GET /projections`+`/leads`. Region/division/email currently hardcoded → from `user` claims (limited fields; `AuthUser` has name/email/username/role, no region/division → those stay static or need a profile endpoint).

---

# PART C — SHARED GAP LIST

### C1. No reports/aggregation endpoint
Every dashboard, KPI strip, SLA report, and aging matrix (web A1/A4/A5, mobile B1/B4/B5) is **client-aggregated** from list endpoints. `report.view` permission exists but no `/reports` controller. Lists are cursor-capped (≤100/page) so true aggregates need either full pagination sweeps or a new endpoint. **Decision per screen:** v1 = client-aggregate (fetch enough pages); revisit a `GET /reports/*` endpoint if payloads/latency hurt. Projections is exempt (returns a `summary`).

### C2. Mobile has NO API/auth/query layer (prerequisite, blocks all of Part B)
`apps/mobile` deps: only `AsyncStorage` — no `@tanstack/react-query`, no axios/fetch wrapper, no auth store. **Prerequisite work:** add `lib/api.ts` (typed fetch + bearer, mirror web), an AsyncStorage-persisted auth store, install `@tanstack/react-query` + provider. Until then mobile screens can't wire.

### C3. Two disconnected auth systems on web
`store/ui.ts` (mock `login(role)`, drives LoginPage + every non-projections page) vs `store/auth.ts` (real JWT, drives ProjectionsPage). LoginPage never calls the API. **Unify** (see `docs/superpowers/specs/2026-08-19-projections-auth-unify-design.md`): real login populates role/user; delete mock auth; derive `role` from `user.role`. Mobile login is likewise mock.

### C4. tenantId resolution
Login needs `tenantId` (e.g. `tenant_acme`), but web LoginPage collects a **workspace slug** ("greatsales") and mobile hardcodes "Acme Industrials". No slug→tenantId resolver. Short-term: send tenantId directly (as ProjectionsPage does). Long-term: resolve from subdomain/slug.

### C5. No remark / follow-up-log endpoints
Web (leads, payments, projections FollowUp modal) and mobile (projection follow-up logs + remarks, lead remarks, payment remarks) all write **remarks / contact-mode logs** that have **no API endpoint**. Projection has only `nextFollowUp` (no log table); Lead/Payment have no remark table exposed. **Decision:** drop remark UI for v1, or add remark/activity endpoints. Payment row exposes `followups[]` (read) but no documented write path.

### C6. No projection-line create ("map product to customer")
Mobile "Map product" (B2/B6) and web AddCustomer initial-products create **projection lines** locally. The projections API only supports **cell edits** (`PATCH /projections/:id`) — no `POST /projections`. Projection lines appear server-generated from customer×product mappings. **Decision:** need a "customer product mapping" or "create projection line" endpoint, or drop client-side line creation.

### C7. No principals endpoint
Principals are only denormalized on products/projections (`principalId`/`principalName`). No `/principals` CRUD → web "Add Principal" (A8) and mobile brand lists (hardcoded `PRINCIPALS`) have no source of truth. **Decision:** derive principal list from `GET /products` (recommended v1), or add `/principals`.

### C8. Free-text vs FK ID structural mismatch (mobile-heavy)
Mobile domain stores `principal`/`product` (projections), `industry`, brand as **free-text strings**; the API keys on `productId`/`principalId`/`industryId`. Denormalized names come back on reads (fine), but **creates/edits** that pick these need ID pickers, not text. Especially blocks mobile "Create Sales Order from a projection line" (needs `productId`/`customerId` the line doesn't carry). Web mock keeps IDs already (easier).

### C9. Order `code` generation
Web mints `SO/26-27/NNNN`, mobile mints `SO-NNNN`; API `OrderCreate` **requires** `code`. Decide client-generates (keep) vs server-generates (would need contract change). For now client must supply a code.

### C10. No bulk endpoints
Payments Tally import (web A5) = N× `POST /payments`; Reassign customers (web A9) = N× `PATCH /customers/:id`. No batch routes. Acceptable v1 (sequential), note for scale.

### C11. No single-resource GET
No `GET /customers/:id` (or orders/leads/:id). Customer 360 drawer (web A7, mobile B6) and detail sheets must reuse the list row + filtered child lists (`?customerId=`). Acceptable, but detail views can't deep-link/refresh a single record.

### C12. Field-shape reconciliations (contact info)
`CustomerRow` exposes `primaryContactName`/`primaryContactPhone` + `whatsapp` isn't on CustomerRow at all — but web/mobile UIs show contact + mobile + WhatsApp. Confirm the customer contact model (single primary contact vs the mock's `phone`/`mobile`/`whatsapp`/`sameAsMobile`). Same for Lead (`LeadRow` has `phone`/`whatsapp`/`sameAsMobile` — OK) vs Customer (leaner). Likely needs a customer-contacts shape decision before Add/Edit Customer wiring.

### C13. Pagination adoption
API lists → `{items, nextCursor}`; both frontends currently hold flat arrays and filter in-memory. Wiring needs infinite-query / "load more" (react-query `useInfiniteQuery`) or explicit paging. Projections returns full `{lines,summary}` (no cursor).

### C14. Offline-first / PowerSync
PLANNED, NOT installed. This pass maps **online direct-API only**. Offline sync is **separate future work** — do not design here.

### C15. Period-lock, role-simulator, data reset (web Data page)
No API support; these are mock-store/dev features (A10). Retire or keep client-only when real API lands.

---

# PART D — RECOMMENDED WIRING ORDER

Ordering = lowest-risk / highest-reuse first. Each surface shares local wire-types where the row shape is identical (web `features/<x>/types.ts` ⇄ mobile `gs/domain.ts`).

### D1. Cross-cutting prerequisites (do first, unblock everything)
1. **Web auth unify** (C3/C4) — one real auth store; LoginPage → `POST /auth/login`; delete mock `useUi` auth; role from `user`.
2. **Enum label⇄value maps** (shared util, copied web+mobile): ProjStatus (exists), DealStage, OrderStatus, PayZone, PaymentTerms, DeliveryMode, CustomerCategory.
3. **Mobile foundation** (C2) — `lib/api` + AsyncStorage auth store + react-query provider + mobile login → `POST /auth/login`.

### D2. WEB order (admin/mgmt)
| # | Screen | Type | Why here |
|---|---|---|---|
| 0 | Projections | ✅ done | reference |
| 1 | **Customers** | full CRUD | master data, feeds everything; simple row; needs `tier→category`. |
| 2 | **Products** | read + price edit + create | simple; principals derived (C7). read-only for mgmt. |
| 3 | **Leads** | full CRUD | high-value pipeline; kanban `PATCH {stage}`. |
| 4 | **Orders** | read + transitions | depends on customers/products for create; SLA report client-side. |
| 5 | **Payments** | CRUD + inline | receivables; zone client-filter; import = N×POST. |
| 6 | **Dashboard** | read aggregation | after its feeders (projections/leads/customers) are live. |
| 7 | **FollowUps** | derive or /followups | after projections/leads/payments; pick model (A6). |
| 8 | **Users** | admin CRUD | narrower audience; reassign = loop. |
| 9 | **Data** | retire/thin | mostly obsolete under real auth. |

### D3. MOBILE order (sales) — after D1.3
| # | Screen | Type | Why here |
|---|---|---|---|
| 1 | **Login → Dashboard(index)** | auth + read | proves the new mobile stack end-to-end; read-only. |
| 2 | **Customers** | CRUD | master data; Call/WhatsApp stay client (`Linking`). |
| 3 | **Leads** | CRUD | pipeline; kanban `PATCH {stage}`. |
| 4 | **Projections** | cell-edit only | wire edits (`committedQty/achievedQty/status/probability/nextFollowUp`); **defer** map-product/log/remark (C5/C6). |
| 5 | **Orders** | read + advance/cancel | create-from-projection blocked on IDs (C8) → defer create. |
| 6 | **Payments** | CRUD + inline | mail bool conversion; zone client-filter. |
| 7 | **FollowUps** | `/followups` CRUD | natural home for the real follow-up table (B7). |
| 8 | **More / Profile** | thin read | `GET /auth/me`; aggregates from lists. |

### D4. Shared wire-type reuse (write once, copy to both surfaces)
`CustomerRow`, `LeadRow`, `OrderRow`(+items/history), `PaymentRow`, `ProjectionLine` (mobile can reuse the web projections types), `FollowUpRow`. Keep each as a **local** copy (web `features/<x>/types.ts`, mobile `gs/domain.ts`) synced to `packages/shared/src/*.ts`. Enum maps shared identically.

### D5. Explicitly deferred (not this pass)
Offline/PowerSync (C14), reports endpoint (C1 — client-aggregate first), remark/activity endpoints (C5), projection-line create & principals endpoints (C6/C7), bulk routes (C10), period-lock (C15).

---

## Read-only vs full-CRUD quick index

| Screen | Web | Mobile |
|---|---|---|
| Dashboard/index | read (aggregate) | read (aggregate) |
| Projections | full cell-edit ✅ | cell-edit (create deferred) |
| Leads | full CRUD | CRUD (no delete) |
| Orders | CRUD + transitions | read + advance/cancel (create deferred) |
| Payments | CRUD + inline | CRUD + inline |
| Customers | CRUD | CRUD (mappings deferred) |
| FollowUps | read/derive (or /followups) | /followups CRUD |
| Products | read + price/create | n/a |
| Users | admin CRUD | n/a |
| More/Profile | n/a | read |
| Data | retire | n/a |
