# M. Compliance, Legal & Business Readiness — Production Checklist

> **policies · DPA · incident response · support · docs**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 14

**Gate:** Commercial product gate — not an engineering afterthought.

**Pairs with:** [G.4 data protection](07-SECURITY.md).

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
| M.1 | Terms of Service and Privacy Policy published and linked from the app | `[ ]` | |
| M.2 | Data Processing Agreement template ready for tenants who ask | `[ ]` | |
| M.3 | Applicable regulation identified (India DPDP Act, and GDPR if any EU data) with the gaps closed | `[ ]` | |
| M.4 | Cookie/consent handling correct for the cookies actually set | `[ ]` | |
| M.5 | Subprocessor list published (G.4.8) | `[ ]` | |
| M.6 | Security incident response plan written, including breach-notification timelines | `[ ]` | |
| M.7 | Support channel exists, with a defined response expectation | `[ ]` | |
| M.8 | Status page or a defined way to tell customers about an outage | `[ ]` | |
| M.9 | SLA/uptime commitment decided (even if "best effort") and stated honestly | `[ ]` | |
| M.10 | Onboarding runbook for a new tenant | `[ ]` | |
| M.11 | User-facing documentation / help for the four roles | `[ ]` | |
| M.12 | Internal runbook: common operational tasks, written so someone other than the author can run them | `[ ]` | |
| M.13 | Licence and IP position clear for a commercial product (repo currently carries `LICENSE.md` — confirm it matches the commercial intent) | `[ ]` | |
| M.14 | Pricing/billing decision: manual onboarding is documented as the v1 answer, with the manual process written down | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
