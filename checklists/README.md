# GreatSales — Production Checklists

One file per layer. Pick up your layer, own it end to end.

**Start here:** [Master tracker](../PRODUCTION-CHECKLIST.md) — shared rules, status legend,
evidence rule, rollup, and the hard-blocker list.

> **Production build only.** Every item in every file is judged against a production build
> running against a production-shaped database. A dev server proves nothing.

| File | Layer | Items | Owner |
| --- | --- | --- | --- |
| [`01-DATABASE.md`](01-DATABASE.md) | Postgres · Prisma · RLS · migrations · indexes · transactions · pooling | 61 | |
| [`02-BACKEND.md`](02-BACKEND.md) | NestJS runtime · config · boot · lifecycle · health · errors · authz | 46 | |
| [`03-API.md`](03-API.md) | API contract · 55 endpoints row by row · 18 missing endpoints | 425 | |
| [`04-FRONTEND-WEB.md`](04-FRONTEND-WEB.md) | `apps/web` · build · bundle · data layer · UI states · forms · routing · security · a11y | 149 | |
| [`05-MOBILE.md`](05-MOBILE.md) | `apps/mobile` · Expo — **scope decision required** | 26 | |
| [`06-SHARED-PACKAGES.md`](06-SHARED-PACKAGES.md) | `@greatsales/db` · `@greatsales/shared` · Turborepo | 7 | |
| [`07-SECURITY.md`](07-SECURITY.md) | auth · transport · application · data protection — 🔴 hard blocker | 43 | |
| [`08-OBSERVABILITY.md`](08-OBSERVABILITY.md) | logging · errors · metrics · alerting · audit — 🔴 hard blocker | 18 | |
| [`09-PERFORMANCE.md`](09-PERFORMANCE.md) | budgets · load · soak · data scale · horizontal scaling | 13 | |
| [`10-TESTING.md`](10-TESTING.md) | gates and test quality — 🔴 hard blocker | 21 | |
| [`11-BUILD-INFRA.md`](11-BUILD-INFRA.md) | production images · CI/CD · deploy · rollback · infra | 33 | |
| [`12-DATA-OPERATIONS.md`](12-DATA-OPERATIONS.md) | backup · restore · DR · tenant lifecycle — 🔴 hard blocker | 14 | |
| [`13-COMPLIANCE.md`](13-COMPLIANCE.md) | policies · DPA · incident response · support · docs | 14 | |
| [`14-FEATURE-SLICES.md`](14-FEATURE-SLICES.md) | F1–F17 rollup across every layer | 170 | |
| [`15-GO-LIVE.md`](15-GO-LIVE.md) | hard blockers · launch day · regression log · sign-off | 23 | |
| [`99-CODE-BASELINE.md`](99-CODE-BASELINE.md) | what the repo actually looked like on 2026-08-25 — reference only | — | |

**Total: 1,063 items.**

## Suggested order

Layers are not independent. Work them roughly in this order, because a defect in an early layer
cannot be fixed from a later one:

```
01-DATABASE  →  02-BACKEND  →  03-API  →  04-FRONTEND-WEB / 05-MOBILE
                                   ↑
        06-SHARED-PACKAGES ────────┘

07-SECURITY · 08-OBSERVABILITY · 10-TESTING   run alongside all of the above (hard blockers)
09-PERFORMANCE                                once A + C + D have real data
11-BUILD-INFRA · 12-DATA-OPERATIONS           before any production traffic
13-COMPLIANCE                                 before the first paying tenant
14-FEATURE-SLICES                             rollup — updated as slices finish
15-GO-LIVE                                    final gate
```

## Counting progress

```bash
for f in checklists/*.md; do echo "$f: $(grep -o '\[x\]' "$f" | wc -l) done / $(grep -oE '\[[ x~-]\]' "$f" | wc -l) total"; done
```

Copy the numbers into the rollup table in [the master tracker](../PRODUCTION-CHECKLIST.md).
