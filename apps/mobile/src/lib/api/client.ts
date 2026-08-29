/**
 * The HTTP client. One place that knows how to talk to the API: JSON encoding,
 * bearer-token injection, request timeouts, uniform error mapping, and
 * transparent access-token refresh on a 401 (single-flight, so a burst of
 * requests triggers at most one refresh).
 *
 * The auth layer wires in token access + refresh via `configureClientAuth`,
 * which keeps this module free of a circular dependency on the auth context.
 */
import { API_URL, REQUEST_TIMEOUT_MS } from '@/lib/config';

import { ApiError } from './errors';
import type { ApiErrorBody } from './types';

type ClientAuth = {
  getAccessToken: () => string | null;
  /** Returns a fresh access token, or null if refresh failed. */
  refresh: () => Promise<string | null>;
  /** Called when the session is unrecoverable (refresh failed / no token). */
  onAuthLost: () => void;
};

let clientAuth: ClientAuth | null = null;
export function configureClientAuth(auth: ClientAuth): void {
  clientAuth = auth;
}

let refreshInFlight: Promise<string | null> | null = null;
function refreshOnce(): Promise<string | null> {
  if (!clientAuth) return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = clientAuth.refresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Attach the bearer access token and handle 401→refresh. */
  auth?: boolean;
  signal?: AbortSignal;
};

async function raw<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  // Bridge a caller-provided signal to our timeout controller.
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) throw new ApiError('timeout', 'Request timed out');
    throw new ApiError('network', err instanceof Error ? err.message : 'Network request failed');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const body = (payload ?? undefined) as ApiErrorBody | undefined;
    if (response.status === 401) throw new ApiError('auth', body?.message ?? 'Unauthorized', 401, body);
    throw new ApiError('http', body?.message ?? response.statusText, response.status, body);
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.auth ? (clientAuth?.getAccessToken() ?? null) : null;

  try {
    return await raw<T>(path, options, token);
  } catch (err) {
    // Try exactly one refresh + retry on an authed 401.
    if (err instanceof ApiError && err.kind === 'auth' && options.auth) {
      const fresh = await refreshOnce();
      if (fresh) {
        return raw<T>(path, options, fresh);
      }
      clientAuth?.onAuthLost();
    }
    throw err;
  }
}
