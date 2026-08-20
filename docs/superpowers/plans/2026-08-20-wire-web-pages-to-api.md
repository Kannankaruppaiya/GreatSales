# Wire All Web Pages to Real API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 8 remaining `apps/web` pages off mock data (`store/trackerStore.ts`) onto the real NestJS API, at a production-grade bar (transparent token refresh, cursor-based infinite pagination, no dead code).

**Architecture:** Each feature repeats the proven ProjectionsPage template — a local `types.ts` (wire types) + `queries.ts` (react-query hooks) per feature, and the page/modals swap `trackerStore` reads/writes for those hooks. `lib/api.ts` gains a single-flight 401→refresh→retry so expired sessions self-heal. RLS scopes every request to the JWT's tenant (no client-side tenantId).

**Tech Stack:** React 19 + Vite 6 + TypeScript, @tanstack/react-query v5, zustand (auth/ui stores), react-router v7, vitest + RTL + jsdom. Backend: NestJS + Prisma (already built, 94 tests green).

## Global Constraints

- **No API changes.** Backend is used as-is. Endpoints are uniform REST per resource: `GET /<r>`, `POST /<r>`, `PATCH /<r>/:id`, `DELETE /<r>/:id`. Base URL from `env.API_BASE_URL` (`lib/config.ts`), default `http://localhost:3000/api/v1`.
- **List `limit` max is 100** (zod contract). Page size = **50**.
- **Wire types are local copies** of `@greatsales/shared` contracts (Vite must not consume shared's CJS dist) — mirror the shared shape exactly; the API is the source of truth.
- **Server-computed values are never re-derived client-side**: order `total`/`lineTotal`, payment `pending`/`status`/`agingDays`. Render them as received.
- **Money/qty are plain numbers on the wire** (Prisma Decimal → number in services).
- **All enum values are the raw DB PascalCase strings** (see `packages/shared/src/enums.ts`).
- Every task ends green on both `pnpm --filter web test` and `pnpm --filter web exec tsc --noEmit`. The 25 existing tests must stay green.
- Tests live under `apps/web/tests/` mirroring `src/` (never co-located in `src/`).
- Keep each page's old file as `<Name>Page.mock.tsx` during wiring; Task 10 deletes them all.
- Commit after every task (frequent commits).

---

### Task 1: Transparent token refresh in the API client

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/store/auth.ts`
- Modify: `apps/web/src/main.tsx:15-19` (the `onApiError` 401 handler)
- Test: `apps/web/tests/lib/api.refresh.test.ts`

**Interfaces:**
- Produces: `setRefreshHandler(fn: () => Promise<string | null>): void` in `lib/api.ts` — the auth store registers a handler that refreshes and returns the new access token (or `null` on failure). `apiFetch` uses it to retry a single 401 once.
- Consumes: existing `setTokenGetter`, `ApiError`, `env.API_BASE_URL`, `useAuth` store with `refreshToken`/`accessToken` and a way to set the new pair.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/tests/lib/api.refresh.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiFetch, setTokenGetter, setRefreshHandler } from "../../src/lib/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch token refresh", () => {
  beforeEach(() => {
    setTokenGetter(() => "expired");
    vi.restoreAllMocks();
  });

  it("refreshes once on 401 then retries the original request", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh");
    setRefreshHandler(refresh);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse(401, { message: "expired" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const out = await apiFetch<{ ok: boolean }>("/things");

    expect(out).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
    // retry carried the fresh bearer
    const retryHeaders = new Headers(fetchMock.mock.calls[1][1]!.headers);
    expect(retryHeaders.get("Authorization")).toBe("Bearer fresh");
  });

  it("throws 401 and does not retry when refresh fails", async () => {
    setRefreshHandler(vi.fn().mockResolvedValue(null));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "expired" }));

    await expect(apiFetch("/things")).rejects.toMatchObject({ status: 401 });
  });

  it("shares a single refresh across concurrent 401s", async () => {
    const refresh = vi.fn().mockImplementation(
      () => new Promise<string>((r) => setTimeout(() => r("fresh"), 10)),
    );
    setRefreshHandler(refresh);
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      const auth = new Headers(init?.headers).get("Authorization");
      return Promise.resolve(
        auth === "Bearer fresh" ? jsonResponse(200, { ok: true }) : jsonResponse(401, { message: "expired" }),
      );
    });

    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run tests/lib/api.refresh.test.ts`
Expected: FAIL — `setRefreshHandler` is not exported.

- [ ] **Step 3: Implement refresh in `lib/api.ts`**

Add below the existing `setTokenGetter`:

```ts
let refreshHandler: (() => Promise<string | null>) | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

/** Registered by the auth store; returns a fresh access token or null on failure. */
export function setRefreshHandler(fn: () => Promise<string | null>): void {
  refreshHandler = fn;
}

/** Single-flight: concurrent 401s await the same refresh. */
function refreshOnce(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  if (!inFlightRefresh) {
    inFlightRefresh = refreshHandler().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}
```

Refactor `apiFetch` so the request is issued by an inner helper and a 401 triggers one refresh+retry (`_retry` guard prevents recursion; the refresh call itself uses raw `fetch`, never `apiFetch`):

```ts
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return doFetch<T>(path, init, false);
}

async function doFetch<T>(path: string, init: RequestInit, isRetry: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = tokenGetter();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${env.API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry) {
    const fresh = await refreshOnce();
    if (fresh) return doFetch<T>(path, init, true);
  }

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const b = body as { message?: string | string[]; details?: unknown } | null;
    const raw = b?.message ?? res.statusText;
    const message = Array.isArray(raw) ? raw.join(", ") : raw;
    throw new ApiError(res.status, message, b?.details);
  }
  return body as T;
}
```

- [ ] **Step 4: Register the handler in `store/auth.ts`**

Add after the existing `setTokenGetter(...)` line:

```ts
import { env } from "@/lib/config";
import type { LoginResponse } from "@/features/projections/types";

// On 401, exchange the refresh token for a new pair via a raw fetch (never apiFetch,
// to avoid recursing into refresh). Returns the new access token, or null → logout.
setRefreshHandler(async () => {
  const rt = useAuth.getState().refreshToken;
  if (!rt) return null;
  try {
    const res = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      useAuth.getState().logout();
      return null;
    }
    const data = (await res.json()) as LoginResponse;
    useAuth.setState({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    return data.accessToken;
  } catch {
    useAuth.getState().logout();
    return null;
  }
});
```

Add `setRefreshHandler` to the existing `import { apiFetch, setTokenGetter } from "@/lib/api"` line. Confirm the `/auth/refresh` body key is `refreshToken` by checking `packages/shared/src/auth.ts` `RefreshSchema`; if it differs, use that key.

- [ ] **Step 5: Soften `main.tsx` onApiError**

The client now heals 401s itself; a 401 that still reaches react-query means refresh already failed and logged out. Update the comment and keep the logout as a final safety net:

```ts
// A 401 that surfaces here means refresh already failed (api.ts self-heals otherwise).
// Clear any residual session so ProtectedRoute bounces to /login.
function onApiError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    useAuth.getState().logout();
  }
}
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm --filter web exec vitest run tests/lib/api.refresh.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/store/auth.ts apps/web/src/main.tsx apps/web/tests/lib/api.refresh.test.ts
git commit -m "feat(web): transparent single-flight token refresh on 401"
```

---

### Task 2: Wire Products page (reference exemplar)

This task establishes the pattern every later page follows, plus a reusable `QueryBoundary` for loading/error/empty.

**Files:**
- Create: `apps/web/src/components/common/QueryBoundary.tsx`
- Create: `apps/web/src/features/products/types.ts`
- Create: `apps/web/src/features/products/queries.ts`
- Modify: `apps/web/src/features/products/ProductsPage.tsx` (swap store → hooks)
- Modify: `apps/web/src/features/products/AddProductModal.tsx` (create via mutation)
- Rename: `ProductsPage.tsx` → `ProductsPage.mock.tsx` first (preserve), then create the wired `ProductsPage.tsx`
- Test: `apps/web/tests/features/products/queries.test.ts`

**Interfaces:**
- Produces: `QueryBoundary` component (reused by Tasks 3-9); `useProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct` hooks; `flattenPages(data)` helper.

- [ ] **Step 1: Preserve the mock page**

```bash
git mv apps/web/src/features/products/ProductsPage.tsx apps/web/src/features/products/ProductsPage.mock.tsx
```

- [ ] **Step 2: Create the reusable QueryBoundary**

```tsx
// apps/web/src/components/common/QueryBoundary.tsx
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui";

interface Props {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
}

export function QueryBoundary({ isLoading, isError, error, isEmpty, emptyLabel = "No records yet.", children }: Props) {
  if (isLoading) return <Skeleton className="h-96 w-full rounded-xl" />;
  if (isError) {
    const msg = error instanceof ApiError ? error.message : "Something went wrong.";
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load: {msg}
      </div>
    );
  }
  if (isEmpty) {
    return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>;
  }
  return <>{children}</>;
}
```

(If `Skeleton` / `text-muted-foreground` differ in this codebase, match the existing tokens used in `components/ui`.)

- [ ] **Step 3: Create wire types**

```ts
// apps/web/src/features/products/types.ts
// Mirrors packages/shared/src/product.ts — API is source of truth.
export type DivisionValue = "LUB" | "WES";

export interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  division: DivisionValue | null;
  unit: string | null;
  basePrice: number | null;
  active: boolean;
  principalId: string;
  principalName: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProductListResponse { items: ProductRow[]; nextCursor: string | null; }

export interface ProductCreate {
  name: string;
  principalId: string;
  sku?: string | null;
  division?: DivisionValue | null;
  unit?: string | null;
  basePrice?: number | null;
  active?: boolean;
}
export type ProductUpdate = Partial<ProductCreate>;
```

- [ ] **Step 4: Write the failing queries test**

```ts
// apps/web/tests/features/products/queries.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import * as api from "../../../src/lib/api";
import { productKeys } from "../../../src/features/products/queries";

describe("products queries", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("list requests /products with cursor + limit 50", async () => {
    const spy = vi
      .spyOn(api, "apiFetch")
      .mockResolvedValue({ items: [], nextCursor: null });
    // exercise the queryFn shape the hook builds:
    const { productsQueryFn } = await import("../../../src/features/products/queries");
    await productsQueryFn({ search: "oil" }, undefined);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/products?"));
    expect(spy.mock.calls[0][0]).toContain("limit=50");
    expect(spy.mock.calls[0][0]).toContain("search=oil");
  });

  it("exposes a stable query key", () => {
    expect(productKeys.list({ search: "x" })).toEqual(["products", { search: "x" }]);
  });

  it("create invalidates the products list", async () => {
    const qc = new QueryClient();
    const inv = vi.spyOn(qc, "invalidateQueries");
    const { onProductMutationSuccess } = await import("../../../src/features/products/queries");
    onProductMutationSuccess(qc);
    expect(inv).toHaveBeenCalledWith({ queryKey: ["products"] });
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm --filter web exec vitest run tests/features/products/queries.test.ts`
Expected: FAIL — module `features/products/queries` not found.

- [ ] **Step 6: Implement queries.ts**

```ts
// apps/web/src/features/products/queries.ts
import { useInfiniteQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";
import type { ProductRow, ProductListResponse, ProductCreate, ProductUpdate } from "./types";

const PAGE_SIZE = 50;

export interface ProductParams { search?: string; principalId?: string }

export const productKeys = {
  list: (p: ProductParams) => ["products", p] as const,
};

export function productsQueryFn(p: ProductParams, cursor: string | undefined) {
  return apiFetch<ProductListResponse>(
    `/products${buildQuery({ search: p.search, principalId: p.principalId, cursor, limit: String(PAGE_SIZE) })}`,
  );
}

export function useProducts(params: ProductParams = {}) {
  return useInfiniteQuery({
    queryKey: productKeys.list(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => productsQueryFn(params, pageParam),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function flattenProducts(data?: { pages: ProductListResponse[] }): ProductRow[] {
  return data?.pages.flatMap((pg) => pg.items) ?? [];
}

export function onProductMutationSuccess(qc: QueryClient) {
  return qc.invalidateQueries({ queryKey: ["products"] });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductCreate) =>
      apiFetch<ProductRow>("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}
export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProductUpdate }) =>
      apiFetch<ProductRow>(`/products/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => onProductMutationSuccess(qc),
  });
}
```

- [ ] **Step 7: Run queries test to verify pass**

Run: `pnpm --filter web exec vitest run tests/features/products/queries.test.ts`
Expected: PASS.

- [ ] **Step 8: Rewrite ProductsPage to consume hooks**

Read `ProductsPage.mock.tsx` for its markup. Create a new `ProductsPage.tsx` that keeps the same table/filters JSX but replaces data plumbing:
1. Delete the `useTrackerStore()` read of `products`/`principals`.
2. `const q = useProducts({ search, principalId });` then `const products = flattenProducts(q.data);`.
3. Wrap the table in `<QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error} isEmpty={products.length === 0}>`.
4. Add a "Load more" button under the table: `{q.hasNextPage && <Button onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>Load more</Button>}`.
5. Derived counts previously computed from the store (e.g. division/active tallies) now compute from `products`.
6. Principals list: fetch via `useProducts`' sibling if a principals endpoint is needed for the filter dropdown — principals are exposed through `product.principalName`; derive the filter options from the loaded rows (`[...new Set(products.map(p => p.principalName))]`) for now.

- [ ] **Step 9: Wire AddProductModal create**

In `AddProductModal.tsx`: replace the store `addProduct(...)` call with:
```ts
const create = useCreateProduct();
// on submit:
await create.mutateAsync({ name, principalId, sku, division, unit, basePrice, active });
onClose();
```
Surface `create.error` (an `ApiError`, e.g. duplicate SKU → 409) inline in the form. Remove the `useTrackerStore()` principals read; pass principal options in as a prop from the page (from the derived set) or fetch as in Step 8.

- [ ] **Step 10: Run full web tests + typecheck**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit`
Expected: PASS (existing 25 + new), no type errors.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/common/QueryBoundary.tsx apps/web/src/features/products apps/web/tests/features/products
git commit -m "feat(web): wire Products page to API (infinite query + CRUD), add QueryBoundary"
```

---

### Task 3: Wire Users page

**Files:**
- Create: `apps/web/src/features/users/types.ts`
- Create: `apps/web/src/features/users/queries.ts`
- Rename then rewrite: `apps/web/src/features/users/UsersPage.tsx` (→ `.mock.tsx` first)
- Modify: `apps/web/src/features/users/EditUserModal.tsx` (create + update via mutations)
- Test: `apps/web/tests/features/users/queries.test.ts`

**Interfaces:**
- Consumes: `QueryBoundary` (Task 2), `apiFetch`, `buildQuery`.
- Produces: `useUsers`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`, `flattenUsers`.

