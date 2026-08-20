# Phase 0 — Tenant Login Unify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the single `LoginPage` the real tenant-user authentication entry point (admin/mgmt/sales), remove the mock `useUi` session and the `ProjectionsPage` ConnectPanel/Disconnect scaffolding, so the whole app runs on one real session with one login and one logout.

**Architecture:** `useAuth` (Zustand, persisted) becomes the single session source of truth — raw `{accessToken, refreshToken, user}` plus selector hooks that derive web `Role`/`isOwner`/`isAuthed`. `useUi` is demoted to UI preferences only. All route guards and chrome read auth from `useAuth`. The cut from mock→real is staged so every commit builds green: (1) enhance `useAuth`, (2) point read-consumers at it, (3) wire `LoginPage` to write it, (4) clean `ProjectionsPage`, (5) delete the dead `useUi` auth fields, (6) add 401→logout.

**Tech Stack:** React 19 + Vite, react-router-dom v6, Zustand v5 (persist), @tanstack/react-query v5, Vitest + @testing-library/react, TypeScript.

## Global Constraints

- Backend `POST /auth/login` body = `{ tenantId, email, password }`; response = `{ accessToken, refreshToken, user }`, `user.role` is the role **name** string (`admin`|`mgmt`|`sales`; tenant layer has **no** `super_admin`).
- Demo login (seeded): tenant `tenant_acme`, admin `admin@acme.test`, password `Passw0rd!`.
- Web `Role` type = `"super_admin" | "admin" | "mgmt" | "sales"` (from `data/constants.ts`) — do not change it.
- `super_admin` real login is **Phase 0.5** (platform login + assume-tenant) — NOT in this plan. In Phase 0 `isOwner` is always derived and always `false`.
- Salespersons have **no web login** (mobile only) — reject a `sales`-role login on the web.
- `activeManagementId` stays the mock slug `DEFAULT_MANAGEMENT_ID` — the management/routing world stays mock this phase; real API scoping is by JWT `tid`.
- TDD: test-first, red→green→refactor. Commit after each task. Do NOT `git push`.
- Web tests run with `pnpm --filter web test` (script = `vitest run`). Build = `pnpm --filter web build`.
- **Per project rule: do not commit unless the user says so.** The `git commit` steps below are the intended commit points; if the user has said to hold commits, do the staging/verification and skip the actual commit.

---

### Task 1: `mapRole` role-mapping util

**Files:**
- Create: `apps/web/src/lib/authRole.ts`
- Test: `apps/web/src/lib/authRole.test.ts`

**Interfaces:**
- Consumes: `Role` from `../data/constants`.
- Produces: `export function mapRole(name: string | null | undefined): Role`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/lib/authRole.test.ts
import { describe, expect, it } from "vitest";
import { mapRole } from "./authRole";

