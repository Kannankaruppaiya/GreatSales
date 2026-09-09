/**
 * Response contract check: does the API send the shape the clients are typed for?
 *
 * `check-wiring.mjs` proves a route exists and something calls it. `smoke.mjs`
 * proves it answers 200. Neither looks at what is IN the response, and that is
 * where the expensive class of bug lives: a field renamed on the server still
 * type-checks on the client, because the client's type is a hand-written
 * interface that nothing compares to the wire. It compiles, it returns 200, and
 * `row.outstanding` is `undefined` in production.
 *
 * This logs in once, GETs each list endpoint, and compares the keys of the
 * first row against the interface in `packages/shared` the clients infer their
 * types from.
 *
 *   MISSING  the type promises a field the server does not send. A real defect
 *            almost every time: some client reads it and gets undefined.
 *   EXTRA    the server sends a field the type does not declare. Usually
 *            harmless — a field added server-first — but it is how a type and
 *            an API drift apart, so it is reported quietly.
 *
 * Why not Schemathesis, which is the tool the ecosystem would reach for: it
 * needs a schema with response bodies in it, and this API has none. NestJS only
 * emits response schemas from `@ApiResponse({ type })` decorators and there are
 * zero of those in apps/api/src, so the generated OpenAPI document declares
 * every response as an untyped object. Fuzzing it would catch 500s and nothing
 * about fields. The TypeScript interfaces are the real contract here, so they
 * are what this checks. If `@ApiResponse` decorators are ever added, switch to
 * Schemathesis — it is strictly better once a spec says something.
 *
 * Needs the API running (see scripts/smoke.mjs for the same connection flags).
 *
 *   node scripts/check-contract.mjs
 *   node scripts/check-contract.mjs --json
 *   node scripts/check-contract.mjs --strict   # exit 1 on any MISSING field
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHARED = join(ROOT, 'packages/shared/src');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');

const BASE =
  (arg('url', process.env.SMOKE_API_URL ?? 'http://localhost:3001')).replace(/\/$/, '') +
  '/api/v1';
const TENANT = arg('tenant', process.env.SMOKE_TENANT ?? 'tenant_promech');
const EMAIL = arg('email', process.env.SMOKE_EMAIL ?? 'admin@greatsales.local');
const PASSWORD = arg('password', process.env.SMOKE_PASSWORD ?? 'admin');

/**
 * Endpoint -> the interface its rows are typed as.
 *
 * Written out rather than inferred. A guess from the URL would be wrong often
 * enough ("principals" -> `PrincipalRow`, but "period-locks" -> `PeriodLockRow`)
 * that the check would spend its credibility on its own naming heuristics.
 */
const CONTRACTS = [
  { path: 'customers?limit=1', type: 'CustomerRow' },
  { path: 'leads?limit=1', type: 'LeadRow' },
  { path: 'orders?limit=1', type: 'OrderRow' },
  { path: 'payments?limit=1', type: 'PaymentRow' },
  { path: 'followups?limit=1', type: 'FollowUpRow' },
  { path: 'products?limit=1', type: 'ProductRow' },
  { path: 'mappings?limit=1', type: 'MappingRow' },
  { path: 'users?limit=1', type: 'UserRow' },
  { path: 'principals', type: 'PrincipalRow' },
  { path: 'industries', type: 'IndustryRow' },
  { path: 'roles', type: 'RoleRow' },
  { path: 'teams', type: 'TeamRow' },
  { path: 'period-locks', type: 'PeriodLockRow' },
  { path: 'managements', type: 'ManagementRow' },
  { path: 'targets?period=2026-06', type: 'SalesTargetRow' },
];

