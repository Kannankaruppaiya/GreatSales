# Sales Role on Web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let salespersons sign in to the web app and work their own accounts, with server-side ownership scoping proven by test before the login block is lifted.

**Architecture:** The API already scopes every list and write to the caller when their role is `sales` (`resolveOwnerScope` / `isSalesOnly` in each service), and route-level RBAC (`PermissionsGuard` + `@RequirePermissions`) already denies `sales` the admin modules. This plan proves those guarantees with tests first, then removes the client-side block in `apps/web/src/store/auth.ts` and adds the role's navigation, route guards, and role-conditional columns.

**Tech Stack:** NestJS 11 + Prisma 6 + Postgres (RLS-enforced) · React 19 + Vite 6 + Tailwind v4 · Jest (API integration tests against real Postgres) · Vitest + Testing Library (web)

This is plan 1 of 3 derived from `docs/superpowers/specs/2026-08-22-poc-v6-parity-sales-web-scale-design.md`. Plan 2 covers component parity; plan 3 covers scale. This plan implements spec section 4.

## Global Constraints

- The web design system stays unchanged — no edits to `apps/web/src/index.css`, no new colour tokens, no font changes. Reuse existing components from `@/components/ui`.
- API tests are **integration** tests against the real Dockerized Postgres via the RLS-bound `greatsales_app` role. They begin with `import '../load-env';` and reseed via `execSync('pnpm --filter @greatsales/db db:seed')` in `beforeAll`. Never mock Prisma.
- Seeded test fixtures: tenants `tenant_acme` and `tenant_globex`; per tenant, users `user_admin_<key>`, `user_sales1_<key>`, `user_sales2_<key>`; roles `role_admin_<key>`, `role_sales_<key>`.
- `RequestUser` is exactly `{ userId: string; tenantId: string; roleId: string }` (`packages/shared/src/auth.ts:66`). It carries **no** role name — services resolve the role from the database. Do not add fields to it in this plan; that change belongs to plan 3.
- Role vocabulary is `"super_admin" | "admin" | "mgmt" | "sales"` (`apps/web/src/data/constants.ts:7`). System roles in the API are `["admin", "mgmt", "sales"]` (`packages/shared/src/rbac.ts:29`).
- Permission keys are `<module>.<action>` from `packages/shared/src/rbac.ts`. The seed derives from `ROLE_PERMISSIONS`, so a grant change must be made there, not in the seed script.
- Run API tests with `pnpm --filter api test`. Run web tests with `pnpm --filter web test`.

---

## Decision requiring sign-off before Task 3

The POC lets a salesperson edit payment follow-up fields on their own invoices — zone, reason, next follow-up date, and the four reminder chips. The current RBAC grant gives `sales` only `payment.read` (`packages/shared/src/rbac.ts:46-55`), so on web a salesperson could see their overdue invoices but not record a single collection action against them.

Task 3 resolves this by granting `sales` the `payment.write` permission, with ownership scoping (already enforced by `PaymentsService`) as the boundary — a salesperson may edit their own invoices and no one else's, proven by test.

This is a privilege grant. If the intent is that collections stay entirely with admin, skip Task 3 and payments remain read-only for sales on web, diverging from the POC on that one page. **Confirm before executing Task 3.** Tasks 1, 2, and 4–8 are unaffected either way.

---

## File Structure

**API — new test files (no production code changes except Task 3):**

| File | Responsibility |
|---|---|
| `apps/api/src/common/sales-scope.spec.ts` | Cross-module proof that an explicit `ownerId` cannot widen a salesperson's scope |
| `apps/api/src/users/users.service.spec.ts` (modify) | Proof that the `user.manage` permission gates the users module |
| `apps/api/src/products/products.service.spec.ts` (modify) | Proof that `sales` reads the catalog but cannot mutate it |
| `apps/api/src/payments/payments.service.spec.ts` (modify) | Task 3 only — scoped `payment.write` for sales |

**API — production changes:**

| File | Change |
|---|---|
| `packages/shared/src/rbac.ts:46` | Task 3 only — add `"payment.write"` to the `sales` grant list |

**Web — production changes:**

