import { execSync } from 'node:child_process';

/**
 * Reseeds the TEST database, and refuses to touch anything else.
 *
 * Two things were wrong with calling `execSync('pnpm ... db:seed')` directly
 * from 24 spec files, and both have bitten:
 *
 * 1. THE SEED TRUNCATES EVERY TABLE, and it was pointed at whatever database
 *    the developer's `.env` happened to name — which is the DEV database. A
 *    single `pnpm --filter api test` therefore destroyed real seeded data. The
 *    guard below makes that structurally impossible: if the target database
 *    name does not end in `_test`, this throws before spawning anything.
 *
 * 2. TRUNCATE requires table ownership, and the API's own DATABASE_URL is the
 *    RLS-bound role `greatsales_app`, which does not have it. The spawned seed
 *    inherited that URL and only worked by accident of how Prisma resolves
 *    env files. This passes the OWNER url (DIRECT_URL) explicitly, so the seed
 *    no longer depends on undocumented dotenv precedence — the same class of
 *    fragility `load-env.ts` exists to avoid.
 *
 * The child gets ALLOW_DESTRUCTIVE_SEED so `seed-guard.ts` permits the
 * truncate; that override is only ever safe because of guard 1 above.
 */

/** Extracts the database name from a postgres connection URL. */
function databaseNameOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

export function reseedTestDatabase(): void {
  const ownerUrl = process.env.DIRECT_URL;
  const appUrl = process.env.DATABASE_URL;

  if (!ownerUrl) {
    throw new Error(
      'reseedTestDatabase: DIRECT_URL is not set. Tests seed as the table ' +
        'OWNER, because TRUNCATE requires ownership and DATABASE_URL is the ' +
        'RLS-bound role. Copy apps/api/.env.test.example to apps/api/.env.test.',
    );
  }

  const ownerDb = databaseNameOf(ownerUrl);
  const appDb = databaseNameOf(appUrl ?? '');

  // The guard. A seed run outside a *_test database is always a mistake, and
  // it is a destructive one — so refuse rather than warn.
  for (const [label, name] of [
    ['DIRECT_URL', ownerDb],
    ['DATABASE_URL', appDb],
  ] as const) {
    if (!name.endsWith('_test')) {
      throw new Error(
        `\nREFUSING TO SEED: ${label} points at database "${name}", which is ` +
          `not a test database.\n\n` +
          `The seed TRUNCATEs every table. Tests must run against a database ` +
          `whose name ends in "_test" so a test run can never destroy dev or ` +
          `production data.\n\n` +
          `Create one and point apps/api/.env.test at it:\n` +
          `  docker exec greatsales-postgres createdb -U greatsales greatsales_test\n` +
          `  cp apps/api/.env.test.example apps/api/.env.test\n`,
      );
    }
  }

  // Both URLs must address the SAME database, or the API under test would
  // read a different one than the fixtures were written to — which fails in a
  // confusing, intermittent way rather than an obvious one.
  if (ownerDb !== appDb) {
    throw new Error(
      `reseedTestDatabase: DATABASE_URL ("${appDb}") and DIRECT_URL ` +
        `("${ownerDb}") name different databases. Fixtures would be written ` +
        `to one and read from the other.`,
    );
  }

  execSync('pnpm --filter @greatsales/db db:seed', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: {
      ...process.env,
      // The seed must connect as the owner to TRUNCATE.
      DATABASE_URL: ownerUrl,
      ALLOW_DESTRUCTIVE_SEED: '1',
    },
  });
}
