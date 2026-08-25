# B. Backend Runtime — Production Checklist

> **NestJS process · config · boot · lifecycle · health · error contract**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 46

**Gate:** Must be green before the API contract can be verified.

**Depends on:** [A. Database](01-DATABASE.md). **Blocks:** [C. API](03-API.md).

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

**Current shape (verified 2026-08-25):** `apps/api`, NestJS 11, global prefix `api/v1`,
`helmet()`, `cookie-parser`, explicit CORS allow-list with a boot-time guard against `*`,
`AllExceptionsFilter`, Swagger at `/api/docs`, `ThrottlerGuard` global (120/60s in-process),
zod env validation, `trust proxy` configurable, health at `GET /api/v1/health`.

## B.1 Configuration & boot

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| B.1.1 | Every environment variable the app reads is declared in the zod schema in `apps/api/src/config/env.ts` — grep proves no `process.env.X` bypasses it | `[~]` | Schema extended 2026-08-25 with `REDIS_URL`, `SWAGGER_ENABLED`, `LOG_LEVEL`, `SENTRY_DSN`, `CORS_ORIGIN_SUFFIX`, `APP_BASE_DOMAIN`. Remaining: run the `process.env.X` grep and prove nothing bypasses it. |
| B.1.2 | The app **refuses to boot** on any missing/invalid env var, with a readable message (verified by deliberately breaking one in the production image) | `[~]` | `pnpm --filter api env:check <file> [--as production]` validates any env file without booting. 2026-08-25: dev `.env`, `.env.staging.example`, `.env.production.example` all PASS; a deliberately broken production file produced all 8 expected violations. Remaining: prove the same failure in the production image. |
| B.1.3 | No secret has a default value in code. `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` have no fallback and are ≥32 bytes of real entropy in production | `[ ]` | |
| B.1.4 | `NODE_ENV=production` in the production image (note: the current API Dockerfile hardcodes `ENV NODE_ENV=staging` — **must be parameterised**) | `[ ]` | |
| B.1.5 | `CORS_ORIGIN` is an explicit allow-list in production; the `*` guard is proven to fire | `[~]` | Enforced: `env.ts` productionRules rejects `CORS_ORIGIN="*"`; `main.ts` also throws for any non-development env. Negative test 2026-08-25 fired the rule. Remaining: prove against the deployed production origin. |
| B.1.6 | `TRUST_PROXY` set to the real hop count behind the production load balancer — wrong value breaks rate limiting and IP audit | `[~]` | Enforced: production boot rejects `TRUST_PROXY="false"`. Negative test 2026-08-25 fired the rule. Remaining: confirm the real hop count behind CloudFront->ALB (template says 2). |
| B.1.7 | Swagger `/api/docs` is **disabled or authenticated** in production (it currently mounts unconditionally) | `[~]` | Fixed 2026-08-25: `main.ts` mounts Swagger only when `SWAGGER_ENABLED=true`, and `env.ts` refuses that value when `NODE_ENV=production`. Negative test fired the rule. Remaining: boot a production image and confirm `/api/docs` 404s. |
| B.1.8 | `x-powered-by` removed and the server banner does not disclose framework/version | `[ ]` | |
| B.1.9 | Request body size limit set explicitly (Express default is 100 kb — confirm it matches the largest legitimate payload and no larger) | `[ ]` | |
| B.1.10 | Global `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — or an equivalent zod pipe applied to **every** route (verified per-endpoint in §C) | `[ ]` | |
| B.1.11 | Timezone of the process is UTC and does not depend on the host | `[ ]` | |
| B.1.12 | Node version pinned and matches between Dockerfile, `engines`, and CI | `[ ]` | |
| B.1.13 | 🔴 API TypeScript runs in **full `strict` mode**. Today `apps/api/tsconfig.json` sets `noImplicitAny: false`, `strictBindCallApply: false`, `noFallthroughCasesInSwitch: false` and never enables `strict` — so implicit `any` flows silently through the entire backend. Turn `strict` on and fix the fallout | `[ ]` | |
| B.1.14 | `skipLibCheck` and any other loosened compiler flag are reviewed and justified, not inherited from a scaffold | `[ ]` | |
| B.1.15 | Zero `any` / `@ts-ignore` / non-null `!` assertions in the API production path; each survivor is listed and justified | `[ ]` | |

## B.2 Process lifecycle & resilience

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| B.2.1 | `enableShutdownHooks()` wired; SIGTERM drains in-flight requests before exit | `[ ]` | |
| B.2.2 | Shutdown grace period is longer than the longest request and shorter than the orchestrator's kill timeout | `[ ]` | |
| B.2.3 | `unhandledRejection` and `uncaughtException` are logged with full context before the process exits — never swallowed | `[ ]` | |
| B.2.4 | The process exits non-zero on fatal error so the orchestrator restarts it | `[ ]` | |
| B.2.5 | No unbounded in-memory state (caches, maps, rate-limit stores) that grows with tenants or users — each has a bound and an eviction policy | `[ ]` | |
| B.2.6 | Memory ceiling set (`--max-old-space-size`) below the container limit so Node GCs instead of being OOM-killed | `[ ]` | |
| B.2.7 | Outbound calls (DB, future SES/S3/Stripe) all have explicit timeouts — no unbounded await | `[ ]` | |
| B.2.8 | Retry policy for transient failures is bounded, jittered, and idempotent-only | `[ ]` | |

## B.3 Health, readiness & probes

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| B.3.1 | **Liveness** probe is cheap and does not touch the DB | `[ ]` | |
| B.3.2 | **Readiness** probe *does* verify the DB connection — the current `/health` returns a static `{status:'ok'}` and will report healthy with a dead database. **Must be fixed.** | `[ ]` | |
| B.3.3 | Readiness fails during startup until migrations/warmup complete, so traffic is not routed early | `[ ]` | |
| B.3.4 | Health endpoints do not leak version, dependency, or infrastructure detail to unauthenticated callers | `[ ]` | |
| B.3.5 | Docker `HEALTHCHECK` points at the readiness endpoint (currently points at the static `/health`) | `[ ]` | |
| B.3.6 | Load balancer / orchestrator probe thresholds tuned (interval, timeout, failure count) and tested by killing the DB | `[ ]` | |

## B.4 Error handling contract

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| B.4.1 | `AllExceptionsFilter` returns a **single stable error envelope** for every failure, documented in §C.1 | `[ ]` | |
| B.4.2 | Stack traces, SQL text, Prisma error detail, and internal paths never reach the client in production | `[ ]` | |
| B.4.3 | Every response carries a correlation/request id, and that id appears in the server log for the same request | `[ ]` | |
| B.4.4 | Prisma error codes are mapped deliberately: `P2002` → 409, `P2025` → 404, `P2003` → 409/422 — not a blanket 500 | `[ ]` | |
| B.4.5 | Validation failures return 422 (or 400) with a field-level, machine-readable shape the web client actually renders | `[ ]` | |
| B.4.6 | Authorization failures return 403 and **do not** reveal whether the resource exists (404-vs-403 leak reviewed per endpoint) | `[ ]` | |
| B.4.7 | No `catch {}` that swallows an error in the production path — grep for empty catches and silent fallbacks | `[ ]` | |
| B.4.8 | Every 5xx is alertable; the 5xx rate has a defined budget and an alarm | `[ ]` | |

## B.5 Authorization plumbing

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| B.5.1 | Auth is **deny-by-default**: a route with no decorator is protected, and `@Public()` is the explicit exception. Verified by adding a bare route and confirming it 401s | `[ ]` | |
| B.5.2 | An inventory of every `@Public()` route exists and each one is justified | `[ ]` | |
| B.5.3 | `PermissionsGuard` is applied globally, not per-controller-by-hand | `[ ]` | |
| B.5.4 | Role/permission checks are **server-side only** — no endpoint trusts a role claim sent by the client | `[ ]` | |
| B.5.5 | Sales-scope (own records only) is enforced in the query, not by filtering after fetch | `[ ]` | |
| B.5.6 | Object-level authorization (IDOR): fetching by id checks ownership/tenancy **before** returning, for every `:id` route | `[ ]` | |
| B.5.7 | Privilege escalation blocked: a user cannot grant themselves a role/permission they do not hold, cannot edit a higher-privileged user, cannot change their own `tenantId` | `[ ]` | |
| B.5.8 | The last owner/admin of a tenant cannot be deleted, deactivated, or demoted | `[ ]` | |
| B.5.9 | Every deny path has an integration test (per `FEATURE-ROADMAP.md` DoD #3) | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
