# K. Build, Release & Infrastructure — Production Checklist

> **production images · CI/CD · deploy · rollback · infra**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 33

**Gate:** The production artifact must be provably different from the staging one.

**Depends on:** every app layer. **Pairs with:** [L. Data operations](12-DATA-OPERATIONS.md).

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

## K.1 Production build

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| K.1.1 | One documented command builds every production artifact from a clean clone | `[ ]` | |
| K.1.2 | 🔴 API Dockerfile hardcodes `ENV NODE_ENV=staging` — must be build-arg driven and set to `production` for the production image | `[ ]` | |
| K.1.3 | Web Dockerfile's `VITE_*` build args are set to production values (currently defaulted to staging) — and it is understood these are **baked in at build time**, so staging and production need separate images | `[ ]` | |
| K.1.4 | Production image contains no dev dependencies, no source maps served publicly, no test files, no seed data | `[ ]` | |
| K.1.5 | `pnpm install --frozen-lockfile` everywhere; the lockfile is committed and current | `[ ]` | |
| K.1.6 | Image size reviewed and layers cached sensibly | `[ ]` | |
| K.1.7 | Images tagged immutably (commit SHA), never only `latest` | `[ ]` | |
| K.1.8 | The exact artifact tested in staging is the artifact promoted to production — no rebuild between environments except for baked-in `VITE_*` values, which are then re-tested | `[ ]` | |
| K.1.9 | Build provenance / SBOM generated | `[ ]` | |

## K.2 CI/CD

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| K.2.1 | 🔴 **CI pipeline exists** (no `.github/workflows` today) | `[~]` | Added 2026-08-25: `.github/workflows/ci.yml` with four jobs — static (lint, types x3, env-contract checks), web tests, API tests against a real Postgres service as the RLS-bound role, and a cold-cache production build. **It has never run.** YAML parses and every command in it was run locally, but the first real run is the only proof. Do not tick until a run is green. |
| K.2.2 | Every PR runs types, lint, unit, integration, build — and blocks merge on failure | `[~]` | The workflow triggers on `pull_request`, so it runs. **Blocking merge is a branch-protection setting on GitHub, not a file in this repo** — that still has to be turned on, along with K.2.3. |
| K.2.3 | `main` is protected: no direct pushes, review required | `[ ]` | |
| K.2.4 | Deployment is automated and repeatable — no manual copy of files to a server | `[ ]` | |
| K.2.5 | Migrations run as an explicit, ordered step before the new code goes live, and a failed migration aborts the deploy | `[ ]` | |
| K.2.6 | Zero-downtime deploy proven (rolling/blue-green), including during a migration | `[ ]` | |
| K.2.7 | **Rollback rehearsed** — not documented, actually performed, with the time-to-rollback recorded | `[ ]` | |
| K.2.8 | Rollback of code when the schema has moved forward is understood (expand/contract, A.2.7) | `[ ]` | |
| K.2.9 | Post-deploy automated smoke test; a failure triggers an alert or auto-rollback | `[ ]` | |
| K.2.10 | Deployments are logged: what shipped, when, by whom, which commit | `[ ]` | |
| K.2.11 | Release versioning + `CHANGELOG.md` updated per release | `[ ]` | |
| K.2.12 | Feature flags available for risky changes (`FeatureFlag`/`TenantFeatureFlag` models exist — wire them or cut them) | `[ ]` | |

## K.3 Infrastructure

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| K.3.1 | Infrastructure is code (the AWS CDK app described in `DEPLOYMENT.md` is **planned, not built** — build it or replace the plan with what actually exists) | `[ ]` | |
| K.3.2 | Production is a separate account/stack from staging, sharing no credentials | `[ ]` | |
| K.3.3 | Secrets live in a secret manager, injected at runtime, never in an image, repo, or compose file | `[ ]` | |
| K.3.4 | Secret rotation procedure written and rehearsed | `[ ]` | |
| K.3.5 | Network: database not publicly reachable; API reachable only through the load balancer; security groups least-privilege | `[ ]` | |
| K.3.6 | WAF / DDoS protection at the edge | `[ ]` | |
| K.3.7 | DNS configured with sane TTLs and a documented change procedure | `[ ]` | |
| K.3.8 | Multi-AZ / redundancy for API and database, or single-AZ risk explicitly accepted in writing | `[ ]` | |
| K.3.9 | Resource limits (CPU/memory) set on every container, with what happens at the limit understood | `[ ]` | |
| K.3.10 | Log/metric retention and cost reviewed | `[ ]` | |
| K.3.11 | `docker-compose.staging.yml` is staging-only and can never be used for production | `[ ]` | |
| K.3.12 | The `tunnel-config.yml` / any dev tunnel is not reachable from production | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
