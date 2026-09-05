import { create } from "zustand";
import { persist } from "zustand/middleware";
import { currentPeriod } from "@/data/months";

/**
 * The month the app opens on, as `YYYY-MM`.
 *
 * Two problems with the hardcoded `"2026-08"` this replaced, and the second is
 * the serious one:
 *
 *   1. The app defaulted to one fixed month forever, so every user would open
 *      on August 2026 for the rest of the product's life.
 *   2. `store/ui.ts` is imported by `App.tsx`, `layout.tsx` and
 *      `DashboardPage.tsx`, so that one string pulled a mock module — and
 *      through it a large dataset — into the production bundle.
 *
 * Computing it costs nothing and removes the edge entirely.
 */
function currentMonth(): string {
  return currentPeriod();
}

/**
 * The month is SESSION state, not a saved preference.
 *
 * It used to be persisted with the rest of this store, so a user who looked at
 * June once opened the app in June for the rest of the year — every page,
 * every reload, until they noticed. The app must open on the real current
 * month every time; looking at another one is an act, and acts do not outlive
 * the tab. Selecting a past month still works, and still holds while you move
 * between pages, because the value lives in this store for the session.
 */
const SESSION_ONLY: (keyof UiState)[] = ["month"];

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
      version: 8,
      // Only the durable preferences are written. `month` is omitted on
      // purpose — see SESSION_ONLY.
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([k]) => !SESSION_ONLY.includes(k as keyof UiState),
          ),
        ) as UiState,
      // v6→v7: auth fields (authed/role/isOwner/ownerId) moved out to useAuth.
      // Drop any legacy keys so an old blob can't rehydrate a fake session.
      // v7→v8: `month` stopped being persisted. A stored one is IGNORED rather
      // than restored, which is the whole point of the version bump — every
      // existing install is carrying a stale month right now.
      migrate: (persistedState: any) => {
        const base = persistedState ?? {};
        return {
          activeManagementId: base.activeManagementId ?? DEFAULT_MANAGEMENT_ID,
          month: currentMonth(),
          principalId: base.principalId ?? "ALL",
          ownerFilter: base.ownerFilter ?? "ALL",
          sidebarOpen: base.sidebarOpen ?? true,
        };
      },
    },
  ),
);
