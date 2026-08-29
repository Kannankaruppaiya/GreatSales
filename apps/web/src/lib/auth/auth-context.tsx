/**
 * Auth/session state for the whole admin app. Owns tokens (in memory +
 * localStorage), the current user, and the session lifecycle:
 *
 *   boot → read stored tokens → load profile → authenticated
 *   login → store tokens + profile → authenticated
 *   401 that can't be refreshed → signed out (reason: expired)
 *   sign out → clear tokens locally
 *
 * The API issues stateless JWTs with no revocation endpoint, so sign-out is a
 * best-effort local clear. When `/auth/logout` lands, call it here first.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getMe, login as loginRequest, refreshTokens } from "@/lib/api/auth-api";
import { configureClientAuth } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { AuthUser, LoginInput } from "@/lib/api/types";
import { storage } from "@/lib/storage";

const ACCESS_KEY = "gs.accessToken";
const REFRESH_KEY = "gs.refreshToken";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";
type ProfileStatus = "idle" | "loading" | "ready" | "error";

type AuthContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  profileStatus: ProfileStatus;
  endedReason: "expired" | null;
  login: (input: LoginInput) => Promise<void>;
  signOut: () => void;
  reloadProfile: () => Promise<void>;
  clearEndedReason: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokensRef = useRef<{ access: string; refresh: string } | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
  const [endedReason, setEndedReason] = useState<"expired" | null>(null);

  const persistTokens = useCallback((access: string, refresh: string) => {
    tokensRef.current = { access, refresh };
    storage.set(ACCESS_KEY, access);
    storage.set(REFRESH_KEY, refresh);
  }, []);

  const clearTokens = useCallback(() => {
    tokensRef.current = null;
    storage.remove(ACCESS_KEY);
    storage.remove(REFRESH_KEY);
  }, []);

  const endSession = useCallback(
    (reason: "expired" | null) => {
      clearTokens();
      setUser(null);
      setProfileStatus("idle");
      setEndedReason(reason);
      setStatus("unauthenticated");
    },
    [clearTokens],
  );

  const loadProfile = useCallback(async () => {
    setProfileStatus("loading");
    try {
      const me = await getMe();
      setUser(me);
      setProfileStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.kind === "auth") return; // handled by onAuthLost
      setProfileStatus("error");
    }
  }, []);

  // Wire token access + refresh into the HTTP client (once).
  useEffect(() => {
    configureClientAuth({
      getAccessToken: () => tokensRef.current?.access ?? null,
      refresh: async () => {
        const current = tokensRef.current;
        if (!current) return null;
        try {
          const next = await refreshTokens(current.refresh);
          persistTokens(next.accessToken, next.refreshToken);
          return next.accessToken;
        } catch {
          return null;
        }
      },
      onAuthLost: () => endSession("expired"),
    });
  }, [persistTokens, endSession]);

  // Bootstrap a stored session on load.
  useEffect(() => {
    const access = storage.get(ACCESS_KEY);
    const refresh = storage.get(REFRESH_KEY);
    if (access && refresh) {
      tokensRef.current = { access, refresh };
      setStatus("authenticated");
      void loadProfile();
    } else {
      setStatus("unauthenticated");
    }
  }, [loadProfile]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await loginRequest(input);
      persistTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      setProfileStatus("ready");
      setEndedReason(null);
      setStatus("authenticated");
    },
    [persistTokens],
  );

  const signOut = useCallback(() => endSession(null), [endSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profileStatus,
      endedReason,
      login,
      signOut,
      reloadProfile: loadProfile,
      clearEndedReason: () => setEndedReason(null),
    }),
    [status, user, profileStatus, endedReason, login, signOut, loadProfile],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
