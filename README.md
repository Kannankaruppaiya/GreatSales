# GreatSales

A multi-tenant sales CRM: a **NestJS** API over a **PostgreSQL** database (Prisma
+ row-level security), an **Expo / React Native** mobile app, and a React web
shell — sharing one set of typed contracts.

## Monorepo layout

| Path              | What it is                                                         |
| ----------------- | ----------------------------------------------------------------- |
| `apps/api`        | NestJS REST API (`/api/v1`) — auth + CRM modules, tenant-scoped   |
| `apps/mobile`     | Expo Router (React Native) app — the salesperson-facing client    |
| `apps/web`        | React + Vite web shell                                             |
| `packages/db`     | Prisma schema, migrations, RLS policies, and dev seed             |
| `packages/shared` | Zod contracts + types shared by the API and all clients           |
| `packages/ui`     | Shared React component stubs                                       |

The wire format lives in `packages/shared`: the API validates request bodies
against the Zod schemas there and the clients infer their request/response types
from the same schemas, so the API and the app can never silently disagree.

## Features

- **Auth** — JWT access/refresh, per-tenant login, RBAC (`admin` / `mgmt` /
  `sales`) enforced by a permissions guard.
- **Dashboard** — customer / lead / order / receivable counts, revenue, and a
  pipeline-by-stage breakdown.
- **Customers** — list, detail with contacts, create (soft-deleted, not purged).
- **Leads** — pipeline list, detail with products + activity timeline, create,
  stage changes, activity notes.
- **Orders** — list, detail with line items + status history, create with
  computed totals, status transitions.
- **Payments** — receivables list, detail with collection follow-ups, create,
  status/zone updates, invoice aging.

Every tenant-owned query runs through `PrismaService.forTenant()`, which sets
`app.tenant_id` transaction-locally so Postgres RLS isolates tenants even if a
`where` clause forgets the tenant filter.

## Running it

Prerequisites: Node 20+, pnpm, Docker (for Postgres).

```sh
pnpm install

# 1. Start Postgres
docker compose up -d

# 2. Generate the client, apply migrations, seed dev data
pnpm --filter @greatsales/db db:generate
pnpm --filter @greatsales/db db:deploy
pnpm --filter @greatsales/db db:seed

# 3. Build shared contracts (API + mobile depend on the built types)
pnpm --filter @greatsales/shared build

# 4. Run the API  → http://localhost:3000/api/v1  (docs at /api/docs)
pnpm --filter api start:dev

# 5. Run the mobile app
pnpm --filter mobile start
```

The API reads its config from `apps/api/.env` (`DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, …). The mobile app points at the API via
`EXPO_PUBLIC_API_URL` — set it to your machine's LAN IP when testing on a
physical device, e.g.:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1 pnpm --filter mobile start
```

### Demo login

The seed creates two tenants (`tenant_acme`, `tenant_globex`) with users that all
share the password `Passw0rd!`:

| Tenant        | Email               | Role  |
| ------------- | ------------------- | ----- |
| `tenant_acme` | `admin@acme.test`   | admin |
| `tenant_acme` | `manager@acme.test` | mgmt  |
| `tenant_acme` | `sales1@acme.test`  | sales |

## API surface

All routes are prefixed `/api/v1` and (except auth) require a bearer token.

```
POST   /auth/login            POST /auth/refresh          GET  /auth/me
GET    /dashboard/summary     GET  /lookups
GET    /customers             GET  /customers/:id
POST   /customers             PATCH /customers/:id        DELETE /customers/:id
GET    /leads                 GET  /leads/:id
POST   /leads                 PATCH /leads/:id            POST /leads/:id/activities
GET    /orders                GET  /orders/:id
POST   /orders                PATCH /orders/:id/status
GET    /payments             GET  /payments/:id
POST   /payments            PATCH /payments/:id          POST /payments/:id/followups
```

List endpoints are cursor-paginated (`?cursor=&limit=`).
