# Task 7b — Migrate remaining `useUi` auth consumers onto `useAuth`

Scope: `apps/web` only. Migrated every remaining component/page/test consumer of the
now-removed `useUi` auth fields (`authed/role/ownerId/isOwner/login/logout/setRole/setOwner`)
onto the real session store (`useAuth`) and the mock-owner shim (`useMockOwnerId`).

## Files changed

### `src/hooks.ts`
`useFilters()` read `role`/`ownerId` from `useUi()`. Now pulls `role` from `useAuthRole()`
and `ownerId` from `useMockOwnerId()`; `principalId`/`ownerFilter` still come from `useUi`.

### Modal components (`src/components/modals/`)
All of these only ever read `ownerId` and/or `role` off `useUi()`; each now imports
`useAuthRole` (when it needed `role`) and `useMockOwnerId` (when it needed `ownerId`)
and drops the `useUi` import if nothing else in the file used it.
- `AddCustomerModal.tsx` — `ownerId` → `useMockOwnerId()`; `useUi` import removed (unused otherwise).
- `AddLeadModal.tsx` — same as above.
- `AddPaymentModal.tsx` — same as above.
- `CreateSalesOrderModal.tsx` — same as above.
- `AddMappingModal.tsx` — kept `useUi` for `month`; added `useAuthRole()` for `role` and
  `useMockOwnerId()` for `ownerId`.
- `LeadDetailModal.tsx` — `role`/`ownerId` → `useAuthRole()`/`useMockOwnerId()`; `useUi` import removed.
- `PaymentDetailModal.tsx` — same as `LeadDetailModal.tsx`.
- `SalesOrderDetailModal.tsx` — same as `LeadDetailModal.tsx`.

### `src/components/ManagementSwitcher.tsx`
`isOwner` was read via `useUi((s) => s.isOwner)`. Now `useIsOwner()` from `store/auth`.
`activeManagementId` still comes from `useUi`.

### Pages (`src/pages/`)
Same pattern throughout — `role`/`ownerId` pulled out of the `useUi()` destructure and
replaced with `useAuthRole()` / `useMockOwnerId()`; UI-preference fields
(`month/principalId/ownerFilter`) stay on `useUi`.
- `DashboardPage.tsx`, `FollowUpsPage.tsx`, `CustomersPage.tsx`, `LeadsPage.tsx`,
  `OrdersPage.tsx`, `PaymentsPage.tsx`, `ProductsPage.tsx`, `UsersPage.tsx` — mechanical
  migration as above (no behavior change).
- `ProjectionsPage.mock.tsx` (backup/mock variant, confirmed via grep it is not imported
  anywhere — left in place per instructions, just fixed to compile) — same pattern.
- `ManagementHomePage.tsx` — `logout` was `useUi((s) => s.logout)`; now `useAuth((s) => s.logout)`.

### `src/pages/DataPage.tsx` — role-simulation retired
Removed the "Active Session Persona" role `<select>` that called the now-gone `useUi.setRole`.
Replaced it with a **read-only** display of the current role
(`roleLabel(useAuthRole())` rendered as static text in the same card position/styling).
`ownerId` → `useMockOwnerId()`. `ROLES`/`Select` imports dropped (no longer used on this
page — `roleLabel` used instead). Page subtitle text updated from "...role simulation..."
to "...session role..." since the simulator no longer exists. Everything else on the page
(dataset metrics, period lock toggle, reset/clear-data actions) is untouched.

### Test suite (`tests/`)
Re-seeded auth via `useAuth.setState({accessToken, refreshToken, user})` instead of the
removed `useUi.setState({authed, role, isOwner})`. `useUi.setState` calls now carry only
UI-preference keys (`activeManagementId`, etc.).
- `tests/App.routes.test.tsx` — seeds `super_admin` in `useAuth`; `useUi` only sets
  `activeManagementId`. Also had to update the first test's assertion — see "Note" below.
- `tests/components/layout.nav.test.tsx` — seeds `admin` in `useAuth`; `useUi` only sets
  `activeManagementId`/`sidebarOpen`.
- `tests/components/ManagementProvider.test.tsx` — added a local `seedAuth(role)` helper;
  owner tests seed `super_admin`, the "blocks a non-owner" test seeds `admin`.
- `tests/components/ManagementSwitcher.test.tsx` — same `seedAuth(role)` helper pattern.
- `tests/components/RequireOwner.test.tsx` — same `seedAuth(role)` helper pattern.
- `tests/pages/UsersPage.addUser.test.tsx` — seeds `admin` (so `canEdit` is true) directly
  in `useAuth.setState`.
- `tests/store/ui.test.ts` — rewritten per instructions: dropped the `isOwner`/`setOwner`
  assertions (no longer exist on `UiState`). Kept `activeManagementId` default +
  `setActiveManagement` coverage, and turned the old "never restores stale isOwner:false"
  test into a check that the `useUi` persist `migrate()` function actually strips legacy
  auth keys (`authed/role/ownerId/isOwner`) out of a stale localStorage blob and preserves
  `activeManagementId`.

## Note: pre-existing, unrelated test failures (NOT fixed, out of scope)

`tests/pages/ManagementHomePage.test.tsx` (3 tests) fails on this branch, and it is **not**
caused by the auth-store migration:

- `git diff HEAD` shows the test file itself is byte-identical to the checkpoint commit —
  I made no changes to it.
- `src/pages/ManagementHomePage.tsx`, however, is already massively rewritten in the
  working tree (uncommitted, pre-dating this task) into a tabbed "Super Admin Hub"
  dashboard (Overview/Sales Team/Workspaces/Principals tabs). The old simple
  card-grid-with-search UI the test targets no longer exists:
  - No more `"create management"` text (button now reads "Create Workspace").
  - No more `<Link>`/`<a href>` elements for management cards — navigation is now
    `onClick={() => handleLaunchManagement(m.id)}` → `navigate(...)` via `useNavigate()`.
  - The search input's placeholder changed to "Search salesperson or workspace…", and
    verified in source that this query is **not** wired to filter the Workspaces list at
    all in the new component (only affects the Salespersons tab) — so the old
    "filters by search" test describes behavior that has been removed, not just renamed.

Because this is a genuine, pre-existing behavior change on a page outside my task's
declared scope (task text only asked me to fix `ManagementHomePage.tsx`'s `logout` call),
and because faithfully rewriting these 3 tests would require making judgment calls about
someone else's in-flight redesign, I left this one file failing rather than guessing at
intended new behavior. Recommend a follow-up task to rewrite
`tests/pages/ManagementHomePage.test.tsx` against the new tabbed UI.

The one exception: `tests/App.routes.test.tsx`'s "owner hitting / lands on the management
home" test *is* in my mandated file list, so I fixed its assertion (it also asserted
`/create management/i`) to check for `/super admin hub/i` instead — a stable, always-visible
header string on the same page — restoring it to green without touching app code.

## Final results

Build: `pnpm --filter web build` → **clean**, exit 0 (`tsc --noEmit && vite build` both
succeed; only the pre-existing "chunk larger than 500kB" advisory warning, non-fatal).

Test: `pnpm --filter web test` → **12 of 13 test files pass, 27 of 30 tests pass**. The
3 failures are all in `tests/pages/ManagementHomePage.test.tsx`, documented above as
pre-existing and out of scope for this migration.
