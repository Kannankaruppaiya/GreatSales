# GreatSales — End-to-End Engineering Checklist

> Full-stack, layer-by-layer production checklist synthesised from battle-tested GitHub checklists + 2025/26 best-practice research, scoped to **this** stack:
> **Mobile** Expo/React Native · **Web** React + Vite · **API** NestJS · **DB** PostgreSQL + Prisma + RLS (Supabase) · **Infra** Docker + AWS/CDK · **Monorepo** Turborepo + pnpm.
>
> Not an SEO/marketing list. This is "can we run a commercial multi-tenant SaaS without losing data, leaking tenants, or waking up to an outage we can't see."
>
> `P0` blocker · `P1` weeks after launch · `P2` scale/polish · `[x]` done `[~]` partial `[ ]` todo `[?]` verify

---

## 1 · Frontend — Web Admin (React + Vite)

- [x] `P0` No secret carries a `VITE_` prefix — anything prefixed is embedded **plain-text** in the minified bundle, readable by every visitor.
- [x] `P0` `build.sourcemap: false` (or `'hidden'` for Sentry upload) — Vite ships source maps to prod by default, handing attackers your code + key locations.
- [x] `P0` Role-based route guards — admin/manager routes unreachable without the role (client guard + **server enforce**, never trust the client).
- [x] `P1` Custom error boundary + 404/500 pages — no blank white screen on crash.
- [x] `P1` API base URL from env per environment; nothing hardcoded.
- [x] `P1` No server-only util accidentally imported into client bundle (a classic leak path).
- [x] `P1` Loading / empty / error state on every data view.
- [x] `P2` Route-level code splitting + bundle-size budget in CI.
- [x] `P2` Security headers (CSP report-only → enforce, X-Frame-Options, Referrer-Policy).
- [x] `P2` Accessibility: labels, focus order, keyboard nav, contrast.

## 2 · Frontend — Mobile (Expo / React Native)

- [ ] `P0` Auth/refresh tokens in `expo-secure-store` (Keychain/Keystore), **never** AsyncStorage.
- [ ] `P0` No secret in `EXPO_PUBLIC_*` — those land readable in the production bundle (Metro strips only *un*prefixed vars).
- [ ] `P0` Crash reporting (Sentry) capturing JS **and** native crashes, tagged with release + runtime version.
- [ ] `P1` **Runtime version** is the JS↔native contract — an OTA bundle calling a native module the binary lacks crashes on launch. Bump runtime version whenever native deps change.
- [ ] `P1` OTA code-signing: private key **never** committed; bundle hash (SHA-256) verified; tampered updates auto-rejected.
- [ ] `P1` Staged OTA rollout (never 100% instantly) + force-update gate for stale clients.
- [ ] `P1` Deep-link / route params validated with zod before use (untrusted input).
- [ ] `P1` Error boundaries per screen; graceful network-loss handling + retry.
- [ ] `P1` Server-cache (TanStack Query) for remote data + `AsyncStorage`/MMKV for non-secret persistence (replaces the demo in-memory store).
- [ ] `P2` Accessibility labels on icon buttons/images; Dynamic Type; New-Architecture compat verified for each native dep.

## 3 · Backend — API (NestJS)

- [ ] `P0` `helmet()` for security headers + global validation pipe (`whitelist: true`, reject unknown fields).
- [ ] `P0` Rate limiting (`@nestjs/throttler`, ~100 req/min/IP) + stricter limit on `/auth/login`.
- [ ] `P0` Error filter returns safe codes — no stack traces, SQL, or internals leaked to clients.
- [ ] `P0` Every route behind an auth guard; role checked server-side on **every** request (deny-by-default).
- [ ] `P1` Pagination on all list endpoints — never return an unbounded table.
- [ ] `P1` Idempotency keys on create/payment mutations so a client retry can't double-write.
- [ ] `P1` CORS locked to known origins (no `*`).
- [ ] `P1` Timeouts + retries on outbound calls; health/readiness endpoints for the LB.
- [ ] `P1` Structured logs with `requestId` + `tenantId` + `userId`; no PII/tokens in logs.
- [ ] `P2` Graceful shutdown (drain in-flight requests on deploy).
- [ ] `P2` API versioned (`/api/v1` ✔) + OpenAPI/Swagger generated.

## 4 · Database (PostgreSQL + Prisma + RLS / Supabase)

