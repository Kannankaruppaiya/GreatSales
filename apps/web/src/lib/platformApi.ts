/**
 * Fetch wrapper for the PLATFORM (owner) API — the counterpart to
 * {@link apiFetch} for the tenant API.
 *
 * Kept separate on purpose: platform routes authenticate with a DIFFERENT
 * token (the platform JWT, no tenant) that the tenant `apiFetch` knows nothing
 * about. Like the tenant flow, a 401 triggers a single-flight refresh from the
 * httpOnly platform refresh cookie; only if that fails is the session dropped.
 */
import { ApiError } from "@/lib/api";
import { env } from "@/lib/config";
import { usePlatformAuth } from "@/store/platformAuth";

interface PlatformSessionBody {
  accessToken: string;
  platformUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

let inFlightRefresh: Promise<string | null> | null = null;

/**
 * Exchange the httpOnly platform refresh cookie for a fresh access token,
 * updating the store. Single-flight so concurrent 401s share one refresh.
 * Returns the new token, or null when there is no usable session.
 */
export function refreshPlatformSession(): Promise<string | null> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      try {
        const res = await fetch(`${env.API_BASE_URL}/platform/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        if (!res.ok) {
          usePlatformAuth.getState().clear();
          return null;
        }
        const data = (await res.json()) as PlatformSessionBody;
        usePlatformAuth.setState({
          accessToken: data.accessToken,
          platformUser: data.platformUser,
        });
        return data.accessToken;
      } catch {
        usePlatformAuth.getState().clear();
        return null;
      } finally {
        inFlightRefresh = null;
      }
    })();
  }
  return inFlightRefresh;
}

export async function platformFetch<T>(
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
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = overrideToken ?? usePlatformAuth.getState().accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers,
    // The login/refresh/assume endpoints set httpOnly cookies; include
    // credentials so the browser stores and returns them.
    credentials: "include",
  });

  // The refresh endpoint is the one 401 we must not try to refresh — it IS the
  // refresh — so /refresh 401s fall straight through.
  if (res.status === 401 && !isRetry && !path.endsWith("/platform/auth/refresh")) {
    const fresh = await refreshPlatformSession();
    if (fresh) return doFetch<T>(path, init, true, fresh);
  }

  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const b = body as
      | { message?: string; error?: string; code?: string; details?: unknown }
      | undefined;
    throw new ApiError(
      res.status,
      b?.message ?? b?.error ?? `Request failed (${res.status})`,
      b?.details,
      b?.code,
    );
  }
  return body as T;
}
