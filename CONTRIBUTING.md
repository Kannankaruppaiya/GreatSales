# Contributing

Internal engineering guide for GreatSales CRM. This is a **proprietary**
codebase (see [LICENSE.md](LICENSE.md)); access is limited to authorized team
members.

## Prerequisites

- **Node 24 LTS** — pin `24.19.0` (nvm-windows recommended).
- **pnpm 9** (`packageManager` is pinned in `package.json`).
- **Docker Desktop** (with WSL2 on Windows) for local Postgres + Redis.
- For mobile: **eas-cli**, Expo Go on a device.
- For infra: **aws-cdk**.

## First-time setup

```bash
pnpm install
docker compose up -d          # Postgres :5433, Redis :6380
```

### Environment files

Env files are **gitignored**. Create them per app:

**`packages/db/.env`** — used by migrations & seed (superuser role):

```
DATABASE_URL="postgresql://greatsales:greatsales@localhost:5433/greatsales?schema=public"
DIRECT_URL="postgresql://greatsales:greatsales@localhost:5433/greatsales?schema=public"
```

**`apps/api/.env`** — the running API (RLS-bound role):

```
DATABASE_URL="postgresql://greatsales_app:greatsales_app@localhost:5433/greatsales?schema=public"
DIRECT_URL="postgresql://greatsales:greatsales@localhost:5433/greatsales?schema=public"
JWT_ACCESS_SECRET="dev-access-secret-change-me"
JWT_REFRESH_SECRET="dev-refresh-secret-change-me"
```

> ⚠️ **Windows BOM trap:** `Set-Content -Encoding utf8` adds a BOM that corrupts
> `.env`. Write env files with `[System.IO.File]::WriteAllText(path, text)` (no
> BOM) instead.

> ⚠️ **Never let the API connect as `greatsales`.** The API uses `greatsales_app`
> (RLS-bound); `greatsales` is superuser and bypasses RLS. `apps/api/src/load-env.ts`
> runs `dotenv.config({ override: true })` as the **first** line of `main.ts` so
> the API's own `.env` wins over the Prisma schema's env. `PrismaService`
> refuses to boot if it detects a superuser connection.

### Initialize the database

```bash
pnpm --filter @greatsales/db db:generate    # prisma generate
pnpm --filter @greatsales/db db:deploy      # apply migrations
pnpm --filter @greatsales/db db:seed        # 2 tenants + platform seed
pnpm --filter @greatsales/shared build      # API consumes dist, not raw TS
```

Seed users all share the dev password **`Passw0rd!`**. Login payload is
`{ tenantId, email, password }` (email is unique per tenant).

## Running

```bash
pnpm --filter api build && node apps/api/dist/main.js   # API  :3000  (/api/v1, docs /api/docs)
pnpm --filter web dev                                     # Web  :5174
pnpm --filter mobile start                                # Expo
```

Root scripts fan out via Turborepo: `pnpm dev`, `pnpm build`, `pnpm lint`,
`pnpm check-types`, `pnpm format`.

## Repo conventions

- **TypeScript everywhere.** No untyped JS.
- **Shared contracts** live in `packages/shared` (zod). Rebuild it after
  changing a schema — the API imports the built `dist`.
- **Data model changes** go through Prisma migrations in `packages/db`. Update
  [DB-SCHEMA-CHECKLIST.md](DB-SCHEMA-CHECKLIST.md) when you add models.
  - Hand-named migrations **must** keep chronological + dependency order — a
    later folder name that sorts before an earlier one will break a fresh
    `migrate deploy`.
- **Every tenant-owned table** needs `tenantId`, timestamps, `deletedAt`
  (soft delete), and an RLS policy. No hard deletes.
- **Web design language:** airy, flat, premium — match the POC's calm density.
  Forest-emerald brand `#0E6B54`, Inter + tabular-nums. Avoid nested grouping and
  colour overload. Semantic green/amber/red = on-track/at-risk/overdue.

## Branching & commits

- Branch off `main`: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`, `docs/<slug>`.
- Keep commits scoped and imperative (e.g. `feat(api): add leads module`).
- Do **not** commit `.env`, secrets, or generated Prisma clients.

## Pull requests

Before opening a PR:

```bash
pnpm check-types
pnpm lint
pnpm build
```

- Describe **what** changed and **why**; link the relevant capability in
  [ADMIN-CAPABILITIES.md](ADMIN-CAPABILITIES.md) where applicable.
- Call out any schema/migration change and whether it needs a reseed.
- Update [CHANGELOG.md](CHANGELOG.md) under **Unreleased**.
- New security-sensitive surface? Re-read [SECURITY.md](SECURITY.md) and verify
  RLS still fails closed.

## Testing

- API: Jest (`pnpm --filter api test`, `test:e2e`).
- Verify tenant isolation with at least two tenants (the seed provides Acme +
  Globex) — a cross-tenant read must return **zero** rows.

## Gotchas quick-reference

| Symptom | Cause / fix |
|---|---|
| Postgres won't bind | Host `5432` taken by native `postgres.exe`; we use `5433`/`6380`. |
| Cross-tenant data leaks | API connected as `greatsales` superuser; check `load-env.ts` + `.env`. |
| `.env` values corrupted | UTF-8 BOM; write with `WriteAllText`. |
| API crashes importing `@greatsales/shared` | Forgot to `build` shared (raw TS ≠ CJS). |
| TS6310 in web build | Split tsconfig / project references — use a single tsconfig. |
| Fresh `migrate deploy` fails on REVOKE | Migration folder ordering; keep names chronological. |

See also the [Code of Conduct](CODE_OF_CONDUCT.md).
