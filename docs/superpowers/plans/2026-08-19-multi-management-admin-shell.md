# Multi-Management Admin Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owner-only shell above the existing web admin so unlimited isolated managements (tenants) can be created and switched, each opening the unchanged current admin scoped to its own data.

**Architecture:** A new `useManagementStore` holds every management's metadata + its own dataset snapshot. Switching a management saves the current working set back and loads the target's into the existing `useTrackerStore` (hydrate-on-switch) — so the 40+ existing tracker actions and every page stay untouched. `useUi` gains `isOwner` + `activeManagementId`. Routes move under `/m/:managementId/*`; a new `/managements` home (owner-gated) lists/creates managements.

**Tech Stack:** React 19 + Vite 6, React Router 7, Zustand 5 (persist), Tailwind 4, TypeScript 5. Tests: Vitest + React Testing Library + jsdom.

## Global Constraints

- Web app is a client-only mock/POC — no API calls; all state in Zustand persisted to localStorage.
- Existing admin screens (Dashboard, Projections, Leads, Orders, Payments, Follow-ups, Customers, Products, Users, Data) render **unchanged** — no edits to their JSX.
- Package manager is `pnpm`; run web commands from `apps/web`.
- Two-weight typography, Tailwind semantic tokens already in `index.css` (`--brand`, `surface`, `line`, `ink`, `muted` etc.) — reuse them; no new colors.
- `DEFAULT_MANAGEMENT_ID = "m_default"` — the pre-existing seeded company.
- Owner-only surfaces gate on `useUi().isOwner`; management access gate: owner → any, admin → only their own.
- Commit after every task with the message shown in its final step.

---

## File map

Create:
- `apps/web/vitest.setup.ts` — jest-dom matchers
- `apps/web/src/store/managementStore.ts` — managements list + per-management datasets
- `apps/web/src/store/managementActions.ts` — `switchManagement`, `snapshotTracker`, `emptyDataset`
- `apps/web/src/components/RequireOwner.tsx` — owner-only route guard
- `apps/web/src/components/ManagementProvider.tsx` — reads `:managementId`, validates, hydrates
- `apps/web/src/components/ManagementSwitcher.tsx` — topbar dropdown (owner only)
- `apps/web/src/components/modals/CreateManagementModal.tsx` — create wizard
- `apps/web/src/pages/ManagementHomePage.tsx` — Level 0 card grid
- test files alongside each (`*.test.ts` / `*.test.tsx`)

Modify:
- `apps/web/package.json` — test deps + `test` script
- `apps/web/vite.config.ts` — vitest `test` block
- `apps/web/src/store/ui.ts` — add `isOwner`, `activeManagementId`, setters; bump persist version
- `apps/web/src/App.tsx` — `/managements` + `/m/:managementId/*` restructure + redirects
- `apps/web/src/components/layout.tsx` — prefix NavLinks with `/m/:managementId`; mount switcher

---

### Task 1: Test tooling + `useUi` owner/tenant state

**Files:**
- Modify: `apps/web/package.json` (devDependencies + scripts)
- Modify: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.setup.ts`
- Modify: `apps/web/src/store/ui.ts`
- Test: `apps/web/src/store/ui.test.ts`

**Interfaces:**
- Consumes: existing `useUi` (`store/ui.ts`).
- Produces: `useUi` state additions — `isOwner: boolean` (default `true`), `activeManagementId: string | null` (default `"m_default"`), actions `setOwner(v: boolean): void`, `setActiveManagement(id: string | null): void`. Exports `DEFAULT_MANAGEMENT_ID = "m_default"` from `store/ui.ts`.

- [ ] **Step 1: Add test deps + script**

In `apps/web/package.json`, add to `devDependencies`:
```json
"vitest": "^3.0.0",
"jsdom": "^25.0.0",
"@testing-library/react": "^16.1.0",
"@testing-library/user-event": "^14.5.2",
"@testing-library/jest-dom": "^6.6.3"
```
Add to `scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`. Then run `pnpm install` from `apps/web`.

- [ ] **Step 2: Configure vitest**

Create `apps/web/vitest.setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

In `apps/web/vite.config.ts` add a `test` block inside the config object (keep existing plugins):
```ts
test: {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./vitest.setup.ts"],
},
```
Add `/// <reference types="vitest/config" />` as the first line of `vite.config.ts`.

- [ ] **Step 3: Write the failing test**

Create `apps/web/src/store/ui.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useUi, DEFAULT_MANAGEMENT_ID } from "./ui";

describe("useUi tenant state", () => {
  beforeEach(() => {
    useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID });
  });

  it("defaults to owner on the default management", () => {
    expect(useUi.getState().isOwner).toBe(true);
    expect(useUi.getState().activeManagementId).toBe("m_default");
  });

  it("setOwner toggles owner flag", () => {
    useUi.getState().setOwner(false);
    expect(useUi.getState().isOwner).toBe(false);
  });

  it("setActiveManagement changes the active id", () => {
    useUi.getState().setActiveManagement("m_acme");
    expect(useUi.getState().activeManagementId).toBe("m_acme");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/store/ui.test.ts`
Expected: FAIL — `DEFAULT_MANAGEMENT_ID` not exported / `isOwner` undefined.

