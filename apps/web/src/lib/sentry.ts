import * as Sentry from "@sentry/react";
import { env } from "@/lib/config";

/**
 * Browser error tracking, gated on VITE_SENTRY_DSN.
 *
 * Empty DSN — every dev build and any deploy without one — makes {@link
 * initSentry} a no-op and {@link reportException} silent, so the feature ships
 * inert and turns on with one build-time variable (go-live blocker O.1.10).
 */
let enabled = false;

export function initSentry(): void {
  if (!env.SENTRY_DSN) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    // Off by default; opt into tracing later by raising this.
    tracesSampleRate: 0,
  });
  enabled = true;
}

/** Report an error to tracking. Safe to call unconditionally — no-op when off. */
export function reportException(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}