- [ ] **Step 1:** `git mv apps/web/src/features/users/UsersPage.tsx apps/web/src/features/users/UsersPage.mock.tsx`

- [ ] **Step 2: Wire types** (`features/users/types.ts`, mirrors `shared/user.ts`):

```ts
export interface UserRow {
  id: string; name: string; email: string; username: string;
  roleId: string; roleName: string;
  managerId: string | null; managerName: string | null;
  teamId: string | null; teamName: string | null;
  active: boolean; lastLoginAt: string | null;
  createdAt: string; updatedAt: string;
}
export interface UserListResponse { items: UserRow[]; nextCursor: string | null; }
export interface UserCreate {
  name: string; email: string; username: string; password: string; roleId: string;
  managerId?: string | null; teamId?: string | null; active?: boolean;
}
export type UserUpdate = Partial<UserCreate>;
```

- [ ] **Step 3: Failing test** `tests/features/users/queries.test.ts` — same three assertions as Task 2 (list hits `/users?...limit=50`, stable key `["users", p]`, create invalidates `["users"]`). Copy the Task 2 test, replace `product`→`user`, endpoint `/users`.

- [ ] **Step 4:** Run it — Expected FAIL (module missing).

- [ ] **Step 5: Implement `queries.ts`** — copy Task 2's `queries.ts`, replace types with `UserRow/UserListResponse/UserCreate/UserUpdate`, resource string `users`, params `{ search?: string; roleId?: string }`, key prefix `"users"`. Hook names: `useUsers`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`, helper `flattenUsers`, `userKeys`, `onUserMutationSuccess`.

