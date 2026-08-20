# Wire All Web Pages to Real API — Design

**Date:** 2026-08-20
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/phase0-auth-unify`
**Approach:** A — Per-page feature wiring (ProjectionsPage template)

## Goal

Move the remaining `apps/web` pages off mock data (`store/trackerStore.ts`) and onto
the real NestJS API, following the proven ProjectionsPage wiring pattern, at a
**production-grade** bar. Data-first: all pages wired now; visual polish is a
**separate later cycle**.

This is **Cycle 1** of a two-cycle plan:

- **Cycle 1 (this spec):** wire all pages to the logged-in tenant's data + session
  hardening (token refresh), real pagination, and dead-code cleanup. Ship-able,
  production-grade for single-tenant admin use.
- **Cycle 2 (separate brainstorm→spec→plan, next):** reconcile the multi-management
  switcher with real per-tenant auth — platform-user login + super-admin tenant
  selection/impersonation. **Requires API changes** (the API today derives tenant
  strictly from the JWT `tid` claim with no override, and `/auth/login` authenticates
  a tenant `User`, not the `PlatformUser` that owns managements). Out of scope here.

## Context / current state

- `apps/web` — all 11 pages built (feature-first structure under `src/features/*`).
- **ProjectionsPage already wired** to the API via `features/projections/{types,queries}.ts`
  + react-query. It is the reference template.
- **Auth unified** on this branch: `store/auth.ts` is the single real-API session
  (JWT persisted; `useIsAuthed / useAuthRole / useIsOwner` derive from it). The old
  inline ConnectPanel is gone — pages just read `accessToken`.
- Backend ready: 8 controllers (`customers, leads, orders, payments, products, users,
  followups, projections`) + shared zod contracts per module. `pnpm --filter api test`
  = 94 tests green.
- `lib/api.ts` = typed fetch wrapper (bearer from auth store, `ApiError`, `buildQuery`).
- Test harness: vitest + RTL + jsdom set up; 25 web tests currently green.

## Approach (chosen: A)

Each feature repeats the ProjectionsPage template. Per feature folder:

```
features/<name>/
  types.ts             ← wire types (local copy of shared Row/DTO; avoids Vite consuming
                          shared's CJS dist)
  queries.ts           ← react-query hooks: useList / useCreate / useUpdate / useDelete
  <Name>Page.tsx       ← trackerStore reads/writes swapped for react-query hooks
  <Name>Page.mock.tsx  ← old mock page preserved (safety net, like ProjectionsPage.mock.tsx)
  *Modal.tsx           ← create/update/delete mutations
```

Rejected alternatives:
- **B — generic `useResource` factory:** pages are heterogeneous (Leads=Kanban,
  Payments=ageing buckets); a shared factory would leak. Too much upfront abstraction risk.
- **C — adapter under trackerStore:** trackerStore is sync, API is async — leaky/brittle.

## Data flow

- **Read:** `useList(params)` → `apiFetch` GET → RLS scopes to the JWT's tenant (no
  client-side tenantId) → react-query cache keyed `[resource, params]`.
- **Write:** `useCreate/useUpdate/useDelete` mutation → POST/PATCH/DELETE →
  `onSuccess` invalidates the list query → automatic refetch → UI recomputes.
  (Proven end-to-end on ProjectionsPage: edit → PATCH 200 → invalidate → re-render.)
- **Server-computed values** (order totals, payment pending/ageing/status) come from the
  API and are never re-derived or trusted from the client.

## Loading / error / empty states

- `isLoading` → reuse existing `Skeleton` components.
- `isError` → inline error banner using `ApiError.message` from `lib/api`.
- Empty list → existing empty-state components.
- Mutation error → inline/toast (e.g. duplicate email/sku → server `ConflictException`
  message surfaced to the form).

## Session hardening — token refresh (production-grade)

The API exposes `POST /auth/refresh` and the auth store already persists `refreshToken`,
but the web client never uses it — so an expired access token silently breaks every
request. Cycle 1 closes this:

- `lib/api.ts` gains 401 handling: on a 401, call `/auth/refresh` **once** with the
  stored refresh token, update the auth store with the new pair, and retry the original
  request a single time.
- Concurrent 401s share **one** in-flight refresh (a single refresh promise) so a burst
  of requests doesn't fire N refreshes.
- If refresh fails (or there is no refresh token), clear the session (`logout`) and
  redirect to `/login`.
- The refresh call itself must not recurse into refresh-on-401.
- Tests: 401 → refresh → retry succeeds; refresh failure → logout; concurrent 401s →
  single refresh.

## Pagination (production-grade)

List APIs are cursor-paginated (`{ items, nextCursor }`). Wire lists with react-query
**`useInfiniteQuery`**, requesting a reasonable page size (e.g. 50) and following
`nextCursor`. Surface a "load more" control (or scroll-triggered fetch) while
`hasNextPage`; flatten pages for rendering. This replaces the earlier `limit ~200`
stopgap so large tenants stay correct and bounded.

## Sequencing (simplest → riskiest)

1. **Products** — flat CRUD, low risk (warm-up).
2. **Users** — CRUD + duplicate-email/username handling.
3. **Customers** — 5 files incl. reassign flow.
4. **FollowUps** — hard-delete (no soft-delete).
5. **Payments** — ageing/status engine, import flow.
6. **Orders** — server-computed totals, status history, invoice print.
7. **Leads** — Kanban stage moves.
8. **Dashboard** — aggregates last (depends on all others).

Token refresh (session hardening) lands **first**, before the pages, since every wired
page depends on it. After all pages are wired and verified, a final **cleanup step**
removes every `features/*/<Name>Page.mock.tsx` (kept as a dev safety net during wiring)
so no dead code ships.

## Testing

Per page: vitest (RTL + jsdom) mocking `apiFetch` — assert (a) list renders from API
data, (b) a mutation calls the correct endpoint with the right payload, (c) list
invalidation/refetch on success. `pnpm --filter web test` green + `tsc --noEmit` clean
after each page. The 25 existing tests must stay green (no regression).

## Boundaries (explicitly out of scope)

- **Multi-management switcher stays mock — deferred to Cycle 2.** The real JWT is
  single-tenant; Cycle 1 wiring covers the logged-in tenant's data only. Reconciling the
  switcher with real per-tenant auth (platform-user login + super-admin tenant selection)
  requires API changes and is its own brainstorm→spec→plan cycle.
- **Visual polish is a separate later cycle** (data-first, per decision).
- **No API changes in Cycle 1.** Backend is used as-is (94 tests green). The documented
  permission-key defaults (product read=`order.read`/write=`user.manage`;
  follow-up read=`projection.read`/write=`projection.write`; payments write admin-only)
  stand.

## Success criteria

- Token refresh works: an expired access token is transparently refreshed and the request
  retried; refresh failure logs out cleanly. No spurious logouts under normal use.
- All 8 pages read live data from the API (no `trackerStore` reads on the wired pages),
  paginated via `useInfiniteQuery`.
- Create/update/delete flows persist through the API and reflect after invalidation.
- No dead `*.mock.tsx` files remain in the tree.
- `pnpm --filter web test` and `tsc --noEmit` green; no regression in existing tests.
- Live-verified in the browser (network trace) for at least the mutation path of each page.
