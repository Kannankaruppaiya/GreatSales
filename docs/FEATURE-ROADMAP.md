# GreatSales — Feature Roadmap (vertical slices)

> **Governing contract:** [`AGENTS.md`](../AGENTS.md).
> **Domain reference:** [`BUILD-BACKLOG.md`](BUILD-BACKLOG.md) — the module/dependency analysis and
> the verified inventory of what exists. This document is the **execution order**: one user-facing
> feature at a time, finished end to end before the next one starts.

---

## Why vertical slices

The module backlog is organised by layer. This roadmap is organised by **what a user can do**.
Each slice cuts through every layer — schema → API → authorization → web UI → tests → docs — and
is not "done" until a real person can perform the action against a real database.

**The one honest caveat:** a vertical slice cannot skip its foundations, it can only absorb them.
Slice 1 (Sign-in) therefore carries the seed/test-fixture fix and the auth-relevant security
baseline, because auth integration tests reseed the database and there is no way to test a login
without them. That makes slice 1 larger than slice 2 or 3. Accept that rather than shipping a
sign-in page whose tests cannot run.

---

## Definition of Done — every slice, no exceptions

A slice is complete only when **all** of these are true. This is `AGENTS.md` §33 applied per
feature:

1. **Schema** — migration written, reviewed for lock duration, rollback documented.
2. **API** — endpoints validated, authorized server-side, paginated where they list, with a
   documented error contract.
3. **Authorization** — every deny path proven by an integration test, not just the allow path.
4. **Web** — real API wiring; loading, error, empty, and permission-denied states all rendered.
   No mock store left in the production path.
5. **Tests** — API integration tests against real Postgres (RLS-bound role, never mocked Prisma)
   plus web component tests. Failure paths tested, not only happy paths.
6. **Performance** — measured, with the number written down. Indexes justified by an EXPLAIN plan.
7. **Observability** — the feature's failures are diagnosable from logs.
8. **Verification** — `pnpm --filter api test`, `pnpm --filter web test`, `pnpm check-types`,
   `pnpm lint` all green, with output pasted.
9. **Docs** — README/DEPLOYMENT/CHANGELOG updated where behaviour changed.
10. **No fake completion** — zero TODOs, mocks, or silent catches in the production path.

---

## The sequence

| # | Slice | What the user can do when it is done | Pulls from |
| --- | --- | --- | --- |
| **F1** | **Sign-in & session** | Sign in on any of the four role portals, stay signed in safely, sign out everywhere | M0, M1, part of M2 |
| F2 | App shell & navigation | Move around the app with role-correct nav and guards; no lying UI | part of M2 |
| F3 | Customers | Create, find, edit, reassign, and safely delete customers with contacts | M4 |
| F4 | Product catalog | Manage principals and products with real SKUs and price history | M5 |
| F5 | Map product to customer | Actually persist a customer↔product mapping (**currently impossible**) | M6 |
| F6 | Projections worksheet | Run the monthly recurring-sales worksheet with correct server totals | M7 |
| F7 | Leads & pipeline | Work the 9-stage pipeline in table and kanban views | M8 |
| F8 | Sales orders & fulfilment | Place an order and advance it through the 7-step lifecycle | M9 |
| F9 | Payments & collections | See live aging/zones and record collection follow-ups | M10 |
| F10 | Follow-up inbox | One cross-entity follow-up list that is actually complete | M11 |
| F11 | Dashboard | Role-correct KPIs in one request, not 40 | M12 |
| F12 | Users, roles & teams | Administer people and permissions without touching the DB | rest of M2 |
| F13 | Notifications & search | Trustworthy badges and a Cmd+K that finds live records | M13 |
| F14 | Tenancy & management switcher | Switch tenant honestly, or not at all | M3 |
| F15 | Import, export & attachments | Bulk-load and attach documents for real | M14 |
| F16 | Audit, compliance & lifecycle | Answer "who changed this and when" | M15 |
| F17 | Deploy, migrate & recover | Ship it, roll it back, restore it | M16 |