- [ ] **Step 6:** Run test — Expected PASS.

- [ ] **Step 7: Rewrite `UsersPage.tsx`** from `.mock.tsx`: replace the `useTrackerStore()` users read with `const q = useUsers({ search }); const users = flattenUsers(q.data);`. Wrap the table in `QueryBoundary`. Add "Load more" (`q.hasNextPage`). The existing add/edit flow already opens `EditUserModal` with `user={null}` for add and a row for edit — keep that; only the persistence layer changes in Step 8. Role filter options: derive from `[...new Set(users.map(u => u.roleName))]` or the existing constants.

- [ ] **Step 8: Wire `EditUserModal.tsx`**:
```ts
const create = useCreateUser();
const update = useUpdateUser();
const isNew = !user;
// on submit:
if (isNew) await create.mutateAsync({ name, email, username, password, roleId, managerId, teamId, active });
else await update.mutateAsync({ id: user.id, patch: { name, email, username, roleId, managerId, teamId, active, ...(password ? { password } : {}) } });
onClose();
```
Never send an empty `password` on update (omit it). Surface `create.error`/`update.error` (409 = duplicate email/username) inline. Remove the `useTrackerStore()` read.

- [ ] **Step 9:** Run `pnpm --filter web test && pnpm --filter web exec tsc --noEmit` — Expected PASS.

