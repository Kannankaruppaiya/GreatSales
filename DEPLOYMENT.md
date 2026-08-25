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
| **staging (docker)** | Pre-prod local parity verification | Full containerized stack via `docker-compose.staging.yml` |
| **staging** | Pre-prod verification | Isolated AWS stack, synthetic tenants |
| **production** | Live tenants | AWS, real tenant data |

Each environment is a separate CDK stack with its own secrets and database. No
environment shares credentials with another.

## Docker Compose Staging Testing

To test the entire CRM stack in a fully containerized staging environment locally before deploying to AWS:

```bash
# 1. Start the staging Docker compose stack (Postgres + Redis + Migrations/Seed + API + Web)
pnpm staging:up
# Or directly:
docker compose -f docker-compose.staging.yml up -d --build

# 2. Run automated staging verification & multi-tenant smoke tests
pnpm staging:test

# 3. Access the services:
# - Web Console: http://localhost:8090 (Login: admin@acme.test / Passw0rd!)
# - API Health:  http://localhost:3000/api/v1/health
# - API Docs:    http://localhost:3000/api/docs

# 4. Stop and clean up staging stack
pnpm staging:down
```

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

### F12 index migration (`20260823120000_f12_users_roles_teams`)

This one replaces two `UNIQUE` constraints on `"User"` with **partial** unique
indexes, so a soft-deleted user frees their email and username for reuse.

**Running it.** Prisma wraps every migration in a transaction, so the index
builds take a brief `ACCESS EXCLUSIVE` lock on `"User"`. On a table of
thousands of rows per tenant that is single-digit milliseconds and safe inline.

If `"User"` has grown past roughly a million rows, do **not** run the file
directly — build the indexes without blocking writes first, then tell Prisma
the migration is already applied:

```sql
-- Outside any transaction, as the superuser role:
CREATE UNIQUE INDEX CONCURRENTLY "User_tenantId_email_live_key"
  ON "User" ("tenantId", "email") WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX CONCURRENTLY "User_tenantId_username_live_key"
  ON "User" ("tenantId", "username") WHERE "deletedAt" IS NULL;
CREATE INDEX CONCURRENTLY "User_tenantId_deletedAt_name_idx"
  ON "User" ("tenantId", "deletedAt", "name");
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_email_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_tenantId_username_key";
```

```bash
pnpm --filter @greatsales/db exec prisma migrate resolve \
  --applied 20260823120000_f12_users_roles_teams
```

A `CONCURRENTLY` build can fail and leave an `INVALID` index behind. Check
before moving on, and drop-and-retry any that did not finish:

```sql
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

**Rolling it back.** Reverting to the plain `UNIQUE` constraints **fails** if a
soft-deleted row shares an email or username with a live row — which is exactly
the state this migration makes legal, so it is likely by the time anyone wants
to revert. Find the collisions first:

```sql
SELECT "tenantId", "email", count(*) FROM "User" GROUP BY 1, 2 HAVING count(*) > 1;
SELECT "tenantId", "username", count(*) FROM "User" GROUP BY 1, 2 HAVING count(*) > 1;
```

Hard-delete or re-key the soft-deleted duplicate in each pair before restoring
the constraints. There is no automatic path: which of the two rows should keep
the address is a business decision, not a schema one.

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
