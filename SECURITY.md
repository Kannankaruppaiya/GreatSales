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
