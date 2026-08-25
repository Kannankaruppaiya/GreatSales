/**
 * MUST be imported before anything that touches @prisma/client.
 *
 * Prisma Client auto-loads the schema's env file (packages/db/.env) at require
 * time, and that file intentionally carries the SUPERUSER DATABASE_URL for
 * migrations/seed. Because dotenv never overrides an already-set variable, if
 * Prisma loads first the superuser URL wins and the API silently connects with
 * RLS bypassed. Loading this app's own .env with override:true first makes
 * apps/api/.env (the greatsales_app role) authoritative.
 */
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Under jest, NODE_ENV is "test" and the suites RESEED — every table is
 * truncated. Pointing that at the developer's dev database destroys real data,
 * which is exactly what happened once. So a test run looks for `.env.test`
 * FIRST and only falls back to `.env` if there is none; `reseedTestDatabase()`
 * then refuses outright unless the resolved database name ends in `_test`.
 */
const isTest = process.env.NODE_ENV === 'test';

const testCandidates = [
  resolve(process.cwd(), '.env.test'),
  resolve(process.cwd(), 'apps/api/.env.test'),
  resolve(__dirname, '../.env.test'),
  resolve(__dirname, '../../apps/api/.env.test'),
];

const devCandidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), 'apps/api/.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../apps/api/.env'),
];

const candidates = isTest
  ? [...testCandidates, ...devCandidates]
  : devCandidates;

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalDirectUrl = process.env.DIRECT_URL;
const originalNodeEnv = process.env.NODE_ENV;
const originalPort = process.env.PORT;

for (const path of candidates) {
  if (existsSync(path)) {
    dotenv.config({ path, override: true });
    break;
  }
}

// Ensure explicit container/host environment variables take precedence
if (originalDatabaseUrl) {
  process.env.DATABASE_URL = originalDatabaseUrl;
}
if (originalDirectUrl) {
  process.env.DIRECT_URL = originalDirectUrl;
}
if (originalNodeEnv) {
  process.env.NODE_ENV = originalNodeEnv;
}
// A PORT supplied by the host/container (or a one-off `PORT=3001 nest start`)
// must beat the checked-in dev default, same as the URLs above — otherwise the
// process silently ignores where it was told to listen.
if (originalPort) {
  process.env.PORT = originalPort;
}
