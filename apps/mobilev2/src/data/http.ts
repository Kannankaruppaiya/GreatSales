/**
 * The one HTTP client for the GreatSales API.
 *
 * The access token lives in memory only. The refresh token — a seven-day
 * credential for a salesperson's whole account, on a phone that lives in a van
 * — goes to the Android Keystore / iOS Keychain through SecureStore, never to
 * AsyncStorage, which is plain text inside the app sandbox. The Expo web build
 * has no SecureStore and falls back to AsyncStorage (localStorage), the same
 * exposure any web app has.
 *
 * React Native cannot hold the httpOnly cookie the web console uses, so sign-in
 * asks for `tokenDelivery: "body"` and both tokens arrive in JSON.
 */
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

import { reportError } from "@/lib/observability";

const API_PORT = 3001;
const REFRESH_TOKEN_KEY = "gs_refresh_token";

/**
 * Where the API is.
 *
 * An explicit `EXPO_PUBLIC_API_URL` always wins — that is how a release build
 * is pointed at production. In development the API runs on the machine that
 * served this bundle, so its host is already known: the page's own host on
 * web, the Metro host on a device. `extra.apiBaseUrl` in app.json is the
 * release fallback when neither exists.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (__DEV__) {
    if (Platform.OS === "web") {
      const host = globalThis.location?.hostname;
      if (host) return `http://${host}:${API_PORT}/api/v1`;
    } else {
      const host = Constants.expoConfig?.hostUri?.split(":")[0];
      if (host) return `http://${host}:${API_PORT}/api/v1`;
    }
  }

  const configured = (
    Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined
  )?.apiBaseUrl;
  return configured ?? `http://localhost:${API_PORT}/api/v1`;
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Stable machine-readable cause from the API envelope. Branch on this, not `message`. */
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when the device cannot reach the API at all. */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach GreatSales. Check your connection and try again.");
    this.name = "NetworkError";
  }
}

// ---- Tokens -----------------------------------------------------------------

let accessToken: string | null = null;
/**
 * Set when the person unticked "Remember me": the refresh token is held for
 * this run of the app only and never written to the device.
 */
let memoryRefreshToken: string | null = null;
let rememberDevice = true;
let inFlightRefresh: Promise<string | null> | null = null;
let onSessionExpired: () => void = () => {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called once by the session store: a refresh that fails signs the user out. */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

const secureStoreAvailable = Platform.OS !== "web";

/** Whether the next sign-in's refresh token is written to the device. */
export function setRememberDevice(remember: boolean): void {
  rememberDevice = remember;
}

export async function persistRefreshToken(token: string): Promise<void> {
  if (!rememberDevice) {
    memoryRefreshToken = token;
    return;
  }
  if (secureStoreAvailable) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } else {
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
  }
}

export async function loadRefreshToken(): Promise<string | null> {
  if (memoryRefreshToken) return memoryRefreshToken;
  return secureStoreAvailable
    ? SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
    : AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  memoryRefreshToken = null;
  if (secureStoreAvailable) {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } else {
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

/**
 * Exchange the stored refresh token for a new pair.
 *
 * Single-flight: a screen that fires six requests at once and gets six 401s
 * performs one refresh, not six — and the API rotates the refresh token on
 * every use, so six parallel refreshes would invalidate each other.
 */
export function refreshSession(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return null;
      let res: Response;
      try {
        res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Offline is not a rejected session: keep the token and let the
        // caller surface a network error instead of signing the user out.
        throw new NetworkError();
      }
      if (!res.ok) {
        await clearTokens();
        return null;
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken?: string;
      };
      accessToken = data.accessToken;
      if (data.refreshToken) await persistRefreshToken(data.refreshToken);
      return data.accessToken;
    })().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

// ---- Requests ---------------------------------------------------------------

/** Build `?a=1&b=2` from defined, non-empty params. `false` is sent; only null/undefined/"" are dropped. */
export function query(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    search.set(key, String(value));
  }
  const q = search.toString();
  return q ? `?${q}` : "";
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return send<T>(path, init, false);
}

async function send<T>(
  path: string,
  init: RequestInit,
  isRetry: boolean,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new NetworkError();
  }

  // Sign-in itself answers 401 for a wrong password; that is not an expired session.
  if (res.status === 401 && !isRetry && !path.startsWith("/auth/login")) {
    const fresh = await refreshSession();
    if (fresh) return send<T>(path, init, true);
    onSessionExpired();
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      // A proxy's HTML error page: keep the status, drop the body.
    }
  }

  if (!res.ok) {
    const b = body as {
      message?: string | string[];
      code?: string;
      details?: unknown;
    } | null;
    const raw = b?.message ?? res.statusText ?? "Request failed";
    const message = Array.isArray(raw) ? raw.join(", ") : raw;
    const error = new ApiError(res.status, message, b?.code, b?.details);
    // A 4xx is the API refusing on purpose; a 5xx is a fault the screen
    // handles but somebody needs to hear about. Only the path goes with it —
    // never the body, which can carry customer data.
    if (res.status >= 500) reportError(error, { path, status: res.status });
    throw error;
  }
  return body as T;
}

/** A message a person can act on, for any error a request can throw. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return error.message && error.message !== "Forbidden"
        ? error.message
        : "Your account doesn't have access to this.";
    }
    if (error.status === 404) return "This record no longer exists.";
    if (error.status === 400 && Array.isArray(error.details)) {
      // The validation envelope's own message is generic; the first issue is
      // the one worth reading.
      const first = error.details[0] as { message?: string } | undefined;
      if (first?.message) return first.message;
    }
    if (error.status >= 500) {
      return "GreatSales had a problem answering. Try again in a moment.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
