#!/usr/bin/env node
/**
 * Backup restore drill.
 *
 * Takes the newest pg_dump that is actually in S3, restores it into a
 * throwaway database on the production box, and compares row counts table by
 * table against the live database. An untested backup is not a backup — the
 * first time this ran it found that the nightly job had never produced a
 * single object, because the generated backup.sh had a syntax error and was
 * dumping the database into the systemd journal instead.
 *
 * The dump travels in over SSM rather than being pulled by the box: the
 * instance role can write to the backups bucket and not read it, which is the
 * right default for a box that faces the internet.
 *
 *   pnpm backup:drill
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BUCKET = process.env.GS_BACKUP_BUCKET ?? 'greatsales-backups-887793660359-aps1';
const REGION = process.env.AWS_REGION ?? 'ap-south-1';

const aws = (args) =>
  execFileSync('aws', [...args, '--region', REGION, '--output', 'json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

const listed = JSON.parse(
  aws(['s3api', 'list-objects-v2', '--bucket', BUCKET, '--query', 'sort_by(Contents,&LastModified)[-1]']),
);
if (!listed || !listed.Key) {
  console.error(`No backup objects in ${BUCKET}. The nightly timer has never produced one.`);
  process.exit(1);
}
console.log(`newest backup: ${listed.Key} (${listed.Size} bytes, ${listed.LastModified})`);

const dir = mkdtempSync(join(tmpdir(), 'gs-drill-'));
const local = join(dir, 'dump.sql.gz');
aws(['s3api', 'get-object', '--bucket', BUCKET, '--key', listed.Key, local]);

// SSM caps a command's parameters near 100KB, so base64 of the gzip has to fit.
const b64 = readFileSync(local).toString('base64');
if (b64.length > 90_000) {
  console.error(
    `Backup is ${(b64.length / 1024).toFixed(0)}KB base64-encoded, past what SSM will carry.\n` +
      `Grant the instance role s3:GetObject on this bucket and have the box pull it directly.`,
  );
  process.exit(1);
}

const counts = 'SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_live_tup > 0 ORDER BY relname;';
const script = `
set -euo pipefail
cd /opt/greatsales
echo "${b64}" | base64 -d > /tmp/drill.sql.gz
echo "shipped \$(wc -c < /tmp/drill.sql.gz) bytes, sha256 \$(sha256sum /tmp/drill.sql.gz | cut -c1-16)"
docker compose exec -T postgres psql -U greatsales -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS restore_drill;' -c 'CREATE DATABASE restore_drill;'
gunzip -c /tmp/drill.sql.gz | docker compose exec -T postgres psql -U greatsales -d restore_drill -q > /tmp/drill.log 2>&1 || true
echo "restore errors: \$(grep -ci 'ERROR' /tmp/drill.log || true)"
grep -i 'ERROR' /tmp/drill.log | head -5 || true
echo "--- LIVE ---"
docker compose exec -T postgres psql -U greatsales -d greatsales -At -F' ' -c 'ANALYZE;' -c "${counts}"
echo "--- RESTORED ---"
docker compose exec -T postgres psql -U greatsales -d restore_drill -At -F' ' -c 'ANALYZE;' -c "${counts}"
docker compose exec -T postgres psql -U greatsales -d postgres -c 'DROP DATABASE restore_drill;' > /dev/null
rm -f /tmp/drill.sql.gz /tmp/drill.log
echo "throwaway database dropped"
`;

const out = execFileSync(process.execPath, [join(import.meta.dirname, 'box.mjs'), '-'], {
  input: script,
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'inherit'],
  maxBuffer: 32 * 1024 * 1024,
});
console.log(out);

// The drill only means something if the two sides agree.
const section = (name) => {
  const body = out.split(`--- ${name} ---`)[1] ?? '';
  const rows = body.split('\n').slice(1);
  const map = new Map();
  for (const r of rows) {
    const m = r.trim().match(/^(\S+) (\d+)$/);
    if (m) map.set(m[1], Number(m[2]));
    else if (r.trim().startsWith('---') || r.trim() === '') break;
  }
  return map;
};
const live = section('LIVE');
const restored = section('RESTORED');
const tables = [...new Set([...live.keys(), ...restored.keys()])].sort();
const bad = tables.filter((t) => live.get(t) !== restored.get(t));

if (live.size === 0) {
  console.error('DRILL INCONCLUSIVE: no row counts came back from the live database.');
  process.exit(1);
}
if (bad.length) {
  console.error('DRILL FAILED — these tables differ (live vs restored):');
  for (const t of bad) console.error(`  ${t.padEnd(22)} ${live.get(t) ?? 0} vs ${restored.get(t) ?? 0}`);
  process.exit(1);
}
console.log(`DRILL PASSED — ${tables.length} tables, identical row counts in the restored copy.`);
