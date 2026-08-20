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