**Rule:** no slice starts until the previous one meets the Definition of Done above.

---

# F1 — Sign-in & session

**Scope:** `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`, a real logout, the four role
login portals on web, and the security controls that make all of it safe to expose.

**Depends on:** nothing. **Blocks:** everything.

## What exists today (read from the code, 2026-08-23)

| File | Lines | State |
| --- | --- | --- |
| `apps/api/src/auth/auth.service.ts` | 152 | login / refresh / me implemented |
| `apps/api/src/auth/auth.controller.ts` | 45 | 3 endpoints |
| `apps/api/src/auth/jwt-auth.guard.ts` | 56 | access-token guard |
| `apps/api/src/auth/hash.ts` | 17 | argon2id verify |
| `apps/web/src/features/auth/LoginPage.tsx` | 402 | 4 role portals, demo prefill |
| `apps/web/src/store/auth.ts` | 88 | zustand + persist, single-flight refresh on 401 |
| `apps/web/src/lib/api.ts` | — | attaches Bearer, retries once after refresh |

Working already, keep it: constant `"Invalid credentials"` message on every failure path;
tenant-scoped RLS reads via `prisma.forTenant`; suspended/churned tenants blocked at login;
single-flight refresh so concurrent 401s trigger one refresh.

## Verified defects this slice must fix

| # | Defect | Evidence | AGENTS.md |
| --- | --- | --- | --- |
| D1 | **Refresh token in `localStorage`.** `useAuth` persists `refreshToken` under key `greatsales_auth`. Any XSS yields a 7-day credential. | `apps/web/src/store/auth.ts:29-46` | §7 |
| D2 | **Refresh tokens cannot be revoked.** `refresh()` only verifies the JWT signature. No `jti`, no stored family, no reuse detection. A stolen token is valid until it expires. | `auth.service.ts:67-92` | §7 |
| D3 | **Logout is client-only.** `logout()` clears local state; the refresh token stays valid on the server. | `apps/web/src/store/auth.ts:45` | §7, §31 |
| D4 | **Refresh does not re-check tenant status.** `login()` blocks Suspended/Churned tenants, but `refresh()` checks only `user.active`. A suspended tenant's users keep refreshing forever. | `auth.service.ts:81-86` vs `:32-41` | §1, §7 |
| D5 | **Timing side-channel enumerates accounts.** When the user is not found, `verifyPassword` never runs, so a missing account answers measurably faster than a wrong password. | `auth.service.ts:44-50` | §7 |
| D6 | **No rate limiting or lockout.** Login and refresh accept unlimited attempts. | no throttler in `app.module.ts` | §7 |
| D7 | **No failed-login audit.** Successful login writes `lastLoginAt`; failures record nothing, so an attack is invisible. | `auth.service.ts:52-55` | §13, §25 |
| D8 | **Demo credentials are compiled-in defaults.** `config.ts` falls back to a real seeded password when the env var is absent, so it can reach a production bundle. | `apps/web/src/lib/config.ts:15-18` | §7, §19 |
| D9 | **`tenantId` is typed by hand in the login form.** Real users do not know their tenant id; it is also an enumeration surface. | `LoginPage.tsx` | §11, §7 |
| D10 | **No password lifecycle.** No change-password, no forgot-password, no strength policy, no reset flow. | absent | §1, §7 |
| D11 | **Auth tests cannot run reliably.** `packages/db/prisma/seed.ts` is uncommitted and now seeds only `tenant_greatsales`, while all 15 API specs reseed and expect `tenant_acme` / `tenant_globex`. | `git status` | §14 |

## Decision required before execution

**How does a user identify their tenant at sign-in?** D9 cannot be fixed without an answer, and
the answer changes the login form, the API contract, and the deployment topology.