describe("mapRole", () => {
  it("maps tenant role names straight through", () => {
    expect(mapRole("admin")).toBe("admin");
    expect(mapRole("mgmt")).toBe("mgmt");
    expect(mapRole("sales")).toBe("sales");
  });

  it("maps platform super-admin names to super_admin", () => {
    expect(mapRole("SuperAdmin")).toBe("super_admin");
    expect(mapRole("super_admin")).toBe("super_admin");
  });

  it("falls back to mgmt (least privilege) for unknown/null", () => {
    expect(mapRole("custom_role")).toBe("mgmt");
    expect(mapRole(null)).toBe("mgmt");
    expect(mapRole(undefined)).toBe("mgmt");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test authRole`
Expected: FAIL — cannot find module `./authRole`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/src/lib/authRole.ts
/**
 * Backend role name (user.role = role.name) → web Role. The tenant layer only
 * issues admin/mgmt/sales; "SuperAdmin" comes from the platform layer (Phase 0.5).
 * Unknown/custom role names fall back to mgmt (least privilege among web roles).
 */
import type { Role } from "../data/constants";

export function mapRole(name: string | null | undefined): Role {
  switch (name) {
    case "admin":
      return "admin";
    case "sales":
      return "sales";
    case "SuperAdmin":
    case "super_admin":
      return "super_admin";
    case "mgmt":
    default:
      return "mgmt";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test authRole`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/authRole.ts apps/web/src/lib/authRole.test.ts
git commit -m "feat(web): add mapRole backend-role→web-Role util"
```

---

### Task 2: `useAuth` — single session source + sales reject + selectors

**Files:**
- Modify: `apps/web/src/store/auth.ts` (full rewrite of the store body)
- Test: `apps/web/src/store/auth.test.ts` (new)

**Interfaces:**
- Consumes: `apiFetch`, `setTokenGetter` from `../lib/api`; `mapRole` from `../lib/authRole`; `LoginResponse`, `AuthUser` from `../features/projections/types`; `Role` from `../data/constants`.
- Produces:
  - `class SalesWebLoginError extends Error`
  - `useAuth` store: state `{ accessToken, refreshToken, user }`, actions `login(tenantId, email, password): Promise<void>`, `logout(): void`.
  - Selector hooks: `useIsAuthed(): boolean`, `useAuthRole(): Role`, `useIsOwner(): boolean`, `useAuthUser(): AuthUser | null`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/src/store/auth.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("../lib/api", () => ({
  apiFetch: (...a: unknown[]) => apiFetch(...a),
  setTokenGetter: vi.fn(),
}));

import { useAuth, SalesWebLoginError } from "./auth";

const makeResponse = (role: string) => ({
  accessToken: "acc",
  refreshToken: "ref",
  user: {
    id: "u1", tenantId: "tenant_acme", name: "Acme Admin",
    email: "admin@acme.test", username: "admin_acme", roleId: "role_admin_acme", role,
  },
});

beforeEach(() => {
  apiFetch.mockReset();
  useAuth.getState().logout();
});
afterEach(() => localStorage.clear());

describe("useAuth", () => {
  it("stores tokens + user on login and derives role/isOwner", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await useAuth.getState().login("tenant_acme", "admin@acme.test", "Passw0rd!");

    const s = useAuth.getState();
    expect(s.accessToken).toBe("acc");
    expect(s.refreshToken).toBe("ref");
    expect(s.user?.email).toBe("admin@acme.test");
    expect(apiFetch).toHaveBeenCalledWith("/auth/login", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_acme", email: "admin@acme.test", password: "Passw0rd!" }),
    });
  });

  it("rejects a sales-role login on the web and leaves the store cleared", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("sales"));
    await expect(
      useAuth.getState().login("tenant_acme", "sales1@acme.test", "Passw0rd!"),
    ).rejects.toBeInstanceOf(SalesWebLoginError);

    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.user).toBeNull();
  });

  it("logout clears the session", async () => {
    apiFetch.mockResolvedValueOnce(makeResponse("admin"));
    await useAuth.getState().login("tenant_acme", "admin@acme.test", "Passw0rd!");
    useAuth.getState().logout();
    const s = useAuth.getState();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.user).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test store/auth`
Expected: FAIL — `SalesWebLoginError` is not exported / behavior missing.

- [ ] **Step 3: Rewrite the store**

```ts
// apps/web/src/store/auth.ts
/**
 * Real API auth state — the single source of truth for the web session. Holds the
 * JWT pair + profile from POST /auth/login, persisted so a reload keeps the session.
 * Registers the token getter the api client uses to authorize every request.
 * Derived web Role / isOwner / isAuthed are exposed as selector hooks (never stored),
 * so the token/user remain the only persisted authority.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, setTokenGetter } from "../lib/api";
import { mapRole } from "../lib/authRole";
import type { Role } from "../data/constants";
import type { AuthUser, LoginResponse } from "../features/projections/types";

/** Thrown when a `sales`-role user tries to sign in on the web (mobile-only). */
export class SalesWebLoginError extends Error {
  constructor() {
    super("Sales is mobile-only — use the GreatSales app.");
    this.name = "SalesWebLoginError";
  }
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  login: (tenantId: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      login: async (tenantId, email, password) => {
        const res = await apiFetch<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ tenantId, email, password }),
        });
        // Salespersons have no web UI. Reject before establishing a session.
        if (mapRole(res.user.role) === "sales") {
          throw new SalesWebLoginError();
        }
        set({
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          user: res.user,
        });
      },
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "greatsales_auth" },
  ),
);

// Wire the api client to always read the freshest token from this store.
setTokenGetter(() => useAuth.getState().accessToken);

/* ── Derived session selectors (computed, never persisted) ── */
export const useIsAuthed = (): boolean => useAuth((s) => !!s.accessToken);
export const useAuthUser = (): AuthUser | null => useAuth((s) => s.user);
export const useAuthRole = (): Role => useAuth((s) => mapRole(s.user?.role));
export const useIsOwner = (): boolean =>
  useAuth((s) => mapRole(s.user?.role) === "super_admin");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test store/auth`
Expected: PASS (3 tests). Also run `pnpm --filter web test` — Task 1 + Task 2 green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/auth.ts apps/web/src/store/auth.test.ts
git commit -m "feat(web): make useAuth the single session source with derived selectors + sales reject"
```

---

### Task 3: Demo login prefill → config

**Files:**
- Modify: `apps/web/src/lib/config.ts`

**Interfaces:**
- Produces: `env.DEMO_TENANT_ID`, `env.DEMO_EMAIL`, `env.DEMO_PASSWORD` (strings).

- [ ] **Step 1: Add the env fields**

Edit `apps/web/src/lib/config.ts` — inside the `env` object, after `IS_DEV`:

```ts
  IS_DEV: import.meta.env.DEV,
  // Demo/seed login prefill (dev only; never real secrets). Used to prefill the
  // login form so the seeded tenant is one click away.
  DEMO_TENANT_ID: import.meta.env.VITE_DEMO_TENANT_ID || "tenant_acme",
  DEMO_EMAIL: import.meta.env.VITE_DEMO_EMAIL || "admin@acme.test",
  DEMO_PASSWORD: import.meta.env.VITE_DEMO_PASSWORD || "Passw0rd!",
```

- [ ] **Step 2: Verify build/typecheck**

Run: `pnpm --filter web build`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/config.ts
git commit -m "feat(web): move demo login prefill into env config"
```

---

### Task 4: Point route guards + chrome at `useAuth`

The `useUi` auth fields still exist after this task (removed in Task 7), but nothing reads them for auth anymore — all guards/chrome read `useAuth`. App still builds green. (Functionally, sign-in is not wired until Task 5; that is expected between tasks.)

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/RoleGuard.tsx`
- Modify: `apps/web/src/components/RequireOwner.tsx`
- Modify: `apps/web/src/components/ManagementProvider.tsx`
- Modify: `apps/web/src/components/layout.tsx`

**Interfaces:**
- Consumes: `useIsAuthed`, `useAuthRole`, `useIsOwner`, `useAuthUser`, `useAuth` from `../store/auth`.

- [ ] **Step 1: `App.tsx` — guards read the real session**

Add import: `import { useIsAuthed, useAuthRole, useIsOwner } from "./store/auth";`
Replace the auth reads in each guard:

- `ProtectedRoute`: `const authed = useUi((s) => s.authed);` → `const authed = useIsAuthed();`
- `PublicAuthRoute`: replace
  ```ts
  const authed = useUi((s) => s.authed);
  const isOwner = useUi((s) => s.isOwner);
  const role = useUi((s) => s.role);
  ```
  with
  ```ts
  const authed = useIsAuthed();
  const isOwner = useIsOwner();
  const role = useAuthRole();
  ```
  Keep `const activeManagementId = useUi((s) => s.activeManagementId);`.
- `RoleDirectRoute`: `const authed = useUi((s) => s.authed);` → `const authed = useIsAuthed();` (keep the `useUi` read for `activeManagementId`).
- `RootRedirect`: replace `const role = useUi((s) => s.role);` and `const isOwner = useUi((s) => s.isOwner);` with `const role = useAuthRole();` and `const isOwner = useIsOwner();` (keep `activeManagementId` from `useUi`).

- [ ] **Step 2: `RoleGuard.tsx` — role from useAuth**

Replace `import { useUi } from "../store/ui";` usage: change `const { role } = useUi();` to:
```ts
import { useAuthRole } from "../store/auth";
// ...
const role = useAuthRole();
```
Remove the now-unused `useUi` import.

- [ ] **Step 3: `RequireOwner.tsx` — isOwner from useAuth**

```ts
import { Navigate } from "react-router-dom";
import { useUi } from "../store/ui";
import { useIsOwner } from "../store/auth";

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const isOwner = useIsOwner();
  const activeManagementId = useUi((s) => s.activeManagementId);

  if (!isOwner) {
    const to = activeManagementId ? `/managements/${activeManagementId}/dashboard` : "/login";
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: `ManagementProvider.tsx` — isOwner from useAuth**

Change `const isOwner = useUi((s) => s.isOwner);` to `const isOwner = useIsOwner();` and add `import { useIsOwner } from "../store/auth";`. Keep `activeManagementId` from `useUi`.

- [ ] **Step 5: `layout.tsx` — role/user/logout from useAuth**

Add import: `import { useAuthRole, useAuthUser, useAuth } from "../store/auth";`

In `Sidebar`:
- Change `const { role, ownerId, sidebarOpen, logout, setSidebar, activeManagementId } = useUi();` to:
  ```ts
  const { sidebarOpen, setSidebar, activeManagementId } = useUi();
  const role = useAuthRole();
  const user = useAuthUser();
  const logout = useAuth((s) => s.logout);
  ```
- `handleLogout` stays: `logout(); navigate("/login");`.
- Remove the `me` lookup line (`const me = users.find(...)`) and the `users` from the `useTrackerStore()` destructure if now unused (keep `projections, leads, payments`). Replace the user-card fields:
  - `{me?.name ?? "User"}` → `{user?.name ?? "User"}`
  - `{me?.name}` → `{user?.name}`
  - `{me?.email}` → `{user?.email}`

In `Topbar`:
- Change `const { role, month, principalId, ownerFilter, setMonth, setPrincipal, setOwnerFilter, toggleSidebar } = useUi();` to drop `role` from the `useUi` destructure, and add `const role = useAuthRole();`.

- [ ] **Step 6: Verify build**

Run: `pnpm --filter web build`
Expected: PASS. (Type-checks that every auth read now resolves against `useAuth`.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/components/RoleGuard.tsx apps/web/src/components/RequireOwner.tsx apps/web/src/components/ManagementProvider.tsx apps/web/src/components/layout.tsx
git commit -m "refactor(web): route guards + chrome read session from useAuth"
```

---

### Task 5: `LoginPage` — real async login

**Files:**
- Modify: `apps/web/src/pages/LoginPage.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../store/auth`; `SalesWebLoginError` from `../store/auth`; `ApiError` from `../lib/api`; `env` from `../lib/config`.

- [ ] **Step 1: Swap the store + add error state**

- Remove `import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";` → replace with:
  ```ts
  import { DEFAULT_MANAGEMENT_ID } from "../store/ui";
  import { useAuth, SalesWebLoginError } from "../store/auth";
  import { ApiError } from "../lib/api";
  import { env } from "../lib/config";
  ```
- Replace `const login = useUi((s) => s.login);` with `const login = useAuth((s) => s.login);`.
- Add state: `const [error, setError] = useState<string | null>(null);` and a tenant-id field state:
  `const [tenantId, setTenantId] = useState(env.DEMO_TENANT_ID);`
- Change the password initial value to `env.DEMO_PASSWORD` and admin email prefill to use `env.DEMO_EMAIL` (keep the per-role `config.defaultEmail` hints for the other tabs).

- [ ] **Step 2: Real async submit + sales/super_admin handling**

Replace `handleSubmit` with:
```ts
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (activeRole === "sales" || activeRole === "super_admin") return;
  setBusy(true);
  setError(null);
  try {
    await login(tenantId, email, password);
    navigate(config.destination, { replace: true });
  } catch (err) {
    if (err instanceof SalesWebLoginError) setError(err.message);
    else if (err instanceof ApiError) setError(err.message);
    else setError("Could not reach the API. Is it running?");
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 3: Tenant-ID field + error banner + super_admin note**

- Change the "Workspace Tenant" input to bind `tenantId` and send it directly. Replace the workspace input block's `value={workspace} onChange={(e) => setWorkspace(e.target.value)}` with `value={tenantId} onChange={(e) => setTenantId(e.target.value)}`, relabel the field "Tenant ID", set placeholder `tenant_acme`, and remove the trailing `.greatsales.app` suffix span and the now-unused `workspace` state.
- Add an error banner just above the submit `Button` inside the form:
  ```tsx
  {error && (
    <div className="rounded-lg border border-red/40 bg-red-soft px-3 py-2 text-xs text-red">
      {error}
    </div>
  )}
  ```
- Gate the credential form so `super_admin` shows a note (Phase 0.5), like the sales tab. Change the render condition from `activeRole === "sales" ? (...sales screen...) : (...form...)` to also handle `super_admin`: when `activeRole === "super_admin"`, render a small info panel:
  ```tsx
  {activeRole === "sales" ? (
    /* existing sales mobile-only screen */
  ) : activeRole === "super_admin" ? (
    <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50/60 p-5 text-center dark:border-purple-900/40 dark:bg-purple-950/20">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/10 text-purple-700">
        <Crown className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-ink">Platform Sign-In Coming Soon</h3>
      <p className="text-xs text-muted leading-relaxed">
        Super Admin uses a dedicated platform sign-in (arriving in Phase 0.5). For now,
        use the Administrator portal.
      </p>
      <Link to="/admin/login" className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-brand text-white text-xs font-bold hover:bg-brand-ink transition-colors">
        Go to Administrator Portal
      </Link>
    </div>
  ) : (
    /* existing credential form */
  )}
  ```
  (`Crown` and `Link` are already imported.)

- [ ] **Step 4: Verify build**

Run: `pnpm --filter web build`
Expected: PASS. Confirm no unused `workspace`/`useUi.login` references remain.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/LoginPage.tsx
git commit -m "feat(web): wire LoginPage to real /auth/login with tenant id + error + super_admin note"
```

---

### Task 6: `ProjectionsPage` — drop ConnectPanel/Disconnect

**Files:**
- Modify: `apps/web/src/pages/ProjectionsPage.tsx`

- [ ] **Step 1: Remove the scaffolding**

- Delete the `DEFAULTS` const (lines ~24–29) and the entire `ConnectPanel` component (lines ~31–111).
- Remove now-unused imports: `Lock` from `lucide-react` (verify it is not used elsewhere in the file), and `useState` for the panel-only state if unused. Keep `useAuth`.
- In `ProjectionsPage`, replace:
  ```ts
  const { accessToken, user, logout } = useAuth();
  ```
  with:
  ```ts
  const accessToken = useAuth((s) => s.accessToken);
  ```
- Remove `if (!enabled) return <ConnectPanel />;` — keep `const enabled = !!accessToken;` (the page is only reachable inside `ProtectedRoute`, so a token exists; `enabled` still guards the query).

- [ ] **Step 2: Remove the header user-info + Disconnect block**

In the header `<div className="flex flex-wrap items-center justify-between …">`, delete the right-hand block:
```tsx
<div className="flex items-center gap-2 text-xs text-muted">
  <span>{user?.name} · {user?.role ?? "—"}</span>
  <button onClick={logout} …>Disconnect</button>
</div>
```
Leave the left-hand "Recurring Sales Projections — {monthLabel} LIVE API" title. (Logout now lives only in the sidebar.)

- [ ] **Step 3: Verify build**

Run: `pnpm --filter web build`
Expected: PASS. No references to `ConnectPanel`, `DEFAULTS`, `user`, or `logout` remain in the file.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ProjectionsPage.tsx
git commit -m "refactor(web): ProjectionsPage consumes shared session, drop ConnectPanel/Disconnect"
```

---

### Task 7: Delete dead `useUi` auth fields + bump persist version

**Files:**
- Modify: `apps/web/src/store/ui.ts`

- [ ] **Step 1: Strip auth state, keep UI prefs**

Rewrite `ui.ts` so `UiState` contains only UI preferences. Remove `authed`, `role`, `ownerId`, `isOwner`, `login`, `logout`, `setRole`, `setOwner`, the `defaultOwnerFor` helper, and the `Role`/`users`/`CURRENT_MONTH`(if only used for auth) imports that become unused. Keep `activeManagementId`, `month`, `principalId`, `ownerFilter`, `sidebarOpen` and their setters. `DEFAULT_MANAGEMENT_ID` export stays.

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURRENT_MONTH } from "../data/mock";

/** The pre-existing seeded company — the default management every session opens with. */
export const DEFAULT_MANAGEMENT_ID = "greatsales-industrial-corp";

/* Client UI preferences only. Session/auth now lives in `useAuth` (store/auth.ts). */
interface UiState {
  activeManagementId: string | null;
  month: string;
  principalId: string;
  ownerFilter: string;
  sidebarOpen: boolean;
  setActiveManagement: (id: string | null) => void;
  setMonth: (m: string) => void;
  setPrincipal: (id: string) => void;
  setOwnerFilter: (id: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      month: CURRENT_MONTH,
      principalId: "ALL",
      ownerFilter: "ALL",
      sidebarOpen: true,
      setActiveManagement: (activeManagementId) => set({ activeManagementId }),
      setMonth: (month) => set({ month }),
      setPrincipal: (principalId) => set({ principalId }),
      setOwnerFilter: (ownerFilter) => set({ ownerFilter }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "greatsales_ui_state",
      version: 7,
      // v6→v7: auth fields (authed/role/isOwner/ownerId) moved out to useAuth.
      // Drop any legacy keys so an old blob can't rehydrate a fake session.
      migrate: (persistedState: any) => {
        const base = persistedState ?? {};
        return {
          activeManagementId: base.activeManagementId ?? DEFAULT_MANAGEMENT_ID,
          month: base.month ?? CURRENT_MONTH,
          principalId: base.principalId ?? "ALL",
          ownerFilter: base.ownerFilter ?? "ALL",
          sidebarOpen: base.sidebarOpen ?? true,
        };
      },
    },
  ),
);
```

- [ ] **Step 2: Verify no lingering references**

Run: `pnpm --filter web build`
Expected: PASS. If the build flags a leftover `useUi((s) => s.role)` / `.authed` / `.login` / `.logout` / `.ownerId` / `.isOwner` / `.setRole` / `.setOwner`, fix that consumer to use `useAuth` (should already be done in Tasks 4–6).

- [ ] **Step 3: Run the full web test suite**

Run: `pnpm --filter web test`
Expected: PASS (Task 1 + Task 2 suites, no regressions).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/store/ui.ts
git commit -m "refactor(web): reduce useUi to UI prefs only, bump persist v6→v7"
```

---

### Task 8: 401 → logout (no silent refresh)

**Files:**
- Modify: `apps/web/src/main.tsx`

**Interfaces:**
- Consumes: `useAuth` from `./store/auth`; `ApiError` from `./lib/api`; `QueryCache`, `MutationCache` from `@tanstack/react-query`.

- [ ] **Step 1: Add a global 401 handler to the QueryClient**

Replace the `QueryClient` construction in `main.tsx`:
```ts
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "./lib/api";
import { useAuth } from "./store/auth";

// An expired/invalid access token surfaces as ApiError(401). Phase 0 has no silent
// refresh: clear the session so ProtectedRoute bounces the user to /login.
function onApiError(err: unknown) {
  if (err instanceof ApiError && err.status === 401) {
    useAuth.getState().logout();
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
});
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter web build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/main.tsx
git commit -m "feat(web): clear session on 401 so the app falls back to login"
```

---

### Task 9: End-to-end verification (browser)

**Files:** none (verification only).

Prerequisite: the API must be running against the seeded DB (`tenant_acme` present) and the web dev server up. Use the Browser preview tools, not manual asks.

- [ ] **Step 1: Start API + web**

Ensure the NestJS API is running (seeded) and start the web dev server via preview_start (`.claude/launch.json` web config, port 5174). Confirm `env.API_BASE_URL` points at the running API.

- [ ] **Step 2: Login as admin**

Navigate to `/admin/login`. Confirm the form prefills tenant `tenant_acme` / `admin@acme.test` / `Passw0rd!`. Submit. Expected: redirect to `/managements/greatsales-industrial-corp/dashboard`, no ConnectPanel anywhere. Check `read_network_requests` shows a 200 `POST /auth/login`. Screenshot.

- [ ] **Step 3: Projections live + edit**

Open Projections from the sidebar. Expected: table loads live (no "Connect to the GreatSales API" panel, no Disconnect button; "LIVE API" badge present). Edit an Achieved-qty cell and blur; confirm a `PATCH /projections/:id` 200 in network. Screenshot.

- [ ] **Step 4: Sales rejection**

Go to `/admin/login`, enter `sales1@acme.test` / `Passw0rd!` (tenant `tenant_acme`), submit. Expected: inline error "Sales is mobile-only — use the GreatSales app.", no navigation, session stays logged out. Screenshot.

- [ ] **Step 5: Logout**

As admin, click the sidebar logout (user card, bottom-left). Expected: redirect to `/login`; revisiting a protected route bounces back to `/login`. Screenshot.

- [ ] **Step 6: super_admin tab note**

Navigate to `/super-admin/login`. Expected: "Platform Sign-In Coming Soon" panel (no credential form). Screenshot.

- [ ] **Step 7: Final green check**

Run: `pnpm --filter web build` and `pnpm --filter web test`
Expected: both PASS. Summarize Phase 0 completion for the user.

---

## Self-Review Notes

- **Spec coverage:** §3.1 useAuth (Task 2) · §3.2 authRole (Task 1) · §3.3 useUi strip + v7 (Task 7) · §3.4 consumers (Task 4) · §4 login flow / tenant field / demo config / sales reject / super_admin note (Tasks 3, 5) · §5 401→logout (Task 8) · Projections cleanup (Task 6) · §8 verification (Task 9). All spec sections mapped.
- **Ordering keeps builds green:** enhance auth (2) → repoint reads (4) → wire login writer (5) → clean projections (6) → delete dead ui fields (7). Between Tasks 4 and 5 sign-in is non-functional but the build compiles; this is the only intentionally-incomplete window.
- **Type consistency:** selector hook names (`useIsAuthed`, `useAuthRole`, `useIsOwner`, `useAuthUser`) and `SalesWebLoginError` are used verbatim across Tasks 2/4/5/6/8. `mapRole` signature stable from Task 1.
