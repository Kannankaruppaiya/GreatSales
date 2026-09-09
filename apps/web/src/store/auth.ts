/**
 * Web session state.
 *
 * Nothing secret is persisted. The access token and profile live in memory
 * only; the refresh token never enters JavaScript at all — the server keeps it
 * in an httpOnly cookie. A page reload therefore starts with no token and
 * re-establishes the session through {@link useAuth.bootstrap}, which asks the
 * server to rotate the cookie into a fresh access token.
 *
 * The single persisted value is `lastTenantId`, which is not a credential: it
 * only saves the user retyping their workspace id on the next sign-in.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiFetch, setTokenGetter, setRefreshHandler } from "@/lib/api";
import { mapRole } from "@/lib/authRole";
import type { Role } from "@/data/constants";
import type { AuthUser, LoginResponse } from "@/features/projections/types";
/**
 * Which sign-in door was used. Mirrors `Portal` in `@greatsales/shared`, which
 * this app does not depend on — the API validates the value against its own
 * copy, so a drift here is a 400 rather than a silently wrong session.
 */
type Portal = "super_admin" | "admin" | "mgmt" | "sales";

/** Access-token lifecycle, so the UI can tell "signed out" from "not yet known". */
export type SessionStatus = "unknown" | "ready";

interface AuthState {
  /** In memory only — never written to storage. */
  accessToken: string | null;
  user: AuthUser | null;
  /** Persisted convenience, not a secret. */
  lastTenantId: string | null;
  /**
   * "unknown" until bootstrap has had its chance, so guards can hold rather
   * than bouncing a signed-in user to the login page on every reload.
   */
  status: SessionStatus;

  login: (
    tenantId: string,
    email: string,
    password: string,
    portal?: Portal,
  ) => Promise<void>;
  logout: (allSessions?: boolean) => Promise<void>;
  /** Restore a session from the refresh cookie. Safe to call more than once. */
  bootstrap: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      lastTenantId: null,
      status: "unknown",

      login: async (tenantId, email, password, portal) => {
        // tokenDelivery defaults to "cookie" server-side; stated explicitly so
        // the browser's contract is visible at the call site.
        //
        // `portal` is which sign-in door was used. The server rejects a role
        // that does not match it, which is what turns /admin/login and
        // /sales/login from two skins of one page into two actual doors.
        const res = await apiFetch<LoginResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            tenantId,
            email,
            password,
            tokenDelivery: "cookie",
            client: "web",
            ...(portal ? { portal } : {}),
          }),
        });
        set({
          accessToken: res.accessToken,
          user: res.user,
          lastTenantId: tenantId,
          status: "ready",
        });
      },

      logout: async (allSessions = false) => {
        try {
          // Server-side revocation is the point: clearing local state alone
          // would leave the refresh token usable until it expired.
          await apiFetch("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ allSessions }),
          });
        } catch {
          // A failed logout must still sign the user out of this device.
        } finally {
          set({ accessToken: null, user: null, status: "ready" });
        }
      },

      bootstrap: async () => {
        // A token already in memory means this tab is live; nothing to restore.
        if (get().accessToken) {
          set({ status: "ready" });
          return;
        }
        try {
          const tokens = await apiFetch<{ accessToken: string }>(
            "/auth/refresh",
            { method: "POST", body: JSON.stringify({}) },
          );
          set({ accessToken: tokens.accessToken });
          const user = await apiFetch<AuthUser>("/auth/me");
          set({ user, status: "ready" });
        } catch {
          // No usable cookie — an ordinary signed-out visit, not an error.
          set({ accessToken: null, user: null, status: "ready" });
        }
      },
    }),
    {
      name: "greatsales_auth",
      // Whitelist, not blacklist: a future field is non-persisted by default,
      // so no credential can be added to storage by accident.
      partialize: (s) => ({ lastTenantId: s.lastTenantId }),
    },
  ),
);

// Wire the api client to always read the freshest token from this store.
setTokenGetter(() => useAuth.getState().accessToken);

/**
 * On 401, ask the server to rotate the refresh cookie into a new access token.
 * Uses a raw fetch rather than apiFetch so a failing refresh cannot recurse
 * into itself. Returns the new access token, or null → the session is over.
 */
setRefreshHandler(async () => {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL || "/api/v1"}/auth/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include", // the cookie IS the credential
      },
    );
    if (!res.ok) {
      useAuth.setState({ accessToken: null, user: null, status: "ready" });
      return null;
    }
    const data = (await res.json()) as { accessToken: string };
    useAuth.setState({ accessToken: data.accessToken });
    return data.accessToken;
  } catch {
    useAuth.setState({ accessToken: null, user: null, status: "ready" });
    return null;
  }
});

/* ── Derived session selectors (computed, never stored) ── */
export const useIsAuthed = (): boolean => useAuth((s) => !!s.accessToken);
export const useSessionStatus = (): SessionStatus => useAuth((s) => s.status);
export const useAuthUser = (): AuthUser | null => useAuth((s) => s.user);
export const useAuthRole = (): Role => useAuth((s) => mapRole(s.user?.role));
export const useIsOwner = (): boolean =>
  useAuth((s) => mapRole(s.user?.role) === "super_admin");
export const useLastTenantId = (): string | null =>
  useAuth((s) => s.lastTenantId);

/** The signed-in user's id, for "is this row me?" checks. */
export const useCurrentUserId = (): string | null =>
  useAuth((s) => s.user?.id ?? null);

/**
 * The session's permission keys as a Set.
 *
 * Memoised off the identity of `user.permissions` so the Set is referentially
 * stable across renders — returning a fresh Set every render would defeat
 * every downstream useMemo that depends on it.
 *
 * PRESENTATION ONLY. Every permission here is enforced server-side and proved
 * by a deny test; this exists so the UI does not offer buttons that would 403.
 */
const permissionSetCache = new WeakMap<string[], ReadonlySet<string>>();
export const usePermissions = (): ReadonlySet<string> =>
  useAuth((s) => {
    const list = s.user?.permissions;
    if (!list) return EMPTY_PERMISSIONS;
    const cached = permissionSetCache.get(list);
    if (cached) return cached;
    const set: ReadonlySet<string> = new Set(list);
    permissionSetCache.set(list, set);
    return set;
  });

const EMPTY_PERMISSIONS: ReadonlySet<string> = new Set<string>();

/** True when the session holds `key`. False before sign-in — never throws. */
export const useHasPermission = (key: string): boolean =>
  useAuth((s) => s.user?.permissions?.includes(key) ?? false);

/** True while an admin-set password must still be replaced by the user. */
export const useMustChangePassword = (): boolean =>
  useAuth((s) => s.user?.mustChangePassword ?? false);
