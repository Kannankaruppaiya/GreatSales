/**
 * Runtime configuration. The API base URL comes from the Vite env var
 * `VITE_API_URL` (inlined at build). Falls back to the local dev API.
 */
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ??
  "http://localhost:3000/api/v1";

/** Per-request timeout before we treat the call as timed out. */
export const REQUEST_TIMEOUT_MS = 15_000;
