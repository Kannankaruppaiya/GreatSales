# N. Per-Feature Slice Matrix — Production Checklist

> **F1–F17 from docs/FEATURE-ROADMAP.md**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 170

**Gate:** A rollup. A slice is DONE only when every layer column is ticked.

**Rolls up:** all layers. **Source of truth for order:** [docs/FEATURE-ROADMAP.md](../docs/FEATURE-ROADMAP.md).

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

Per `docs/FEATURE-ROADMAP.md`. A slice is **Done** only when every column is `[x]` — schema,
API, authorization, web, mobile (if in scope), tests, performance measured, observability,
verification run, docs updated, and zero fake completion.

| Slice | Schema | API | AuthZ | Web | Mobile | Tests | Perf | Obs | Docs | **DONE** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F1 Sign-in & session | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[~]` | `[ ]` |
| F2 App shell & navigation | `[ ]` | `[ ]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F3 Customers | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F4 Product catalog | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F5 Customer↔product mapping | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F6 Projections worksheet | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F7 Leads & pipeline | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F8 Orders & fulfilment | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F9 Payments & collections | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F10 Follow-up inbox | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F11 Dashboard | `[ ]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F12 Users, roles & teams | `[~]` | `[~]` | `[~]` | `[~]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[~]` | `[ ]` |
| F13 Notifications & search | `[~]` | `[ ]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F14 Tenancy & mgmt switcher | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F15 Import, export, attachments | `[~]` | `[ ]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F16 Audit & lifecycle | `[~]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[~]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| F17 Deploy, migrate & recover | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[~]` | `[ ]` |

## Baseline sweep — read from the code on 2026-08-25

Every `[~]` above means **an implementation exists in the repo and nobody has proven it against a
production build.** It is not progress. `[ ]` means nothing is there at all.

**How the sweep was done:** every `@Controller` in `apps/api/src` was listed, every
`features/*/queries.ts` in `apps/web/src` was checked for `apiFetch`, every consumer of the
mock `trackerStore` was traced, and the test files were counted. No repo-root audit report was
used.

### Per-slice findings

| Slice | Finding |
| --- | --- |
| F1 | 5 auth endpoints, `RefreshToken` model, `20260823054257_auth_session_hardening` migration, server logout, change-password, throttler, 4 role portals. **Still open:** forgot-password self-serve, session list/revoke UI, MFA, and the F1 **tenant-identification decision (D9)** — see the roadmap. |
| F2 | Routes, layout, `RoleGuard`, `RequireOwner`, 4 nav/route test files. No schema or API of its own. |
| F3 | 4 endpoints, page + 4 modals, real queries, tests. **Missing:** `CustomerContact` and `Industry` sub-resources ([C.3.16](03-API.md), [C.3.12](03-API.md)). |
| F4 | `products` + `principals` = 8 endpoints, page, tests. **Missing: price history** — the schema has a single `price` column on `Product`, no history table. The roadmap asks for price history. |
| F5 | **BUILT 2026-08-25.** Four endpoints plus a mapping screen; 15 service tests on real Postgres. Verified end to end against the live Promech data: create returned 201, the row persisted, and the page's own delete soft-deleted it. `effectivePrice` is resolved server-side. Verification also caught a defect worth naming: the customer/product pickers stopped at the first page of 50, leaving 88% of a 417-customer book unreachable — fixed, and flagged in code as a stopgap until a server-searched typeahead exists ([C.3.4](03-API.md)). **Not `[x]`:** no production-build verification yet. |
| F6 | `GET` and `PATCH` only. **Missing:** create/delete if the worksheet needs them ([C.2.proj.1](03-API.md)), and the `SalesTarget` API ([C.3.10](03-API.md)). |
| F7 | 4 endpoints, table **and** kanban view, tests. **Missing:** `LeadProduct` / `LeadActivity` sub-resources ([C.3.17](03-API.md)). |
| F8 | 4 endpoints, `order-engine.spec.ts`, page + 4 modals. **Missing:** `OrderStatusHistory` read API. The 7-step state machine still needs the server-side transition validation in [C.2.orders.1](03-API.md). |
| F9 | 4 endpoints, `payment-engine.spec.ts`, page + 4 modals, 4 web test files. **Missing:** `PaymentFollowup` sub-resource ([C.3.18](03-API.md)). |
| F10 | 4 endpoints, page, modal, tests. The cross-entity **completeness** claim is unproven — see [C.2.fu.1](03-API.md). |
| F11 | **BUILT 2026-08-25.** `GET /dashboard` composes the projections and leads services rather than re-querying, so the recurring math stays in `projection-engine` and deal value stays in the leads row mapper. The browser fetch-all loop is gone; verified live that every figure is unchanged (₹50.5L committed, ₹8.2L achieved, 8 due / 8 overdue) with one request and no `/leads` calls. Due/overdue now resolves against the server's day rather than a browser clock. **Known regression, recorded:** the quick-add-lead modal on this page lost its industry options, which were scraped from loaded leads — needs [C.3.12](03-API.md). |
| F12 | `users` 7 + `roles` 5 + `teams` 7 = 19 endpoints, 3-tab UI, **8 API spec files**, own migration `20260823120000_f12_users_roles_teams`. The most recently worked slice. |
| F13 | The Cmd+K palette **works**, but client-side: it searches over data already fetched by the customers/products/orders/payments/leads queries — it will not scale and it cannot find a record that is not on the current page. The nav badge counts overdue follow-ups; the `Notification` table is unused. **Missing:** server search and notifications APIs ([C.3.4](03-API.md), [C.3.3](03-API.md)). |
| F14 | 🔴 **Fake.** `features/management/managementActions.ts` implements `switchManagement()` as a **localStorage dataset swap** over the mock `trackerStore` — no API call is made. The roadmap's own wording applies: *"Switch tenant honestly, or not at all."* Web is marked `[ ]`, not `[~]`, because shipping this as-is would be a lie to the user. Tests are `[~]` only because tests exist — they test the fake. |
| F15 | `ImportPaymentsModal` parses xlsx **in the browser**. No `ImportJob` API, no attachments, no server-side export ([C.3.6](03-API.md)–[C.3.8](03-API.md)). |
| F16 | `AuditLog` model plus `apps/api/src/users/users.audit.ts` (currently **untracked in git**) write audit rows for the users slice only. **No read API** ([C.3.9](03-API.md)), so "who changed this and when" cannot be answered. |
| F17 | Two multi-stage Dockerfiles and `docker-compose.staging.yml` exist. **No CI, no CDK infrastructure, no backup/restore, no rehearsed rollback.** `DEPLOYMENT.md` describes a target topology that is not built. |

### Why the Mobile column is `[ ]` for every slice

`apps/mobile` has **no API client at all**. All 9 Expo Router screens read `src/gs/mock.ts`
through an in-memory store; there is no auth and no network layer. Until the scope decision in
[`05-MOBILE.md`](05-MOBILE.md) is made and E.1 is done, no slice can claim a mobile tick.

### Rollup

| Bucket | Count | Slices |
| --- | --- | --- |
| Built end to end (unverified) | 8 | F1, F2, F3, F7, F8, F9, F10, F12 |
| Partial | 7 | F4, F6, F11, F13, F15, F16, F17 |
| Absent or fake | 2 | **F5** (no API), **F14** (localStorage) |
| **Verified to production standard** | **0** | — |


---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