| File | Change |
|---|---|
| `apps/web/src/data/constants.ts` | Add `sales` to `ROLES`; add `NAVS.sales` |
| `apps/web/src/store/auth.ts` | Remove `SalesWebLoginError` and its throw site |
| `apps/web/src/features/auth/LoginPage.tsx` | Add `sales` to `LoginRole`, `ROLE_CONFIGS`, `resolveRoleFromPath`, `DEMO_EMAIL_BY_ROLE` |
| `apps/web/src/App.tsx` | Add `/sales/login` and `/sales` routes; add `RoleGuard` to `/products` |
| `apps/web/src/features/projections/ProjectionsPage.tsx` | Role-conditional Salesperson column |
| `apps/web/src/features/leads/LeadsPage.tsx` | Role-conditional Salesperson column |
| `apps/web/src/features/orders/OrdersPage.tsx` | Role-conditional Salesperson column |

**Web — new test files:**

| File | Responsibility |
|---|---|
| `apps/web/tests/store/auth.sales.test.ts` | A sales login establishes a session instead of throwing |
| `apps/web/tests/components/layout.sales-nav.test.tsx` | The sales sidebar shows exactly the POC's seven items |
| `apps/web/tests/features/projections/ProjectionsPage.role.test.tsx` | Salesperson column hidden for sales, shown for admin |

The topbar salesperson filter is **already** role-conditional (`apps/web/src/components/layout.tsx:427` — `{role !== "sales" && ...}`), so no task is needed for it.

---

### Task 1: Prove an explicit `ownerId` cannot widen a salesperson's scope

Six services already have "scopes a salesperson to their own X only" tests, but none passes an explicit `ownerId` naming a *different* salesperson. `resolveOwnerScope` ignores the parameter for sales by construction — this task locks that in so a future refactor cannot silently regress it. This is the security-critical test the spec requires before the web login block is lifted.

**Files:**
- Create: `apps/api/src/common/sales-scope.spec.ts`

**Interfaces:**
- Consumes: `CustomersService.list`, `LeadsService.list`, `OrdersService.list`, `PaymentsService.list`, `FollowUpsService.list`, `ProjectionsService.list` — each takes `(user: RequestUser, query, ...)` and returns `{ items: T[]; nextCursor: string | null }`, except `ProjectionsService.list` which returns `{ lines: ProjectionLine[]; summary }`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/sales-scope.spec.ts`:

```ts
import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { execSync } from 'node:child_process';
import type { RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { LeadsService } from '../leads/leads.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from '../payments/payments.service';
import { FollowUpsService } from '../followups/followups.service';
import { ProjectionsService } from '../projections/projections.service';

/**
 * Cross-module guarantee: a salesperson's scope is derived from their own
 * identity, never from request input. Passing another salesperson's id as
 * `ownerId` must not widen what they can see. Admin, by contrast, may filter.
 */
const sales1: RequestUser = {
  userId: 'user_sales1_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_sales_acme',
};
const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: 'tenant_acme',
  roleId: 'role_admin_acme',
};
const OTHER = 'user_sales2_acme';

