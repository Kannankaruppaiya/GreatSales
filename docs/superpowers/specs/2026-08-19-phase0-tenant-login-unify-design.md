# Phase 0 — Tenant Login Unify (Design Spec)

**Date:** 2026-08-19
**Status:** APPROVED — ready for implementation plan.
**Decision owner:** Kannan
**Supersedes scope of:** `2026-08-19-projections-auth-unify-design.md` (that note decided
"Option 2: unify whole-app auth"; this spec is the concrete, implementable slice of it).

---

## 1. Goal

Make the app's single `LoginPage` the **real** authentication entry point for tenant
users (admin / mgmt / sales). Kill the mock `useUi` login and the in-worksheet
`ConnectPanel`/Disconnect scaffolding on `ProjectionsPage`. After this phase there is **one
session, one login, one logout** for tenant roles, and `ProjectionsPage` stops demanding a
second sign-in.

**Explicitly out of scope (deferred):**
- **Platform `super_admin` real login** — the backend `POST /auth/login` serves *tenant*
  users only (`db.user`, role ∈ `admin|mgmt|sales`). The platform "SuperAdmin" lives in a
  separate `PlatformUser` table with **no login endpoint**, and every tenant endpoint is
  RLS-scoped by the JWT `tid` claim, so a platform token cannot read tenant data without an
  assume-tenant (impersonation) token. That whole architecture (platform login endpoint +
  platform JWT + assume-tenant token minting) is its own mini-spec: **Phase 0.5**.
- **Refresh-token rotation / silent refresh** — Phase 0 handles an expired/invalid access
  token by logging out (redirect to `/login`). No silent refresh yet.
- **Non-auth pages staying on real data** — only the *session* becomes real in Phase 0.
  Dashboard/Leads/Orders/Payments/etc. keep their mock data (`data/mock.ts`,
  `store/trackerStore`, `store/managementStore`) until their own Phase-1 wiring. `Projections`
  is the one page already on the live API and stays so.
- **slug → tenantId resolver** — the login form sends the `tenantId` directly.

---

## 2. Backend reality (why the scope is what it is)

Confirmed by reading the API + seed:

- `POST /auth/login` body `{ tenantId, email, password }` → `{ accessToken, refreshToken, user }`
  where `user: { id, tenantId, name, email, username, roleId, role }` and `role` is the
  role **name** string.
- Seeded tenants: `tenant_acme` (Acme Corp), `tenant_globex`. Per-tenant users share password
  `Passw0rd!`:
  - admin → `admin@acme.test`, role name `admin`
  - mgmt  → `manager@acme.test`, role name `mgmt`
  - sales → `sales1@acme.test`, role name `sales`
- `SYSTEM_ROLES = ["admin","mgmt","sales"]` — **no `super_admin`** at the tenant layer.
- Platform super admin: `super@greatsales.io`, `PlatformUser.role = "SuperAdmin"`, no login
  route wired. → Phase 0.5.
- Every access token carries `tid`; `JwtAuthGuard` sets `req.user` and every tenant Prisma
  call runs `SET app.tenant_id` (RLS). A tokenless/tenantless request sees no rows.

---

## 3. Architecture — Option B (true unify)

Two stores remain but with **clean, non-overlapping responsibilities**. `useAuth` becomes the
single source of truth for the session; `useUi` is demoted to UI preferences only.

### 3.1 `store/auth.ts` — the session (single source of truth)

State: `accessToken`, `refreshToken`, `user` (all persisted under `greatsales_auth`).

Derived (selectors / computed getters, never persisted as authority):
- `isAuthed` = `!!accessToken`
- `role: Role` = `mapRole(user?.role)` (see `lib/authRole.ts`)
- `isOwner: boolean` = `role === "super_admin"` (always `false` in Phase 0)

