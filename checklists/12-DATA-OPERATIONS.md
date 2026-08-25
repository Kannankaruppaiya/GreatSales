# L. Data Operations — Production Checklist

> **backup · restore · DR · tenant lifecycle**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 14

**Gate:** HARD BLOCKER. A backup that has never been restored is not a backup.

**Pairs with:** [K. Build & infra](11-BUILD-INFRA.md), [A.2 migrations](01-DATABASE.md).

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
| L.1 | Automated backups configured with a defined frequency | `[ ]` | |
| L.2 | **RPO and RTO written down and agreed** with the business (how much data may be lost, how long recovery may take) | `[ ]` | |
| L.3 | 🔴 **A restore has actually been performed** from a backup into a fresh database, and the restored data verified. A backup that has never been restored is not a backup | `[ ]` | |
| L.4 | Restore time measured and compared against the agreed RTO | `[ ]` | |
| L.5 | Point-in-time recovery available and tested | `[ ]` | |
| L.6 | Backups encrypted, access-controlled, and stored in a separate failure domain from the primary | `[ ]` | |
| L.7 | Backup retention policy defined and enforced | `[ ]` | |
| L.8 | Backup failure raises an alert — a silently failing backup job is the classic disaster | `[ ]` | |
| L.9 | Disaster-recovery runbook written: total region loss, database corruption, accidental mass delete | `[ ]` | |
| L.10 | A DR drill has been performed end to end | `[ ]` | |
| L.11 | Single-tenant restore is possible without restoring everyone (a customer will ask for this) | `[ ]` | |
| L.12 | Tenant provisioning and de-provisioning procedures are written and tested | `[ ]` | |
| L.13 | Production data-fix procedure defined: who may run SQL against production, how it is reviewed, how it is logged | `[ ]` | |
| L.14 | Seed/demo data can never reach production (guard verified — A.3.12) | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