- [ ] **Step 5: Implement**

In `apps/web/src/store/ui.ts`:
- Add `export const DEFAULT_MANAGEMENT_ID = "m_default";` near the top.
- Extend `UiState` with:
```ts
  isOwner: boolean;
  activeManagementId: string | null;
  setOwner: (v: boolean) => void;
  setActiveManagement: (id: string | null) => void;
```
- In the store initializer add defaults + actions:
```ts
      isOwner: true,
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      setOwner: (isOwner) => set({ isOwner }),
      setActiveManagement: (activeManagementId) => set({ activeManagementId }),
```
- In `login`, also set `isOwner: true` and `activeManagementId: DEFAULT_MANAGEMENT_ID` (POC single owner).
- Bump persist `version: 2` → `version: 3` and in `migrate`, ensure returned object has `isOwner: true` and `activeManagementId: DEFAULT_MANAGEMENT_ID` when missing:
```ts
        return {
          ...(persistedState ?? {}),
          role: persistedState?.role ?? "admin",
          ownerId: persistedState?.ownerId ?? "u_adm",
          isOwner: persistedState?.isOwner ?? true,
          activeManagementId: persistedState?.activeManagementId ?? DEFAULT_MANAGEMENT_ID,
        };
```
(apply inside both branches so all migrated states carry the new fields).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/store/ui.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/vite.config.ts apps/web/vitest.setup.ts apps/web/src/store/ui.ts apps/web/src/store/ui.test.ts
git commit -m "feat(web): vitest setup + owner/activeManagement state in useUi"
```

---

### Task 2: Management store + dataset helpers

**Files:**
- Create: `apps/web/src/store/managementStore.ts`
- Test: `apps/web/src/store/managementStore.test.ts`

**Interfaces:**
- Consumes: types from `../data/types` and `WorkspaceProfile` from `./trackerStore`; `DEFAULT_MANAGEMENT_ID` from `./ui`.
- Produces:
  - Type `ManagementSummary = { id: string; name: string; initials: string; industry: string; currency: string; createdAt: string }`.
  - Type `TrackerData = { users: User[]; principals: Principal[]; products: Product[]; customers: Customer[]; projections: Projection[]; leads: Lead[]; orders: SalesOrder[]; payments: Payment[]; profile: WorkspaceProfile }`.
  - Type `CreateManagementInput = { name: string; industry: string; currency: string; timezone: string; adminName: string; adminEmail: string }`.
  - `emptyDataset(profile: WorkspaceProfile): TrackerData`.
  - `useManagementStore` with state `{ managements: ManagementSummary[]; datasets: Record<string, TrackerData> }` and actions `createManagement(input: CreateManagementInput): string` (returns new id), `getDataset(id: string): TrackerData | undefined`, `saveDataset(id: string, data: TrackerData): void`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/store/managementStore.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useManagementStore, emptyDataset } from "./managementStore";
import { DEFAULT_MANAGEMENT_ID } from "./ui";

const baseState = () => ({
  managements: [
    { id: DEFAULT_MANAGEMENT_ID, name: "GreatSales Industrial Corp", initials: "GS", industry: "Industrial", currency: "INR (₹)", createdAt: "2026-08-19" },
  ],
  datasets: {},
});

describe("useManagementStore", () => {
  beforeEach(() => useManagementStore.setState(baseState()));

  it("seeds the default management", () => {
    expect(useManagementStore.getState().managements[0].id).toBe(DEFAULT_MANAGEMENT_ID);
  });

  it("createManagement appends a summary and an empty dataset", () => {
    const id = useManagementStore.getState().createManagement({
      name: "Acme Traders", industry: "Pharma", currency: "INR (₹)",
      timezone: "Asia/Kolkata", adminName: "Ravi", adminEmail: "ravi@acme.com",
    });
    const s = useManagementStore.getState();
    expect(s.managements.map((m) => m.id)).toContain(id);
    expect(s.datasets[id].customers).toEqual([]);
    expect(s.datasets[id].users).toHaveLength(1);
    expect(s.datasets[id].users[0].email).toBe("ravi@acme.com");
  });

  it("save/getDataset round-trips", () => {
    const data = emptyDataset({ name: "X", subdomain: "x", currency: "INR (₹)", fiscalYearStart: "April" });
    useManagementStore.getState().saveDataset("m_x", data);
    expect(useManagementStore.getState().getDataset("m_x")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/store/managementStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/store/managementStore.ts`:
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Customer, Lead, Payment, Principal, Product, Projection, SalesOrder, User } from "../data/types";
import type { WorkspaceProfile } from "./trackerStore";
import { DEFAULT_MANAGEMENT_ID } from "./ui";

export interface ManagementSummary {
  id: string;
  name: string;
  initials: string;
  industry: string;
  currency: string;
  createdAt: string;
}

export interface TrackerData {
  users: User[];
  principals: Principal[];
  products: Product[];
  customers: Customer[];
  projections: Projection[];
  leads: Lead[];
  orders: SalesOrder[];
  payments: Payment[];
  profile: WorkspaceProfile;
}

export interface CreateManagementInput {
  name: string;
  industry: string;
  currency: string;
  timezone: string;
  adminName: string;
  adminEmail: string;
}