Actions:
- `login(tenantId, email, password)` → calls `apiFetch<LoginResponse>("/auth/login", …)`.
  On success, if `mapRole(res.user.role) === "sales"`, it **rejects**: leaves the store
  cleared and throws a typed error `SalesWebLoginError` ("Sales is mobile-only — use the
  GreatSales app"). Otherwise stores `{ accessToken, refreshToken, user }`.
- `logout()` → clears all three fields.

`setTokenGetter(() => useAuth.getState().accessToken)` stays wired (unchanged).

### 3.2 `lib/authRole.ts` — role mapping (new, pure)

```ts
// Backend role name (role.name) → web Role. Unknown/custom names fall back to "mgmt"
// (least privilege among web roles). "SuperAdmin"/"super_admin" → "super_admin"
// (only reachable via Phase 0.5 platform login).
export function mapRole(name: string | null | undefined): Role
```

Mapping table:
| backend `role` | web `Role` |
|---|---|
| `admin` | `admin` |
| `mgmt` | `mgmt` |
| `sales` | `sales` |
| `SuperAdmin` / `super_admin` | `super_admin` |
| anything else / null | `mgmt` (read-only fallback) |

### 3.3 `store/ui.ts` — UI preferences only

Keep: `activeManagementId`, `month`, `principalId`, `ownerFilter`, `sidebarOpen`, and their
setters + `toggleSidebar`.
Remove: `authed`, `role`, `isOwner`, `ownerId`, `login`, `logout`, `setRole`, `setOwner`, and
the `defaultOwnerFor` helper. `activeManagementId` keeps defaulting to `DEFAULT_MANAGEMENT_ID`
(mock slug) — the routing/management world stays mock in Phase 0.

**Persist gotcha:** bump the `persist` `version` (6 → 7) and simplify `partialize`/`migrate`
so old `greatsales_ui_state` blobs holding `authed:true`/`role` don't rehydrate a fake
session. Migrate drops the removed keys; the session now comes solely from `greatsales_auth`.

### 3.4 Consumers read auth from `useAuth`

- `App.tsx`: `ProtectedRoute`, `PublicAuthRoute`, `RoleDirectRoute`, `RootRedirect` read
  `isAuthed` / `role` / `isOwner` from `useAuth` instead of `useUi`.
- `components/RoleGuard.tsx`, `components/RequireOwner.tsx`: `role` / `isOwner` from `useAuth`.
- `components/ManagementProvider.tsx`: `isOwner` from `useAuth`; `activeManagementId` stays
  from `useUi`.
- `components/layout.tsx`:
  - `Sidebar` — `role` from `useAuth`; the existing single logout (`handleLogout`) calls
    `useAuth.logout()` then `navigate("/login")`. The user-card avatar/name/email read
    `useAuth.user` (real) instead of looking `me` up in mock `trackerStore` users.
  - `Topbar` — `role` from `useAuth`; UI filters stay from `useUi`.

---

## 4. Login flow + edge roles

1. `LoginPage` submit (`handleSubmit`) becomes **async** and calls
   `useAuth.login(tenantId, email, password)`; on success `navigate(config.destination)`, on
   `ApiError`/`SalesWebLoginError` shows an inline error under the form. Remove the
   `setTimeout` mock and the `useUi.login` call.
2. **Tenant field:** the "Workspace Tenant" input now holds and sends `tenantId` directly,
   prefilled from config (`env.DEMO_TENANT_ID`, default `tenant_acme`). Label updated to
   "Tenant ID". slug→tenantId resolver deferred.
3. **Demo prefill → config:** add to `lib/config.ts`:
   `DEMO_TENANT_ID` (`VITE_DEMO_TENANT_ID` || `tenant_acme`),
   `DEMO_EMAIL` (`VITE_DEMO_EMAIL` || `admin@acme.test`),
   `DEMO_PASSWORD` (`VITE_DEMO_PASSWORD` || `Passw0rd!`).
   Per-role default emails in `LoginPage` prefill from these (admin uses `DEMO_EMAIL`; mgmt
   prefixes `manager@` on the same tenant domain — kept as static per-role hints, no secrets).
   Delete `DEFAULTS` from `ProjectionsPage`.
4. **sales rejection:** enforced in `useAuth.login` (§3.1). The sales tab already renders a
   mobile-only screen with no form; this guard covers sales creds typed into the admin form.
5. **super_admin tab (Phase 0):** platform login is Phase 0.5, so the super_admin tab shows a
   "Platform sign-in — available in Phase 0.5" note instead of a live credential form
   (mirrors the sales-tab mobile-only pattern). No mock fallback.
6. **Protected routing unchanged in shape:** no token → `/login` (via `ProtectedRoute`
   reading `useAuth.isAuthed`). Already-authed visiting `/login` → redirect to destination.

---

## 5. Error / expiry handling (Phase 0 scope)

- Login failure → inline message from `ApiError.message` (e.g. "Invalid credentials") or the
  sales-only message.
- Expired/invalid access token → API returns 401 → `ApiError(401)`. Phase 0: on a 401 from
  any query/mutation, call `useAuth.logout()` so the app falls back to `/login` (no silent
  refresh). This is a small centralized hook (react-query default `onError` or an `apiFetch`
  wrapper check) — keep it minimal.

---

## 6. Files touched

| File | Change |
|---|---|
| `apps/web/src/lib/authRole.ts` | **new** — `mapRole` pure util |
| `apps/web/src/lib/authRole.test.ts` | **new** — table test |
| `apps/web/src/store/auth.ts` | derived `isAuthed/role/isOwner`, sales-reject, `SalesWebLoginError` |
| `apps/web/src/store/auth.test.ts` | **new** — login/logout/derive/reject (mock `apiFetch`) |
| `apps/web/src/store/ui.ts` | strip auth fields; UI prefs only |
| `apps/web/src/lib/config.ts` | demo prefill env vars |
| `apps/web/src/App.tsx` | guards read `useAuth` |
| `apps/web/src/components/RoleGuard.tsx` | `role` from `useAuth` |
| `apps/web/src/components/RequireOwner.tsx` | `isOwner` from `useAuth` |
| `apps/web/src/components/ManagementProvider.tsx` | `isOwner` from `useAuth` |
| `apps/web/src/components/layout.tsx` | `role`/`user`/logout from `useAuth` |
| `apps/web/src/pages/LoginPage.tsx` | real async login; tenant field; super_admin note |
| `apps/web/src/pages/ProjectionsPage.tsx` | delete ConnectPanel/DEFAULTS/gate/Disconnect |

---

## 7. TDD plan

The web app currently has **zero tests**, but vitest is configured (`vite.config.ts` `test`
block + `vitest.setup.ts`). Phase 0 seeds the first web tests.

Red → green → refactor, test-first, per unit:

1. **`lib/authRole.test.ts`** — `mapRole` maps admin/mgmt/sales; `SuperAdmin`/`super_admin` →
   `super_admin`; unknown/null → `mgmt`.
2. **`store/auth.test.ts`** — with `apiFetch` mocked:
   - `login` stores tokens + user; `isAuthed` true; `role`/`isOwner` derive correctly.
   - login as a `sales` user → store stays cleared and `SalesWebLoginError` thrown.
   - `logout` clears everything; `isAuthed` false.
3. Guard behavior (light, optional) — a render test that an unauthed `ProtectedRoute`
   redirects, if it can be done cheaply with the router; otherwise covered by browser verify.

## 8. Verification (definition of done)

- `pnpm build` clean (web).
- `pnpm test` green (new web tests + no regressions).
- Browser preview: log in as admin (`tenant_acme` / `admin@acme.test` / `Passw0rd!`) →
  land on dashboard → open Projections (loads live, no ConnectPanel) → edit a cell (PATCH
  persists) → sidebar logout returns to `/login`. Screenshot proof.
- Log in with a sales user in the admin form → rejected with the mobile-only message.

---

## 9. Open items intentionally left for later phases

- Phase 0.5: platform login + assume-tenant token → real `super_admin` browsing tenant data.
- Refresh-token rotation.
- Wiring the remaining pages to real API data (Phase 1).
- slug → tenantId resolution at login.
