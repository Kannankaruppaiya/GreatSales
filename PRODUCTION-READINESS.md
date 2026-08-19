# GreatSales — Production Readiness Checklist

> The checklist a senior engineer runs **before a commercial, multi-tenant SaaS takes real customers and real money**.
> Scoped to *this* stack — Expo mobile (salesperson) · React+Vite web (admin) · NestJS API · Postgres + RLS · Turborepo/pnpm.
>
> **This is NOT an SEO/marketing-website checklist.** GreatSales lives behind a login, so favicons, sitemaps, og:images and Google ranking don't matter here. Tenant isolation, data integrity, auth, and "can I safely charge a customer" **do**.

**Priority legend** — `P0` = blocker, cannot sell without it · `P1` = needed within weeks of launch · `P2` = polish/scale.
**Status** — `[x]` done · `[~]` partial · `[ ]` todo · `[?]` verify in code.

---

## 1. Security & Authentication  *(the part that ends the company if wrong)*

- [ ] `P0` **Token storage** — mobile stores auth/refresh token in `expo-secure-store` (Keychain/Keystore), **never** AsyncStorage. `[?]`
- [ ] `P0` **Refresh-token rotation** — short-lived access token + rotating refresh token; revoke on logout & on theft detection.
- [ ] `P0` **AuthZ deny-by-default** — every API route behind a guard; role checked server-side on **every** request, never trusted from the client.
- [ ] `P0` **Brute-force protection** — login rate-limit + account lockout/backoff; no user-enumeration in error messages.
- [ ] `P0` **Secrets never in git** — `.env` gitignored (✔ already), prod secrets in a manager (Vercel/Cloudflare/1Password), rotated, no secrets in the mobile bundle.
- [ ] `P0` **Transport** — HTTPS/TLS only, HSTS on web, cert pinning optional for mobile.
- [ ] `P1` **CORS** locked to known origins (no `*` in prod).
- [ ] `P1` **Input validation at the boundary** — every API DTO validated (zod/class-validator); reject unknown fields.
- [ ] `P1` **XSS/injection** — no `dangerouslySetInnerHTML` on web; Prisma parameterized queries only (✔ by default); escape any raw SQL.
- [ ] `P1` **Dependency scanning** — `pnpm audit` + Dependabot/Renovate in CI; no known-critical CVEs shipped.
- [ ] `P2` **Security headers** on web (CSP, X-Frame-Options, Referrer-Policy).

## 2. Multi-Tenancy Isolation  *(the #1 way B2B SaaS leaks data)*

- [x] `P0` **RLS enforced** at DB level; app role cannot bypass. `[~ documented]`
- [ ] `P0` **Every query scoped by `workspace_id`** — app DB role bypasses RLS per your notes, so this is an app-layer invariant, not a DB safety net.
- [ ] `P0` **Cross-tenant test** — an automated test that logs in as Tenant A and *fails* to read/write Tenant B's rows. Ship nothing until this is green.
- [ ] `P1` **Tenant context propagation** — `workspace_id` flows request → service → query → logs; never inferred from client input.
- [ ] `P1` **No global caches keyed without tenant** — cache keys must include tenant id.

## 3. Database & Data Integrity

- [x] `P0` **Migrate vs runtime role split** — superuser migrates, app role runs (✔ your setup).
- [ ] `P0` **Automated backups + tested restore** — PITR on; actually *restore* once to prove it works.
- [ ] `P0` **DB-level constraints** — NOT NULL, FK, UNIQUE, CHECK — don't rely on app validation alone.
- [ ] `P1` **Indexes** on every FK and filter/sort column; check the slow-query log; kill N+1s.
- [ ] `P1` **Transactions** wrap multi-row writes (order + line items + timeline) so partial writes can't happen.
- [ ] `P1` **Migrations reversible & CI-tested** — no manual prod schema edits, ever.
- [ ] `P1` **Connection pooling** (pgbouncer/Supabase pooler) sized for serverless.
- [ ] `P2` **Soft-delete policy** decided (audit/undo vs hard delete + GDPR erase).

## 4. API / Backend (NestJS)

- [x] `P1` **Versioned API** (`/api/v1`) ✔.
- [ ] `P0` **Consistent error envelope** — no stack traces or SQL leaked to clients; map errors to safe codes.
- [ ] `P0` **Pagination on all list endpoints** — never return an unbounded table.
- [ ] `P1` **Idempotency** on create/payment mutations (idempotency key) so a retry can't double-charge/double-create.
- [ ] `P1` **Timeouts + retries** on every outbound call; circuit-break slow deps.
- [ ] `P1` **Health/readiness endpoints** for the platform's load balancer.
- [ ] `P1` **Structured logging** with `requestId` + `tenantId` + `userId` on every log line.
- [ ] `P2` **Graceful shutdown** — drain in-flight requests on deploy.

## 5. Mobile App (Expo / React Native)

