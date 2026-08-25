# Changelog

All notable changes to GreatSales CRM are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — F12 Users, roles & teams

- **Roles API** (`/roles`, `/permissions`). Custom roles with editable
  permission grants. Built-in roles can be re-scoped but not renamed or
  deleted. Reading roles needs `user.manage` OR `role.manage`; every write
  needs `role.manage`.
- **Teams API** (`/teams`). Team CRUD plus bulk membership. Deleting a team
  detaches its members in the same transaction rather than orphaning them.
- **`POST /auth/change-password`** — self-service password change requiring the
  current password. Closes the F1 D10 deferral for the *change* half; recovery
  by email is still blocked on a mail-provider decision.
- **Forced password change.** A user whose password an admin set must replace
  it before any other endpoint answers, enforced by a guard rather than by the
  client honouring a flag.
- **User lifecycle**: `GET /users/:id`, `POST /users/:id/restore`,
  `POST /users/:id/reset-password`.
- **Audit trail** for every user, role, and team change, written in the same
  transaction as the change. Credentials are stripped by a key-name filter, so
  a future `tempPassword` column cannot leak into it by omission.
- **Web**: `/users` becomes three URL-synced tabs (Users, Roles, Teams) with a
  live permission matrix, server-side filtering and sorting, confirmed
  destructive actions, and a forced-password-change screen.

### Fixed

- **`?active=false` returned ACTIVE users.** `z.coerce.boolean()` maps the
  string `"false"` to `true`. Replaced with a `status` enum, which has no
  coercion to get wrong.
- **An admin could lock the workspace out of itself** by deactivating,
  deleting, or demoting the last user able to manage users — or their own
  account. Both are now refused, checked inside the write's transaction under a
  `FOR UPDATE` lock so two simultaneous removals cannot both succeed.
- **Raw SQL bypassed tenant scoping.** `forTenant()` extends `$allModels`,
  which does not cover client-level `$queryRaw`; such a query ran with
  `app.tenant_id` unset and RLS returned nothing — silently, and in a guard,
  fail-OPEN. Added `PrismaService.transactionForTenant()`.
- **Deleting a user burned their email and username permanently.** Uniqueness
  is now enforced by partial indexes over live rows only, so an address is
  reusable after a delete, and a restore onto a re-taken identity fails with a
  clear 409.
- **Deactivation, deletion, role change, and password reset left sessions
  alive** until the target's next refresh. All four now revoke immediately.
- **Invalid role/manager/team ids surfaced as 500s.** Now 400 `INVALID_REFERENCE`.
- **Email and username were normalised client-side only**, so `Admin@x` and
  `admin@x` were two accounts. Normalised server-side.
- **Reporting cycles were possible** (A manages B manages A), which would hang
  any code walking the chain. Rejected with 400 `INVALID_MANAGER`.
- **The web permissions table was hardcoded** and unrelated to real grants.
  Replaced with a live matrix.
- **The users page compared a mock-data id against real user ids**, so "(you)"
  never rendered and the self-deactivation guard never engaged.
- **Action visibility keyed off `role === "admin"`**, hiding every control from
  a super-admin and from any custom role holding `user.manage`. Now
  permission-driven.
- **The header count showed loaded rows, not the real total.**
- **Dialogs were not exposed as dialogs.** The shared `Dialog` now carries
  `role="dialog"`, `aria-modal`, and `aria-labelledby`, and restores focus to
  whatever opened it.

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
