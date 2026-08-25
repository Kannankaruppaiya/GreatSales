import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Loads a real-data seed file.
 *
 * `promech-data.json` and `poc-v6-data.json` are NOT in git. They hold a real
 * company's records — 417 customers, 141 payments, and named contacts with
 * mobile numbers, extracted verbatim — and committing tenant data is exactly
 * what checklists/07-SECURITY.md G.3.9 forbids. They are listed in
 * .gitignore, so a fresh clone will not have them.
 *
 * The consequence is deliberate: `db:seed:promech` and `db:seed:poc` only work
 * on a machine that has been given the data out of band. The ordinary
 * `db:seed` uses synthetic fixtures and always works, which is what tests and
 * CI use.
 *
 * Without this helper the failure is a bare ENOENT from readFileSync, which
 * reads like a broken script rather than a deliberate policy.
 */
export function loadDataset<T>(fileName: string, dirName: string): T {
  const file = path.join(dirName, fileName);

  if (!existsSync(file)) {
    throw new Error(
      `\nSeed dataset not found: ${file}\n\n` +
        `This file is intentionally NOT committed — it contains real customer\n` +
        `records (names, contacts, mobile numbers, payments), and committing\n` +
        `tenant data is forbidden by checklists/07-SECURITY.md G.3.9.\n\n` +
        `To use this seed, obtain the file out of band and place it at:\n` +
        `  ${file}\n\n` +
        `If you only need a working database, use the synthetic seed instead:\n` +
        `  pnpm --filter @greatsales/db db:seed\n`,
    );
  }

  return JSON.parse(readFileSync(file, 'utf8')) as T;
}