- [ ] `P0` **RLS enabled on every table** in the public schema — no exceptions. Without it, the anon key reads everything.
- [ ] `P0` Runtime app role is a plain role (no superuser, no `BYPASSRLS`); consider `FORCE ROW LEVEL SECURITY`. Table owners + superusers silently bypass RLS.
- [ ] `P0` Supabase `service_role` key lives **only** on the backend — never in mobile/web bundles (it bypasses RLS and fails silently until data is already exposed).
- [ ] `P0` Tenant id (`workspace_id`) set **inside a transaction** when using `current_setting` — a pooled connection can otherwise read the previous request's tenant.
- [ ] `P0` Automated backups **+ a tested restore** (actually restore once) + PITR.
- [ ] `P1` DB-level constraints: NOT NULL, FK, UNIQUE, CHECK — not app validation alone.
- [ ] `P1` Indexes on every FK + filter/sort column; watch slow-query log; kill N+1s.
- [ ] `P1` Multi-step writes wrapped in transactions.
- [ ] `P1` Migrations reversible + run in CI + as an explicit gated deploy step; **no manual prod schema edits**.
- [ ] `P1` RLS policy that JOINs another RLS table is tested — the joined table's RLS can silently break the query.
- [ ] `P2` Connection pooling (Supabase pooler/pgbouncer) sized for serverless; soft-delete vs hard-delete policy decided.

## 5 · Multi-Tenancy (cross-cutting — the SaaS killer)

- [ ] `P0` Every query scoped by `workspace_id` at the app layer (RLS is the net, not the only wall).
- [ ] `P0` **Automated cross-tenant test** — log in as Tenant A, assert you cannot read/write Tenant B's rows. Ship nothing until green.
- [ ] `P1` Tenant context flows request → service → query → logs; never inferred from client input.
- [ ] `P1` Cache keys include tenant id; no global cache shared across tenants.

## 6 · Server / Infra / DevOps (Docker + AWS/CDK)

- [ ] `P0` Infra as code (CDK/Terraform) — staging + prod provisioned from the **same** template.
- [ ] `P0` Secrets in a manager (AWS Secrets Manager/SSM), not env files in the image or git.
- [ ] `P0` TLS everywhere (HTTPS/HSTS); reverse proxy syntax-checked before deploy.
- [ ] `P1` Docker: official minimal base image, pinned versions, `HEALTHCHECK` defined, non-root user, multi-stage build.
- [ ] `P1` Zero-downtime deploys — blue-green / canary / rolling, with **automated rollback** on failed health check.
- [ ] `P1` Staging mirrors prod exactly; migration runs as an explicit pipeline step.
- [ ] `P1` Autoscaling + resource limits; DB connection limits respected.
- [ ] `P2` CDN/WAF in front; DDoS protection; artifact registry versioned + separate from source.

## 7 · Security (cross-cutting)

- [ ] `P0` `.env` gitignored (✔); no secrets in git history (scan with gitleaks/trufflehog).
- [ ] `P0` Refresh-token rotation + revoke on logout/theft; short-lived access tokens.
- [ ] `P0` Brute-force lockout/backoff on login; no user-enumeration in error text.
- [ ] `P1` `pnpm audit` + Dependabot/Renovate in CI (400k+ CVEs logged in 2025 — no critical ships).
- [ ] `P1` Input validation at every boundary (API DTOs, forms, deep links).
- [ ] `P1` No `dangerouslySetInnerHTML`; Prisma parameterized only; escape any raw SQL.
- [ ] `P2` Periodic pen-test / OWASP Top 10 pass; security headers audited.

## 8 · Observability & Monitoring

- [ ] `P0` Error tracking wired in all 3 apps (mobile/web/API) with source maps uploaded.
- [ ] `P0` Uptime monitoring + alerting — someone gets **paged** when API is down or error rate spikes.
- [ ] `P1` Audit trail: who changed which record when (customers/orders/payments) — B2B buyers ask for it.
- [ ] `P1` APM/metrics: p95 latency, error rate, DB time per endpoint; dashboards.
- [ ] `P1` Log aggregation + retention policy; PII masked.
- [ ] `P2` Synthetic checks on the critical flow; anomaly/abuse detection on usage patterns.

## 9 · Testing