export function emptyDataset(profile: WorkspaceProfile): TrackerData {
  return {
    users: [], principals: [], products: [], customers: [],
    projections: [], leads: [], orders: [], payments: [], profile,
  };
}

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "M";

const slugId = (name: string) =>
  `m_${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}_${Date.now().toString(36)}`;

interface ManagementState {
  managements: ManagementSummary[];
  datasets: Record<string, TrackerData>;
  createManagement: (input: CreateManagementInput) => string;
  getDataset: (id: string) => TrackerData | undefined;
  saveDataset: (id: string, data: TrackerData) => void;
}

export const useManagementStore = create<ManagementState>()(
  persist(
    (set, get) => ({
      managements: [
        { id: DEFAULT_MANAGEMENT_ID, name: "GreatSales Industrial Corp", initials: "GS", industry: "Industrial", currency: "INR (₹)", createdAt: "2026-08-19" },
      ],
      datasets: {},
      createManagement: (input) => {
        const id = slugId(input.name);
        const profile: WorkspaceProfile = {
          name: input.name,
          subdomain: id,
          currency: input.currency,
          fiscalYearStart: "April",
        };
        const data = emptyDataset(profile);
        data.users = [{
          id: "u_01", name: input.adminName, email: input.adminEmail,
          role: "admin", active: true, lastLogin: null,
        } as User];
        set((state) => ({
          managements: [...state.managements, {
            id, name: input.name, initials: initials(input.name),
            industry: input.industry, currency: input.currency,
            createdAt: new Date().toISOString().slice(0, 10),
          }],
          datasets: { ...state.datasets, [id]: data },
        }));
        return id;
      },
      getDataset: (id) => get().datasets[id],
      saveDataset: (id, data) => set((state) => ({ datasets: { ...state.datasets, [id]: data } })),
    }),
    { name: "greatsales_managements_v1", version: 1 },
  ),
);
```
(If the `User` type requires more required fields, add them with sensible defaults so the object type-checks — check `apps/web/src/data/types.ts` for the exact shape.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/store/managementStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/managementStore.ts apps/web/src/store/managementStore.test.ts
git commit -m "feat(web): management store with per-management datasets"
```

---

### Task 3: `switchManagement` orchestrator + tracker snapshot

**Files:**
- Create: `apps/web/src/store/managementActions.ts`
- Test: `apps/web/src/store/managementActions.test.ts`

**Interfaces:**
- Consumes: `useTrackerStore` (`./trackerStore`), `useManagementStore` + `TrackerData` (`./managementStore`), `useUi` (`./ui`).
- Produces:
  - `snapshotTracker(): TrackerData` — reads the 9 data fields off `useTrackerStore`.
  - `switchManagement(targetId: string): void` — saves current management's working set into `useManagementStore`, loads the target's dataset into `useTrackerStore`, sets `useUi.activeManagementId = targetId`. If the target has no saved dataset, loads `emptyDataset(current profile)`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/store/managementActions.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { switchManagement, snapshotTracker } from "./managementActions";
import { useTrackerStore } from "./trackerStore";
import { useManagementStore, emptyDataset } from "./managementStore";
import { useUi, DEFAULT_MANAGEMENT_ID } from "./ui";

