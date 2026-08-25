# Security Policy

GreatSales CRM is a multi-tenant SaaS handling customer, sales, and payment data
across isolated tenants. Security is a first-class concern, not an afterthought.

## Reporting a vulnerability

If you discover a security issue, **do not** open a public issue or discuss it in
shared channels. Report it privately to **study@rjpinfotek.com** with:

- a description and impact assessment,
- steps to reproduce (or a proof of concept),
- affected components/versions.

We aim to acknowledge within **2 business days** and to remediate confirmed,
high-severity issues promptly. Please give us reasonable time to fix before any
disclosure.

## Security model

Defense in depth — **two independent layers**:

1. **Role at the API.** Every route passes the global `JwtAuthGuard`
   (`APP_GUARD`); routes are opened explicitly with `@Public`. RBAC permission
   keys (`PERMISSIONS` / `ROLE_PERMISSIONS` in `@greatsales/shared`) gate
   actions. Security is **not** route-path based.

2. **Row-Level Security at the database.** Every tenant-owned table has a
   PostgreSQL RLS policy scoped by `app.tenant_id`.

### The RLS contract (critical — do not break)

- The API connects as the **non-superuser** role `greatsales_app`.
- Each request/transaction sets the tenant:
  `SET LOCAL app.tenant_id = '<tenantId>'` (via `PrismaService.forTenant(tid)`,
  a `$extends` wrapper that runs `set_config('app.tenant_id', tid, true)` in the
  same transaction as the query, with the tenant id parameter-bound).
- If `app.tenant_id` is unset, `current_setting('app.tenant_id', true)` is NULL
  and policies **fail closed** (0 rows, and `WITH CHECK` blocks cross-tenant
  writes).
- Migrations and seed run as superuser `greatsales`, which **bypasses RLS** — by
  design, and only for those tools.
- Global master tables (`Permission`, `Industry`) are shared and intentionally
  have no RLS.
- Platform tables (`PlatformUser`, `PlatformAuditLog`) have `greatsales_app`
  access **revoked**; only the platform console (superuser) touches them.

### Known trap this defends against

`@prisma/client` auto-loads the Prisma schema's env file (`packages/db/.env`,
which holds the **superuser** URL for migrations) at *require* time — before
NestJS `ConfigModule` loads `apps/api/.env`, and `dotenv` won't override an
existing var. Left unguarded, the API would connect as `greatsales`
(`rolbypassrls = t`) and **silently bypass RLS**, allowing cross-tenant reads.

Guards in place:
- `apps/api/src/load-env.ts` calls `dotenv.config({ override: true })` and is the
  **first** import in `main.ts` (before any Prisma import).
- `PrismaService.onModuleInit` queries `current_user` / `is_superuser` and
  **throws — refuses to boot — if the connection is a superuser** (fail-closed).

**Any change to Prisma bootstrap, env loading, or the datasource URL must
preserve both guards.** After such a change, verify a cross-tenant read returns
zero rows using the two seeded tenants (Acme, Globex).

## Authentication

- Passwords hashed with **argon2id** (`@node-rs/argon2`, prebuilt binaries).
- JWTs via `@nestjs/jwt` with **separate access and refresh secrets** and a `typ`
  claim (`access` / `refresh`); tokens are not interchangeable.
- Login requires `tenantId` explicitly — email is unique **per tenant**, not
  globally.
- Platform users support 2FA (`PlatformUser`).

### Session handling

- **The refresh token never enters JavaScript.** Browser clients receive it as
  an `httpOnly`, `Secure`, `SameSite=Lax` cookie (`gs_rt`) scoped to
  `/api/v1/auth`; the response body carries no refresh token at all. An XSS can
  therefore act as the user while the page is open, but cannot exfiltrate a
  seven-day credential. Native clients may opt into body delivery with
  `tokenDelivery: "body"` and are expected to use OS-level secure storage.
- **This requires the API to be same-origin with the web app.** Dev goes
  through the Vite proxy, staging through its reverse proxy
  (`VITE_API_URL=/api/v1`). Splitting the origins would force `SameSite=None`,
  which browsers increasingly block for third-party cookies.
- **Rotation with reuse detection.** Every refresh token has a `jti` backed by
  a `RefreshToken` row and belongs to a rotation *family*. Refreshing consumes
  the presented token and issues its replacement in the same family. Presenting
  an already-consumed token means a stolen copy was replayed, so the **entire
  family is revoked** — the legitimate holder is signed out too, which is
  correct once a credential is known to have leaked.
- **Logout is server-side.** `POST /auth/logout` revokes the family;
  `allSessions: true` (requires a valid access token) revokes every session for
  the user. Clearing client state alone would leave the token usable.
- **Revalidation on every rotation.** Refresh re-checks tenant status, user
  active flag, and lockout — so suspending a tenant or deactivating a user
  takes effect within one access-token TTL (default 15 minutes) rather than at
  the refresh token's 7-day expiry.
- **Access tokens are not persisted** by the web client. A reload restores the
  session from the cookie via `POST /auth/refresh` + `GET /auth/me`. The only
  value in `localStorage` is the last tenant id, which is not a credential.
- **Administrative writes revoke sessions immediately.** Deactivating a user,
  deleting them, changing their role, or resetting their password all revoke
  every live refresh family in the same transaction as the change. Before this,
  the containment window was one access-token TTL — and a *role* change was
  worse than that, because the access token carries `roleId`, so a demoted user
  kept the old role's permissions until their token expired. Each revocation
  records why (`admin_deactivated`, `admin_deleted`, `admin_password_reset`,
  `role_changed`, `role_permissions_changed`, `self_password_change`) so an
  operator can tell months later what ended a session.

