/**
 * Thin typed fetch wrapper for the GreatSales API. Attaches the bearer token
 * from whatever getter the auth store registers, sends/parses JSON, and turns
 * non-2xx responses into a typed {@link ApiError} carrying the server's
 * validation `details` (the shared ApiErrorBody contract).
 */
import { env } from "@/lib/config";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    /**
     * Stable machine-readable cause from the API envelope, e.g.
     * "LAST_ADMIN_PROTECTED". Branch on THIS, never on `message` — the
     * wording is for humans and may be reworded at any time. Undefined for
     * unexpected 500s, which carry no business meaning.
     */
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let tokenGetter: () => string | null = () => null;

/** Registered once by the auth store so requests pick up the current token. */
export function setTokenGetter(fn: () => string | null): void {
  tokenGetter = fn;
}

let refreshHandler: (() => Promise<string | null>) | null = null;
let inFlightRefresh: Promise<string | null> | null = null;

/** Registered by the auth store; returns a fresh access token or null on failure. */
export function setRefreshHandler(fn: () => Promise<string | null>): void {
  refreshHandler = fn;
}

/** Single-flight: concurrent 401s await the same refresh. */
function refreshOnce(): Promise<string | null> {
  if (!refreshHandler) return Promise.resolve(null);
  if (!inFlightRefresh) {
    inFlightRefresh = refreshHandler().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  return doFetch<T>(path, init, false);
}

/**
 * Fetch a file rather than JSON.
 *
 * Goes through the same path as everything else — bearer token, cookie
 * credentials, single-flight refresh on a 401 — because a download whose
 * session has just expired should renew and succeed, not fail with a browser
 * error page in a new tab. A plain `<a href>` would get none of that: it sends
 * no Authorization header at all.
 */
export async function apiFetchBlob(
  path: string,
  init: RequestInit = {},
): Promise<Blob> {
  return doFetch<Blob>(path, { ...init, [BLOB_RESPONSE]: true }, false);
}

/**
 * Marks a request whose response is a file. A symbol so it cannot collide with
 * a real `RequestInit` key, and is dropped before the init reaches `fetch`.
 */
const BLOB_RESPONSE = Symbol.for("greatsales.blobResponse") as unknown as string;

async function doFetch<T>(
  path: string,
  init: RequestInit,
  isRetry: boolean,
  overrideToken?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  // A multipart body must be sent with NO content-type header: the browser
  // writes it, and the boundary it generates is the only thing that makes the
  // body parseable. Setting it by hand produces a request the server cannot
  // read and an error that says nothing about why.
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = overrideToken ?? tokenGetter();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // `credentials: "include"` is mandatory, not optional: the refresh token
  // lives in an httpOnly cookie, so without it the session cannot be renewed
  // and the browser would never store the cookie in the first place.
  const wantsBlob = (init as Record<string, unknown>)[BLOB_RESPONSE] === true;
  const res = await fetch(`${env.API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !isRetry) {
    const fresh = await refreshOnce();
    if (fresh) return doFetch<T>(path, init, true, fresh);
  }

  if (wantsBlob && res.ok) return (await res.blob()) as T;

  const text = await res.text();
  // A file endpoint that fails still answers with JSON; a 204 answers with
  // nothing, and JSON.parse("") throws.
  const body: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const b = body as {
      message?: string | string[];
      details?: unknown;
      code?: string;
    } | null;
    const raw = b?.message ?? res.statusText;
    const message = Array.isArray(raw) ? raw.join(", ") : raw;
    throw new ApiError(res.status, message, b?.details, b?.code);
  }
  return body as T;
}

/** Build a query string from defined, non-empty params (with leading '?'). */
export function buildQuery(
  params: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
