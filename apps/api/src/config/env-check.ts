/**
 * Validates an environment file against the API's contract WITHOUT booting the
 * app or touching a database.
 *
 * The point is to catch a bad production configuration BEFORE it reaches a
 * deploy, and to make the same check runnable in CI. Boot-time validation
 * already fails fast, but "fails fast" in production still means a task that
 * crash-loops in front of real users.
 *
 * Usage:
 *   pnpm --filter api env:check                          # checks apps/api/.env
 *   pnpm --filter api env:check ../../.env.staging.example
 *   pnpm --filter api env:check ../../.env.production.example --as production
 *
 * `--as <env>` overrides NODE_ENV for the check only, so a production template
 * can be validated against the production rules from a laptop.
 *
 * This script NEVER prints a value. Only key names and rule violations are
 * shown, so its output is safe to paste into a ticket or a CI log.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { envSchema } from './env';

/** Keys whose mere presence should be reported, never their contents. */
const SECRET_HINT = /SECRET|PASSWORD|TOKEN|DSN|DATABASE_URL|DIRECT_URL|REDIS/i;

function main(): number {
  const args = process.argv.slice(2);
  const asIndex = args.indexOf('--as');
  const overrideEnv = asIndex >= 0 ? args[asIndex + 1] : undefined;
  const fileArg = args.find((a) => !a.startsWith('--') && a !== overrideEnv);

  const path = resolve(process.cwd(), fileArg ?? '.env');
  if (!existsSync(path)) {
    console.error(`env:check — no such file: ${path}`);
    console.error(
      'Pass a path, or copy .env.example to .env first. Nothing was checked.',
    );
    return 1;
  }

  // dotenv.parse returns a plain object and does NOT mutate process.env, so
  // checking a production template cannot contaminate this shell.
  const parsed = dotenv.parse(readFileSync(path));
  const candidate: Record<string, unknown> = { ...parsed };
  if (overrideEnv) candidate.NODE_ENV = overrideEnv;

  // `candidate` is Record<string, unknown>, so NODE_ENV must be narrowed
  // rather than stringified — String() on an unknown can print
  // "[object Object]" and would make this banner lie about what was checked.
  const rawNodeEnv = candidate.NODE_ENV;
  const targetEnv = typeof rawNodeEnv === 'string' ? rawNodeEnv : 'development';
  console.log(`env:check  file=${path}`);
  console.log(`env:check  validating as NODE_ENV=${targetEnv}`);

  const result = envSchema.safeParse(candidate);

  if (result.success) {
    const declared = Object.keys(parsed).sort();
    console.log(`env:check  ${declared.length} variables declared:`);
    for (const key of declared) {
      const shown = SECRET_HINT.test(key) ? '<set, not shown>' : parsed[key];
      console.log(`             ${key} = ${shown}`);
    }
    console.log(`\nenv:check  PASS — valid for NODE_ENV=${targetEnv}`);
    return 0;
  }

  console.error(
    `\nenv:check  FAIL — ${result.error.issues.length} problem(s):\n`,
  );
  for (const issue of result.error.issues) {
    const where = issue.path.length ? issue.path.join('.') : '(root)';
    console.error(`  ${where}: ${issue.message}`);
  }
  console.error(
    '\nThe contract is apps/api/src/config/env.ts. Production rules only apply ' +
      'when NODE_ENV=production — re-run with `--as production` to test a ' +
      'production template from a development machine.',
  );
  return 1;
}

process.exit(main());