### Password lifecycle

- **One policy, both sides.** `packages/shared/src/password.ts` is the single
  definition: minimum 12 characters, maximum 128 **bytes** (argon2 hashes the
  byte string, so a multi-byte password would otherwise cost double), a
  blocklist of common passwords, and no case-insensitive substring of four or
  more characters shared with the user's name, email local-part, or username.
  Modelled on NIST SP 800-63B — deliberately length and blocklist rather than
  composition rules, which push users toward predictable substitutions without
  adding entropy. The web app carries an ADVISORY copy for immediate feedback
  and renders the server's message verbatim on submit, so it can only ever warn
  earlier than the server, never later.
- **Self-service change** — `POST /auth/change-password` requires the CURRENT
  password. An access token alone must not suffice, or a stolen token converts
  into permanent account takeover. Every *other* session is revoked; the
  calling session survives so the user is not ejected from the tab they are in.
- **Admin reset forces a change.** A password an administrator chose is a
  shared secret from the moment it is typed, so `POST /users/:id/reset-password`
  and `POST /users` both set `mustChangePassword`. While that flag is set,
  `MustChangePasswordGuard` refuses every route except `/auth/me`,
  `/auth/change-password`, and `/auth/logout` — enforced server-side, so a
  client that ignores the flag gets 403 rather than data. The flag is read from
  the database, not from the token, so setting it takes effect on the next
  request rather than at token expiry.
- **An admin cannot reset their own password through the admin route.** That
  belongs on `/auth/change-password`, which demands the current password.

### Administrative recoverability

- **A workspace cannot be locked out of itself.** Two invariants, both checked
  inside the write's transaction under a `SELECT … FOR UPDATE` over the
  surviving-administrator set:
  - you cannot deactivate, delete, or change the role of your **own** account
    (`SELF_MUTATION_FORBIDDEN`) — editing your own name or email stays allowed;
  - the **last** active, non-deleted holder of `user.manage` cannot be removed
    by any route (`LAST_ADMIN_PROTECTED`), and `user.manage`/`role.manage`
    cannot be stripped from the last *populated* role that grants them
    (`LAST_ADMIN_ROLE_PROTECTED`).

  The lock is what makes this hold under concurrency: without it, two
  administrators removing each other at the same instant would each read "one
  other admin remains" and both commit, leaving none.
- **Raw SQL must be tenant-scoped explicitly.** `PrismaService.forTenant()`
  extends `$allModels`, which does **not** cover client-level `$queryRaw`. A
  raw query issued through a tenant client therefore runs with `app.tenant_id`
  unset, and RLS answers with zero rows — silently, and inside a "does another
  administrator exist?" check, fail-OPEN. Use
  `PrismaService.transactionForTenant()` for any unit of work that spans more
  than one statement or uses `$queryRaw` at all.

### Brute-force and enumeration defences

- **Two independent controls.** Per-IP throttling (5 login attempts/minute) is
  in-process, so with N API instances an attacker distributing requests gets up
  to N times that budget — it is the fast, best-effort layer. The authoritative
  layer is the **per-account lockout** (5 consecutive failures → 15 minutes),
  which lives in the database and is therefore instance-independent.
  *Accepted trade-off:* an attacker who knows an email can temporarily lock
  that account. Lockout is time-bounded for exactly this reason.
- **`TRUST_PROXY` must be set behind a reverse proxy.** Left unset, `req.ip` is
  the proxy's address, so every client shares one rate-limit bucket and
  `User.lastIp` records the proxy instead of the user.
- **Uniform failure responses.** Wrong password, unknown email, unknown tenant,
  suspended tenant, and deactivated user all return the same
  `401 Invalid credentials`. The not-found path also performs a dummy argon2id
  verify so it costs the same as a real one — without that, response time
  reveals which emails are registered.
- **Credentialed CORS cannot use a wildcard.** The API refuses to start with
  `CORS_ORIGIN="*"` unless `NODE_ENV=development`.
- **No credential ships in the frontend bundle.** Demo login prefill is read
  from `VITE_DEMO_*` and forced empty in production builds
  (`apps/web/src/lib/config.ts`).

### Not yet implemented

Password change, password reset / forgot-password, MFA for tenant users, and a
"sessions on other devices" view are **not built**. There is no self-service
password recovery today.

## Secrets & configuration

- All `.env` files are **gitignored** — never commit secrets, tokens, or
  connection strings.
- Rotate the dev password (`Passw0rd!`) and JWT secrets for any non-local
  environment.
- Production secrets live in the platform secret store (AWS), never in the repo.
- The `greatsales_app` role password must differ from the superuser password in
  every shared/hosted environment.

## Data protection

- **Soft delete only** (`deletedAt`) — no hard deletes of tenant data.
- **Audit trail** on writes (`AuditLog`); platform actions in `PlatformAuditLog`.
- Impersonation / "view as" is **audited** and time-boxed.
- Per-user login IP is recorded (`User.lastIp`).

## Dependencies

- Keep dependencies patched; review advisories before upgrading major versions.
- Prefer prebuilt native modules (e.g. `@node-rs/argon2`) to avoid build-chain
  risk on Windows.

## Scope

This policy covers the code in this repository and its deployed environments. It
does not authorize testing against production tenant data or any denial-of-service
activity.
