import { validateEnv } from './env';

/**
 * The production deploy failed to boot because SENTRY_DSN arrived as "" —
 * docker compose renders an unset variable as an empty string, and `""` is not
 * a valid URL. These two cases are the contract that stops it recurring.
 */
describe('validateEnv — optional URL variables', () => {
  const base = {
    DATABASE_URL: 'postgresql://app:pw@db:5432/gs?schema=public',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('treats an empty SENTRY_DSN as "not configured"', () => {
    const env = validateEnv({ ...base, SENTRY_DSN: '' });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('still rejects a SENTRY_DSN that is set but malformed', () => {
    expect(() => validateEnv({ ...base, SENTRY_DSN: 'not-a-url' })).toThrow(
      /SENTRY_DSN/,
    );
  });

  it('keeps a real SENTRY_DSN', () => {
    const dsn = 'https://abc123@o1.ingest.sentry.io/42';
    expect(validateEnv({ ...base, SENTRY_DSN: dsn }).SENTRY_DSN).toBe(dsn);
  });
});
