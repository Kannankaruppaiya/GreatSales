# C. API Contract — Production Checklist

> **every endpoint, one row at a time**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 425

**Gate:** Must be green before any client layer is signed off.

**Depends on:** [A](01-DATABASE.md), [B](02-BACKEND.md). **Blocks:** [D. Web](04-FRONTEND-WEB.md), [E. Mobile](05-MOBILE.md).

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

## C.1 Cross-cutting API rules

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.1.1 | Versioning: `api/v1` prefix is real versioning — a documented policy exists for how v2 ships and how long v1 lives | `[ ]` | |
| C.1.2 | One documented error envelope, identical across every endpoint | `[ ]` | |
| C.1.3 | **Every** list endpoint is paginated with a hard server-side max page size — no endpoint can return an unbounded set | `[ ]` | |
| C.1.4 | Pagination is stable under concurrent writes (keyset/cursor, or offset with a documented caveat) | `[ ]` | |
| C.1.5 | Sorting and filtering parameters are allow-listed — no user-supplied column name reaches SQL | `[ ]` | |
| C.1.6 | Every mutating endpoint validates its body against a schema; unknown fields are rejected, not ignored | `[ ]` | |
| C.1.7 | Every `:id` path param is validated for format before it reaches the DB | `[ ]` | |
| C.1.8 | Idempotency: retryable POSTs (payments, orders) accept an idempotency key or are proven naturally idempotent | `[ ]` | |
| C.1.9 | Response shapes are explicit DTOs — no Prisma model is serialised straight to the client (leaks `passwordHash`, internal ids, soft-delete flags) | `[ ]` | |
| C.1.10 | `null` vs missing vs empty-string semantics are consistent and documented for PATCH bodies | `[ ]` | |
| C.1.11 | Swagger/OpenAPI describes every endpoint including error responses, and is generated from the same schemas that validate (no drift) | `[ ]` | |
| C.1.12 | Rate limits are per-endpoint-class and appropriate: auth tight, reads loose, writes medium. Documented per row below | `[ ]` | |
| C.1.13 | ⚠️ Throttler storage is **in-process** — the limit is per instance. With N instances the effective limit is N×. A shared store (Redis) or an instance-independent control is required before horizontal scaling | `[ ]` | |
| C.1.14 | Every endpoint's happy path, permission-denied path, not-found path, and validation-failure path are all tested | `[ ]` | |
| C.1.15 | Breaking-change policy written: what counts as breaking, how clients are notified, how mobile (which cannot be force-updated) is handled | `[ ]` | |

## C.2 Endpoint matrix

> Columns: **Auth** = requires a valid session · **RBAC** = permission checked server-side ·
> **Tenant** = tenant-scoped in the query (not only by RLS) · **Valid** = input schema-validated ·
> **Page** = paginated + capped · **Rate** = rate-limit chosen · **Audit** = writes an audit record ·
> **Tests** = allow + deny + 404 + invalid all covered.

### Health

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | n/a (public) | n/a | n/a | n/a | n/a | `[ ]` | n/a | `[ ]` |

### Auth — `apps/api/src/auth/auth.controller.ts`

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/login` | public | n/a | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| POST | `/auth/refresh` | cookie | n/a | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| POST | `/auth/logout` | `[ ]` | n/a | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| POST | `/auth/change-password` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| GET | `/auth/me` | `[ ]` | n/a | `[ ]` | n/a | n/a | `[ ]` | n/a | `[ ]` |

### Customers

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/customers` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/customers` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/customers/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/customers/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

### Leads

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/leads` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/leads` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/leads/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/leads/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

### Orders

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/orders` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/orders` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/orders/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/orders/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

Extra for orders — the 7-step lifecycle:

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.orders.1 | Every status transition is validated server-side against an explicit state machine; invalid transitions are rejected | `[ ]` | |
| C.2.orders.2 | `OrderStatusHistory` is written in the same transaction as the status change | `[ ]` | |
| C.2.orders.3 | Order totals are computed server-side from items — never trusted from the client | `[ ]` | |
| C.2.orders.4 | Concurrent status changes cannot produce two histories or skip a step | `[ ]` | |

### Payments

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/payments` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/payments` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/payments/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/payments/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

Extra for payments — money correctness:

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.pay.1 | Aging/zone (`PayZone`) is computed server-side on read, from `timestamptz`, in the tenant's business timezone — never client-side | `[ ]` | |
| C.2.pay.2 | Over-allocation is impossible: a payment cannot exceed the outstanding amount, enforced in the transaction | `[ ]` | |
| C.2.pay.3 | Rounding rules are defined once and applied identically in API, web, and any export | `[ ]` | |
| C.2.pay.4 | Deleting/editing a payment correctly reverses derived balances | `[ ]` | |

### Products & Principals

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/products` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/products` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/products/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/products/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| GET | `/principals` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/principals` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/principals/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/principals/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

