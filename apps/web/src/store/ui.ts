import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "../data/constants";
import { CURRENT_MONTH, users } from "../data/mock";

/** The pre-existing seeded company — the default management every session opens with.
 *  Value is a human-readable slug (matches the slug of "GreatSales Industrial Corp"). */
export const DEFAULT_MANAGEMENT_ID = "greatsales-industrial-corp";

/* Client UI state. Persisted in localStorage so auth sessions and filters persist across page reloads. */
interface UiState {
  authed: boolean;
  role: Role;
  ownerId: string;
  isOwner: boolean;
  activeManagementId: string | null;
  month: string;
  principalId: string;
  ownerFilter: string;
  sidebarOpen: boolean;
  login: (role: Role) => void;
  logout: () => void;
  setRole: (role: Role) => void;
  setOwner: (v: boolean) => void;
  setActiveManagement: (id: string | null) => void;
  setMonth: (m: string) => void;
  setPrincipal: (id: string) => void;
  setOwnerFilter: (id: string) => void;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

const defaultOwnerFor = (role: Role): string => {
  if (role === "sales") {
    return users.find((u) => u.role === "sales")?.id ?? "u_s1";
  }
  const match = users.find((u) => u.role === role);
  if (match) return match.id;
  const admin = users.find((u) => u.role === "admin");
  return admin?.id ?? users[0]?.id ?? "u_adm";
};

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      authed: true,
      role: "admin",
      ownerId: defaultOwnerFor("admin"),
      isOwner: true,
      activeManagementId: DEFAULT_MANAGEMENT_ID,
      month: CURRENT_MONTH,
      principalId: "ALL",
      ownerFilter: "ALL",
      sidebarOpen: true,
      login: (role) =>
        set({
          authed: true,
          role,
          ownerId: defaultOwnerFor(role),
          ownerFilter: "ALL",
          isOwner: true,
          activeManagementId: DEFAULT_MANAGEMENT_ID,
        }),
      logout: () => set({ authed: false }),
      setRole: (role) => set({ role, ownerId: defaultOwnerFor(role), ownerFilter: "ALL" }),
      setOwner: (isOwner) => set({ isOwner }),
      setActiveManagement: (activeManagementId) => set({ activeManagementId }),
      setMonth: (month) => set({ month }),
      setPrincipal: (principalId) => set({ principalId }),
      setOwnerFilter: (ownerFilter) => set({ ownerFilter }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "greatsales_ui_state",
      version: 5,
      // isOwner is an authorization flag, not a UI preference. Never persist it:
      // localStorage is spoofable, and a stale `false` misroutes the owner straight
      // into a management instead of the management home. It is derived each session.
      partialize: (state) => {
        const rest = { ...state } as Record<string, unknown>;
        delete rest.isOwner;
        return rest as unknown as UiState;
      },
      migrate: (persistedState: any) => {
        const base = persistedState ?? {};
        const roleOk = ["admin", "sales", "mgmt"].includes(base.role);
        return {
          ...base,
          role: roleOk ? base.role : "admin",
          ownerId: roleOk ? base.ownerId : "u_adm",
          // POC: the web user is always the owner — force true, dropping any stale false.
          isOwner: true,
          activeManagementId: base.activeManagementId ?? DEFAULT_MANAGEMENT_ID,
        };
      },
    },
  ),
);
