import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CURRENT_MONTH } from "../data/mock";

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
