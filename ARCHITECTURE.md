# Architecture

GreatSales CRM is a multi-tenant SaaS: **two client surfaces on one backend**,
with tenant isolation enforced at both the API and the database.

## System overview

```
                       ┌──────────────────────────────┐
   Salespeople  ─────▶ │  Mobile app (Expo / RN)      │
   (field, offline)    │  offline-first + PowerSync   │
                       └──────────────┬───────────────┘
                                      │  sync
   Tenant Admin  ─────▶ ┌─────────────┴───────────────┐
   Management          │  Web console (React + Vite)  │
   (RBAC)             └──────────────┬───────────────┘
                                      │  HTTPS  /api/v1  (JWT)
                       ┌──────────────┴───────────────┐
                       │  API (NestJS modular monolith)│
                       │  JWT+RBAC guard · Zod DTOs    │
                       │  Prisma $extends per-request  │
                       │  SET LOCAL app.tenant_id      │
                       └──────────────┬───────────────┘
                                      │  role: greatsales_app (RLS-bound)
                       ┌──────────────┴───────────────┐
                       │  PostgreSQL + Row-Level Sec.  │
                       │  Redis + BullMQ (jobs/queues) │
                       └──────────────────────────────┘

   Platform Super-Admin ─▶ separate console, role: greatsales (RLS bypass)  [Phase 2]
```

## Roles & surfaces

| Role | Surface | Login | DB role | Scope |
|---|---|---|---|---|
| Salesperson | Mobile | mobile | `greatsales_app` | own data (offline-first) |
| Management | Web | web | `greatsales_app` | team/company **view** (mostly read) |
| Tenant Admin | Web | web | `greatsales_app` | one tenant — full control |
| Platform Super-Admin | Separate console | separate auth | `greatsales` (superuser) | ALL tenants + platform |

Full capability breakdown: [ADMIN-CAPABILITIES.md](ADMIN-CAPABILITIES.md).

## Tenant isolation (the core security invariant)

Security is **two layers**, not route-based:

1. **Role at the API** — `JwtAuthGuard` + RBAC permission checks on every route.
2. **RLS at the DB** — PostgreSQL Row-Level Security policies scope every
   tenant-owned table by `app.tenant_id`.

The running API connects as the **non-superuser** role `greatsales_app` and runs
`SET LOCAL app.tenant_id='<tenantId>'` inside the same transaction as each query
(via a Prisma `$extends` wrapper, `PrismaService.forTenant(tid)`). If the setting
is unset, `current_setting('app.tenant_id', true)` is NULL and RLS **fails
closed** (returns 0 rows).

- Migrations & seed run as superuser `greatsales`, which **bypasses RLS**.
- The API must **never** connect as a superuser. `PrismaService.onModuleInit`
  checks `is_superuser` and **refuses to boot** if it is one (fail-closed).
- Global master tables (`Permission`, `Industry`) are shared and have **no RLS**.

See [SECURITY.md](SECURITY.md) for the full contract and the env-pollution trap
that this guard defends against.

## Layers

### API (`apps/api`) — NestJS modular monolith
- `PrismaService` extends `PrismaClient`, constructed with an explicit
  `datasourceUrl` (the `greatsales_app` URL).
- `forTenant(tid)` wraps each model op in a transaction:
  `$transaction([set_config('app.tenant_id', tid, true), query(args)])`.
- Auth: `@node-rs/argon2` (prebuilt, Windows-safe) + `@nestjs/jwt`
  (separate access/refresh secrets, `typ` claim). Global `JwtAuthGuard`
  (`APP_GUARD`) with `@Public` / `@CurrentUser` decorators.
- `ZodValidationPipe` for DTOs; `AllExceptionsFilter` → uniform `ApiErrorBody`.
- Bootstrap: helmet, CORS, `/api/v1` prefix, Swagger at `/api/docs`.
- Endpoints today: `POST /auth/login`, `/auth/refresh`, `GET /auth/me`, `/health`.

### Data (`packages/db`) — Prisma + PostgreSQL
- Single source of truth for the schema (28+ models, 10+ enums).
- Migrations, `prisma/seed.ts` (2 tenants + platform), and RLS policy migration.
- Consumed as raw TS by tooling; the API imports the generated client.
- Full model spec: [DB-SCHEMA-CHECKLIST.md](DB-SCHEMA-CHECKLIST.md).

### Contracts (`packages/shared`) — zod
- zod schemas + inferred types (auth, RBAC `PERMISSIONS`/`ROLE_PERMISSIONS`,
  pagination, `ApiErrorBody`).
- **Builds to `dist` (CJS + `.d.ts`)** — the NestJS runtime is CJS, so a raw-TS
  workspace import would crash. Always `pnpm --filter @greatsales/shared build`
  before running the API.

### Web console (`apps/web`) — React 19 + Vite 6
- Vite 6 + `@vitejs/plugin-react` + Tailwind v4 (`@tailwindcss/vite`) +
  React Router v7 + `@tanstack/react-query` + zustand.
- **Single tsconfig** (`tsc --noEmit && vite build`) — project references trip
  TS6310, so do not split.
- Internal authed dashboard: no SSR/SEO need → SPA, cheap static hosting
  (S3 + CloudFront). This is why it is **not** Next.js.
- Currently renders deterministic mock data; API wiring is the next milestone.

### Mobile (`apps/mobile`) — Expo / React Native
- Offline-first salesperson app; sync via **PowerSync** (not a custom engine —
  the biggest risk deliberately avoided).
- `.npmrc` uses `node-linker=hoisted` for Expo/Metro compatibility.

### Async work — Redis + BullMQ
- Queues/jobs (imports, notifications, scheduled reports) run on BullMQ over
  Redis.

## Offline sync (PowerSync)

Every tenant-owned table carries `deletedAt` (soft delete) and `updatedAt` for
sync/conflict handling. The mobile app reads/writes locally and reconciles
through PowerSync, so field users keep working without connectivity.

## Deployment target

AWS via **AWS CDK (TypeScript)**: ECS, RDS (Postgres) + RDS Proxy, ElastiCache
(Redis), S3, SES, CloudFront, WAF. Observability: Sentry + PostHog. Billing
(Stripe) is deferred; `Tenant.plan/limits` fields are already reserved. See
[DEPLOYMENT.md](DEPLOYMENT.md).

## Key decisions (and why)

- **PostgreSQL over MySQL** — first-class RLS + PowerSync support.
- **NestJS separate API + React SPA web** — internal authed console needs no SSR;
  simpler and cheaper than Next.js.
- **PowerSync over custom sync** — offline sync is the highest-risk area; buy it.
- **Two-layer security (API role + DB RLS)** — defense in depth; the DB is the
  last line even if an API bug slips through.
- **Platform tooling deferred** — onboard first tenants manually; build the
  Super-Admin console when revenue/scale justifies it.
