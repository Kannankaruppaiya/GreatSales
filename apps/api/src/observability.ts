/**
 * Error reporting.
 *
 * SENTRY_DSN has been in the env contract since August but nothing read it, so
 * a production crash was visible only to whoever happened to run `docker logs`
 * — in practice, nobody, until a user phoned. This wires the declared variable
 * to something that actually reports.
 *
 * With no DSN set every function here is a no-op, which is what keeps
 * development and CI quiet and means the deploy does not block on somebody
 * creating a Sentry project first.
 */
import * as Sentry from '@sentry/node';

let enabled = false;

export function initObservability(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    // Traces are sampled, errors are not: a dropped error is a bug nobody
    // hears about, while a dropped span costs only detail.
    tracesSampleRate: 0.1,
    // Bodies can carry a password on the login route and customer data
    // everywhere else. Neither belongs in a third-party error tracker.
    sendDefaultPii: false,
  });
  enabled = true;
}

/** Report an unexpected error. Silent when Sentry is not configured. */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
