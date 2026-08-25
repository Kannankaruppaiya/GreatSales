import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * The month the app opens on, as `YYYY-MM`.
 *
 * This used to import `CURRENT_MONTH` from `@/data/mock` — a hardcoded
 * `"2026-08"`. Two problems, and the second is the serious one:
 *
 *   1. The app defaulted to one fixed month forever, so every user would open
 *      on August 2026 for the rest of the product's life.
 *   2. `store/ui.ts` is imported by `App.tsx`, `layout.tsx` and
 *      `DashboardPage.tsx`, so that one string pulled `data/mock.ts` — and
 *      through it the 33,000-line POC dataset of REAL customer records — into
 *      the production bundle. See checklists/07-SECURITY.md G.3.9.
 *
 * Computing it costs nothing and removes the edge entirely.
 */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The pre-existing seeded company — the default management every session opens with.
 *  Value is a human-readable slug (matches the slug of "GreatSales Industrial Corp"). */
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
      month: currentMonth(),
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
          month: base.month ?? currentMonth(),
          principalId: base.principalId ?? "ALL",
          ownerFilter: base.ownerFilter ?? "ALL",
          sidebarOpen: base.sidebarOpen ?? true,
        };
      },
    },
  ),
);