- [ ] **Step 10: Commit** `feat(web): wire Users page to API (CRUD, dup-email handling)`

---

### Task 4: Wire Customers page

**Files:**
- Create: `apps/web/src/features/customers/types.ts`, `queries.ts`
- Rename+rewrite: `CustomersPage.tsx` (→ `.mock.tsx`)
- Modify: `AddCustomerModal.tsx`, `EditCustomerModal.tsx`, `CustomerDrawer.tsx`, `ReassignCustomersModal.tsx`
- Test: `apps/web/tests/features/customers/queries.test.ts`

**Interfaces:**
- Produces: `useCustomers`, `useCreateCustomer`, `useUpdateCustomer`, `useDeleteCustomer`, `flattenCustomers`. Reassign = `useUpdateCustomer` per row with `{ salespersonId }`.

- [ ] **Step 1:** `git mv .../CustomersPage.tsx .../CustomersPage.mock.tsx`

- [ ] **Step 2: Wire types** (mirror `shared/customer.ts`):
```ts
export type DivisionValue = "LUB" | "WES";
export interface CustomerRow {
  id: string; name: string; division: DivisionValue | null;
  category: string | null; type: string | null;
  industryId: string | null; industryName: string | null; subIndustry: string | null;
  area: string | null; paymentTerms: string | null; payZone: string | null;
  outstanding: number; active: boolean;
  salespersonId: string; salespersonName: string;
  collectorId: string | null; collectorName: string | null;
  primaryContactName: string | null; primaryContactPhone: string | null;
  createdAt: string; updatedAt: string;
}
export interface CustomerListResponse { items: CustomerRow[]; nextCursor: string | null; }
export interface CustomerCreate {
  name: string; salespersonId: string;
  division?: string | null; category?: string | null; type?: string | null;
  industryId?: string | null; subIndustry?: string | null; area?: string | null;
  paymentTerms?: string | null; payZone?: string | null; outstanding?: number;
  collectorId?: string | null; active?: boolean;
}
export type CustomerUpdate = Partial<CustomerCreate>;
```

