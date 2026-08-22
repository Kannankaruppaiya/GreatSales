/**
 * Real API auth state — the single source of truth for the web session. Holds the
 * JWT pair + profile from POST /auth/login, persisted so a reload keeps the session.
 * Registers the token getter the api client uses to authorize every request.
 * Derived web Role / isOwner / isAuthed are exposed as selector hooks (never stored),
 * so the token/user remain the only persisted authority.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, setTokenGetter, setRefreshHandler } from "@/lib/api";
import { mapRole } from "@/lib/authRole";
import { env } from "@/lib/config";
import type { Role } from "@/data/constants";
import type {
  AuthTokens,
  AuthUser,
  LoginResponse,
} from "@/features/projections/types";

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

// On 401, exchange the refresh token for a new pair via a raw fetch (never apiFetch,
// to avoid recursing into refresh). Returns the new access token, or null → logout.
// The API's POST /auth/refresh only re-issues the token pair (AuthTokens), not the
// user profile, so the stored `user` is left untouched here.
setRefreshHandler(async () => {
  const rt = useAuth.getState().refreshToken;
  if (!rt) return null;
  try {
    const res = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) {
      useAuth.getState().logout();
      return null;
    }
    const data = (await res.json()) as AuthTokens;
    useAuth.setState({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  } catch {
    useAuth.getState().logout();
    return null;
  }
});

/* ── Derived session selectors (computed, never persisted) ── */
export const useIsAuthed = (): boolean => useAuth((s) => !!s.accessToken);
export const useAuthUser = (): AuthUser | null => useAuth((s) => s.user);
export const useAuthRole = (): Role => useAuth((s) => mapRole(s.user?.role));
export const useIsOwner = (): boolean =>
  useAuth((s) => mapRole(s.user?.role) === "super_admin");
