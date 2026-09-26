/**
 * Crash reporting for the app — the mobile half of
 * `apps/api/src/observability.ts`, and deliberately shaped like it.
 *
 * Until this existed the API reported its errors and the app reported nothing,
 * so a crash on a salesperson's phone in a factory yard was invisible: the only
 * signal was somebody phoning to say the app "won't open". That is not
 * hypothetical — the first release build crashed on launch and the cause had to
 * be guessed at, because there was no stack trace anywhere.
 *
 * Importing this module initialises Sentry as a side effect. It has to run
 * before anything else in the app so that an error thrown while the first
 * screen is still mounting is caught, which is why the root layout imports it
 * on its first line rather than calling a function later.
 *
 * With no DSN every part of this is inert, which is what keeps development and
 * CI quiet and means a build does not depend on a Sentry project existing.
 */
import * as Sentry from "@sentry/react-native";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  // An unset DSN already disables the SDK, but being explicit means a typo in
  // the env var name fails loudly in review rather than silently shipping an
  // app that reports nothing.
  enabled: Boolean(dsn),
  environment: process.env.EXPO_PUBLIC_ENV ?? "development",
  // Traces are sampled, crashes are not: a dropped crash is a defect nobody
  // hears about, while a dropped span costs only detail.
  tracesSampleRate: 0.1,
  // These phones hold customer lists, outstanding amounts and the salesperson's
  // own credentials. None of that belongs in a third-party error tracker, and
  // the API made the same call.
  sendDefaultPii: false,
});

/**
 * Report a handled error — one that was caught and dealt with, but still
 * indicates a defect. Uncaught errors and native crashes are captured without
 * this. Silent when Sentry is not configured.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export { Sentry };