- [ ] `P0` Unit tests on domain logic (pricing, aging, stage transitions).
- [ ] `P0` Cross-tenant isolation test in CI (see §5).
- [ ] `P1` Integration tests: API + DB, happy + failure paths (auth, orders, payments).
- [ ] `P1` E2E smoke on the critical flow: login → add lead → create SO → collect payment.
- [ ] `P1` Coverage target (~70%+ on core); contract tests between app boundaries.
- [ ] `P2` Load test the multi-tenant API at expected concurrency before onboarding a big tenant.

## 10 · CI/CD & Release

- [ ] `P0` CI on every PR: install → typecheck → lint → test → build; red = no merge.
- [ ] `P0` Trunk-based/short-lived branches; artifacts versioned + stored separately from source.
- [ ] `P1` Gated DB migration step with rollback in the pipeline.
- [ ] `P1` Semver + CHANGELOG (✔) + git tags; EAS build numbers for mobile.
- [ ] `P2` Preview environment per PR; feature flags for risky rollouts.

## 11 · Commercial / Legal / Ops

- [ ] `P0` Privacy Policy + Terms of Service live; data residency (GDPR/DPDP) decided — contact phone/email is personal data.
- [ ] `P1` Data export + "delete my data" (tenant offboarding, right to erasure).
- [ ] `P1` Tenant onboarding/offboarding runbook; incident-response + status page + SLA.
- [ ] `P2` Dependency license audit (no GPL surprise in a commercial product); DPA template.

## 12 · Docs & Developer Experience

- [x] README, ARCHITECTURE, SECURITY, DEPLOYMENT, CONTRIBUTING, CODE_OF_CONDUCT, LICENSE (GreatWorks) ✔.
- [ ] `P1` `.env.example` for every app; one-command local boot; "how to run locally" per service.
- [x] Shared types/validation (`packages/shared` zod) + central eslint/tsconfig ✔.
- [ ] `P2` CODEOWNERS + PR review rules; ADRs for big decisions (RLS model, desktop pivot, in-memory→server-cache).

---

### The 5 that would fail a launch review on GreatSales today
1. **Cross-tenant isolation test** (§5) — app role can bypass RLS, so isolation is unproven.
2. **Secret hygiene** (§1/§2/§4) — audit every `VITE_`/`EXPO_PUBLIC_` and keep `service_role` server-only.
3. **Token storage + refresh rotation** (§2/§7).
4. **Backups with a *tested* restore** (§4).
5. **Error tracking + uptime alerting** across all three apps (§8) — you can't fix what you can't see.

---

### Sources
- GitHub: [awesome-checklists](https://github.com/israelroldan/awesome-checklists) · [production-ready-checklist](https://github.com/PrekshaShah2509/production-ready-checklist) · [microservice-production-readiness](https://github.com/kgoralski/microservice-production-readiness-checklist) · [devops-checklist](https://github.com/anugurthi/devops-checklist)
- Postgres RLS: [production pattern](https://theroadtoenterprise.com/blog/postgres-rls-multi-tenant-saas) · [Prisma RLS extension](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security)
- Supabase: [RLS best practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) · [anon vs service_role](https://www.stingrai.io/blog/supabase-powerful-but-one-misconfiguration-away-from-disaster)
- NestJS: [security defaults](https://medium.com/@duckweave/nestjs-security-defaults-7-switches-youll-thank-yourself-for-b9ff3f4ea026)
- Vite: [env var security](https://merge.rocks/resources/websites-playbook/website-strategy-planning/vite-environment-variables-secure-usage-patterns-for-production-builds) · [source-map leak](https://www.sprocketsecurity.com/blog/hunting-secrets-in-javascript-at-scale-how-a-vite-misconfiguration-lead-to-full-ci-cd-compromise)
- Expo: [OTA safe rollout](https://www.72technologies.com/blog/expo-eas-ota-updates-without-bricking-production) · [OTA signing/fingerprinting](https://medium.com/@_.sirsha/ota-updates-in-a-production-expo-app-signing-fingerprinting-tagging-and-rolling-out-safely-edee6df07f76)
- DevOps: [CI/CD checklist](https://informatix.systems/blog/techops-and-optimization/the-ultimate-checklist-for-ci-cd-pipelines/) · [zero-downtime Docker+Nginx](https://www.deployhq.com/blog/the-ultimate-deployment-checklist-ensuring-smooth-and-successful-releases) · [AWS deployment checklist](https://www.qovery.com/blog/aws-production-deployment-checklist)