- [ ] **Step 3: Failing test** — Task 2 pattern; endpoint `/customers`, params `{ search?, category?, ownerId? }`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5: Implement `queries.ts`** — Task 2 copy; resource `customers`, params `{ search?: string; category?: string; ownerId?: string }`, names `useCustomers/useCreateCustomer/useUpdateCustomer/useDeleteCustomer/flattenCustomers/customerKeys`.
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7: Rewrite `CustomersPage.tsx`** — `const q = useCustomers({ search, category, ownerId }); const customers = flattenCustomers(q.data);` + `QueryBoundary` + Load more. Owner/category filters derive from constants (unchanged) — they only shape the query params now.
- [ ] **Step 8: Wire modals** — `AddCustomerModal` → `useCreateCustomer().mutateAsync(body)`; `EditCustomerModal` → `useUpdateCustomer().mutateAsync({ id, patch })`; `CustomerDrawer` delete → `useDeleteCustomer().mutateAsync(id)`; `ReassignCustomersModal` → for each selected id call `useUpdateCustomer().mutateAsync({ id, patch: { salespersonId: target } })` (await all with `Promise.all`), then close. Surface mutation `error` inline. Remove `useTrackerStore()` reads.
- [ ] **Step 9:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 10: Commit** `feat(web): wire Customers page to API (CRUD + reassign)`

---

### Task 5: Wire FollowUps page

**Files:**
- Create: `apps/web/src/features/followups/types.ts`, `queries.ts`
- Rename+rewrite: `FollowUpsPage.tsx` (→ `.mock.tsx`)
- Modify: `FollowUpModal.tsx`
- Test: `apps/web/tests/features/followups/queries.test.ts`

**Note:** FollowUp has NO soft-delete → `DELETE /followups/:id` is a hard delete. Marking done = `PATCH { done: true }`.

- [ ] **Step 1:** `git mv .../FollowUpsPage.tsx .../FollowUpsPage.mock.tsx`
- [ ] **Step 2: Wire types** (mirror `shared/followup.ts`):
```ts
export type EntityTypeValue = "Projection" | "Lead" | "Payment" | "Order" | "Customer";
export interface FollowUpRow {
  id: string; entityType: EntityTypeValue; entityId: string;
  salespersonId: string; salespersonName: string;
  title: string | null; subtitle: string | null; amount: number | null;
  dueDate: string; done: boolean; note: string | null;
  createdAt: string; updatedAt: string;
}
export interface FollowUpListResponse { items: FollowUpRow[]; nextCursor: string | null; }
export interface FollowUpCreate {
  entityType: EntityTypeValue; entityId: string; dueDate: string;
  salespersonId?: string | null; title?: string | null; subtitle?: string | null;
  amount?: number | null; note?: string | null; done?: boolean;
}
export interface FollowUpUpdate {
  entityType?: EntityTypeValue; entityId?: string; dueDate?: string;
  title?: string | null; subtitle?: string | null; amount?: number | null;
  note?: string | null; done?: boolean;
}
```
(Confirm `EntityType` values against `packages/shared/src/enums.ts` `EntityTypeSchema` and match exactly.)

- [ ] **Step 3: Failing test** — Task 2 pattern; endpoint `/followups`, params `{ search?, entityType?, done?, ownerId? }`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5: Implement `queries.ts`** — Task 2 copy; resource `followups`, note `done` param is boolean → pass as `String(done)` through `buildQuery`. Names `useFollowUps/useCreateFollowUp/useUpdateFollowUp/useDeleteFollowUp/flattenFollowUps`.
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7: Rewrite `FollowUpsPage.tsx`** — the page currently buckets follow-ups into overdue/today/upcoming from the store. Replace the store read with `const q = useFollowUps({ ownerId, done: false }); const rows = flattenFollowUps(q.data);` then compute the same buckets from `rows` (bucket by comparing `dueDate` to today — pure client grouping over the fetched set). Wrap in `QueryBoundary`; add Load more. A "mark done" control → `useUpdateFollowUp().mutate({ id, patch: { done: true } })`.
- [ ] **Step 8: Wire `FollowUpModal.tsx`** — create → `useCreateFollowUp().mutateAsync(body)`; edit → `useUpdateFollowUp().mutateAsync({ id, patch })`. Remove `useTrackerStore()` reads.
- [ ] **Step 9:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 10: Commit** `feat(web): wire FollowUps page to API (hard-delete, mark-done)`

---

### Task 6: Wire Payments page

**Files:**
- Create: `apps/web/src/features/payments/types.ts`, `queries.ts`
- Rename+rewrite: `PaymentsPage.tsx` (→ `.mock.tsx`)
- Modify: `AddPaymentModal.tsx`, `PaymentDetailModal.tsx`, `ImportPaymentsModal.tsx`
- Test: `apps/web/tests/features/payments/queries.test.ts`

**Note:** `pending`, `status`, `agingDays` are server-computed — render as received, never recompute. Ageing buckets/zones are pure client grouping over the fetched rows using `agingDays`/`payZone`.

