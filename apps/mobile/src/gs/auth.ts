/**
 * Mobile auth store — useSyncExternalStore based (no Zustand dependency).
 *
 * Mobile-specific differences from the web auth store:
 * - tokenDelivery: 'body' — refresh token arrives in the JSON response, not a cookie
 * - Tokens are persisted to AsyncStorage so sessions survive app restarts
 * - bootstrap() reads the persisted refresh token and exchanges it for a fresh
 *   access token on startup instead of relying on a cookie
 */
import { useSyncExternalStore } from 'react';
import {
  apiFetch,
  setAccessToken,
  persistRefreshToken,
  loadRefreshToken,
  clearTokens,
} from './api';

// ---------------------------------------------------------------------------
// Types (mirrors web AuthUser / LoginResponse, source of truth is the API)
// ---------------------------------------------------------------------------
export interface AuthUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  permissions: string[];
  mustChangePassword: boolean;
}

export type SessionStatus = 'unknown' | 'ready';

interface AuthState {
  user: AuthUser | null;
  status: SessionStatus;
  /** Persisted convenience, not a secret. */
  lastTenantId: string | null;
}

// ---------------------------------------------------------------------------
// Store (useSyncExternalStore pattern — matches existing store.ts)
// ---------------------------------------------------------------------------
let state: AuthState = {
  user: null,
  status: 'unknown',
  lastTenantId: null,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<AuthState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function getSnapshot(): AuthState {
  return state;
}

export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useAuthUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, () => state.user);
}

export function useSessionStatus(): SessionStatus {
  return useSyncExternalStore(subscribe, () => state.status);
}

export function useIsAuthed(): boolean {
  return useSyncExternalStore(subscribe, () => state.user !== null);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Sign in. Uses tokenDelivery: 'body' so both tokens are returned in JSON
 * (React Native cannot hold httpOnly cookies).
 */
export async function login(
  tenantId: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const res = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ tenantId, email, password, tokenDelivery: 'body' }),
  });

  setAccessToken(res.accessToken);
  await persistRefreshToken(res.refreshToken);
  const user = { ...res.user, userId: res.user.id };
  setState({ user, status: 'ready', lastTenantId: tenantId });
  // Returned so the caller can honour `mustChangePassword` before navigating.
  return user;
}

/**
 * Restore session on app launch — reads the refresh token from AsyncStorage
 * and exchanges it for a fresh access token.
 */
export async function bootstrap(): Promise<void> {
  // Already have a user in memory — nothing to do.
  if (state.user) {
    setState({ status: 'ready' });
    return;
  }

  try {
    const refreshToken = await loadRefreshToken();
    if (!refreshToken) {
      setState({ status: 'ready' });
      return;
    }

    const tokens = await apiFetch<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    setAccessToken(tokens.accessToken);
    await persistRefreshToken(tokens.refreshToken);

    const me = await apiFetch<AuthUser>('/auth/me');
    const user = { ...me, userId: me.id };
    setState({ user, status: 'ready' });
  } catch {
    // Token expired or server unavailable — treat as signed out.
    await clearTokens();
    setState({ user: null, status: 'ready' });
  }
}

/** Sign out. Revokes the server session then clears local state. */
/**
 * Change the signed-in user's password, then refresh the profile.
 *
 * The refresh is the point: `mustChangePassword` lives on the user record, and
 * until the store sees it cleared the app keeps routing back to the change
 * screen. Mobile had no such screen at all — login ignored the flag and went
 * straight to the tab bar, where MustChangePasswordGuard then 403'd every
 * single request. The server was right to refuse; the app simply had no way
 * out, so an admin resetting a rep's password locked that rep out of mobile
 * until someone reinstalled or logged in on the web.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const user = await apiFetch<AuthUser>('/auth/me');
  setState({ user, status: 'ready' });
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ allSessions: false }),
    });
  } catch {
    // Even if the server call fails, clear local state.
  } finally {
    await clearTokens();
    setState({ user: null, status: 'ready' });
  }
}
