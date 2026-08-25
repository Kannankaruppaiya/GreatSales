# O. Go-Live — Production Checklist

> **hard blockers · launch day · regression log · sign-off**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 23

**Gate:** FINAL GATE. Nothing ships while a hard blocker is unticked.

**Depends on:** every file in this directory.

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

## O.1 The hard blockers

No production launch while any of these is unticked. Each links to its section above.

| # | Blocker | Section | Status |
| --- | --- | --- | --- |
| O.1.1 | Runtime DB role cannot bypass RLS, proven in production | [A.3.1](01-DATABASE.md) | `[ ]` |
| O.1.2 | Every tenant query is explicitly tenant-filtered in addition to RLS | [A.3.8](01-DATABASE.md) | `[ ]` |
| O.1.3 | Cross-tenant read **and write** denied for every resource, proven by test | [A.3.10](01-DATABASE.md) | `[ ]` |
| O.1.4 | A backup has been restored and verified | [L.3](12-DATA-OPERATIONS.md) | `[ ]` |
| O.1.5 | Rollback has been rehearsed, not just written | [K.2.7](11-BUILD-INFRA.md) | `[ ]` |
| O.1.6 | CI exists and blocks merge on a failing gate | [K.2.1](11-BUILD-INFRA.md) / [J.1.8](10-TESTING.md) | `[ ]` |
| O.1.7 | Readiness probe actually checks the database | [B.3.2](02-BACKEND.md) | `[ ]` |
| O.1.8 | No mock data, demo credential, or seed password in any production bundle | [D.1.6](04-FRONTEND-WEB.md) / [D.1.7](04-FRONTEND-WEB.md) / [G.3.9](07-SECURITY.md) | `[ ]` |
| O.1.9 | No token in browser storage; refresh token httpOnly and revocable | [D.7.1](04-FRONTEND-WEB.md) / [G.1.2](07-SECURITY.md) | `[ ]` |
| O.1.10 | Error tracking + alerting live, with a test alert delivered to a human | [H.6](08-OBSERVABILITY.md) / [H.14](08-OBSERVABILITY.md) | `[ ]` |
| O.1.11 | Secrets in a secret manager, none in the repo or images | [K.3.3](11-BUILD-INFRA.md) | `[ ]` |
| O.1.12 | Swagger disabled or authenticated in production | [B.1.7](02-BACKEND.md) | `[ ]` |
| O.1.13 | Production images built with `NODE_ENV=production` and production `VITE_*` values | [K.1.2](11-BUILD-INFRA.md) / [K.1.3](11-BUILD-INFRA.md) | `[ ]` |
| O.1.14 | Critical-journey E2E green against the deployed production build | [J.2.11](10-TESTING.md) | `[ ]` |
| O.1.15 | Mobile decision made and honoured (ship it properly, or cut it visibly) | [§E](05-MOBILE.md) | `[ ]` |
| O.1.16 | API TypeScript compiles under full `strict` | [B.1.13](02-BACKEND.md) | `[ ]` |

## O.2 Launch day

| # | Item | Status |
| --- | --- | --- |
| O.2.1 | Launch window agreed; everyone needed is available | `[ ]` |
| O.2.2 | Pre-launch backup taken and verified immediately before the deploy | `[ ]` |
| O.2.3 | Rollback decision criteria agreed **in advance** (what metric, what threshold, who calls it) | `[ ]` |
| O.2.4 | Dashboards open and watched for the first hours | `[ ]` |
| O.2.5 | First real tenant onboarded following the written runbook, and the runbook corrected where it was wrong | `[ ]` |
| O.2.6 | Post-launch review at 24h and 7d: error rate, latency, DB growth, user-reported issues | `[ ]` |

## O.3 Regression log

When a previously verified item breaks, set it back to `[ ]` and record it here.

| Date | Item # | What broke | Root cause | Re-verified on |
| --- | --- | --- | --- | --- |
| | | | | |

## O.4 Sign-off

| Layer | Signed by | Date | Notes |
| --- | --- | --- | --- |
| [A Database](01-DATABASE.md) | | | |
| [B Backend runtime](02-BACKEND.md) | | | |
| [C API contract](03-API.md) | | | |
| [D Frontend web](04-FRONTEND-WEB.md) | | | |
| [E Mobile](05-MOBILE.md) | | | |
| [F Shared packages](06-SHARED-PACKAGES.md) | | | |
| [G Security](07-SECURITY.md) | | | |
| [H Observability](08-OBSERVABILITY.md) | | | |
| [I Performance](09-PERFORMANCE.md) | | | |
| [J Testing](10-TESTING.md) | | | |
| [K Build & infra](11-BUILD-INFRA.md) | | | |
| [L Data operations](12-DATA-OPERATIONS.md) | | | |
| [M Compliance](13-COMPLIANCE.md) | | | |
| **PRODUCTION GO-LIVE** | | | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