### Projections

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/projections` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| PATCH | `/projections/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.proj.1 | ⚠️ No `POST` / `DELETE` for projections — confirm the worksheet genuinely never needs to create or remove a line, or add the endpoints | `[ ]` | |
| C.2.proj.2 | Month/period boundaries are computed server-side in a defined timezone; a user in another timezone sees the same month | `[ ]` | |
| C.2.proj.3 | Totals are computed and returned by the server (DoD for F6) — the client never sums | `[ ]` | |

### Follow-ups

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/followups` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/followups` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/followups/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/followups/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.fu.1 | The follow-up inbox is genuinely cross-entity and **complete** — a follow-up on any entity type appears; proven by a test that creates one of each | `[ ]` | |
| C.2.fu.2 | Overdue/due computation is server-side and timezone-correct | `[ ]` | |

### Users

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/users` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| GET | `/users/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | n/a | `[ ]` |
| POST | `/users` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/users/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| POST | `/users/:id/restore` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| POST | `/users/:id/reset-password` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/users/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.users.1 | `passwordHash` and every other credential field can never appear in any user response shape — proven by a serialisation test | `[ ]` | |
| C.2.users.2 | `reset-password` invalidates all of that user's refresh tokens and forces re-login on every device | `[ ]` | |
| C.2.users.3 | Deactivate/delete immediately revokes sessions — an already-issued access token is rejected within its remaining TTL (or the TTL is short enough to be an accepted, documented risk) | `[ ]` | |
| C.2.users.4 | Route ordering (`/users/:id` declared after `/users`) is covered by a test so a refactor cannot silently break it | `[ ]` | |
| C.2.users.5 | Email/identity reuse after delete is handled deliberately (restore vs. new user) and tested | `[ ]` | |

### Roles & Permissions

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/roles` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/roles` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/roles/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/roles/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| GET | `/permissions` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| C.2.roles.1 | System roles cannot be edited or deleted | `[ ]` | |
| C.2.roles.2 | Deleting a role in use is blocked or safely reassigns; never orphans a user | `[ ]` | |
| C.2.roles.3 | A permission change takes effect on the **next request**, not on next login — or the token TTL bound is documented and accepted | `[ ]` | |

### Teams

| Method | Path | Auth | RBAC | Tenant | Valid | Page | Rate | Audit | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/teams` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/teams` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| PATCH | `/teams/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/teams/:id` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| GET | `/teams/:id/members` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` |
| POST | `/teams/:id/members` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |
| DELETE | `/teams/:id/members/:userId` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | n/a | `[ ]` | `[ ]` | `[ ]` |

## C.3 Endpoints the product needs but that DO NOT EXIST yet

> Verified 2026-08-25 by listing every `@Controller` in `apps/api/src`. These are gaps, not
> opinions. Each needs a decision: **build before v1** or **explicitly cut** with a reason.

| # | Missing capability | Model(s) already in schema | Roadmap slice | Decision |
| --- | --- | --- | --- | --- |
| C.3.1 | Customer↔Product **mapping** CRUD — the web `AddMappingModal` has nowhere to POST | `Mapping` | F5 | `[ ]` |
| C.3.2 | **Dashboard** aggregate endpoint — the web dashboard currently assembles KPIs from `/projections` + full `/leads` in the browser | — | F11 | `[ ]` |
| C.3.3 | **Notifications** read/mark-read | `Notification` | F13 | `[ ]` |
| C.3.4 | **Global search** (Cmd+K palette has no backend) | — | F13 | `[ ]` |
| C.3.5 | **Tenants / management** switching + provisioning | `Tenant`, `PlatformUser` | F14 | `[ ]` |
| C.3.6 | **Attachments** upload/download | `Attachment` | F15 | `[ ]` |
| C.3.7 | **Import jobs** (the web `ImportPaymentsModal` and `xlsx` dependency imply client-side parsing) | `ImportJob` | F15 | `[ ]` |
| C.3.8 | **Export** (server-side, permission-checked, tenant-scoped) | — | F15 | `[ ]` |
| C.3.9 | **Audit log** read API — "who changed this and when" | `AuditLog`, `PlatformAuditLog` | F16 | `[ ]` |
| C.3.10 | **Sales targets** CRUD | `SalesTarget` | F6/F11 | `[ ]` |
| C.3.11 | **Activities / Remarks** API (a `RemarksModal` exists in web) | `Activity`, `Remark` | F7 | `[ ]` |
| C.3.12 | **Industries** reference data | `Industry` | F3 | `[ ]` |
| C.3.13 | **Feature flags** read/write | `FeatureFlag`, `TenantFeatureFlag` | F14 | `[ ]` |
| C.3.14 | **Forgot-password / self-serve reset** (only admin-initiated reset exists) | — | F1 | `[ ]` |
| C.3.15 | **Session list / revoke-other-sessions** for a user | `RefreshToken` | F1 | `[ ]` |
| C.3.16 | **Customer contacts** as first-class sub-resource | `CustomerContact` | F3 | `[ ]` |
| C.3.17 | **Lead products / lead activities** sub-resources | `LeadProduct`, `LeadActivity` | F7 | `[ ]` |
| C.3.18 | **Payment follow-ups** as a distinct sub-resource | `PaymentFollowup` | F9 | `[ ]` |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
