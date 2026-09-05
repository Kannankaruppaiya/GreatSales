/**
 * Thin typed fetch wrapper for the GreatSales API — mobile edition.
 *
 * Mirrors apps/web/src/lib/api.ts but uses AsyncStorage for the refresh
 * token instead of an httpOnly cookie (cookies are not available in React
 * Native). Everything else — single-flight refresh, ApiError typing, the
 * buildQuery helper — is identical to the web client.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/** Base URL read from app.json `extra.apiBaseUrl`, falling back to a safe default. */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl ?? 'http://localhost:3000/api/v1';

const REFRESH_TOKEN_KEY = 'gs_refresh_token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    /**
     * Stable machine-readable cause from the API envelope, e.g.
     * "LAST_ADMIN_PROTECTED". Branch on THIS, never on `message`.
     */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Token management — the access token lives in memory only; the refresh
// token is persisted to AsyncStorage so sessions survive app restarts.
// ---------------------------------------------------------------------------
let _accessToken: string | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export async function persistRefreshToken(token: string): Promise<void> {
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export async function loadRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  _accessToken = null;
  await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Single-flight: concurrent 401s all await the same refresh attempt. */
function refreshOnce(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const refreshToken = await loadRefreshToken();
        if (!refreshToken) return null;

        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          await clearTokens();
          return null;
        }
        const data = (await res.json()) as { accessToken: string; refreshToken?: string };
        setAccessToken(data.accessToken);
        if (data.refreshToken) {
          await persistRefreshToken(data.refreshToken);
        }
        return data.accessToken;
      } catch {
        return null;
      }
    })().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return doFetch<T>(path, init, false);
}

async function doFetch<T>(
  path: string,
  init: RequestInit,
  isRetry: boolean,
  overrideToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit | undefined);
  headers.set('Content-Type', 'application/json');

  const token = overrideToken ?? _accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401 && !isRetry) {
    const fresh = await refreshOnce();
    if (fresh) return doFetch<T>(path, init, true, fresh);
    // Refresh failed — caller (auth store) will handle sign-out
  }

  const text = await res.text();
  const body: unknown = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const b = body as { message?: string | string[]; details?: unknown; code?: string } | null;
    const raw = b?.message ?? res.statusText;
    const message = Array.isArray(raw) ? raw.join(', ') : raw;
    throw new ApiError(res.status, message, b?.details, b?.code);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Build a query string from defined, non-empty params (with leading '?'). */
export function buildQuery(params: Record<string, unknown>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}
