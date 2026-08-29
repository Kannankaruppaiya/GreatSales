/**
 * GreatSales Web Application Client Environment Configuration
 * Note: Only public, non-secret variables are prefixed with VITE_.
 * Never put private API keys, database credentials or service secrets here.
 */

/**
 * Vite inlines `import.meta.env.*` at build time, so ANY literal used as a
 * fallback here is compiled into the shipped bundle. A hardcoded default
 * credential is therefore a credential in production, not a convenience.
 *
 * Demo prefill is read from the environment only, and forced empty in a
 * production build so nothing leaks even if the vars are set on the build
 * machine.
 */
const demo = (value: string | undefined): string =>
  import.meta.env.PROD ? "" : (value ?? "");

export const env = {
  // Default to the same-origin path: the refresh token is an httpOnly cookie,
  // and same-origin keeps it first-party (dev goes through the Vite proxy,
  // staging through its reverse proxy).
  API_BASE_URL: import.meta.env.VITE_API_URL || "/api/v1",
  APP_ENV: import.meta.env.VITE_APP_ENV || "development",
  APP_NAME: import.meta.env.VITE_APP_NAME || "GreatSales PRO",
  /**
   * Error-tracking DSN. Public by design (a Sentry DSN is not a secret — it only
   * permits *sending* events), so VITE_-prefixed is correct. Empty → tracking
   * off (see lib/sentry.ts).
   */
  SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN || "",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,

  /** Dev-only login prefill. Empty string in production — see `demo` above. */
  DEMO_TENANT_ID: demo(import.meta.env.VITE_DEMO_TENANT_ID),
  DEMO_EMAIL: demo(import.meta.env.VITE_DEMO_EMAIL),
  DEMO_PASSWORD: demo(import.meta.env.VITE_DEMO_PASSWORD),
  /** The POC seed gives the administrator its own password; staff share one. */
  DEMO_PASSWORD_STAFF: demo(import.meta.env.VITE_DEMO_PASSWORD_STAFF),
} as const;

/** True when this build carries any prefill at all (dev convenience active). */
export const hasDemoPrefill = (): boolean =>
  !import.meta.env.PROD && env.DEMO_EMAIL !== "";
