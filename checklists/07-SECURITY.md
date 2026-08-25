# G. Security — Production Checklist

> **auth · transport · application · data protection**
>
> Part of the [GreatSales Master Production Tracker](../PRODUCTION-CHECKLIST.md) · governed by [`AGENTS.md`](../AGENTS.md).
>
> **Production build only.** Every item is judged against a **production build**
> (`NODE_ENV=production`, `nest build` / `vite build` / EAS release) running against a
> **production-shaped database**. A working dev server, a seeded demo tenant, or a green
> unit test is **not** evidence.

**Layer owner:** ______________ · **Last reviewed:** 2026-08-25 · **Items:** 43

**Gate:** HARD BLOCKER. No go-live with an unticked item here.

**Cuts across:** every layer. Read with [A.3 RLS](01-DATABASE.md) and [B.5 AuthZ](02-BACKEND.md).

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

## G.1 Authentication & session

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| G.1.1 | Password hashing is argon2id with reviewed parameters (memory, iterations, parallelism) sized for the production instance | `[ ]` | |
| G.1.2 | Refresh tokens are stored server-side (`RefreshToken` model), revocable, and **reuse is detected** — a replayed token kills the whole family | `[ ]` | |
| G.1.3 | Logout revokes the refresh token server-side, not only client state | `[ ]` | |
| G.1.4 | Refresh re-checks user active status **and** tenant status (Suspended/Churned) on every refresh, not only at login | `[ ]` | |
| G.1.5 | Refresh cookie is `httpOnly`, `Secure`, `SameSite=Lax`, path-scoped to `/api/v1/auth`, with a sane `Max-Age` | `[ ]` | |
| G.1.6 | Access-token TTL is short (≤15m) and the revocation window is documented and accepted | `[ ]` | |
| G.1.7 | Login response time is constant whether or not the account exists (no timing enumeration) | `[ ]` | |
| G.1.8 | The error message is identical for unknown user, wrong password, inactive user, and suspended tenant | `[ ]` | |
| G.1.9 | Per-account lockout/backoff on repeated failures, independent of instance count | `[ ]` | |
| G.1.10 | Per-IP throttling on `/auth/*` with the real client IP (depends on B.1.6) | `[ ]` | |
| G.1.11 | Failed logins are audited with IP, user agent, and timestamp | `[ ]` | |
| G.1.12 | Password policy enforced server-side (length, breach-list check or equivalent) — not only in the UI | `[ ]` | |
| G.1.13 | Change-password requires the current password and revokes all other sessions | `[ ]` | |
| G.1.14 | JWT `alg` is pinned; `none` and algorithm-confusion are impossible; `iss`/`aud`/`exp` all verified | `[ ]` | |
| G.1.15 | Access and refresh secrets are different values, rotatable without logging everyone out mid-rotation (or the rotation downtime is documented) | `[~]` | Production boot now rejects identical or <32-char JWT secrets (`env.ts` productionRules); negative test 2026-08-25 fired both rules. Remaining: the rotation procedure itself. |
| G.1.16 | Tenant identification at sign-in is resolved (subdomain / email-derived / explicit) and is not an enumeration surface (F1 decision D9) | `[ ]` | |
| G.1.17 | MFA: shipped, or explicitly deferred with a written risk acceptance | `[ ]` | |

## G.2 Transport & headers

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| G.2.1 | TLS everywhere; HTTP redirects to HTTPS; TLS 1.2+ only | `[ ]` | |
| G.2.2 | HSTS with a long max-age and `includeSubDomains` | `[ ]` | |
| G.2.3 | Certificate auto-renewal working, with an expiry alarm | `[ ]` | |
| G.2.4 | Helmet's defaults reviewed rather than accepted blindly; CSP configured for the API's actual needs | `[ ]` | |
| G.2.5 | CORS allow-list contains only the real production origins; credentials mode verified end to end | `[ ]` | |
| G.2.6 | CSRF: the cookie flow is `SameSite=Lax` and every state-changing request also carries a Bearer token (double-submit) — or an explicit CSRF token is used. **Written down which one, and tested.** | `[ ]` | |

## G.3 Application security

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| G.3.1 | No SQL injection: every raw query parameterised (see A.3.9) | `[ ]` | |
| G.3.2 | No mass assignment: request bodies are allow-listed, never spread into a Prisma `data` object | `[ ]` | |
| G.3.3 | No IDOR: every id-addressed resource checks tenancy + ownership (B.5.6) | `[ ]` | |
| G.3.4 | No sensitive data in URLs, query strings, or logs (emails, tokens, ids that identify a person) | `[ ]` | |
| G.3.5 | File upload (when built): type sniffing, size cap, virus scanning decision, storage outside the web root, no user-controlled path | `[ ]` | |
| G.3.6 | SSRF: no user-supplied URL is fetched server-side | `[ ]` | |
| G.3.7 | Dependency scanning in CI, with a policy for what blocks a release | `[ ]` | |
| G.3.8 | Secrets scanning on every commit; the git history has been scanned for previously committed secrets | `[ ]` | |
| G.3.9 | 🔴 No real credential, seed password, or tenant data in any committed file, example env, fixture, or test | `[ ]` | |
| G.3.10 | Container images run as non-root (API does — verify web/nginx too), with no shell/package manager left in the runtime layer where avoidable | `[ ]` | |
| G.3.11 | Base images pinned by digest and rebuilt on CVE | `[ ]` | |
| G.3.12 | An external penetration test or a structured internal threat model has been done and its findings closed | `[ ]` | |

## G.4 Data protection & privacy

| # | Item | Status | Evidence |
| --- | --- | --- | --- |
| G.4.1 | Encryption at rest for the database, backups, and any object storage | `[ ]` | |
| G.4.2 | PII inventory written: exactly which columns hold personal data | `[ ]` | |
| G.4.3 | Data retention policy per entity, with automated deletion | `[ ]` | |
| G.4.4 | Tenant data export (portability) and tenant data deletion (right to erasure) are implemented and tested end to end | `[ ]` | |
| G.4.5 | Backups honour deletion — a deleted tenant does not live forever in backups without a documented, communicated window | `[ ]` | |
| G.4.6 | Logs are PII-scrubbed; no request body containing personal data is logged | `[ ]` | |
| G.4.7 | Access to production data is role-restricted, logged, and requires a documented break-glass procedure | `[ ]` | |
| G.4.8 | Third-party processors (Sentry, PostHog, SES, hosting) listed with what data each receives | `[ ]` | |

---

---

[← Master tracker](../PRODUCTION-CHECKLIST.md) · [All checklists](README.md)
