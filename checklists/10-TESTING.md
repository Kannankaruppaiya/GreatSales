# J. Testing & Quality Gates — Production Checklist

> **the commands that must be green, and the tests that must be real**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 21

**Gate:** HARD BLOCKER. Gates every other layer.

**Gates:** all layers. See also [K.2 CI/CD](11-BUILD-INFRA.md).

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

**Current shape (verified 2026-08-25):** 26 API spec files, 43 web test files, an e2e config at
`apps/api/test/jest-e2e.json`. No `.github/workflows` directory exists — **there is no CI.**

## J.1 The gates

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| J.1.1 | `pnpm check-types` green across every workspace | `[~]` | 2026-08-25: `pnpm --filter api check-types` and `pnpm --filter web check-types` both exit 0. **NOT every workspace** — `pnpm check-types` at the root still fails on `mobile`, whose `node_modules` is not installed (`Cannot find module .../typescript/bin/tsc`). See J.1.7. |
| J.1.2 | `pnpm lint` green with zero warnings tolerated | `[~]` | 2026-08-25: `pnpm --filter api lint` exits 0 with **zero errors and zero warnings** (was 13 errors + 1 warning). Root causes fixed, not suppressed — see the note under this table. **Scope: api only** — `web` declares no lint script and `mobile` cannot run one. |
| J.1.3 | `pnpm --filter api test` green | `[~]` | 2026-08-25: `pnpm --filter api test` — **26 suites, 332 tests, all passed** against the local Postgres. Log shows `Connected as greatsales_app (not superuser, NOBYPASSRLS)`. |
| J.1.4 | `pnpm --filter api test:e2e` green **against a real Postgres with the RLS-bound role** | `[~]` | 2026-08-25: `pnpm --filter api test:e2e` — **5 suites, 133 tests, all passed** against real Postgres on :5433 as the RLS-bound role. |
| J.1.5 | `pnpm --filter web test` green | `[~]` | 2026-08-25: `pnpm --filter web test` — **43 files, 213 tests, all passed**. |
| J.1.6 | `pnpm build` (all workspaces, production mode) green from a clean clone with a cold cache | `[ ]` | |
| J.1.7 | Mobile `check-types` green | `[ ]` | BLOCKED 2026-08-25: `apps/mobile/node_modules` has no typescript binary, so the script cannot run at all. Needs a workspace install before this gate means anything. |
| J.1.8 | All of the above run in **CI on every PR** and block merge — **CI does not exist yet; this is a blocker** | `[ ]` | |

### Lint: what was actually fixed on 2026-08-25

`pnpm --filter api lint` went from **13 errors + 1 warning** to zero. Every fix removed the
cause; only one used a disable, and that one is a documented false positive.

| Where | Was | Fix |
| --- | --- | --- |
| `auth/jwt-auth.guard.ts` (4), `common/decorators.ts` (2), `common/permissions.guard.ts` (2) | `ctx.switchToHttp().getRequest()` returns `any`, so `req.user` — the value that decides **which tenant a query is bound to** — was untyped. `req.user.tenanId` would have compiled and produced `undefined`. | New `common/authenticated-request.ts`; every call site now uses `getRequest<AuthenticatedRequest>()`. `user` is optional there on purpose, because it genuinely does not exist on a `@Public()` route. `@CurrentUser()` now throws instead of returning `undefined`. |
| `prisma/prisma.service.ts` | `const base = this` aliased the service so a method-shorthand callback could reach it. | `$allOperations` is now an arrow function, which captures `this` lexically. No alias. |
| `common/zod-validation.pipe.ts` | unused `_metadata` parameter | dropped — TS permits a narrower arity than the interface. |
| `main.ts` | floating `bootstrap()` promise | `void bootstrap();` with a note on why a rejection must reach the process. |
| `common/rbac-grants.spec.ts` | `async` stub with no `await` | returns `Promise.resolve(...)`. |
| `common/permissions.guard.spec.ts` | `unbound-method` on two empty stubs | **the one disable**, scoped to two lines with the reason: they are identity keys for decorator metadata, never invoked, and rebinding them would break the lookup. |

The guard fixes matter beyond lint: they are the same `any` that
[B.1.13](02-BACKEND.md) is about. Turning on full `strict` for the API is now a smaller job
than it was, but it is **not** done — those were the loudest call sites, not all of them.


## J.2 Test quality (not just test count)

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| J.2.1 | 🔴 API tests run against **real Postgres with the RLS-bound role**, never a mocked Prisma client — a mocked Prisma test proves nothing about tenancy | `[ ]` | |
| J.2.2 | Every authorization **deny** path has a test (roadmap DoD #3) | `[ ]` | |
| J.2.3 | Cross-tenant isolation tested for every resource (A.3.10) | `[ ]` | |
| J.2.4 | Failure paths tested: DB down, timeout, constraint violation, concurrent write, malformed input | `[ ]` | |
| J.2.5 | Concurrency tests for every path with a race (order status, payment allocation, user create) | `[ ]` | |
| J.2.6 | Web tests assert real behaviour, not implementation detail; they would fail if the feature broke | `[ ]` | |
| J.2.7 | Tests are deterministic — no time-of-day, timezone, ordering, or network dependence. Proven by running the suite 10× and in a different timezone | `[ ]` | |
| J.2.8 | Test isolation: `maxWorkers: 1` in the API jest config is a **workaround, not a design** — either the tests are made parallel-safe or the constraint is documented as permanent | `[ ]` | |
| J.2.9 | Seeding for tests is committed, reproducible, and cannot touch a non-test database | `[ ]` | |
| J.2.10 | Coverage measured; the number is known; critical modules (auth, permissions, money, tenancy) are near-total | `[ ]` | |
| J.2.11 | E2E smoke test of the **critical user journey** against the deployed production build: login → create customer → create lead → create order → record payment → logout | `[ ]` | |
| J.2.12 | Every fixed bug has a regression test that fails without the fix | `[ ]` | |
| J.2.13 | Flaky tests are zero, or quarantined with an owner and a deadline | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
