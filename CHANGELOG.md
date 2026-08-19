# Changelog

All notable changes to GreatSales CRM are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Project documentation set: `README`, `ARCHITECTURE`, `CONTRIBUTING`,
  `SECURITY`, `DEPLOYMENT`, `CODE_OF_CONDUCT`, `LICENSE`, `CHANGELOG`.

### Planned (next)
- Feature modules per domain (service + controller + DTO), starting with the
  projection engine and PowerSync integration.
- Wire the web console to the NestJS API (replace mock selectors with
  `@tanstack/react-query` calls; real `/auth/login` with session persistence).
- Mobile (Expo) salesperson app + PowerSync offline sync.

---

## History (pre-1.0 build log)

> Milestones completed while scaffolding the product. Versioned releases begin
> once the API↔web wiring lands.

### API & shared contracts — walking skeleton (2026-08-17)
- `packages/shared` (`@greatsales/shared`): zod contracts + inferred types
  (auth, RBAC, pagination, `ApiErrorBody`); builds to `dist` (CJS + d.ts).
- `apps/api` (NestJS): `PrismaService` with per-request tenant scoping
  (`forTenant(tid)` via `$extends` + `set_config('app.tenant_id', …)`).
- Auth: argon2id (`@node-rs/argon2`) + JWT access/refresh; global `JwtAuthGuard`,
  `@Public`/`@CurrentUser`, `ZodValidationPipe`, `AllExceptionsFilter`.
- Endpoints: `POST /auth/login` (tenantId required), `/auth/refresh`,
  `GET /auth/me`, `/health`. helmet, CORS, `/api/v1` prefix, Swagger `/api/docs`.
- **Security fix:** blocked Prisma env-pollution that let the API connect as
  superuser and bypass RLS — `load-env.ts` override + boot-time superuser refusal.

### Web console — full UI build with mock data (2026-08-17→18)
- `apps/web` rebuilt from Next.js → **React 19 + Vite 6 + Tailwind v4** (SPA,
  React Router v7, `@tanstack/react-query`, zustand).
- 11 pages: Login, Dashboard, Projections, Leads (Kanban), Orders, Payments,
  Follow-ups, Customers, Products, Users, Data/Settings.
- Dep-free SVG charts; forest-emerald design system; deterministic mock data.
- Data-completeness pass vs POC (probability/weighted pipeline, product division,
  lead expected-close/stage-age/address, SO delivery mode/created-by/ship-to).
- Projections page redesigned to a flat premium table (customer→product runs).

### Platform layer (2026-08-15)
- `PlatformUser` (separate from tenant `User`, `PlatformRole`, 2FA),
  `PlatformAuditLog`, `FeatureFlag` (global + rollout %), `TenantFeatureFlag`
  (per-tenant, RLS-scoped); `Tenant` status/region/industry/contract fields.
- Access verified: `greatsales_app` revoked on platform tables.

### Database — seed + RLS (2026-08-15)
- `prisma/seed.ts`: 2 tenants (Acme, Globex) end-to-end + platform seed.
- RLS policy migration applied and **verified**: read isolation, child tables via
  parent EXISTS, fail-closed on unset, `WITH CHECK` blocks cross-tenant writes.

### Database — initial schema (2026-08-14)
- `packages/db`: Prisma schema (28 models + 10 enums, all POC gaps filled),
  initial migration applied. Local Postgres :5433 / Redis :6380 via Docker.

### Repo scaffold (2026-08-14)
- Turborepo + pnpm monorepo: `apps/{api, web, mobile}` +
  `packages/{db, shared, ui, eslint-config, typescript-config}`.

[Unreleased]: https://example.com/compare/main...HEAD