- **A. Subdomain** — `acme.greatsales.app` resolves the tenant; the form asks only email +
  password. Cleanest UX, needs wildcard DNS and TLS.
- **B. Email-derived** — the server resolves the tenant from the email domain or a global unique
  email. Simplest UX, but forces email uniqueness across all tenants.
- **C. Keep explicit tenant id** — but move it out of a free-text box (remembered per device,
  or an org code issued at onboarding).

Everything else in F1 can proceed while this is open. Only the login form and the login DTO wait.

## User stories

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| F1-1 | As a user, I want to sign in with my credentials and reach my role's home page, so that I can start working. | Correct credentials return tokens + profile and land on the role's default route. All four portals (super-admin, admin, management, sales) work. Wrong credentials return one indistinguishable error. |
| F1-2 | As a security reviewer, I want a stolen refresh token to be revocable, so that a compromise is containable. | Refresh tokens carry a `jti` and belong to a stored family. Rotation on every use. Reuse of a consumed token revokes the entire family and writes a security audit event. |
| F1-3 | As a user, I want sign-out to actually end my session, so that "log out" means something. | A server logout endpoint revokes the refresh family. A revoked refresh token is rejected. Test proves the old token fails after logout. |
| F1-4 | As a security reviewer, I want the refresh token out of JavaScript's reach, so that XSS cannot steal a long-lived credential. | Refresh token moves to an httpOnly, Secure, SameSite cookie — or, if that is rejected during brainstorming, the decision and its residual risk are written into the spec with a compensating control. Access token stays in memory. |
| F1-5 | As an operator, I want a suspended tenant locked out immediately, so that suspension is enforceable. | `refresh()` re-validates tenant status. A suspended tenant's refresh fails. Access tokens expire within their TTL and the TTL is documented as the containment window. |
| F1-6 | As a security reviewer, I want login timing not to reveal whether an account exists, so that accounts cannot be enumerated. | A dummy argon2id verify runs on the not-found path. A timing test asserts the two paths are statistically indistinguishable. |
| F1-7 | As a security reviewer, I want brute force to be expensive, so that credential stuffing fails. | Per-IP and per-account throttling on login and refresh, with documented limits, a 429 error contract, and a backoff or lockout policy. Behaviour under multiple API instances is stated. |
| F1-8 | As an operator, I want every authentication event logged, so that an attack is visible. | Success and failure both emit a structured event with request id, tenant, outcome, and source IP — and never the password, token, or hash. |
| F1-9 | As a user, I want to change my password and end my other sessions, so that I can recover from a leak. | Change requires the current password, enforces a strength policy, re-hashes with argon2id, and revokes every other refresh family. |
| F1-10 | As a user who forgot my password, I want a safe reset, so that I am not locked out permanently. | Single-use, short-TTL, rate-limited reset token. The request response is identical whether or not the account exists. Using the token revokes all sessions. |
| F1-11 | As an operator, I want no credential compiled into the frontend, so that the production bundle is clean. | Demo prefill is env-only and renders empty when `PROD`. A test greps the production build output and fails if a seeded password string is present. |
| F1-12 | As a user on a slow or broken network, I want the login page to tell me what happened, so that I am not staring at a dead button. | Distinct, non-leaking UI states for pending, invalid credentials, rate-limited, tenant suspended, and network failure. Double-submit is prevented. Form is keyboard-navigable with labelled inputs and an announced error. |
| F1-13 | As an engineer, I want the auth test suite to run against a stable fixture, so that these guarantees stay proven. | The seed conflict is resolved (see D11) and all 15 existing API specs plus the new auth specs are green. |

## Outcome (2026-08-23)

**Delivered.** D1–D9 and D11 fixed; see `SECURITY.md` → *Session handling* for
the resulting model.