// ---------------------------------------------------------------------------
// The declared shape: field names off the exported interface.
// ---------------------------------------------------------------------------
function readInterfaces() {
  const out = new Map();
  if (!existsSync(SHARED)) return out;
  for (const file of readdirSync(SHARED).filter((f) => f.endsWith('.ts'))) {
    const src = readFileSync(join(SHARED, file), 'utf8');
    const re = /export interface (\w+)\s*\{([\s\S]*?)^\}/gm;
    let m;
    while ((m = re.exec(src))) {
      const [, name, body] = m;
      const fields = [];
      let depth = 0;
      for (const rawLine of body.split('\n')) {
        // Strip comments so a `//` mentioning a field name is not read as one.
        const line = rawLine.replace(/\/\/.*$/, '').trim();
        if (!line || line.startsWith('*') || line.startsWith('/*')) continue;
        // Only top-level members count; a nested object literal's keys are not
        // fields of this interface.
        if (depth === 0) {
          const f = line.match(/^(\w+)\??\s*:/);
          if (f) fields.push({ name: f[1], optional: /^\w+\?/.test(line) });
        }
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
      }
      out.set(name, { fields, file });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
async function login() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tenantId: TENANT,
      email: EMAIL,
      password: PASSWORD,
      tokenDelivery: 'body',
      client: 'web',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `login failed (${res.status}). Is the API up on ${BASE}, and is the ` +
        `Promech dataset seeded? ${body.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  return json.accessToken;
}

/** The first row of whatever shape the endpoint returns. */
function firstRow(payload) {
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (payload && Array.isArray(payload.items)) return payload.items[0] ?? null;
  if (payload && Array.isArray(payload.data)) return payload.data[0] ?? null;
  return payload && typeof payload === 'object' ? payload : null;
}

const interfaces = readInterfaces();
const results = [];

let token;
try {
  token = await login();
} catch (err) {
  console.error(`\n  ${err.message}\n`);
  process.exit(2);
}

for (const { path, type } of CONTRACTS) {
  const declared = interfaces.get(type);
  if (!declared) {
    results.push({ path, type, status: 'no-type', missing: [], extra: [] });
    continue;
  }

  let row = null;
  let status = 'ok';
  try {
    const res = await fetch(`${BASE}/${path}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      results.push({ path, type, status: `http-${res.status}`, missing: [], extra: [] });
      continue;
    }
    row = firstRow(await res.json());
  } catch {
    results.push({ path, type, status: 'unreachable', missing: [], extra: [] });
    continue;
  }

  if (!row) {
    // No rows is not a contract failure — it is an empty table. Say so rather
    // than reporting every field as missing, which is how a check like this
    // becomes noise nobody reads.
    results.push({ path, type, status: 'no-rows', missing: [], extra: [] });
    continue;
  }

  const actual = new Set(Object.keys(row));
  // An optional field that is absent is the type working as written.
  const missing = declared.fields.filter((f) => !f.optional && !actual.has(f.name)).map((f) => f.name);
  const declaredNames = new Set(declared.fields.map((f) => f.name));
  const extra = [...actual].filter((k) => !declaredNames.has(k));
  if (missing.length) status = 'drift';

  results.push({ path, type, status, fields: declared.fields.length, missing, extra });
}

const drifted = results.filter((r) => r.status === 'drift');
const broken = results.filter((r) => r.status.startsWith('http-') || r.status === 'unreachable');

if (asJson) {
  console.log(
    JSON.stringify(
      {
        results,
        summary: {
          checked: results.length,
          // Compared against a real row. An endpoint with no rows was not
          // checked at all, and counting it as a pass would be a lie the
          // aggregate report then repeats.
          matched: results.filter((r) => r.status === 'ok').length,
          noRows: results.filter((r) => r.status === 'no-rows').map((r) => r.path),
          drift: drifted.map((r) => ({ path: r.path, type: r.type, missing: r.missing })),
          unreachable: broken.map((r) => r.path),
        },
      },
      null,
      2,
    ),
  );
} else {
  console.log('\nGreatSales — response contract\n');
  const w = Math.max(...CONTRACTS.map((c) => c.path.length)) + 2;
  for (const r of results) {
    const mark = r.status === 'ok' ? '[x]' : r.status === 'drift' ? '[!]' : '[ ]';
    const note =
      r.status === 'ok'
        ? `${r.type} — ${r.fields} field(s) all present`
        : r.status === 'drift'
          ? `${r.type} — MISSING ${r.missing.join(', ')}`
          : r.status === 'no-rows'
            ? `${r.type} — no rows to compare`
            : r.status === 'no-type'
              ? `${r.type} — interface not found in packages/shared`
              : `${r.type} — ${r.status}`;
    console.log(`  ${mark} ${r.path.padEnd(w)} ${note}`);
  }

  const extras = results.filter((r) => r.extra?.length);
  if (extras.length) {
    console.log('\n  Sent but not declared (drift the other way, usually harmless):');
    for (const r of extras) console.log(`    ${r.type}: ${r.extra.join(', ')}`);
  }

  console.log(
    `\n  ${results.filter((r) => r.status === 'ok').length}/${results.length} endpoints match their declared type` +
      (drifted.length ? `, ${drifted.length} with missing fields` : ''),
  );
  console.log();
}

if (strict && (drifted.length || broken.length)) process.exit(1);
