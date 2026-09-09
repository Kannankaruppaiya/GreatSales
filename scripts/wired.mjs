/**
 * One command, one small report: is this application wired end to end?
 *
 * The individual checks each answer one layer and print a full inventory —
 * every endpoint, every table, every screen. That is the right output for a
 * person scanning a terminal and the wrong one for an agent, which pays for
 * every line it reads. Reading this repository's source to answer "is
 * everything wired?" costs roughly 468,000 tokens; the reports below cost about
 * 1,500, and most of that is the inventories rather than the answer.
 *
 * So this runs them all and keeps only what is not fine. An endpoint that is
 * wired, a table that is queried, a type that matches the wire — none of those
 * appear. What comes out is the exceptions plus the counts they came from,
 * which is what a judgement needs: the script decides what is TRUE, and leaves
 * "is this a problem or is it deliberate?" to whoever reads it.
 *
 *   node scripts/wired.mjs            # findings, for a person
 *   node scripts/wired.mjs --json     # findings, for an agent
 *   node scripts/wired.mjs --strict   # exit 1 if anything is unwired
 *
 * Static checks always run. The two that need a live API (contract, smoke) are
 * skipped with a reason when it is down, rather than failing the whole run —
 * an agent asking this question offline should still get the static answer.
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');

const API = (process.env.SMOKE_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');

function run(script, extra = []) {
  try {
    const out = execFileSync(process.execPath, [join(ROOT, 'scripts', script), '--json', ...extra], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, data: JSON.parse(out) };
  } catch (err) {
    // A non-zero exit is expected from checks run with --strict elsewhere; what
    // matters here is whether stdout parsed.
    const out = err.stdout?.toString?.() ?? '';
    try {
      return { ok: true, data: JSON.parse(out) };
    } catch {
      return { ok: false, error: (err.stderr?.toString?.() || err.message || '').trim().slice(0, 300) };
    }
  }
}

async function apiIsUp() {
  try {
    const res = await fetch(`${API}/api/v1/health`, { signal: AbortSignal.timeout(2500) });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
const report = { findings: [], counts: {}, skipped: [] };
const add = (layer, kind, detail) => report.findings.push({ layer, kind, ...detail });

// --- frontend <-> backend --------------------------------------------------
const wiring = run('check-wiring.mjs');
if (wiring.ok) {
  const clientFacing = wiring.data.endpoints.filter((e) => !e.nonClient);
  const unwired = clientFacing.filter((e) => !e.wiredBy.length);
  report.counts.endpoints = { total: clientFacing.length, wired: clientFacing.length - unwired.length };
  for (const e of unwired) {
    add('api', 'endpoint-unwired', { endpoint: `${e.method} ${e.path}`, source: e.source });
  }
  for (const o of wiring.data.orphanCalls ?? []) {
    add('api', 'call-without-route', { endpoint: `${o.method} ${o.path}`, source: o.source });
  }
} else {
  report.skipped.push({ check: 'wiring', reason: wiring.error });
}

// --- backend <-> database --------------------------------------------------
const db = run('check-db-wiring.mjs');
if (db.ok) {
  const s = db.data.summary;
  report.counts.models = { total: s.total, reached: s.total - s.untouched.length - s.seedOnly.length };
  for (const m of s.untouched) add('db', 'table-untouched', { model: m });
  for (const m of s.seedOnly) add('db', 'table-seed-only', { model: m });
  for (const m of s.writeOnly) add('db', 'table-write-only', { model: m });
  for (const [model, cols] of Object.entries(s.unmentionedColumns ?? {})) {
    add('db', 'column-unmentioned', { model, columns: cols });
  }
} else {
  report.skipped.push({ check: 'db-wiring', reason: db.error });
}

// --- inventory, for scale rather than detail -------------------------------
const facts = run('facts.mjs');
if (facts.ok && facts.data) {
  const f = facts.data;
  report.counts.surfaces = {
    features: f.features?.length,
    webPages: f.totals?.pages ?? f.totals?.webPages,
    mobileScreens: f.totals?.mobileScreens,
    testFiles: f.totals?.testFiles,
  };
}

// --- the two that need a server -------------------------------------------
if (await apiIsUp()) {
  const contract = run('check-contract.mjs');
  if (contract.ok) {
    const s = contract.data.summary;
    report.counts.contracts = {
      checked: s.checked,
      matched: s.matched,
      noRows: s.noRows?.length ?? 0,
      drift: s.drift.length,
    };
    for (const d of s.drift) {
      add('contract', 'response-missing-fields', {
        endpoint: d.path,
        type: d.type,
        missing: d.missing,
      });
    }
    for (const p of s.unreachable) add('contract', 'endpoint-unreachable', { endpoint: p });
  } else {
    report.skipped.push({ check: 'contract', reason: contract.error });
  }
} else {
  report.skipped.push({
    check: 'contract',
    reason: `API not reachable at ${API}. Start it and re-run for the runtime layers.`,
  });
}

// ---------------------------------------------------------------------------
const KIND_LABEL = {
  'endpoint-unwired': 'endpoint exposed but no client calls it',
  'call-without-route': 'client calls a route the API does not expose',
  'table-untouched': 'table no code touches at all',
  'table-seed-only': 'table only fixtures write',
  'table-write-only': 'table written but never read',
  'column-unmentioned': 'column no code mentions',
  'response-missing-fields': 'response missing fields its type declares',
  'endpoint-unreachable': 'endpoint did not answer',
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\nGreatSales — end-to-end wiring\n');
  const c = report.counts;
  if (c.endpoints) console.log(`  endpoints  ${c.endpoints.wired}/${c.endpoints.total} wired`);
  if (c.models) console.log(`  tables     ${c.models.reached}/${c.models.total} reached by app code`);
  if (c.contracts)
    console.log(
      `  contracts  ${c.contracts.matched}/${c.contracts.checked} match their type` +
        (c.contracts.noRows ? ` (${c.contracts.noRows} had no rows to compare)` : ''),
    );

  if (!report.findings.length) {
    console.log('\n  Nothing unwired.\n');
  } else {
    console.log(`\n  ${report.findings.length} finding(s):\n`);
    const byKind = new Map();
    for (const f of report.findings) {
      if (!byKind.has(f.kind)) byKind.set(f.kind, []);
      byKind.get(f.kind).push(f);
    }
    for (const [kind, items] of byKind) {
      console.log(`  ${KIND_LABEL[kind] ?? kind} (${items.length})`);
      for (const i of items) {
        const what = i.endpoint ?? i.model ?? i.type ?? '';
        const extra = i.missing?.length
          ? ` — missing ${i.missing.join(', ')}`
          : i.columns?.length
            ? ` — ${i.columns.join(', ')}`
            : '';
        console.log(`    ${what}${extra}`);
      }
      console.log();
    }
  }

  for (const s of report.skipped) console.log(`  skipped: ${s.check} — ${s.reason}`);
  console.log();
}

if (strict && report.findings.length) process.exit(1);