- [ ] **Step 1:** `git mv .../PaymentsPage.tsx .../PaymentsPage.mock.tsx`
- [ ] **Step 2: Wire types** (mirror `shared/payment.ts`):
```ts
export interface PaymentFollowupRow { id: string; date: string; note: string; nextFollowupDate: string | null; }
export interface PaymentRow {
  id: string; refNo: string | null;
  customerId: string | null; customerName: string | null;
  salespersonId: string | null; salespersonName: string | null;
  invoiceNo: string | null; invoiceDate: string | null;
  amount: number; received: number; pending: number;
  dueDate: string | null; agingDays: number | null; payZone: string | null;
  delayReason: string | null; nextFollowUp: string | null;
  mail1: boolean; mail2: boolean; mail3: boolean; mail4: boolean;
  status: string; followups: PaymentFollowupRow[];
  createdAt: string; updatedAt: string;
}
export interface PaymentListResponse { items: PaymentRow[]; nextCursor: string | null; }
export interface PaymentCreate {
  amount: number; refNo?: string | null;
  customerId?: string | null; customerName?: string | null; salespersonId?: string | null;
  invoiceNo?: string | null; invoiceDate?: string | null; received?: number;
  dueDate?: string | null; payZone?: string | null; delayReason?: string | null; nextFollowUp?: string | null;
  mail1?: boolean; mail2?: boolean; mail3?: boolean; mail4?: boolean;
}
export type PaymentUpdate = Partial<PaymentCreate>;
```
- [ ] **Step 3: Failing test** — Task 2 pattern; endpoint `/payments`, params `{ search?, status?, customerId?, ownerId? }`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5: Implement `queries.ts`** — Task 2 copy; resource `payments`; names `usePayments/useCreatePayment/useUpdatePayment/useDeletePayment/flattenPayments`.
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7: Rewrite `PaymentsPage.tsx`** — `const q = usePayments({ status, ownerId }); const rows = flattenPayments(q.data);`; compute ageing buckets + zone summaries from `rows` (use server `agingDays`/`payZone`, do not recompute pending/status). `QueryBoundary` + Load more.
- [ ] **Step 8: Wire modals** — `AddPaymentModal` → `useCreatePayment().mutateAsync(body)`; `PaymentDetailModal` edits/mark-mail → `useUpdatePayment().mutateAsync({ id, patch })`; `ImportPaymentsModal` → for each parsed row call `useCreatePayment().mutateAsync(row)` (sequential or `Promise.all`), show a per-row success/error count, then invalidate happens via mutation `onSuccess`. Remove `useTrackerStore()` reads.
- [ ] **Step 9:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 10: Commit** `feat(web): wire Payments page to API (server ageing/status, import)`

---

### Task 7: Wire Orders page

**Files:**
- Create: `apps/web/src/features/orders/types.ts`, `queries.ts`
- Rename+rewrite: `OrdersPage.tsx` (→ `.mock.tsx`)
- Modify: `CreateSalesOrderModal.tsx`, `SalesOrderDetailModal.tsx`, `InvoicePrintModal.tsx`
- Test: `apps/web/tests/features/orders/queries.test.ts`

**Note:** `total`/`lineTotal` are server-computed from `items` — never send or trust a client total. A status change is `PATCH { status, statusNote? }`; cancel is `PATCH { status: "Cancelled", cancelReason }`.

- [ ] **Step 1:** `git mv .../OrdersPage.tsx .../OrdersPage.mock.tsx`
- [ ] **Step 2: Wire types** (mirror `shared/order.ts`):
```ts
export interface OrderItemInput { productId: string; qty: number; price: number; unit?: string | null; }
export interface OrderItemRow { id: string; productId: string; productName: string; qty: number; price: number; unit: string | null; lineTotal: number; }
export interface OrderStatusHistoryRow { id: string; status: string; note: string | null; changedById: string; changedByName: string; at: string; }
export interface OrderRow {
  id: string; code: string; customerId: string; customerName: string;
  salespersonId: string; salespersonName: string; createdById: string | null;
  date: string; status: string; total: number; isUrgent: boolean;
  paymentTerms: string | null; advanceAmount: number | null; advanceRef: string | null;
  deliveryMode: string | null; deliveryAddress: string | null; expectedDelivery: string | null;
  transporterName: string | null; lrNumber: string | null; deliveryInstructions: string | null;
  cancelReason: string | null; cancelledAt: string | null;
  items: OrderItemRow[]; statusHistory: OrderStatusHistoryRow[];
  createdAt: string; updatedAt: string;
}
export interface OrderListResponse { items: OrderRow[]; nextCursor: string | null; }
export interface OrderCreate {
  code: string; customerId: string; salespersonId: string; items: OrderItemInput[];
  status?: string; date?: string; isUrgent?: boolean; paymentTerms?: string | null;
  advanceAmount?: number | null; advanceRef?: string | null;
  deliveryMode?: string | null; deliveryAddress?: string | null; expectedDelivery?: string | null;
  transporterName?: string | null; lrNumber?: string | null; deliveryInstructions?: string | null;
}
export interface OrderUpdate {
  status?: string; statusNote?: string | null; cancelReason?: string | null; isUrgent?: boolean;
  paymentTerms?: string | null; advanceAmount?: number | null; advanceRef?: string | null;
  deliveryMode?: string | null; deliveryAddress?: string | null; expectedDelivery?: string | null;
  transporterName?: string | null; lrNumber?: string | null; deliveryInstructions?: string | null;
}
```
- [ ] **Step 3: Failing test** — Task 2 pattern; endpoint `/orders`, params `{ search?, status?, customerId?, ownerId? }`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5: Implement `queries.ts`** — Task 2 copy; resource `orders`; names `useOrders/useCreateOrder/useUpdateOrder/useDeleteOrder/flattenOrders`.
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7: Rewrite `OrdersPage.tsx`** — `const q = useOrders({ status, ownerId }); const orders = flattenOrders(q.data);` + `QueryBoundary` + Load more. Render `total` from server.
- [ ] **Step 8: Wire modals** — `CreateSalesOrderModal` builds `items: OrderItemInput[]` and calls `useCreateOrder().mutateAsync(body)` WITHOUT a `total` (server computes it); the returned `OrderRow` carries `total`/`items[].lineTotal`. `SalesOrderDetailModal` status advance → `useUpdateOrder().mutateAsync({ id, patch: { status, statusNote } })`; cancel → `{ status: "Cancelled", cancelReason }`. `InvoicePrintModal` reads the fetched `OrderRow` (no store). Remove `useTrackerStore()` reads.
- [ ] **Step 9:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 10: Commit** `feat(web): wire Orders page to API (server totals, status history)`