describe("switchManagement", () => {
  beforeEach(() => {
    useUi.setState({ activeManagementId: DEFAULT_MANAGEMENT_ID });
    useManagementStore.setState({
      managements: [{ id: DEFAULT_MANAGEMENT_ID, name: "Default", initials: "DF", industry: "x", currency: "INR (₹)", createdAt: "2026-08-19" }],
      datasets: { m_empty: emptyDataset({ name: "Empty Co", subdomain: "m_empty", currency: "INR (₹)", fiscalYearStart: "April" }) },
    });
  });

  it("saves the current dataset and loads the target", () => {
    const before = useTrackerStore.getState().customers.length;
    expect(before).toBeGreaterThan(0);

    switchManagement("m_empty");
    expect(useUi.getState().activeManagementId).toBe("m_empty");
    expect(useTrackerStore.getState().customers).toEqual([]);
    expect(useManagementStore.getState().getDataset(DEFAULT_MANAGEMENT_ID)!.customers.length).toBe(before);

    switchManagement(DEFAULT_MANAGEMENT_ID);
    expect(useTrackerStore.getState().customers.length).toBe(before);
  });

  it("snapshotTracker captures live tracker arrays", () => {
    const snap = snapshotTracker();
    expect(snap.customers).toEqual(useTrackerStore.getState().customers);
    expect(snap.profile).toEqual(useTrackerStore.getState().profile);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/store/managementActions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/store/managementActions.ts`:
```ts
import { useTrackerStore } from "./trackerStore";
import { useManagementStore, emptyDataset, type TrackerData } from "./managementStore";
import { useUi } from "./ui";

export function snapshotTracker(): TrackerData {
  const t = useTrackerStore.getState();
  return {
    users: t.users, principals: t.principals, products: t.products,
    customers: t.customers, projections: t.projections, leads: t.leads,
    orders: t.orders, payments: t.payments, profile: t.profile,
  };
}

export function switchManagement(targetId: string): void {
  const current = useUi.getState().activeManagementId;
  if (current && current !== targetId) {
    useManagementStore.getState().saveDataset(current, snapshotTracker());
  }
  const target =
    useManagementStore.getState().getDataset(targetId) ??
    emptyDataset(snapshotTracker().profile);
  useTrackerStore.setState({ ...target });
  useUi.getState().setActiveManagement(targetId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/store/managementActions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/store/managementActions.ts apps/web/src/store/managementActions.test.ts
git commit -m "feat(web): switchManagement hydrate-on-switch orchestrator"
```

---

### Task 4: `RequireOwner` route guard

**Files:**
- Create: `apps/web/src/components/RequireOwner.tsx`
- Test: `apps/web/src/components/RequireOwner.test.tsx`

**Interfaces:**
- Consumes: `useUi` (`../store/ui`).
- Produces: `RequireOwner({ children }: { children: React.ReactNode })` — renders children when `useUi().isOwner`, else `<Navigate to={"/m/" + activeManagementId + "/dashboard"} replace />` (falls back to `/login` when `activeManagementId` is null).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/RequireOwner.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOwner } from "./RequireOwner";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";

function renderAt() {
  return render(
    <MemoryRouter initialEntries={["/managements"]}>
      <Routes>
        <Route path="/managements" element={<RequireOwner><div>home</div></RequireOwner>} />
        <Route path="/m/:id/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireOwner", () => {
  beforeEach(() => useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID }));

  it("renders children for an owner", () => {
    renderAt();
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("redirects a non-owner to their management dashboard", () => {
    useUi.setState({ isOwner: false, activeManagementId: DEFAULT_MANAGEMENT_ID });
    renderAt();
    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/components/RequireOwner.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/RequireOwner.tsx`:
```tsx
import { Navigate } from "react-router-dom";
import { useUi } from "../store/ui";

export function RequireOwner({ children }: { children: React.ReactNode }) {
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);

  if (!isOwner) {
    const to = activeManagementId ? `/m/${activeManagementId}/dashboard` : "/login";
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/components/RequireOwner.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/RequireOwner.tsx apps/web/src/components/RequireOwner.test.tsx
git commit -m "feat(web): RequireOwner route guard"
```

---

### Task 5: `ManagementProvider` (validate + hydrate)

**Files:**
- Create: `apps/web/src/components/ManagementProvider.tsx`
- Test: `apps/web/src/components/ManagementProvider.test.tsx`

**Interfaces:**
- Consumes: `useParams` (react-router), `useUi`, `useManagementStore`, `switchManagement`.
- Produces: `ManagementProvider({ children })` — reads `:managementId` from the route. Access rule: owner → any existing management; non-owner → only when `managementId === useUi().activeManagementId`. If the id is unknown or access denied, `<Navigate>` to a safe route (owner-unknown → `/managements`; non-owner-denied → their `/m/:active/dashboard`). On valid access, if `managementId !== useUi().activeManagementId`, calls `switchManagement(managementId)` in an effect, then renders children.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ManagementProvider.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ManagementProvider } from "./ManagementProvider";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";
import { useManagementStore, emptyDataset } from "../store/managementStore";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/m/:managementId/dashboard" element={<ManagementProvider><div>inside</div></ManagementProvider>} />
        <Route path="/managements" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ManagementProvider", () => {
  beforeEach(() => {
    useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID });
    useManagementStore.setState({
      managements: [
        { id: DEFAULT_MANAGEMENT_ID, name: "Default", initials: "DF", industry: "x", currency: "INR (₹)", createdAt: "2026-08-19" },
        { id: "m_acme", name: "Acme", initials: "AC", industry: "Pharma", currency: "INR (₹)", createdAt: "2026-08-19" },
      ],
      datasets: { m_acme: emptyDataset({ name: "Acme", subdomain: "m_acme", currency: "INR (₹)", fiscalYearStart: "April" }) },
    });
  });

  it("renders children for a valid management the owner may open", () => {
    renderAt("/m/m_acme/dashboard");
    expect(screen.getByText("inside")).toBeInTheDocument();
    expect(useUi.getState().activeManagementId).toBe("m_acme");
  });

  it("redirects owner to home for an unknown management", () => {
    renderAt("/m/m_ghost/dashboard");
    expect(screen.getByText("home")).toBeInTheDocument();
  });

  it("blocks a non-owner from another management", () => {
    useUi.setState({ isOwner: false, activeManagementId: DEFAULT_MANAGEMENT_ID });
    renderAt("/m/m_acme/dashboard");
    expect(screen.queryByText("inside")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/components/ManagementProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/ManagementProvider.tsx`:
```tsx
import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useUi } from "../store/ui";
import { useManagementStore } from "../store/managementStore";
import { switchManagement } from "../store/managementActions";

export function ManagementProvider({ children }: { children: React.ReactNode }) {
  const { managementId } = useParams();
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);
  const known = useManagementStore((s) => s.managements.some((m) => m.id === managementId));

  const exists = Boolean(managementId) && known;
  const mayAccess = exists && (isOwner || managementId === activeManagementId);

  useEffect(() => {
    if (mayAccess && managementId && managementId !== activeManagementId) {
      switchManagement(managementId);
    }
  }, [mayAccess, managementId, activeManagementId]);

  if (!mayAccess) {
    if (isOwner) return <Navigate to="/managements" replace />;
    const to = activeManagementId ? `/m/${activeManagementId}/dashboard` : "/login";
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/components/ManagementProvider.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ManagementProvider.tsx apps/web/src/components/ManagementProvider.test.tsx
git commit -m "feat(web): ManagementProvider validates access and hydrates dataset"
```

---

### Task 6: Restructure routes in `App.tsx`

**Files:**
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/App.routes.test.tsx`

**Interfaces:**
- Consumes: `RequireOwner`, `ManagementProvider`, `ManagementHomePage` (Task 8 — import lazily; the file is created there, but this task defines the route so add the import and a temporary inline placeholder ONLY IF Task 8 not yet done — prefer implementing Task 8 first if running in order).
- Produces: routes — `/managements` (owner-gated), `/m/:managementId/*` (wrapped in `ManagementProvider`, renders existing `AppLayout` screens), `/` redirect (owner → `/managements`, else → `/m/:active/dashboard`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/App.routes.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { useUi, DEFAULT_MANAGEMENT_ID } from "./store/ui";

// App renders its own <Routes>; mount it inside a MemoryRouter by rendering the
// route tree. App uses top-level <Routes>, so wrap with MemoryRouter here.
describe("App routing", () => {
  beforeEach(() => useUi.setState({ authed: true, isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID }));

  it("owner hitting / lands on the management home", () => {
    render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
    // Home shows the create-management affordance
    expect(screen.getByText(/create management/i)).toBeInTheDocument();
  });

  it("opening a management renders the dashboard shell", async () => {
    render(<MemoryRouter initialEntries={[`/m/${DEFAULT_MANAGEMENT_ID}/dashboard`]}><App /></MemoryRouter>);
    expect(await screen.findByText(/executive overview/i)).toBeInTheDocument();
  });
});
```
Note: `App.tsx` currently renders `<Routes>` at top level with no `<Router>` — that is correct; tests supply `MemoryRouter`. Confirm `main.tsx` provides `BrowserRouter` in production (leave it as-is).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/App.routes.test.tsx`
Expected: FAIL — `/` does not render home; no create-management text.

- [ ] **Step 3: Implement**

Edit `apps/web/src/App.tsx`:
- Add lazy import: `const ManagementHomePage = lazy(() => import("./pages/ManagementHomePage"));`
- Add imports: `import { RequireOwner } from "./components/RequireOwner";` and `import { ManagementProvider } from "./components/ManagementProvider";` and `import { useUi } from "./store/ui";` (already imported).
- Replace the protected `/*` element so routing becomes:
```tsx
function RootRedirect() {
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);
  if (isOwner) return <Navigate to="/managements" replace />;
  return <Navigate to={activeManagementId ? `/m/${activeManagementId}/dashboard` : "/login"} replace />;
}
```
- Change `AppLayout`'s inner `<Routes>` paths to be relative under `/m/:managementId` — the existing `AppLayout` `<Route path="/dashboard" ...>` becomes `<Route path="dashboard" ...>` etc. (drop leading slash on each), and its container is mounted at `/m/:managementId/*`.
- Update the top-level tree:
```tsx
export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<PublicAuthRoute />} />
        <Route path="/managements" element={
          <ProtectedRoute><RequireOwner>
            <Suspense fallback={<PageLoadingSkeleton />}><ManagementHomePage /></Suspense>
          </RequireOwner></ProtectedRoute>
        } />
        <Route path="/m/:managementId/*" element={
          <ProtectedRoute><ManagementProvider><AppLayout /></ManagementProvider></ProtectedRoute>
        } />
        <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
        <Route path="*" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />
      </Routes>
    </ErrorBoundary>
  );
}
```
- In `AppLayout`, keep `RoleGuard` on `users`/`data`. Its `<Route path="/" ...>` redirect becomes `<Route index element={<Navigate to="dashboard" replace />} />`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/App.routes.test.tsx`
Expected: PASS (2 tests). (Implement Task 8 first if `ManagementHomePage` does not yet exist.)

- [ ] **Step 5: Verify the full suite + typecheck**

Run: `pnpm --dir apps/web test` then `pnpm --dir apps/web build`
Expected: all tests PASS; `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.routes.test.tsx
git commit -m "feat(web): route managements home + /m/:managementId shell"
```

---

### Task 7: Prefix navigation links with the active management

**Files:**
- Modify: `apps/web/src/components/layout.tsx`
- Test: `apps/web/src/components/layout.nav.test.tsx`

**Interfaces:**
- Consumes: `useUi().activeManagementId`, `NAVS` (`../data/constants`).
- Produces: `Sidebar` `NavLink` `to` values become `/m/${activeManagementId}/${n.key}`; the `Topbar` title lookup still keys off the last path segment.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/layout.nav.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./layout";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";

describe("Sidebar links", () => {
  beforeEach(() => useUi.setState({ role: "admin", activeManagementId: DEFAULT_MANAGEMENT_ID, sidebarOpen: true }));

  it("prefixes nav links with the active management id", () => {
    render(<MemoryRouter><Sidebar onOpenCommandPalette={() => {}} /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link.getAttribute("href")).toBe(`/m/${DEFAULT_MANAGEMENT_ID}/dashboard`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/components/layout.nav.test.tsx`
Expected: FAIL — href is `/dashboard`, not prefixed.

- [ ] **Step 3: Implement**

In `apps/web/src/components/layout.tsx` `Sidebar`:
- Read the active id: `const activeManagementId = useUi((s) => s.activeManagementId);` (extend the existing `useUi` destructure or add a selector).
- Change the `NavLink` `to`:
```tsx
to={`/m/${activeManagementId}/${n.key}`}
```
- In `Topbar`, the `key` derivation must use the LAST segment, not `replace("/", "")`:
```tsx
const segs = useLocation().pathname.split("/").filter(Boolean);
const key = segs[segs.length - 1] || "dashboard";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/components/layout.nav.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout.tsx apps/web/src/components/layout.nav.test.tsx
git commit -m "feat(web): scope sidebar links to active management"
```

---

### Task 8: Management Home page (Level 0)

**Files:**
- Create: `apps/web/src/pages/ManagementHomePage.tsx`
- Test: `apps/web/src/pages/ManagementHomePage.test.tsx`

**Interfaces:**
- Consumes: `useManagementStore().managements`, `useNavigate`, `CreateManagementModal` (Task 9 — import; if running in order, implement Task 9 first, or stub the modal to `null` until then).
- Produces: default-exported `ManagementHomePage` — renders a card per management (name, initials, industry · currency, "Open"), a search input filtering by name (case-insensitive), and a "Create management" card that opens the create modal. Clicking a management card navigates to `/m/${id}/dashboard`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/pages/ManagementHomePage.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ManagementHomePage from "./ManagementHomePage";
import { useManagementStore } from "../store/managementStore";
import { DEFAULT_MANAGEMENT_ID } from "../store/ui";

describe("ManagementHomePage", () => {
  beforeEach(() => {
    useManagementStore.setState({
      managements: [
        { id: DEFAULT_MANAGEMENT_ID, name: "GreatSales Industrial Corp", initials: "GS", industry: "Industrial", currency: "INR (₹)", createdAt: "2026-08-19" },
        { id: "m_acme", name: "Acme Traders", initials: "AC", industry: "Pharma", currency: "INR (₹)", createdAt: "2026-08-19" },
      ],
      datasets: {},
    });
  });

  it("lists all managements and the create card", () => {
    render(<MemoryRouter><ManagementHomePage /></MemoryRouter>);
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.getByText("GreatSales Industrial Corp")).toBeInTheDocument();
    expect(screen.getByText(/create management/i)).toBeInTheDocument();
  });

  it("filters by search", async () => {
    render(<MemoryRouter><ManagementHomePage /></MemoryRouter>);
    await userEvent.type(screen.getByPlaceholderText(/search managements/i), "acme");
    expect(screen.getByText("Acme Traders")).toBeInTheDocument();
    expect(screen.queryByText("GreatSales Industrial Corp")).not.toBeInTheDocument();
  });

  it("links a management card to its dashboard", () => {
    render(<MemoryRouter><ManagementHomePage /></MemoryRouter>);
    const link = screen.getByRole("link", { name: /acme traders/i });
    expect(link.getAttribute("href")).toBe("/m/m_acme/dashboard");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/pages/ManagementHomePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/pages/ManagementHomePage.tsx`. Use existing Tailwind tokens (`surface`, `line`, `ink`, `muted`, `brand`, `brand-soft`, `brand-ink`). Render management cards as `<Link to={`/m/${m.id}/dashboard`}>`. Search filters `managements` by `name.toLowerCase().includes(query)`. Include a dashed "Create management" button that sets `showCreate` state and renders `<CreateManagementModal open={showCreate} onClose={...} />`. Provide an accessible name on each card link (the management name). Keep the create card OUT of the search filter.

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, ArrowRight } from "lucide-react";
import { useManagementStore } from "../store/managementStore";
import { CreateManagementModal } from "../components/modals/CreateManagementModal";

export default function ManagementHomePage() {
  const managements = useManagementStore((s) => s.managements);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const shown = managements.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-canvas text-ink p-6 sm:p-10 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-xl font-bold">Your managements</h1>
        <span className="text-sm text-muted">{managements.length} workspaces</span>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-1.5">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search managements"
            className="bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
        {shown.map((m) => (
          <Link
            key={m.id}
            to={`/m/${m.id}/dashboard`}
            aria-label={m.name}
            className="rounded-xl border border-line bg-surface p-4 flex flex-col gap-3 hover:border-brand/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-ink font-bold text-sm">{m.initials}</div>
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{m.name}</div>
                <div className="text-[11px] text-muted">{m.industry} · {m.currency}</div>
              </div>
            </div>
            <div className="text-[11px] text-brand-ink flex items-center gap-1 mt-auto">Open <ArrowRight className="h-3 w-3" /></div>
          </Link>
        ))}

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-xl border border-dashed border-line hover:border-brand/50 p-4 flex flex-col items-center justify-center gap-2 text-muted min-h-[132px]"
        >
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-ink"><Plus className="h-5 w-5" /></span>
          <span className="text-[13px] font-bold text-ink">Create management</span>
          <span className="text-[11px]">New workspace · own users &amp; data</span>
        </button>
      </div>

      <CreateManagementModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/pages/ManagementHomePage.test.tsx`
Expected: PASS (3 tests). (Requires Task 9's `CreateManagementModal`; implement Task 9 first if running strictly in order.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/ManagementHomePage.tsx apps/web/src/pages/ManagementHomePage.test.tsx
git commit -m "feat(web): management home card grid + search"
```

---

### Task 9: Create-Management modal (wizard)

**Files:**
- Create: `apps/web/src/components/modals/CreateManagementModal.tsx`
- Test: `apps/web/src/components/modals/CreateManagementModal.test.tsx`

**Interfaces:**
- Consumes: `useManagementStore().createManagement`, `useNavigate`.
- Produces: `CreateManagementModal({ open, onClose }: { open: boolean; onClose: () => void })`. Fields: name (required), industry, currency (select, default `INR (₹)`), timezone (default `Asia/Kolkata`), first-admin name + email. On submit with an empty name, shows inline error "Enter a company name" and does not create. On valid submit, calls `createManagement(input)`, then `navigate(`/m/${newId}/dashboard`)` and `onClose()`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/modals/CreateManagementModal.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { CreateManagementModal } from "./CreateManagementModal";
import { useManagementStore } from "../../store/managementStore";
import { DEFAULT_MANAGEMENT_ID } from "../../store/ui";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateMock };
});

describe("CreateManagementModal", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    useManagementStore.setState({
      managements: [{ id: DEFAULT_MANAGEMENT_ID, name: "Default", initials: "DF", industry: "x", currency: "INR (₹)", createdAt: "2026-08-19" }],
      datasets: {},
    });
  });

  it("validates the required name", async () => {
    render(<MemoryRouter><CreateManagementModal open onClose={() => {}} /></MemoryRouter>);
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    expect(screen.getByText(/enter a company name/i)).toBeInTheDocument();
    expect(useManagementStore.getState().managements).toHaveLength(1);
  });

  it("creates a management and navigates into it", async () => {
    render(<MemoryRouter><CreateManagementModal open onClose={() => {}} /></MemoryRouter>);
    await userEvent.type(screen.getByLabelText(/company name/i), "Nova Foods");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));
    const created = useManagementStore.getState().managements.find((m) => m.name === "Nova Foods");
    expect(created).toBeTruthy();
    expect(navigateMock).toHaveBeenCalledWith(`/m/${created!.id}/dashboard`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/components/modals/CreateManagementModal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/modals/CreateManagementModal.tsx`. Follow the pattern of an existing modal (e.g. `AddPrincipalModal.tsx`) for the overlay/dialog shell and buttons. Controlled inputs; `name` required with inline error. On submit build `CreateManagementInput` and call the store.

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useManagementStore } from "../../store/managementStore";

const CURRENCIES = ["INR (₹)", "USD ($)", "GBP (£)", "EUR (€)"];

export function CreateManagementModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const createManagement = useManagementStore((s) => s.createManagement);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [currency, setCurrency] = useState("INR (₹)");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const submit = () => {
    if (!name.trim()) { setError("Enter a company name"); return; }
    const id = createManagement({ name: name.trim(), industry, currency, timezone, adminName, adminEmail });
    onClose();
    navigate(`/m/${id}/dashboard`);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-ink">Create management</h2>

        <label className="block text-xs font-bold text-muted">Company name
          <input aria-label="Company name" value={name} onChange={(e) => { setName(e.target.value); setError(""); }}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>
        {error && <p className="text-xs text-red">{error}</p>}

        <label className="block text-xs font-bold text-muted">Industry
          <input value={industry} onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>

        <label className="block text-xs font-bold text-muted">Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="block text-xs font-bold text-muted">First admin name
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>

        <label className="block text-xs font-bold text-muted">First admin email
          <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancel</button>
          <button onClick={submit} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white">Create management</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --dir apps/web test src/components/modals/CreateManagementModal.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/modals/CreateManagementModal.tsx apps/web/src/components/modals/CreateManagementModal.test.tsx
git commit -m "feat(web): create-management wizard modal"
```

---

### Task 10: Management switcher in the topbar (owner only)

**Files:**
- Modify: `apps/web/src/components/layout.tsx`
- Create: `apps/web/src/components/ManagementSwitcher.tsx`
- Test: `apps/web/src/components/ManagementSwitcher.test.tsx`

**Interfaces:**
- Consumes: `useUi` (`isOwner`, `activeManagementId`), `useManagementStore().managements`, `useNavigate`.
- Produces: `ManagementSwitcher()` — renders nothing when `!isOwner`. When owner, shows the current management name as a button; clicking reveals a menu listing other managements (each navigates to `/m/${id}/dashboard`), a "Back to all managements" item (→ `/managements`), and "Create new" (→ `/managements` where the create card lives). Mounted in `Topbar`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/ManagementSwitcher.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ManagementSwitcher } from "./ManagementSwitcher";
import { useUi, DEFAULT_MANAGEMENT_ID } from "../store/ui";
import { useManagementStore } from "../store/managementStore";

describe("ManagementSwitcher", () => {
  beforeEach(() => {
    useUi.setState({ isOwner: true, activeManagementId: DEFAULT_MANAGEMENT_ID });
    useManagementStore.setState({
      managements: [
        { id: DEFAULT_MANAGEMENT_ID, name: "GreatSales Industrial Corp", initials: "GS", industry: "Industrial", currency: "INR (₹)", createdAt: "2026-08-19" },
        { id: "m_acme", name: "Acme Traders", initials: "AC", industry: "Pharma", currency: "INR (₹)", createdAt: "2026-08-19" },
      ],
      datasets: {},
    });
  });

  it("hides for non-owners", () => {
    useUi.setState({ isOwner: false });
    const { container } = render(<MemoryRouter><ManagementSwitcher /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it("owner sees current management and can open the menu", async () => {
    render(<MemoryRouter><ManagementSwitcher /></MemoryRouter>);
    expect(screen.getByText("GreatSales Industrial Corp")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /switch management/i }));
    const link = screen.getByRole("link", { name: /acme traders/i });
    expect(link.getAttribute("href")).toBe("/m/m_acme/dashboard");
    expect(screen.getByRole("link", { name: /back to all managements/i }).getAttribute("href")).toBe("/managements");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/web test src/components/ManagementSwitcher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/ManagementSwitcher.tsx`:
```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Building2, LayoutGrid } from "lucide-react";
import { useUi } from "../store/ui";
import { useManagementStore } from "../store/managementStore";

export function ManagementSwitcher() {
  const isOwner = useUi((s) => s.isOwner);
  const activeManagementId = useUi((s) => s.activeManagementId);
  const managements = useManagementStore((s) => s.managements);
  const [open, setOpen] = useState(false);

  if (!isOwner) return null;
  const current = managements.find((m) => m.id === activeManagementId);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Switch management"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink"
      >
        <Building2 className="h-3.5 w-3.5 text-muted" />
        <span className="max-w-[140px] truncate">{current?.name ?? "Select management"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-30 mt-1 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl text-xs">
            {managements.filter((m) => m.id !== activeManagementId).map((m) => (
              <Link key={m.id} to={`/m/${m.id}/dashboard`} aria-label={m.name} onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-ink hover:bg-surface-2">
                <span className="grid h-5 w-5 place-items-center rounded bg-brand-soft text-[10px] font-bold text-brand-ink">{m.initials}</span>
                <span className="truncate">{m.name}</span>
              </Link>
            ))}
            <div className="my-1 border-t border-line" />
            <Link to="/managements" aria-label="Back to all managements" onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-ink hover:bg-surface-2">
              <LayoutGrid className="h-3.5 w-3.5 text-muted" /> Back to all managements
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount in Topbar**

In `apps/web/src/components/layout.tsx`, import `ManagementSwitcher` and render it in `Topbar` just before the title/breadcrumb block:
```tsx
<ManagementSwitcher />
```
(place it inside the header, left of the `GreatSales / <title>` group).

- [ ] **Step 5: Run test + suite**

Run: `pnpm --dir apps/web test src/components/ManagementSwitcher.test.tsx` then `pnpm --dir apps/web test`
Expected: switcher tests PASS; full suite green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/ManagementSwitcher.tsx apps/web/src/components/layout.tsx apps/web/src/components/ManagementSwitcher.test.tsx
git commit -m "feat(web): owner-only management switcher in topbar"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole suite**

Run: `pnpm --dir apps/web test`
Expected: all tests PASS.

- [ ] **Step 2: Typecheck + build**

Run: `pnpm --dir apps/web build`
Expected: `tsc --noEmit` clean, Vite build succeeds.

- [ ] **Step 3: Manual smoke (dev server)**

Run the dev server and confirm: `/` (owner) → management home; create a management → lands in its empty dashboard; switch back to the default management → seeded data intact; switching does not leak data between managements; a management's sidebar links carry `/m/:id/...`.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A apps/web
git commit -m "test(web): verify multi-management shell end-to-end"
```

---

## Self-review notes

- **Spec coverage:** Level 0 home (T8), create wizard (T9), Level 1 prefix + provider (T5–T7), owner gating (T4, T10), state additions (T1), isolation via per-management datasets (T2–T3), routing target (T6). All spec sections mapped.
- **Isolation deviation from spec §7:** spec said "narrows the in-memory dataset"; because POC records carry no managementId, isolation is implemented as per-management dataset snapshots swapped on switch (T2–T3) — stronger isolation, same outcome. Noted intentionally.
- **Out of scope (unchanged):** billing, real API/tenant provisioning endpoint, separate platform console, cross-management dashboards, pagination.
- **Type consistency:** `ManagementSummary`, `TrackerData`, `CreateManagementInput`, `switchManagement`, `snapshotTracker`, `emptyDataset`, `DEFAULT_MANAGEMENT_ID` used with identical signatures across tasks.
- **Ordering note:** Tasks 8 and 9 are mutually referenced (home renders the modal); when executing strictly in order, implement Task 9's modal before Task 8's page test, or stub the import — called out in both tasks.
