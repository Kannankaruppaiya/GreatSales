/**
 * Bring the TEST database's schema up to date before the API suite runs.
 *
 * There are two databases on the dev machine — `greatsales` and
 * `greatsales_test` — and `pnpm --filter @greatsales/db db:deploy` only ever
 * touches the first one, because that is what packages/db/.env names. So a
 * migration could be written, applied, verified by hand against the dev
 * database, and the test suite would still fail on the change, reporting
 * something like:
 *
 *   The column `Notification.entityType` does not exist in the current database.
 *
 * which reads like a code fault and is not one. The seed reruns before every
 * suite and rewrites the ROWS; nothing was rerunning the MIGRATIONS. This runs
 * them, so the two databases cannot drift apart again.
 *
 * Wired into `apps/api`'s `test` script, before jest, rather than into the
 * per-suite reseed helper: pending migrations are a property of the database,
 * not of a suite, and spawning Prisma thirty-four times to learn there is
 * nothing to do would cost more than the problem.
 *
 *   node scripts/migrate-test-db.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ENV_TEST = join(ROOT, 'apps/api/.env.test');

if (!existsSync(ENV_TEST)) {
  console.error(
    `\n  apps/api/.env.test is missing, so there is no test database to ` +
      `migrate.\n  Copy apps/api/.env.test.example to apps/api/.env.test.\n`,
  );
  process.exit(1);
}

/** Minimal .env reader — enough for KEY="value" and KEY=value. */
function readEnv(file) {
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnv(ENV_TEST);
// Migrations run as the OWNER. DATABASE_URL there is the RLS-bound
// `greatsales_app` role, which cannot alter a table it does not own.
const owner = env.DIRECT_URL;

if (!owner) {
  console.error('\n  apps/api/.env.test has no DIRECT_URL to migrate.\n');
  process.exit(1);
}

const name = (() => {
  try {
    return new URL(owner).pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();

// The same guard the reseed helper carries, for the same reason: `migrate
// deploy` against the dev database from a command called "test" would be a
// silent, destructive surprise.
if (!name.endsWith('_test')) {
  console.error(
    `\n  REFUSING TO MIGRATE: DIRECT_URL in apps/api/.env.test names "${name}", ` +
      `which is not a test database.\n`,
  );
  process.exit(1);
}

try {
  // Prisma's own entry point, run by node directly. Spawning `npx` would work
  // on a shell and not from execFile on Windows, where npx is a .cmd — and the
  // failure there is an ENOENT with no output, which reads as "the migration
  // failed" rather than "the command was never found".
  const prismaBin = join(ROOT, 'node_modules/prisma/build/index.js');
  execFileSync(
    process.execPath,
    [prismaBin, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
    {
      cwd: join(ROOT, 'packages/db'),
      stdio: 'pipe',
      // Both point at the owner: `migrate deploy` reads DATABASE_URL for the
      // connection and DIRECT_URL for the shadow-free deploy path, and the
      // .env in packages/db would otherwise win and migrate the DEV database.
      env: { ...process.env, DATABASE_URL: owner, DIRECT_URL: owner },
    },
  );
  console.log(`test database "${name}" is up to date`);
} catch (err) {
  const e = err;
  console.error(
    `\n  Could not migrate the test database "${name}".\n\n` +
      `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}\n`,
  );
  process.exit(1);
}