| Decision | Resolution |
| --- | --- |
| Tenant identification (A/B/C) | **C — kept explicit `tenantId`**, now remembered per device. Subdomain resolution (option A) is a DNS/TLS change well outside a sign-in slice; recorded as a follow-up. |
| Refresh-token storage (F1-4) | **httpOnly cookie** for browsers, opt-in body delivery for native clients. Viable because staging already serves the API same-origin (`VITE_API_URL=/api/v1`); dev now matches via a Vite proxy. |

**Deferred with reason — D10 (password lifecycle).** Change-password and
forgot-password are not part of the sign-in page: one lives in profile
settings, the other needs a mail-provider decision (AGENTS.md §20). Shipping a
reset flow with no delivery channel would be fake completion (§31). **There is
no self-service password recovery today** — an admin must reset a user
directly. This is the first thing F12 (Users, roles & teams) should address.

**Tests:** 55 auth service (integration, real Postgres under the RLS-bound
role) + 28 auth HTTP e2e + 15 login-page component tests. Full suites green:
API 157, API e2e 30, web 126.

## Non-goals for F1

MFA/2FA, SSO/OAuth, device management, and a "sessions on other devices" UI are explicitly out of
scope. F1-2's token-family design must not make them harder to add later.

## Prompt — paste this to start F1

```
Read AGENTS.md and docs/FEATURE-ROADMAP.md (section F1) first, and hold both for the whole
task.

Build F1 — Sign-in & session — as a complete production vertical slice. Not a page: the
whole feature, schema to UI to tests.

Workflow (non-negotiable):
1. superpowers:brainstorming — resolve every open question with me BEFORE any design. The
   tenant-identification decision (F1 "Decision required", options A/B/C) and the
   refresh-token storage decision (F1-4) are the two that must be settled with me, not
   assumed.
2. Write the design spec to docs/superpowers/specs/<date>-f1-signin-design.md.
3. superpowers:writing-plans — task-by-task plan to
   docs/superpowers/plans/<date>-f1-signin.md.
4. superpowers:test-driven-development — test first. API tests are INTEGRATION tests
   against real Postgres via the RLS-bound greatsales_app role. Never mock Prisma.
5. superpowers:verification-before-completion — paste real output from
   `pnpm --filter api test`, `pnpm --filter web test`, `pnpm check-types`, `pnpm lint`.

Fix all eleven verified defects D1-D11 listed in the F1 section of
docs/FEATURE-ROADMAP.md. Do not take my word for any of them — re-read the cited lines and
confirm each one before you fix it. If a defect is not real, say so with evidence.

Order of work:
- D11 first (the seed conflict), because no auth test can run reliably until it is
  resolved. All 15 existing API specs must be green before you write a single new one.
- Then the server: token families with jti + rotation + reuse detection, a real logout,
  tenant re-validation on refresh, constant-time not-found handling, throttling with a
  documented 429 contract, structured auth event logging.
- Then password lifecycle: change-password and forgot-password with a single-use,
  short-TTL, rate-limited token and an identical response whether or not the account
  exists.
- Then the web: token storage per the F1-4 decision, the login form per the tenant
  decision, and real pending / invalid / rate-limited / suspended / network-failure
  states. Keyboard navigable, labelled inputs, announced errors.
- Finally D8/F1-11: env-only demo prefill, empty in PROD, with a test that fails if a
  seeded credential appears in the production bundle.

Hard rules:
- Authorization is enforced SERVER-SIDE. A web guard is UX, never security.
- Never log a password, hash, or token.
- Every security control needs a test proving the DENY path.
- Do not widen scope into MFA, SSO, or device management — F1 non-goals. But do not design
  the token family in a way that blocks them later (AGENTS.md §18).
- Any schema change ships with a migration and a documented rollback (AGENTS.md §24).
- If any requirement here is insecure, non-scalable, or data-lossy, STOP and tell me
  (AGENTS.md §32).
- Do not report done with any mock, TODO, or silent catch in the production path
  (AGENTS.md §31).

Report at the end: which defects were fixed, which were found not to be real, measured
login p95, and anything you deliberately left out.
```

