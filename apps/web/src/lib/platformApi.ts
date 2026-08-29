/**
 * Fetch wrapper for the PLATFORM (owner) API — the counterpart to
 * {@link apiFetch} for the tenant API.
 *
 * Kept separate on purpose: platform routes authenticate with a DIFFERENT
 * token (the platform JWT, no tenant) that the tenant `apiFetch` knows nothing
 * about, and there is no refresh flow here — a platform token simply expires
 * and the owner signs in again. Mixing the two token systems in one client is
 * exactly the confusion the separate backend auth exists to avoid.
 */
import { ApiError } from "@/lib/api";
import { env } from "@/lib/config";
import { usePlatformAuth } from "@/store/platformAuth";

export async function platformFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = usePlatformAuth.getState().accessToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers,
    // The assume endpoint sets the tenant refresh cookie; include credentials
    // so the browser stores it, exactly as the tenant login does.
    credentials: "include",
  });

  if (res.status === 401) {
    // The platform token is gone or expired. There is no refresh; drop the
    // session so the UI routes back to the platform login.
    usePlatformAuth.getState().clear();
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
