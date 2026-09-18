/**
 * Which data source the app runs against, and where the API lives.
 *
 * This is the single switch the brief asked for: flip `DATA_SOURCE` to "api"
 * and every screen reads from the real backend instead of the synthetic
 * dataset. No screen imports either implementation directly.
 */
import Constants from "expo-constants";

export type DataSourceKind = "synthetic" | "api";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function readString(key: string, fallback: string): string {
  const value = extra[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

/**
 * Defaults to the synthetic source.
 *
 * That is on purpose while the app is being built: a screen that renders
 * nothing against an unreachable API looks identical to a screen that is not
 * finished, and the two are worth telling apart. Set `dataSource: "api"` under
 * `expo.extra` in app.json to switch.
 */
export const DATA_SOURCE: DataSourceKind =
  readString("dataSource", "synthetic") === "api" ? "api" : "synthetic";

/** Base URL for the NestJS API, including the version prefix. */
export const API_BASE_URL = readString(
  "apiBaseUrl",
  "http://localhost:3001/api/v1",
);

/** Seed for the synthetic dataset. Same seed, same rows, every launch. */
export const SYNTHETIC_SEED = readString(
  "syntheticSeed",
  "greatsales-mobilev2",
);

/**
 * Artificial latency for the synthetic source, in milliseconds.
 *
 * Non-zero so loading skeletons are on screen during development rather than
 * flashing past — a skeleton that never renders is a skeleton nobody notices is
 * broken.
 */
export const SYNTHETIC_LATENCY_MS = 180;

/**
 * Capabilities the backend does not have yet.
 *
 * The design includes screens the API cannot serve. Rather than invent an
 * endpoint or fake the result, each one is named here and the screen reads this
 * flag to explain itself. Verified against apps/api/src on 2026-09-18:
 *
 * - `globalSearch`: there is no search controller. Every list endpoint takes
 *   its own `search` parameter, so flow 10 is implemented as a client-side
 *   fan-out across those endpoints, not as a server-side search.
 * - `leadDetail` / `orderDetail`: leads and orders expose `GET /` but no
 *   `GET /:id`. Detail screens fetch the list filtered to the one row.
 */
export const BACKEND_CAPABILITIES = {
  globalSearch: false,
  leadDetailEndpoint: false,
  orderDetailEndpoint: false,
} as const;
