/**
 * Auth/session state for the whole app. Owns the tokens (in memory + secure
 * storage), the current user profile, and the session lifecycle:
 *
 *   boot → read stored tokens → load profile → authenticated
 *   login → store tokens + profile → authenticated
 *   401 that can't be refreshed → signed out (reason: expired)
 *   sign out → clear tokens locally
 *
 * Note: the API currently issues stateless JWTs with no server-side
 * revocation endpoint, so sign-out is a best-effort local clear. When a
 * `/auth/logout` endpoint lands, call it here before clearing.
 */
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { getMe, login as loginRequest, refreshTokens } from '@/lib/api/auth-api';
import { configureClientAuth } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AuthUser, LoginInput } from '@/lib/api/types';
import { storage } from '@/lib/storage';

const ACCESS_KEY = 'gs.accessToken';
const REFRESH_KEY = 'gs.refreshToken';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';
type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

type AuthContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  profileStatus: ProfileStatus;
  /** Set when the session ended on its own (e.g. refresh failed). */
  endedReason: 'expired' | null;
  login: (input: LoginInput) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
  clearEndedReason: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const tokensRef = useRef<{ access: string; refresh: string } | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [endedReason, setEndedReason] = useState<'expired' | null>(null);

  const persistTokens = useCallback(async (access: string, refresh: string) => {
    tokensRef.current = { access, refresh };
    await Promise.all([storage.set(ACCESS_KEY, access), storage.set(REFRESH_KEY, refresh)]);
  }, []);

  const clearTokens = useCallback(async () => {
    tokensRef.current = null;
    await Promise.all([storage.remove(ACCESS_KEY), storage.remove(REFRESH_KEY)]);
  }, []);

  const endSession = useCallback(
    async (reason: 'expired' | null) => {
      await clearTokens();
      setUser(null);
      setProfileStatus('idle');
      setEndedReason(reason);
      setStatus('unauthenticated');
    },
    [clearTokens],
  );

  const loadProfile = useCallback(async () => {
    setProfileStatus('loading');
    try {
      const me = await getMe();
      setUser(me);
      setProfileStatus('ready');
    } catch (err) {
      // An unrecoverable 401 is handled by onAuthLost (session ends); any other
      // failure keeps the session but surfaces a retryable profile error.
      if (err instanceof ApiError && err.kind === 'auth') return;
      setProfileStatus('error');
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
          await persistTokens(next.accessToken, next.refreshToken);
          return next.accessToken;
        } catch {
          return null;
        }
      },
      onAuthLost: () => {
        void endSession('expired');
      },
    });
  }, [persistTokens, endSession]);

  // Bootstrap: restore a stored session on cold start.
  useEffect(() => {
    let active = true;
    (async () => {
      const [access, refresh] = await Promise.all([storage.get(ACCESS_KEY), storage.get(REFRESH_KEY)]);
      if (!active) return;
      if (access && refresh) {
        tokensRef.current = { access, refresh };
        setStatus('authenticated');
        await loadProfile();
      } else {
        setStatus('unauthenticated');
      }
    })();
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await loginRequest(input);
      await persistTokens(res.accessToken, res.refreshToken);
      setUser(res.user);
      setProfileStatus('ready');
      setEndedReason(null);
      setStatus('authenticated');
    },
    [persistTokens],
  );

  const signOut = useCallback(async () => {
    await endSession(null);
  }, [endSession]);

  const value: AuthContextValue = {
    status,
    user,
    profileStatus,
    endedReason,
    login,
    signOut,
    reloadProfile: loadProfile,
    clearEndedReason: () => setEndedReason(null),
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
