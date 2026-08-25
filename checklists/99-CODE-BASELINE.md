# Code Baseline — 2026-08-25 — Production Checklist

> **what was actually observed in the repository when this tracker was written**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 0

**Gate:** REFERENCE ONLY. These are observations, not tick-marks.

Use this to tell what has changed since the tracker was created.

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

Recorded so a future reader knows what this tracker was built against, and can tell what has
changed since. **These are observations of the repository, not tick-marks.**

| Area | Observed |
| --- | --- |
| Monorepo | pnpm + Turborepo; `apps/api`, `apps/web`, `apps/mobile`; `packages/db`, `packages/shared` |
| Database | 34 Prisma models, 6 migrations, 70 `@@index`, RLS applied via a dynamic loop, runtime role `greatsales_app` |
| API | NestJS 11, prefix `api/v1`, 12 feature modules (+ Prisma), 55 routes across 13 controllers |
| API security middleware | `helmet()`, `cookie-parser`, CORS allow-list with a boot guard against `*`, global `ThrottlerGuard` (120/60s, **in-process**), zod env validation, `AllExceptionsFilter` |
| API health | `GET /api/v1/health` returns a **static** payload — does not check the database |
| Swagger | mounted at `/api/docs` **unconditionally** |
| Web | Vite 6 + React 19 SPA, 10 protected routes + login portals; `mockOwner` still imported by `hooks.ts` and `AddMappingModal.tsx` |
| Web build | `tsc --noEmit && vite build`; Dockerfile bakes `VITE_*` at build time with staging defaults |
| Mobile | 9 Expo Router screens, **no API client at all**, every screen fed from `src/gs/mock.ts` |
| TypeScript | web `tsconfig.json` has `strict: true`; **API `tsconfig.json` does not** — `noImplicitAny: false`, `strictBindCallApply: false`, no `strict` |
| Tests | 26 API spec files, 43 web test files, an e2e jest config; API jest pinned to `maxWorkers: 1` |
| CI | **none** — no `.github/workflows` |
| Containers | API + web Dockerfiles, both multi-stage; API runs as non-root; API image hardcodes `NODE_ENV=staging` |
| Deployment | `DEPLOYMENT.md` describes an AWS CDK topology that is **planned, not implemented** |
| Missing APIs | mappings, dashboard aggregate, notifications, search, tenants, attachments, imports, exports, audit read, sales targets, activities/remarks, industries, feature flags, forgot-password, session management (see §C.3) |

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
