# F. Shared Packages — Production Checklist

> **@greatsales/db · @greatsales/shared · Turborepo graph**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 7

**Gate:** Drift here silently breaks every consumer.

**Feeds:** [B](02-BACKEND.md), [C](03-API.md), [D](04-FRONTEND-WEB.md), [E](05-MOBILE.md).

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

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| F.1 | `@greatsales/shared` builds cleanly and its published types match what api/web/mobile consume | `[ ]` | |
| F.2 | Domain types are defined **once** and shared — no hand-maintained duplicate of an API shape in `apps/web/src/features/*/types.ts` that can drift | `[ ]` | |
| F.3 | `@greatsales/db` never leaks Prisma types into the web bundle (verified: web's Dockerfile runs `db:generate` — confirm nothing from `@prisma/client` reaches `dist/`) | `[ ]` | |
| F.4 | Enum values are shared between DB, API, and UI — a new `DealStage` cannot be added in one place only | `[ ]` | |
| F.5 | Money/date formatting helpers live in one place and are used by every surface | `[ ]` | |
| F.6 | Turborepo task graph is correct: `build` depends on upstream `build`, cache keys include env vars that affect output | `[ ]` | |
| F.7 | No circular workspace dependencies | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
