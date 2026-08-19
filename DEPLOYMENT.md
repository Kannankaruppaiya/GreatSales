# Deployment

How GreatSales CRM environments are structured and released. Infrastructure is
provisioned with **AWS CDK (TypeScript)**. Billing (Stripe) is deferred; early
tenants are onboarded manually.

> Status: the CDK infra app is planned/in-progress. This document is the target
> topology and process — treat unimplemented pieces as the intended design.

## Environments

| Env | Purpose | Data |
|---|---|---|
| **local** | Developer machine | Docker Postgres :5433 + Redis :6380, seeded |
| **staging** | Pre-prod verification | Isolated AWS stack, synthetic tenants |
| **production** | Live tenants | AWS, real tenant data |

Each environment is a separate CDK stack with its own secrets and database. No
environment shares credentials with another.

## Target AWS topology

| Concern | Service |
|---|---|
| API compute | ECS (Fargate) running `apps/api` |
| Database | RDS PostgreSQL + **RDS Proxy** (connection pooling) |
| Cache / queues | ElastiCache (Redis) for BullMQ |
| Web console | S3 + CloudFront (static SPA) |
| Files/attachments | S3 |
| Email | SES |
| Edge security | WAF + CloudFront |
| Mobile | Expo EAS build + OTA channels (dev/staging/prod) |
| Observability | Sentry (errors) + PostHog (product analytics) |

## Build outputs

| Workspace | Build | Artifact |
|---|---|---|
| `apps/api` | `pnpm --filter api build` | `apps/api/dist` (run `node dist/main.js`) |
| `apps/web` | `pnpm --filter web build` | static bundle → S3/CloudFront |
| `packages/shared` | `pnpm --filter @greatsales/shared build` | `dist` (CJS + d.ts) — build **before** API |
| `packages/db` | `db:generate` | Prisma client |
| `apps/mobile` | EAS build | native binaries / OTA |

## Database migrations

Migrations run as the **superuser** role (`greatsales` / `DIRECT_URL`), never as
the app role:

```bash
pnpm --filter @greatsales/db db:deploy    # prisma migrate deploy (idempotent)
```

- Run migrations as a **release step before** rolling the API, not from app boot.
- The running API stays on `greatsales_app` (RLS-bound); see [SECURITY.md](SECURITY.md).
- Hand-named migrations must keep chronological + dependency order, or a fresh
  `migrate deploy` can run a `REVOKE ... FROM greatsales_app` before that role
  exists.
- Do **not** run `db:seed` against production. Onboard tenants via the documented
  provisioning flow.

## Release process

1. Merge to `main` with `check-types`, `lint`, and `build` green.
2. Update [CHANGELOG.md](CHANGELOG.md) (move **Unreleased** → the new version).
3. Tag the release.
4. Deploy to **staging**; run migrations; smoke-test auth + tenant isolation
   (cross-tenant read returns zero rows) + a core flow.
5. Promote to **production**: run migrations, then roll the API, then invalidate
   the CloudFront cache for the web bundle.
6. Mobile: publish an EAS OTA update or submit a store build; use force-update
   gating for breaking changes.

## Configuration & secrets

- All runtime config comes from environment variables / the AWS secret store —
  never from committed files.
- Required API vars: `DATABASE_URL` (`greatsales_app`), `DIRECT_URL`
  (`greatsales`, migrations only), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  Redis URL, plus S3/SES/observability keys.
- Rotate JWT secrets and role passwords per environment.

## Rollback

- **API:** redeploy the previous image/tag.
- **Web:** repoint CloudFront to the previous S3 build and invalidate.
- **Database:** prefer forward-fixing migrations. Use RDS point-in-time restore
  only as a last resort, and never a restore that would drop RLS policies or
  roles.

## Post-deploy checks

- `GET /api/v1/health` returns healthy.
- Auth login works for a seeded/known tenant user.
- Tenant isolation holds (two-tenant cross-read = 0 rows).
- Sentry shows no new error spike; queue workers are processing.
