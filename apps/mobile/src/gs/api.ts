/**
 * Thin typed fetch wrapper for the GreatSales API — mobile edition.
 *
 * Mirrors apps/web/src/lib/api.ts but uses AsyncStorage for the refresh
 * token instead of an httpOnly cookie (cookies are not available in React
 * Native). Everything else — single-flight refresh, ApiError typing, the
 * buildQuery helper — is identical to the web client.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * In development the API runs on the same machine that is serving this bundle,
 * so its address is already known: `hostUri` is the Metro host the phone just
 * downloaded the app from. Deriving the API host from it means a DHCP lease
 * change costs nothing — the old hardcoded LAN IP in app.json had to be edited
 * by hand every time the laptop moved network, and until it was, every request
 * failed with a bare "could not reach the server".
 *
 * Order: an explicit EXPO_PUBLIC_API_URL always wins (that is how release
 * builds point at the real API), then the Metro host, then app.json, then
 * localhost for the simulator.
 */
const API_PORT = 3001;

function devHostApiUrl(): string | null {
  // Web: the browser already knows which host it loaded the app from, and the
  // API sits beside it. `hostUri` is not populated on web, so without this the
  // web build fell through to app.json and used whatever LAN IP was written
  // there months ago.
  if (Platform.OS === 'web') {
    const host = globalThis.location?.hostname;
    return host ? `http://${host}:${API_PORT}/api/v1` : null;
  }

  // Native dev: hostUri is the Metro host the phone downloaded the bundle
  // from, which is by definition the machine running the API.
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${API_PORT}/api/v1` : null; // null in a release build
}

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ||
  devHostApiUrl() ||
  // Last resort only. Metro embeds app.json at server START, so a value edited
  // here is stale until Metro restarts — never rely on it to point at a LAN IP.
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
    ?.apiBaseUrl ||
  `http://localhost:${API_PORT}/api/v1`;

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

/**
 * The refresh token is a seven-day credential for a salesperson's entire
 * account, and these phones live in vans and factory yards. AsyncStorage keeps
 * it in plain text inside the app sandbox, readable on a rooted or jailbroken
 * device and by anything with a filesystem backup; SecureStore hands it to the
 * Android Keystore / iOS Keychain instead.
 *
 * SecureStore has no web implementation, so the Expo-web build keeps
 * AsyncStorage (localStorage underneath) — the same exposure the browser gives
 * any web app, and not the case this protects.
 */
const secureStoreAvailable = Platform.OS !== 'web';

export async function persistRefreshToken(token: string): Promise<void> {
  if (secureStoreAvailable) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    return;
  }
  await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export async function loadRefreshToken(): Promise<string | null> {
  if (secureStoreAvailable) {
    const secure = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (secure) return secure;
    // One-time migration: a session created before this change is still in
    // AsyncStorage. Move it rather than silently signing the user out.
    const legacy = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (legacy) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    }
    return legacy;
  }
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  _accessToken = null;
  // Clear BOTH stores: a token left behind in the legacy location would be
  // picked up by the migration in loadRefreshToken() and resurrect a session
  // the user just signed out of.
  if (secureStoreAvailable) {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
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