- [ ] `P0` **Crash reporting** — Sentry (or similar) capturing JS + native crashes with release/version.
- [ ] `P0` **Deep-link param validation** — validate every route param with zod before use (untrusted input).
- [ ] `P1` **Offline / retry** — network-loss handling; the in-memory store is fine for a demo, but real data needs a server cache (TanStack Query) + `AsyncStorage`/MMKV persistence for non-secret data.
- [ ] `P1` **Error boundaries** around screens so one bad render doesn't white-screen the app.
- [ ] `P1` **Force-update gate** — app checks min supported version, blocks stale clients.
- [ ] `P1` **OTA strategy** — EAS Update channel per env; know what ships JS-only vs needs a store build.
- [x] `P1` **Loading / empty / error states** on lists ✔.
- [ ] `P2` **Accessibility** — `accessibilityLabel` on icon buttons & images, screen-reader order, Dynamic Type.
- [ ] `P2` **New Architecture compat** verified for every native dep.

## 6. Web Admin (React + Vite)

- [ ] `P0` **Route guards by role** — admin/manager routes unreachable without the role (client guard + server enforce).
- [ ] `P1` **Error + 404 pages**, not a blank screen on crash.
- [ ] `P1` **Env-based config** — API URL from env, nothing hardcoded per environment.
- [ ] `P2` **Source maps** hidden or auth-gated in prod; route-level code splitting; bundle budget.

## 7. Observability & Ops

- [ ] `P0` **Error tracking wired in all 3 apps** (mobile, web, API) with source maps uploaded.
- [ ] `P0` **Uptime + alerting** — someone gets paged when the API is down or error rate spikes.
- [ ] `P1` **Audit trail** — who changed which record when (customers, orders, payments) — B2B customers will ask.
- [ ] `P1` **Metrics/APM** — latency, error rate, DB time per endpoint.
- [ ] `P1` **Log retention + no PII in logs** (mask phone/email/tokens).

## 8. Testing & CI/CD

- [ ] `P0` **CI on every PR** — install → typecheck → lint → test → build; red = no merge.
- [ ] `P0` **Multi-tenant isolation test** (see §2) in CI.
- [ ] `P1` **Integration tests** for API + DB (auth, orders, payments happy + failure paths).
- [ ] `P1` **E2E smoke** on the critical flow (login → add lead → create SO → collect payment).
- [ ] `P1` **DB migration step** gated in the deploy pipeline with rollback.
- [ ] `P1` **Release versioning** — semver + CHANGELOG (✔ CHANGELOG exists), EAS build numbers, git tags.
- [ ] `P2` **Preview environments** per PR.
- [ ] `P2` **Feature flags** for risky rollouts.

## 9. Performance & Scale

- [x] `P1` **List virtualization** — FlatList used ✔.
- [ ] `P1` **Server-side query caching** (TanStack Query) once wired; stale-while-revalidate.
- [ ] `P1` **DB query budget** — p95 endpoint latency target; index before it hurts.
- [ ] `P2` **Image/asset optimization**, bundle-size budgets in CI.
- [ ] `P2` **Load test** the multi-tenant API at expected concurrency before onboarding a big customer.

## 10. Commercial / Legal / Compliance  *(because it's a product you sell)*

- [ ] `P0` **Privacy Policy + Terms of Service** live and linked.
- [ ] `P0` **Data residency / GDPR-DPDP** — decide the region; contacts' phone/email are personal data.
- [ ] `P1` **Data export + "delete my data"** (tenant offboarding, right to erasure).
- [ ] `P1` **Tenant onboarding/offboarding runbook** — provision, seed roles, suspend, delete.
- [ ] `P1` **Incident response + SLA** — status page, on-call, comms template.
- [ ] `P2` **Dependency license audit** — no GPL surprise in a commercial product.
- [x] `P2` **LICENSE = GreatWorks** ✔.

## 11. Developer Experience / Maintainability

- [x] README, ARCHITECTURE, SECURITY, DEPLOYMENT, CONTRIBUTING, CODE_OF_CONDUCT ✔.
- [ ] `P1` **`.env.example`** for every app so a new dev boots in one pass.
- [x] Shared types/validation (`packages/shared` zod) ✔.
- [x] Central eslint/tsconfig ✔.
- [ ] `P2` **CODEOWNERS + PR review rules**.
- [ ] `P2` **ADRs** for the big decisions (RLS model, in-memory→server-cache, desktop pivot).

---

### How to use this
1. Fix all `P0` before charging a single customer — those are the "lose data / lose the company" items.
2. `P1` in the first weeks post-launch.
3. `P2` as you scale.

**The three that would worry a veteran most on GreatSales today:**
1. **Tenant-isolation test** (§2) — app role bypasses RLS, so isolation is currently an *unproven* app-layer promise.
2. **Token storage + refresh rotation** (§1) — verify mobile uses SecureStore, not AsyncStorage.
3. **Crash/error tracking + backups-with-tested-restore** (§7, §3) — you can't fix what you can't see, and can't recover what you never restored.