---

### Task 8: Wire Leads page (Kanban)

**Files:**
- Create: `apps/web/src/features/leads/types.ts`, `queries.ts`
- Rename+rewrite: `LeadsPage.tsx` (→ `.mock.tsx`)
- Modify: `AddLeadModal.tsx`, `LeadDetailModal.tsx`
- Test: `apps/web/tests/features/leads/queries.test.ts`

**Note:** the board is grouped by `stage` (DealStage enum). A drag between columns = `PATCH /leads/:id { stage }`. Update schema omits `products` (line items edited via create only in this cycle).

- [ ] **Step 1:** `git mv .../LeadsPage.tsx .../LeadsPage.mock.tsx`
- [ ] **Step 2: Wire types** (mirror `shared/lead.ts`):
```ts
export interface LeadProductRow { id: string; principalId: string | null; productId: string | null; productName: string; brand: string | null; qty: number | null; unit: string | null; price: number | null; value: number | null; }
export interface LeadProductInput { productName: string; principalId?: string | null; productId?: string | null; brand?: string | null; qty?: number | null; unit?: string | null; price?: number | null; value?: number | null; }
export interface LeadRow {
  id: string; customerName: string; division: string | null; tier: string | null; type: string | null;
  salespersonId: string; salespersonName: string; stage: string; leadStatus: string | null;
  industryId: string | null; industryName: string | null; subIndustry: string | null;
  area: string | null; address: string | null;
  contactName: string | null; phone: string | null; whatsapp: string | null; sameAsMobile: boolean; email: string | null;
  nextFollowUp: string | null; expClose: string | null; stageUpdatedAt: string | null;
  products: LeadProductRow[]; totalValue: number; createdAt: string; updatedAt: string;
}
export interface LeadListResponse { items: LeadRow[]; nextCursor: string | null; }
export interface LeadCreate {
  customerName: string; salespersonId: string; stage?: string;
  division?: string | null; tier?: string | null; type?: string | null; leadStatus?: string | null;
  industryId?: string | null; subIndustry?: string | null; area?: string | null; address?: string | null;
  contactName?: string | null; phone?: string | null; whatsapp?: string | null; sameAsMobile?: boolean; email?: string | null;
  nextFollowUp?: string | null; expClose?: string | null; products?: LeadProductInput[];
}
export type LeadUpdate = Partial<Omit<LeadCreate, "products">>;
```
(Confirm `DealStage` values against `enums.ts` and use them for the Kanban columns.)