describe('sales ownership scope (cross-module)', () => {
  let prisma: PrismaService;
  let customers: CustomersService;
  let leads: LeadsService;
  let orders: OrdersService;
  let payments: PaymentsService;
  let followups: FollowUpsService;
  let projections: ProjectionsService;

  beforeAll(async () => {
    execSync('pnpm --filter @greatsales/db db:seed', {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();
    customers = new CustomersService(prisma);
    leads = new LeadsService(prisma);
    orders = new OrdersService(prisma);
    payments = new PaymentsService(prisma);
    followups = new FollowUpsService(prisma);
    projections = new ProjectionsService(prisma);
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('ignores an explicit ownerId naming another salesperson', async () => {
    const [c, l, o, p, f] = await Promise.all([
      customers.list(sales1, { limit: 50, ownerId: OTHER }),
      leads.list(sales1, { limit: 50, ownerId: OTHER }),
      orders.list(sales1, { limit: 50, ownerId: OTHER }),
      payments.list(sales1, { limit: 50, ownerId: OTHER }),
      followups.list(sales1, { limit: 50, ownerId: OTHER }),
    ]);

    expect(c.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(l.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(o.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(p.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
    expect(f.items.every((x) => x.salespersonId === sales1.userId)).toBe(true);
  });

  it('ignores an explicit ownerId on the projections worksheet', async () => {
    const res = await projections.list(sales1, {
      period: '2026-06',
      ownerId: OTHER,
    });
    expect(
      res.lines.every((l) => l.salespersonId === sales1.userId),
    ).toBe(true);
  });

  it('still honours ownerId for an admin caller', async () => {
    const res = await customers.list(admin, { limit: 50, ownerId: OTHER });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((x) => x.salespersonId === OTHER)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter api test -- sales-scope`

Expected: PASS. `salespersonId` is confirmed present on every one of these DTOs (`customers.service.ts:49`, `leads.service.ts:54`, `orders.service.ts:46`, `payments.service.ts:45`, `followups.service.ts:29`, `projections.service.ts:180`), and `resolveOwnerScope` returns `user.userId` for a sales caller regardless of the `ownerId` argument. The test's value is regression protection, not discovery.

If a compile error appears on an `ownerId` query key, read that module's list-query schema in `packages/shared/src/` and correct the test. Do **not** change production code to satisfy the test.

If an assertion genuinely fails — a salesperson sees another's rows — **stop and report it**. That is a live authorization bug and the remaining tasks must not proceed until it is fixed.

- [ ] **Step 3: Verify the test is meaningful**

Temporarily edit `resolveOwnerScope` in `apps/api/src/customers/customers.service.ts:205` to return `requestedOwnerId` unconditionally:

```ts
  private async resolveOwnerScope(
    db: TenantPrisma,
    user: RequestUser,
    requestedOwnerId?: string,
  ): Promise<string | undefined> {
    return requestedOwnerId && requestedOwnerId !== 'ALL'
      ? requestedOwnerId
      : undefined;
  }
```

Run: `pnpm --filter api test -- sales-scope`
Expected: the first test FAILS on the customers assertion.

This confirms the test actually exercises the guard rather than passing vacuously.

- [ ] **Step 4: Revert the sabotage**

Run: `git checkout apps/api/src/customers/customers.service.ts`
Run: `pnpm --filter api test -- sales-scope`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/sales-scope.spec.ts
git commit -m "test(api): lock sales scope against explicit ownerId input"
```

---

### Task 2: Prove the admin modules deny the sales role

`users.service.spec.ts` and `products.service.spec.ts` have no role tests. Route-level RBAC is what denies `sales` here: every users route requires `user.manage` and every product/principal mutation requires `user.manage`, neither of which `sales` is granted. Catalog reads require `order.read`, which `sales` does have — the worksheet needs it.

This task tests the grant table and the guard, which is where the decision actually lives.

**Files:**
- Create: `apps/api/src/common/rbac-grants.spec.ts`

**Interfaces:**
- Consumes: `ROLE_PERMISSIONS`, `PERMISSION_KEYS` from `@greatsales/shared`; `PermissionsGuard` from `../common/permissions.guard`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/rbac-grants.spec.ts`:

```ts
import { ROLE_PERMISSIONS, PERMISSION_KEYS } from '@greatsales/shared';

/**
 * The grant table is the authority for what each system role may do. These
 * assertions are deliberately literal: a future edit that widens the sales
 * role must fail here and be argued for, not slip through.
 */
describe('ROLE_PERMISSIONS grants', () => {
  it('never grants sales the admin permissions', () => {
    expect(ROLE_PERMISSIONS.sales).not.toContain('user.manage');
    expect(ROLE_PERMISSIONS.sales).not.toContain('role.manage');
  });

  it('never grants management any write permission', () => {
    const writes = ROLE_PERMISSIONS.mgmt.filter((k) => k.endsWith('.write'));
    expect(writes).toEqual([]);
  });

  it('grants sales the catalog read used by the projections worksheet', () => {
    // products + principals list routes both require 'order.read'
    expect(ROLE_PERMISSIONS.sales).toContain('order.read');
  });

  it('grants admin every permission', () => {
    expect([...ROLE_PERMISSIONS.admin].sort()).toEqual(
      [...PERMISSION_KEYS].sort(),
    );
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter api test -- rbac-grants`
Expected: PASS — these assertions describe the grant table as it stands today.

If `never grants management any write permission` fails, report it rather than editing the assertion: management is specified read-only in the POC and a write grant would be a real defect.

- [ ] **Step 3: Add the guard-level test**

Append to the same file:

```ts
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import type { RequestUser } from '@greatsales/shared';
import { PermissionsGuard } from './permissions.guard';
import { PERMISSIONS_KEY } from './decorators';

function ctxFor(handler: unknown, user: RequestUser): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard denies sales the users module', () => {
  const salesUser: RequestUser = {
    userId: 'user_sales1_acme',
    tenantId: 'tenant_acme',
    roleId: 'role_sales_acme',
  };

  it('rejects a user.manage route for a sales caller', async () => {
    const handler = () => {};
    Reflect.defineMetadata(PERMISSIONS_KEY, ['user.manage'], handler);

    const prismaStub = {
      forTenant: () => ({
        role: {
          findUnique: async () => ({
            id: 'role_sales_acme',
            permissions: ROLE_PERMISSIONS.sales.map((key) => ({
              permission: { key },
            })),
          }),
        },
      }),
    };

    const guard = new PermissionsGuard(
      new Reflector(),
      prismaStub as never,
    );

    await expect(
      guard.canActivate(ctxFor(handler, salesUser)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter api test -- rbac-grants`
Expected: PASS

If the guard test fails on the stub's shape, open `apps/api/src/common/permissions.guard.spec.ts` and mirror how that existing file builds its context and Prisma stub — it already solves the same problem.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/rbac-grants.spec.ts
git commit -m "test(api): assert role grant table and users-module denial for sales"
```

---

### Task 3: Grant sales scoped write access to their own payments

**Do not start this task without the sign-off described above.**

**Files:**
- Modify: `packages/shared/src/rbac.ts:46-55`
- Modify: `apps/api/src/payments/payments.service.spec.ts`
- Modify: `apps/api/src/common/rbac-grants.spec.ts`

**Interfaces:**
- Consumes: `PaymentsService.update(user: RequestUser, id: string, patch: PaymentUpdate)` — throws `ForbiddenException` when a sales caller targets another salesperson's payment.
- Produces: `ROLE_PERMISSIONS.sales` now includes `"payment.write"`, which the web Payments page relies on in plan 2.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/payments/payments.service.spec.ts`, inside the existing top-level `describe`:

```ts
  it('lets a salesperson update the follow-up fields on their own payment', async () => {
    const mine = await service.list(sales('tenant_acme', 'acme', 1), {
      limit: 1,
    });
    const target = mine.items[0];
    expect(target).toBeDefined();

    const updated = await service.update(
      sales('tenant_acme', 'acme', 1),
      target.id,
      { payZone: 'RedZone', delayReason: 'Awaiting MSME approval' },
    );

    expect(updated.payZone).toBe('RedZone');
    expect(updated.delayReason).toBe('Awaiting MSME approval');
  });
```

- [ ] **Step 2: Run it to confirm the service already allows this**

Run: `pnpm --filter api test -- payments.service`
Expected: PASS. `PaymentsService.update` gates on ownership, not on the permission key — the permission is enforced at the route by `PermissionsGuard`, which this service-level test does not exercise.

If it fails with a `ForbiddenException`, the service has its own role gate. Read `payments.service.ts` around the ownership check and report what you find before changing anything.

- [ ] **Step 3: Update the grant table**

In `packages/shared/src/rbac.ts`, change the `sales` array to include `payment.write` immediately after `payment.read`:

```ts
  sales: [
    "customer.read",
    "customer.write",
    "lead.read",
    "lead.write",
    "projection.read",
    "projection.write",
    "order.read",
    "order.write",
    "payment.read",
    "payment.write",
  ],
```

- [ ] **Step 4: Update the grant assertion**

In `apps/api/src/common/rbac-grants.spec.ts`, add to the first `describe`:

```ts
  it('grants sales scoped payment write for collections follow-up', () => {
    // POC parity: a salesperson records zone, reason, next follow-up and
    // reminder chips on their own invoices. Ownership — not the permission
    // key — is what stops them touching another salesperson's invoice; that
    // boundary is proven in payments.service.spec.ts.
    expect(ROLE_PERMISSIONS.sales).toContain('payment.write');
  });
```

- [ ] **Step 5: Confirm the ownership boundary still holds**

The existing test `forbids a salesperson from editing another salesperson payment` (`payments.service.spec.ts:132`) is the boundary this grant relies on.

Run: `pnpm --filter api test -- payments.service rbac-grants`
Expected: PASS, including that existing test.

- [ ] **Step 6: Reseed so the grant reaches the database**

`ROLE_PERMISSIONS` drives the seed, so existing role rows need refreshing.

Run: `pnpm --filter @greatsales/db db:seed`
Run: `pnpm --filter api test`
Expected: the full API suite passes (94 tests plus the ones added here).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/rbac.ts apps/api/src/common/rbac-grants.spec.ts apps/api/src/payments/payments.service.spec.ts
git commit -m "feat(rbac): grant sales scoped payment.write for collections follow-up"
```

---

### Task 4: Add the sales role to the web role vocabulary

**Files:**
- Modify: `apps/web/src/data/constants.ts:1-16` and the `NAVS` block at `:270`
- Create: `apps/web/tests/components/layout.sales-nav.test.tsx`

**Interfaces:**
- Consumes: `Role` type, already includes `"sales"`.
- Produces: `NAVS.sales` — an array of `{ key: string; label: string }` read by `Sidebar` in `apps/web/src/components/layout.tsx:70`. `ROLES` gains a `sales` entry so `roleLabel("sales")` returns `"Salesperson"` instead of falling back to `"Administrator"`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/components/layout.sales-nav.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function renderSidebar() {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar onOpenCommandPalette={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Sidebar for the sales role", () => {
  beforeEach(() => {
    useUi.setState({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      sidebarOpen: true,
    });
    useAuth.setState({
      accessToken: "test",
      refreshToken: "test",
      user: {
        id: "u2",
        tenantId: "tenant_acme",
        name: "Megala",
        email: "megala@acme.test",
        username: "megala",
        roleId: "role_sales",
        role: "sales",
      },
    });
  });

  it("shows the seven POC sales nav items", () => {
    renderSidebar();
    for (const label of [
      /dashboard/i,
      /recurring/i,
      /new sales customers/i,
      /sales orders/i,
      /payments follow-up/i,
      /follow-ups/i,
      /my customers/i,
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("hides the admin-only modules from a salesperson", () => {
    renderSidebar();
    expect(screen.queryByRole("link", { name: /^users$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^data$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^products$/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web test -- layout.sales-nav`
Expected: FAIL. `NAVS.sales` is undefined, so `Sidebar` falls back to `NAVS.admin` (`layout.tsx:70`) and the admin-only links are present.

- [ ] **Step 3: Add the sales nav and role label**

In `apps/web/src/data/constants.ts`, replace the `ROLES` block and its stale comment:

```ts
/** Web login roles. All four roles have a web login; `sales` is additionally
 *  the primary role on the GreatSales mobile app. */
export type Role = "super_admin" | "admin" | "mgmt" | "sales";

export const ROLES: { value: Role; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Administrator" },
  { value: "mgmt", label: "Management" },
  { value: "sales", label: "Salesperson" },
];
```

Then add a `sales` key to `NAVS`, matching the POC's order and labels:

```ts
  sales: [
    { key: "dashboard", label: "Dashboard" },
    { key: "projections", label: "Recurring Projections" },
    { key: "leads", label: "New Sales Customers" },
    { key: "orders", label: "Sales Orders" },
    { key: "payments", label: "Payments Follow-up" },
    { key: "followups", label: "Follow-ups" },
    { key: "customers", label: "My Customers" },
  ],
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter web test -- layout.sales-nav layout.nav`
Expected: PASS, including the pre-existing admin nav test.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data/constants.ts apps/web/tests/components/layout.sales-nav.test.tsx
git commit -m "feat(web): add sales role nav and label"
```

---

### Task 5: Unblock sales login on web

**Files:**
- Modify: `apps/web/src/store/auth.ts:19-25` and `:47-50`
- Modify: `apps/web/src/features/auth/LoginPage.tsx:22`, `:37`, `:76`, `:93`
- Modify: `apps/web/src/App.tsx`
- Create: `apps/web/tests/store/auth.sales.test.ts`

**Interfaces:**
- Consumes: `useAuth.login(tenantId, email, password)` — currently throws `SalesWebLoginError` for a sales user.
- Produces: `LoginRole` becomes `"super_admin" | "admin" | "mgmt" | "sales"`. `SalesWebLoginError` is deleted; any importer must be updated. Route `/sales/login` renders the sales login card.

- [ ] **Step 1: Find every importer of the error class**

Run: `grep -rn "SalesWebLoginError" apps/web/src apps/web/tests`

Note each result — `LoginPage.tsx` almost certainly catches it to render a message. Every one of these sites is edited in Step 4.

- [ ] **Step 2: Write the failing test**

Create `apps/web/tests/store/auth.sales.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useAuth } from "@/store/auth";

/**
 * A salesperson signing in on web must establish a session like any other
 * role. Server-side ownership scoping — not a client-side block — is what
 * limits what they can reach.
 */
describe("useAuth.login for the sales role", () => {
  beforeEach(() => {
    useAuth.setState({ accessToken: null, refreshToken: null, user: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          accessToken: "at",
          refreshToken: "rt",
          user: {
            id: "u2",
            tenantId: "tenant_acme",
            name: "Megala",
            email: "megala@acme.test",
            username: "megala",
            roleId: "role_sales",
            role: "sales",
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("establishes a session instead of throwing", async () => {
    await expect(
      useAuth.getState().login("tenant_acme", "megala@acme.test", "pw"),
    ).resolves.toBeUndefined();

    expect(useAuth.getState().accessToken).toBe("at");
    expect(useAuth.getState().user?.role).toBe("sales");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter web test -- auth.sales`
Expected: FAIL with `Sales is mobile-only — use the GreatSales app.`

If it instead fails on the fetch stub's shape, open `apps/web/src/lib/api.ts` to see what `apiFetch` expects of a response and adjust the stub. Do not change `apiFetch`.

- [ ] **Step 4: Remove the block**

In `apps/web/src/store/auth.ts`, delete the `SalesWebLoginError` class (lines 19–25) and the guard inside `login`:

```ts
        const res = await apiFetch<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ tenantId, email, password }),
        });
        set({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          user: res.user,
        });
```

Then remove the now-unused `mapRole` import if nothing else in the file uses it — check first with `grep -n "mapRole" apps/web/src/store/auth.ts`; the selector hooks at the bottom of the file do use it, so it most likely stays.

Update every site found in Step 1 to drop its `SalesWebLoginError` import and catch branch.

- [ ] **Step 5: Add the sales login role**

In `apps/web/src/features/auth/LoginPage.tsx`:

```ts
export type LoginRole = "super_admin" | "admin" | "mgmt" | "sales";
```

Add to `ROLE_CONFIGS`, using the existing `Users`/`ShieldCheck` import style — import `UserRound` from `lucide-react`:

```ts
  sales: {
    id: "sales",
    label: "Salesperson",
    badge: "FIELD SALES",
    badgeColor: "bg-sky-500/10 text-sky-600 border-sky-300 dark:border-sky-800",
    icon: UserRound,
    route: "/sales/login",
    defaultEmail: "sales@greatsales.in",
    destination: `/managements/${DEFAULT_MANAGEMENT_ID}/dashboard`,
    title: "Salesperson Portal",
    description:
      "Your accounts. Recurring projections, new sales pipeline, orders, and collections follow-up.",
  },
```

Add to `resolveRoleFromPath`, before the `admin` check so `/sales/login` is not swallowed by a substring match:

```ts
  if (roleParam === "sales" || roleParam === "salesperson") return "sales";
```

and in the pathname branch, before the `admin` line:

```ts
  if (pathname.includes("sales")) return "sales";
```

Add to `DEMO_EMAIL_BY_ROLE`:

```ts
  sales: env.DEMO_EMAIL.replace(/^admin@/, "sales@"),
```

- [ ] **Step 6: Add the routes**

In `apps/web/src/App.tsx`, beside the other dedicated login routes:

```tsx
        <Route path="/sales/login" element={<PublicAuthRoute initialRole="sales" />} />
```

and beside the other direct role entry routes:

```tsx
        <Route path="/sales" element={<RoleDirectRoute role="sales" />} />
```

`RoleDirectRoute`'s `role` prop is typed `"super_admin" | "admin" | "mgmt"` — widen it to include `"sales"`, and add an unauthenticated redirect branch alongside the existing ones:

```tsx
    if (targetRole === "sales") return <Navigate to="/sales/login" replace />;
```

A sales user falls through to the existing management-dashboard redirect, which is correct.

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter web test`
Expected: PASS. If `App.routes.test.tsx` fails, read the failure — it may assert the old route set and need the sales routes added to its expectations.

Run: `pnpm --filter web check-types`
Expected: no errors. A `LoginRole` widening usually surfaces missing `ROLE_CONFIGS` keys or a narrow prop type here.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/store/auth.ts apps/web/src/features/auth/LoginPage.tsx apps/web/src/App.tsx apps/web/tests/store/auth.sales.test.ts
git commit -m "feat(web): allow salespersons to sign in on web"
```

---

### Task 6: Guard the admin routes against direct URL access

Hiding a nav link does not stop someone typing the URL. `/users` and `/data` already carry a `RoleGuard`; `/products` does not, and the sales nav omits it.

**Files:**
- Modify: `apps/web/src/App.tsx` — the `/products` route
- Create: `apps/web/tests/App.sales-routes.test.tsx`

**Interfaces:**
- Consumes: `RoleGuard({ allowedRoles: Role[], children })` from `@/features/auth/RoleGuard` — renders an "Access Restricted" panel when the current role is not listed.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/App.sales-routes.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

function renderAt(path: string) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("route guards for the sales role", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true });
    useAuth.setState({
      accessToken: "test",
      refreshToken: "test",
      user: {
        id: "u2",
        tenantId: "tenant_acme",
        name: "Megala",
        email: "megala@acme.test",
        username: "megala",
        roleId: "role_sales",
        role: "sales",
      },
    });
  });

  it.each(["users", "data", "products"])(
    "blocks a salesperson from /%s",
    async (segment) => {
      renderAt(`/managements/${DEFAULT_MANAGEMENT_ID}/${segment}`);
      await waitFor(() =>
        expect(screen.getByText(/access restricted/i)).toBeInTheDocument(),
      );
    },
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web test -- App.sales-routes`
Expected: the `products` case FAILS — that route has no guard. The `users` and `data` cases should already pass.

- [ ] **Step 3: Guard the products route**

In `apps/web/src/App.tsx`, wrap the products route the way `/users` is wrapped:

```tsx
            <Route
              path="products"
              element={
                <RoleGuard allowedRoles={["super_admin", "admin", "mgmt"]}>
                  <ProductsPage />
                </RoleGuard>
              }
            />
```

Management keeps read access to the catalog; only `sales` is excluded, matching the POC's nav.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter web test -- App.sales-routes App.routes`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/tests/App.sales-routes.test.tsx
git commit -m "feat(web): guard the products route against the sales role"
```

---

### Task 7: Hide the Salesperson column from a salesperson

In the POC, a salesperson never sees a Salesperson column — every row is theirs, so the column is noise. `ProjectionsPage.tsx` has no role awareness at all; `LeadsPage.tsx` and `OrdersPage.tsx` read the role but still render the column unconditionally.

**Files:**
- Modify: `apps/web/src/features/projections/ProjectionsPage.tsx:148` (header) and its matching body cell
- Modify: `apps/web/src/features/leads/LeadsPage.tsx:209` and its matching body cell
- Modify: `apps/web/src/features/orders/OrdersPage.tsx:248` and its matching body cell
- Create: `apps/web/tests/features/projections/ProjectionsPage.role.test.tsx`

**Interfaces:**
- Consumes: `useAuthRole(): Role` from `@/store/auth`.
- Produces: nothing consumed by later tasks. Note for plan 2: `ProjectionsPage` gains a `role` binding that the new role-conditional delete column will reuse.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/features/projections/ProjectionsPage.role.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProjectionsPage from "@/features/projections/ProjectionsPage";
import { useUi, DEFAULT_MANAGEMENT_ID } from "@/store/ui";
import { useAuth } from "@/store/auth";

const LINE = {
  id: "pl1",
  customerName: "Acme Corp Customer One",
  salespersonId: "u2",
  salespersonName: "Megala",
  principalName: "CASTROL",
  productName: "HYDROPAC AW 68",
  price: 160,
  committedQty: 10,
  committedValue: 1600,
  achievedQty: 4,
  achievedValue: 640,
  status: "ProjectionCreated",
};

function setRole(role: "admin" | "sales") {
  useAuth.setState({
    accessToken: "test",
    refreshToken: "test",
    user: {
      id: "u2",
      tenantId: "tenant_acme",
      name: "Megala",
      email: "megala@acme.test",
      username: "megala",
      roleId: `role_${role}`,
      role,
    },
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProjectionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectionsPage salesperson column", () => {
  beforeEach(() => {
    useUi.setState({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      month: "2026-06",
      principalId: "ALL",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          lines: [LINE],
          summary: {
            committedValue: 1600,
            achievedValue: 640,
            achievementPct: 40,
            lineCount: 1,
          },
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the Salesperson column for an admin", async () => {
    setRole("admin");
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByRole("columnheader", { name: /salesperson/i }),
      ).toBeInTheDocument(),
    );
  });

  it("hides the Salesperson column for a salesperson", async () => {
    setRole("sales");
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Acme Corp Customer One")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("columnheader", { name: /salesperson/i }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter web test -- ProjectionsPage.role`
Expected: the second test FAILS — the column renders for every role.

If the first test also fails, the fetch stub does not match what `useProjections` expects. Open `apps/web/tests/features/payments/PaymentsPage.test.tsx` and copy how it stubs a list response; it solves the same problem for a sibling page.

- [ ] **Step 3: Make the column conditional in ProjectionsPage**

Add the role binding near the other hooks at the top of the component:

```tsx
import { useAuthRole } from "@/store/auth";
```

```tsx
  const role = useAuthRole();
  const showSalesperson = role !== "sales";
```

Wrap the header cell at line 148:

```tsx
                {showSalesperson && (
                  <th className="min-w-[110px] px-3 py-2.5">Salesperson</th>
                )}
```

Wrap the matching body cell (the `<td>` rendering `l.salespersonName`):

```tsx
                    {showSalesperson && (
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                        {l.salespersonName}
                      </td>
                    )}
```

The table has three `colSpan={12}` placeholder rows for the loading, error, and empty states. A hidden column makes those spans wrong. Replace the literal with a computed value:

```tsx
  const colCount = showSalesperson ? 12 : 11;
```

and use `colSpan={colCount}` in all three places.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter web test -- ProjectionsPage.role`
Expected: PASS

- [ ] **Step 5: Apply the same treatment to Leads and Orders**

`LeadsPage.tsx` and `OrdersPage.tsx` already bind `role`. In each, guard the Salesperson `<th>` and its matching `<td>` with `role !== "sales"`, and adjust any `colSpan` literal in that table the same way.

In `LeadsPage.tsx` the Kanban card footer also renders the salesperson name — guard that too, matching the POC, which shows it only to admin and management.

- [ ] **Step 6: Run the full web suite**

Run: `pnpm --filter web test`
Expected: PASS

Run: `pnpm --filter web check-types`
Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/projections/ProjectionsPage.tsx apps/web/src/features/leads/LeadsPage.tsx apps/web/src/features/orders/OrdersPage.tsx apps/web/tests/features/projections/ProjectionsPage.role.test.tsx
git commit -m "feat(web): hide the salesperson column from the sales role"
```

---

### Task 8: Verify end-to-end against a running stack

Unit and integration tests do not prove that a salesperson can actually sign in and use the app. This task closes that gap by hand, once.

**Files:** none — this is a verification task.

- [ ] **Step 1: Confirm a seeded sales user exists**

Run: `pnpm --filter @greatsales/db db:seed`

Then find the sales user's email and tenant:

```bash
psql "$DATABASE_URL" -c "select u.email, u.tenant_id, r.name as role from \"User\" u join \"Role\" r on r.id = u.role_id where r.name = 'sales' limit 5;"
```

If the table names differ, read `packages/db/prisma/schema.prisma` for the `@@map` values.

- [ ] **Step 2: Start the API and the web app**

Start the API however this repo normally does (`pnpm --filter api dev`).

For the web app, use the preview tooling rather than a raw shell — add a `.claude/launch.json` entry if none exists, then start it and open the browser pane.

- [ ] **Step 3: Sign in as the salesperson**

Navigate to `/sales/login` and sign in with the seeded credentials.

Confirm, and note any deviation:
- The sidebar shows exactly seven items, ending in "My Customers".
- No Users, Data, or Products link appears.
- The topbar shows the month and principal selectors but **no** salesperson selector.
- The Projections worksheet has no Salesperson column.
- Every row on Projections, Leads, Orders, and Payments belongs to this salesperson.

- [ ] **Step 4: Confirm the guards hold against direct URLs**

With the sales session still active, navigate directly to `/managements/<id>/users`, then `/data`, then `/products`.

Expected: each renders the "Access Restricted" panel.

- [ ] **Step 5: Confirm the API refuses too**

Client-side guards are cosmetic; the server is the authority. With the sales user's access token:

```bash
curl -i -H "Authorization: Bearer $SALES_TOKEN" http://localhost:3000/users
```

Expected: `403`, not `200`.

- [ ] **Step 6: Record the result**

If every check passed, note it in the commit. If any failed, **stop** — a failure here means an authorization gap that the test suite missed, and it must be fixed and covered by a test before this plan is considered done.

```bash
git commit --allow-empty -m "test(web): verify sales-on-web end-to-end against a running stack"
```

---

## Done when

- `pnpm --filter api test` passes, including the new `sales-scope` and `rbac-grants` suites.
- `pnpm --filter web test` and `pnpm --filter web check-types` pass.
- A seeded salesperson can sign in at `/sales/login`, sees the POC's seven nav items, and sees only their own rows.
- `/users`, `/data`, and `/products` are refused for that session in the browser **and** by the API.

## What this plan deliberately does not do

- No design-system changes. Spec section 1.
- No new columns, modals, or filters — that is plan 2 (component parity).
- No performance work, and specifically no change to `RequestUser`, `isSalesOnly`, or `forTenant` — that is plan 3. `isSalesOnly` still costs a database round trip per call here, and that is accepted for now.