---

# F2 — App shell & navigation

**Scope:** layout, sidebar, topbar, role-based nav, route guards, and the portal picker — with
every element telling the truth about what the server will allow.

**Depends on:** F1.

**Known debt going in:** sidebar and topbar badge counts read the mock `useTrackerStore`
(`apps/web/src/components/layout.tsx`), so they never reflect the database. F2 either wires them
to real counts or removes them until F13 — it must not ship a number that is decorative.

| ID | Story | Acceptance criteria |
| --- | --- | --- |
| F2-1 | As a user, I want navigation to show only what my role can reach, so that I am not offered dead ends. | Nav derives from the server-issued role and permission set. A hidden route is also denied server-side, proven by test. |
| F2-2 | As a user, I want a denied route to explain itself, so that I know it is a permission issue, not a bug. | Route guards render an explicit permission-denied state, never a blank page or a silent redirect loop. |
| F2-3 | As a user, I want no badge to show a number the database does not support. | Badges are wired to server counts or removed. No mock-backed number ships (AGENTS.md §31). |
| F2-4 | As a user on a phone or tablet, I want the shell to work, so that field sales is usable. | Responsive layout verified at mobile, tablet, and desktop widths. Keyboard and screen-reader navigable. |

Prompt: use the standard envelope from `BUILD-BACKLOG.md`, scoped to the stories above.

---

# F3 – F17

Each remaining slice takes its user stories, acceptance criteria, and prompt from the
corresponding module section of [`BUILD-BACKLOG.md`](BUILD-BACKLOG.md) — see the mapping in
**The sequence** table above — and adds the web half plus the Definition of Done from this
document.

Detailed slice definitions are written **when the slice is reached**, not in advance: writing F9's
acceptance criteria today would encode assumptions that F3–F8 are going to invalidate.

---

## Progress

| Slice | Status | Completed |
| --- | --- | --- |
| F1 Sign-in & session | **Done** (D10 deferred) | 2026-08-23 |
| F2 App shell & navigation | Not started | — |
| F3 Customers | Not started | — |
| F4 Product catalog | Not started | — |
| F5 Map product to customer | Not started | — |
| F6 Projections worksheet | Not started | — |
| F7 Leads & pipeline | Not started | — |
| F8 Sales orders & fulfilment | Not started | — |
| F9 Payments & collections | Not started | — |
| F10 Follow-up inbox | Not started | — |
| F11 Dashboard | Not started | — |
| F12 Users, roles & teams | **Delivered 2026-08-23** | See the F12 section below |
| F13 Notifications & search | Not started | — |
| F14 Tenancy & management switcher | Not started | — |
| F15 Import, export & attachments | Not started | — |
| F16 Audit, compliance & lifecycle | Not started | — |
| F17 Deploy, migrate & recover | Not started | — |


---

# F12 — Users, roles & teams

**Delivered 2026-08-23.** Design spec:
[`docs/superpowers/specs/2026-08-23-f12-users-roles-teams-design.md`](superpowers/specs/2026-08-23-f12-users-roles-teams-design.md).
Plan: [`docs/superpowers/plans/2026-08-23-f12-users-roles-teams.md`](superpowers/plans/2026-08-23-f12-users-roles-teams.md).

## Decisions taken

| Question | Decision |
| --- | --- |
| Scope | Users **and** roles **and** teams, as one slice |
| Self-lockout | Both guards: no self-mutation, and the last permission-holder is protected |
| Admin password reset | Revokes every session **and** forces a change on next sign-in |
| Delete semantics | Soft-delete; the email and username are freed for reuse; restore supported |
| Roles | Custom roles with editable grants; built-in roles re-scopable but not renamable |
| Teams | Full CRUD plus membership |
| UI | Three tabs on `/users`, synced to `?tab=` |
| Password policy | min 12, max 128 bytes, common-password blocklist, no identity substrings |

