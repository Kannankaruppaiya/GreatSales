import * as Sentry from '@sentry/node';

/**
 * Error tracking, gated on SENTRY_DSN.
 *
 * With no DSN — every dev machine, CI, and any deploy that has not been given
 * one — {@link initSentry} is a no-op and {@link reportException} does nothing,
 * so the feature is inert until an operator wires a real DSN. That is what makes
 * it safe to ship ahead of the Sentry account (go-live blocker O.1.10): the
 * code is in place, and turning it on is one environment variable.
 */
let enabled = false;

export function initSentry(dsn?: string, environment?: string): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: environment ?? 'development',
    // Off by default; opt into tracing by setting the sample rate explicitly.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0'),
  });
  enabled = true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

/** Report an unexpected error. Safe to call unconditionally — a no-op when off. */
export function reportException(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}
