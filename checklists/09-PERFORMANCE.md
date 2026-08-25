# I. Performance & Scale — Production Checklist

> **budgets · load · soak · data scale · horizontal scaling**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 13

**Gate:** Every item needs a NUMBER written down, not an adjective.

**Depends on:** [A.4 indexes](01-DATABASE.md), [C](03-API.md), [D.2 bundle](04-FRONTEND-WEB.md).

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
| I.1 | Written performance budget: API p95 per endpoint class, page LCP, TTI — with **numbers**, agreed before testing | `[ ]` | |
| I.2 | Load test at expected peak concurrency against a production-shaped dataset, results recorded | `[ ]` | |
| I.3 | Load test at 10× expected peak to find the breaking point, and the breaking point is documented | `[ ]` | |
| I.4 | Soak test (hours, not minutes) shows no memory growth and no connection leak | `[ ]` | |
| I.5 | Dataset scale test: 100k+ rows per entity per tenant, with list/search/dashboard timings recorded | `[ ]` | |
| I.6 | Multi-tenant noisy-neighbour test: one heavy tenant does not degrade others | `[ ]` | |
| I.7 | Horizontal scaling proven: two API instances behind a load balancer behave correctly (**note: the in-process throttler breaks under this — C.1.13**) | `[ ]` | |
| I.8 | No sticky-session requirement; the API is genuinely stateless | `[ ]` | |
| I.9 | Caching strategy decided per endpoint (HTTP caching, ETags, Redis) and cache invalidation is correct across tenants | `[ ]` | |
| I.10 | Response compression enabled and verified | `[ ]` | |
| I.11 | Background/long-running work (imports, exports, reports) runs off the request path with a job queue — never a 60-second HTTP request | `[ ]` | |
| I.12 | Autoscaling policy defined, or fixed capacity chosen with headroom and a documented manual scale-up procedure | `[ ]` | |
| I.13 | Cost per tenant estimated at target scale | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