## Verified defects fixed

Each was confirmed in the code before being fixed, and each has a regression test.

| # | Defect |
| --- | --- |
| A1 | `?active=false` returned **active** users — `z.coerce.boolean()` maps `"false"` to `true` |
| A2 | An admin could deactivate/delete/demote themselves, or the last admin, locking the tenant out |
| A3 | No audit logging on any user mutation |
| A4 | Password reset and deactivation left refresh families alive |
| A5 | Soft-delete burned the email and username permanently |
| A6 | No `total`, no sort, no `GET /users/:id` |
| A7 | Invalid role/manager/team → 500; no manager-cycle detection |
| A8 | Email/username normalised client-side only |
| A9 | No `/roles` endpoint at all |
| A10 | Zero HTTP tests for `/users`; nothing proved a `sales` user was refused |
| W1 | `useMockOwnerId()` compared a mock id to real ids — `(you)` never rendered, self-guard never engaged |
| W2 | Role options derived from loaded rows, so an empty role could never receive its first user |
| W3 | The permissions card was hardcoded markup, free to lie about real grants |
| W4 | Delete was never wired; deactivate fired with no confirmation |
| W5 | The header count read loaded pages, not the real total |
| W6 | No manager/team/last-login columns, no status filter, no sorting |
| W7 | `role === "admin"` hid every action from a super-admin |

## Found during implementation

| Finding | Resolution |
| --- | --- |
| `forTenant()` extends `$allModels`, so `$queryRaw` runs **unscoped** — the last-admin guard read zero rows under RLS and passed silently, fail-OPEN | `PrismaService.transactionForTenant()`; documented in `SECURITY.md` |
| Postgres collation disagrees with JS `localeCompare`, so re-sorting in a test asserts a shared collation that does not exist | Sort tests assert reversal, and compare against the database's own ordering |
| Password length was defined twice — Zod `min(8)` and the policy's 12 — and the Zod error shadowed the `WEAK_PASSWORD` code, leaving the client unable to say why | Length lives only in the shared policy |
| The e2e Jest config had no `maxWorkers`, so suites sharing one database clobbered each other's fixtures | `maxWorkers: 1`, matching the unit config |
| The shared `Dialog` had no `role="dialog"`, no `aria-modal`, no accessible name, and did not restore focus | Fixed in `components/ui.tsx` — improves every modal in the app |
| An `aria-label` on a bare `<svg>` is not exposed to assistive tech | The role lock icon carries `role="img"` |

## Verification

| Gate | Result |
| --- | --- |
| `pnpm --filter api test` | 332 passed, 26 suites |
| `pnpm --filter api test:e2e` | 133 passed, 5 suites |
| `pnpm --filter web test` | 213 passed, 43 files |
| `pnpm --filter @greatsales/shared test` | 17 passed |
| `pnpm --filter api check-types` | clean |
| `pnpm --filter web check-types` | clean |
| `pnpm --filter api lint` | 13 errors, all **pre-existing** in files this slice did not author (`jwt-auth.guard`, `decorators`, `permissions.guard`, `zod-validation.pipe`, `main`, `prisma.service`, two older specs). No new module is flagged. Left alone rather than folded into this slice |

## Known gaps

- **No self-service password recovery by email.** Still blocked on a
  mail-provider decision (AGENTS.md §20). An admin reset is the only path, and
  it now forces a change on next sign-in.
- **Search is not index-backed.** `ILIKE '%term%'` cannot use a B-tree. A
  per-tenant user table is a hundreds-to-low-thousands object, so a trigram GIN
  index was not added on speculation — but the `EXPLAIN (ANALYZE)` measurement
  that would justify the decision either way has not been run.
- **The manager picker loads one page of users.** A workspace with thousands of
  people needs a search-as-you-type picker.
- **Dialogs restore focus but do not trap it.** Tab can still reach the page
  behind an open modal.
