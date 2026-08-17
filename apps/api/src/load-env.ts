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
import { resolve } from 'node:path';

dotenv.config({ path: resolve(process.cwd(), '.env'), override: true });
