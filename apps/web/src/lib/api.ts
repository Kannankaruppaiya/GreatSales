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

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = tokenGetter();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${env.API_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const b = body as { message?: string | string[]; details?: unknown } | null;
    const raw = b?.message ?? res.statusText;
    const message = Array.isArray(raw) ? raw.join(", ") : raw;
    throw new ApiError(res.status, message, b?.details);
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
