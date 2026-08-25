/**
 * Destructive-seed guard.
 *
 * Both seed scripts TRUNCATE every table before inserting. That is correct for a
 * dev or test database and catastrophic anywhere else, so the truncate path must
 * be unreachable unless the environment explicitly permits it (AGENTS.md §8).
 *
 * A seed is allowed only when BOTH hold:
 *   1. NODE_ENV is `development`, `test`, or unset (bare `tsx prisma/seed.ts`).
 *   2. The target database is not flagged as protected.
 *
 * `ALLOW_DESTRUCTIVE_SEED=1` is the single, deliberate override — used by CI
 * against a throwaway database. It is intentionally not documented in
 * .env.example so it cannot be set by accident.
 */

/** Hosts that are never acceptable seed targets, whatever NODE_ENV claims. */
const PROTECTED_HOST_PATTERNS = [
  /\.rds\.amazonaws\.com/i,
  /\.supabase\.co/i,
  /\.neon\.tech/i,
  /\.render\.com/i,
  /\.azure\.com/i,
  /\.googleapis\.com/i,
];

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    // An unparseable URL is not provably local, so treat it as remote.
    return url;
  }
}

function isLocalHost(host: string): boolean {
  const name = host.split(':')[0]?.toLowerCase() ?? '';
  return (
    name === 'localhost' ||
    name === '127.0.0.1' ||
    name === '::1' ||
    name === 'postgres' || // docker-compose service name
    name === 'db'
  );
}

/**
 * Throws unless this process is allowed to wipe and reseed the target database.
 * Call this before the first TRUNCATE, not after.
 */
export function assertDestructiveSeedAllowed(): void {
  const override = process.env.ALLOW_DESTRUCTIVE_SEED === '1';
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '';

  if (!url) {
    throw new Error(
      'Seed refused: neither DIRECT_URL nor DATABASE_URL is set, so the target database cannot be verified.',
    );
  }

  const host = hostOf(url);

  const protectedHost = PROTECTED_HOST_PATTERNS.find((re) => re.test(host));
  if (protectedHost && !override) {
    throw new Error(
      `Seed refused: "${host}" looks like a managed/production database. ` +
        'This script TRUNCATEs every table. If this is genuinely a throwaway database, ' +
        'set ALLOW_DESTRUCTIVE_SEED=1.',
    );
  }

  if (nodeEnv !== 'development' && nodeEnv !== 'test' && !override) {
    throw new Error(
      `Seed refused: NODE_ENV="${nodeEnv}". Seeding TRUNCATEs every table and is permitted ` +
        'only in development or test. Set ALLOW_DESTRUCTIVE_SEED=1 to override deliberately.',
    );
  }

  if (!isLocalHost(host) && !override) {
    throw new Error(
      `Seed refused: database host "${host}" is not local. This script TRUNCATEs every table. ` +
        'Set ALLOW_DESTRUCTIVE_SEED=1 only if you are certain this database is disposable.',
    );
  }
}
