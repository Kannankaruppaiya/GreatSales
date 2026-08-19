# GreatSales CRM

> Commercial, production-grade **multi-tenant sales CRM** — recurring sales
> projection-vs-achievement tracking, leads, orders, payments and follow-ups for
> distribution/field-sales teams.

GreatSales is a SaaS product built as **two surfaces on one backend**:

| Surface | Users | Stack |
|---|---|---|
| **Mobile app** | Salespeople (offline-first, field use) | React Native / Expo + PowerSync |
| **Web console** | Tenant Admin + Management (RBAC) | React 19 + Vite + Tailwind v4 |
| **API** | Both | NestJS modular monolith + Prisma |
| **Platform console** | Us (SaaS operator) — Phase 2 | separate auth, cross-tenant |

Security is **role-at-API + Row-Level-Security-at-DB** (two layers), never
route-based. See [SECURITY.md](SECURITY.md) and [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Monorepo layout

Turborepo + pnpm workspaces (100% TypeScript).

```
GreatSales/
├─ apps/
│  ├─ api/       NestJS API (Prisma, JWT+RBAC, RLS-scoped)   → :3000  /api/v1
│  ├─ web/       React + Vite admin/mgmt console              → :5174
│  └─ mobile/    Expo (React Native) salesperson app
├─ packages/
│  ├─ db/        Prisma schema, migrations, seed, RLS policies (@greatsales/db)
│  ├─ shared/    zod contracts + inferred types (@greatsales/shared)
│  ├─ ui/        shared React component stubs
│  ├─ eslint-config/
│  └─ typescript-config/
└─ docker-compose.yml   local Postgres (:5433) + Redis (:6380)
```

## Documentation map

| Doc | What it covers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flow, tenant isolation, sync |
| [SECURITY.md](SECURITY.md) | RLS contract, secrets, auth, vulnerability reporting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local setup, branching, commits, PR workflow |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environments, AWS CDK deploy, release process |
| [DB-SCHEMA-CHECKLIST.md](DB-SCHEMA-CHECKLIST.md) | Data model spec (28+ models, RLS, gaps filled) |
| [ADMIN-CAPABILITIES.md](ADMIN-CAPABILITIES.md) | Tenant Admin + Platform Super-Admin capability spec |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes per release |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Team conduct expectations |
| [LICENSE.md](LICENSE.md) | Proprietary license — all rights reserved |

---

## Quick start (local development)

**Prerequisites:** Node 24 LTS (nvm-windows: `24.19.0`), pnpm 9, Docker Desktop.

```bash
# 1. install
pnpm install

# 2. start local Postgres (:5433) + Redis (:6380)
docker compose up -d

# 3. configure env (see CONTRIBUTING.md for full detail)
#    packages/db/.env  -> DATABASE_URL/DIRECT_URL as superuser `greatsales`
#    apps/api/.env     -> DATABASE_URL as `greatsales_app`, DIRECT_URL as `greatsales`

# 4. database: generate client, run migrations, seed
pnpm --filter @greatsales/db db:generate
pnpm --filter @greatsales/db db:deploy
pnpm --filter @greatsales/db db:seed

# 5. build the shared contracts package (API consumes dist, not raw TS)
pnpm --filter @greatsales/shared build

# 6. run
pnpm --filter api build && node apps/api/dist/main.js   # API  :3000
pnpm --filter web dev                                     # Web  :5174
pnpm --filter mobile start                                # Expo
```

> ⚠️ **Windows port gotcha:** host `5432` is usually taken by a native
> `postgres.exe`, so Docker maps Postgres to **5433** and Redis to **6380**.
> Full env / gotcha notes are in [CONTRIBUTING.md](CONTRIBUTING.md).

Seed users share the dev password **`Passw0rd!`**. Login requires
`{ tenantId, email, password }` — email is unique **per tenant**.

## Common scripts

Run from the repo root (Turborepo fans out across workspaces):

```bash
pnpm dev            # dev servers
pnpm build          # build everything
pnpm lint           # lint
pnpm check-types    # typecheck
pnpm format         # prettier
```

Per-workspace: `pnpm --filter <web|api|mobile|@greatsales/db|@greatsales/shared> <script>`.

---

## Status

Actively developed. Web console and API walking-skeleton are built and verified;
feature modules and API↔web wiring are in progress. See [CHANGELOG.md](CHANGELOG.md).

## License

Proprietary — © GreatWorks ([greatworks.in](https://greatworks.in/)). All rights reserved. See [LICENSE.md](LICENSE.md).