- [ ] **Step 3: Failing test** — Task 2 pattern; endpoint `/leads`, params `{ search?, stage?, tier?, ownerId? }`.
- [ ] **Step 4:** Run — FAIL.
- [ ] **Step 5: Implement `queries.ts`** — Task 2 copy; resource `leads`; names `useLeads/useCreateLead/useUpdateLead/useDeleteLead/flattenLeads`.
- [ ] **Step 6:** Run — PASS.
- [ ] **Step 7: Rewrite `LeadsPage.tsx`** — `const q = useLeads({ ownerId }); const leads = flattenLeads(q.data);`; group `leads` by `stage` into the existing Kanban columns (client grouping). Wrap in `QueryBoundary`; add Load more (fetch remaining pages so the board isn't partial — call `fetchNextPage` in a loop while `hasNextPage` on mount, or show Load more). On card drop into a column: `useUpdateLead().mutate({ id, patch: { stage: targetStage } })` — react-query invalidation refetches; optionally optimistic update for snappier UX (out of scope, invalidation is sufficient).
- [ ] **Step 8: Wire modals** — `AddLeadModal` → `useCreateLead().mutateAsync(body)` (may include `products`); `LeadDetailModal` scalar edits → `useUpdateLead().mutateAsync({ id, patch })`. Remove `useTrackerStore()` reads.
- [ ] **Step 9:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 10: Commit** `feat(web): wire Leads Kanban to API (stage moves via PATCH)`

---

### Task 9: Wire Dashboard aggregates

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Test: `apps/web/tests/features/dashboard/DashboardPage.test.tsx`

**Note:** there is no dedicated dashboard API. The dashboard composes existing list hooks (projections, orders, payments, leads) and computes its KPIs client-side from the fetched sets. Keep it read-only.

- [ ] **Step 1: Failing test** — render `DashboardPage` with mocked `apiFetch` returning small fixtures for each resource; assert a KPI value (e.g. total committed) reflects the fixture. Use RTL + a `QueryClientProvider` wrapper.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3: Rewrite `DashboardPage.tsx`** — replace the `useTrackerStore()` reads with the wired hooks: `useProjections` (existing), `useOrders`, `usePayments`, `useLeads`. Flatten each and compute the existing KPI cards / charts from those arrays (reuse the current selector math, fed by API data instead of store). Wrap each section in `QueryBoundary` keyed to its query. Because the dashboard fires several queries, gate the whole grid on `isLoading` of the primary (projections) and let secondary cards show their own skeletons.
- [ ] **Step 4:** Run test — PASS.
- [ ] **Step 5:** `pnpm --filter web test && tsc --noEmit` — PASS.
- [ ] **Step 6: Commit** `feat(web): wire Dashboard KPIs to API (composed from list hooks)`

---

### Task 10: Remove dead mock files + full verification

**Files:**
- Delete: every `apps/web/src/features/*/*.mock.tsx` (Products, Users, Customers, FollowUps, Payments, Orders, Leads — and the pre-existing `features/projections/ProjectionsPage.mock.tsx`).
- Modify: `apps/web/src/store/trackerStore.ts` — only if nothing imports it any more (see Step 2).

- [ ] **Step 1: Find every mock file and any lingering trackerStore import**

Run:
```bash
grep -rl "\.mock" apps/web/src --include=*.tsx
grep -rn "trackerStore\|useTracker" apps/web/src --include=*.ts --include=*.tsx
```
Expected after Tasks 2-9: mock files listed; no `trackerStore` imports remain in wired pages (only `store/ui.ts` may still import `CURRENT_MONTH`/users from `data/mock.ts` — that is separate and stays).

- [ ] **Step 2: Delete the dead mock pages**

> **GateGuard note:** Claude's Bash cannot run `rm`/`git rm`. Kannan runs this in his own shell, or the executing agent uses `git rm` if the gate is off (`ECC_GATEGUARD=off`):
```bash
git rm apps/web/src/features/projections/ProjectionsPage.mock.tsx \
       apps/web/src/features/products/ProductsPage.mock.tsx \
       apps/web/src/features/users/UsersPage.mock.tsx \
       apps/web/src/features/customers/CustomersPage.mock.tsx \
       apps/web/src/features/followups/FollowUpsPage.mock.tsx \
       apps/web/src/features/payments/PaymentsPage.mock.tsx \
       apps/web/src/features/orders/OrdersPage.mock.tsx \
       apps/web/src/features/leads/LeadsPage.mock.tsx
```
If `store/trackerStore.ts` now has zero importers, `git rm` it too. If `store/ui.ts` still reads from `data/mock.ts`, leave `data/mock.ts` alone.

- [ ] **Step 3: Full green gate**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web build`
Expected: all tests pass, no type errors, production build emits.

- [ ] **Step 4: Live browser verification**

Start the API (`cd apps/api && node dist/main.js` after `pnpm --filter api build`) and the web preview (`greatsales-web`, port 5174). Log in once (seeded `tenant_acme` / `admin@acme.test` / `Passw0rd!`). For each page: confirm the network trace shows a `GET /api/v1/<resource>` 200 and one mutation (create/update/delete) round-trips and the list updates. Capture a screenshot of a wired page for the user.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(web): remove mock page fallbacks after API wiring"
```

---

## Self-Review

**Spec coverage:**
- Token refresh → Task 1. ✅
- Wire 8 pages (Products, Users, Customers, FollowUps, Payments, Orders, Leads, Dashboard) → Tasks 2-9, risk-order per spec. ✅
- `useInfiniteQuery` pagination, page size ≤ 100 → PAGE_SIZE 50 in every `queries.ts`. ✅
- Loading/error/empty → reusable `QueryBoundary` (Task 2), used by all. ✅
- Server-computed values not re-derived → called out in Payments (Task 6) and Orders (Task 7). ✅
- Remove dead `.mock.tsx` → Task 10. ✅
- No API changes; permission-key defaults stand → Global Constraints. ✅
- Cycle 2 (mgmt↔tenant) out of scope → not planned here, per spec. ✅

**Placeholder scan:** Each page task carries its concrete wire types + a concrete `queries.ts` derived from the Task 2 template with named hooks; page-swap steps name the exact hooks, files, and store reads to replace. No "TBD"/"add error handling"/vague steps.

**Type consistency:** Hook naming is uniform (`useX/useCreateX/useUpdateX/useDeleteX/flattenX`), resource strings match controller routes (`products/users/customers/followups/payments/orders/leads`), `PAGE_SIZE=50` everywhere, wire types mirror the shared contracts field-for-field. Enum value confirmations are flagged where the exact strings live in `enums.ts` (FollowUp entityType, DealStage).
