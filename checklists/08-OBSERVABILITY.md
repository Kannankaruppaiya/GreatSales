# H. Observability — Production Checklist

> **logging · errors · metrics · alerting · audit trail**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 18

**Gate:** HARD BLOCKER. If a failure is not diagnosable, the feature is not done.

**Cuts across:** every layer.

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
| H.1 | Structured JSON logging in production (Nest's default pretty logger is not production logging) | `[ ]` | |
| H.2 | Every log line carries: timestamp, level, request id, tenant id, user id, route, duration, status | `[ ]` | |
| H.3 | Log levels used correctly; production runs at `info` and can be raised without a redeploy | `[ ]` | |
| H.4 | Logs shipped off-instance to a searchable store with a defined retention | `[ ]` | |
| H.5 | Request/correlation id generated at the edge, propagated through the API, returned to the client, and surfaced in the UI error message so a user can quote it | `[ ]` | |
| H.6 | Error tracking (Sentry or equivalent) wired in **API, web, and mobile**, with releases and source maps | `[ ]` | |
| H.7 | Every 5xx creates an alertable event; errors are grouped and not drowned in noise | `[ ]` | |
| H.8 | Metrics: request rate, error rate, p50/p95/p99 latency per route | `[ ]` | |
| H.9 | Metrics: DB connection pool usage, query duration, slow-query count | `[ ]` | |
| H.10 | Metrics: process CPU, memory, event-loop lag, restart count | `[ ]` | |
| H.11 | Business metrics: logins, failed logins, records created per entity, active tenants | `[ ]` | |
| H.12 | Dashboards exist and someone actually looks at them daily | `[ ]` | |
| H.13 | Alerts defined with owners and thresholds: 5xx rate, p99 latency, DB connections, disk, certificate expiry, failed-login spike, health-check failure | `[ ]` | |
| H.14 | Alerts route to a real person via a real channel, and a test alert has been fired end to end | `[ ]` | |
| H.15 | On-call / escalation path written down, even if it is one person | `[ ]` | |
| H.16 | Uptime monitoring from outside the infrastructure | `[ ]` | |
| H.17 | Audit trail is queryable in production: "who changed this record and when" answerable for every entity (needs C.3.9) | `[ ]` | |
| H.18 | Distributed tracing, or a documented decision that request-id correlation is sufficient for v1 | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
