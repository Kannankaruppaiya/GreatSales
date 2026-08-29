/**
 * Runtime configuration. The API base URL is read from the public env var
 * `EXPO_PUBLIC_API_URL` (inlined at build time by Expo). Falls back to the
 * local dev API. Set it per environment in `.env` / EAS build profiles.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000/api/v1';

/** How long a single request may take before we treat it as a timeout. */
export const REQUEST_TIMEOUT_MS = 15_000;
