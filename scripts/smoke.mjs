/**
 * End-to-end smoke check: log in once, then GET every feature's read endpoint.
 *
 * Answers one question fast — "is each feature actually wired to the API?" —
 * without a browser or a test framework. A row fails if the status is not 200,
 * so an unmounted controller, a broken guard or a 500 in a service shows up
 * immediately. It does NOT assert business logic; that is what the e2e specs
 * and a walk through the pages are for.
 *
 *   node scripts/smoke.mjs [--period YYYY-MM] [--url http://localhost:3001]
 */
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const BASE = (arg('url', process.env.SMOKE_API_URL ?? 'http://localhost:3001')).replace(/\/$/, '') + '/api/v1';
const PERIOD = arg('period', new Date().toISOString().slice(0, 7));
const TENANT = arg('tenant', process.env.SMOKE_TENANT ?? 'tenant_promech');
const EMAIL = arg('email', process.env.SMOKE_EMAIL ?? 'admin@greatsales.local');
const PASSWORD = arg('password', process.env.SMOKE_PASSWORD ?? 'admin');

/** feature key -> the read endpoint that page depends on. */
const CHECKS = [
  ['health', 'health'],
  ['health', 'health/ready'],
  ['auth', 'auth/me'],
  ['dashboard', `dashboard?period=${PERIOD}`],
  ['projections', `projections?period=${PERIOD}`],
  ['leads', 'leads?limit=1'],
  ['orders', 'orders?limit=1'],
  ['payments', 'payments?limit=1'],
  ['followups', 'followups?limit=1'],
  ['customers', 'customers?limit=1'],
  ['products', 'products?limit=1'],
  ['products', 'principals'],
  ['mappings', 'mappings?limit=1'],
  ['users', 'users?limit=1'],
  ['users', 'roles'],
  ['users', 'permissions'],
  ['users', 'teams'],
  ['data', 'period-locks'],
  ['customers', 'industries'],
  ['management', 'managements'],
  // Remarks are addressed by (entityType, entityId), so there is no "list all"
  // to probe. The customer id is read from the customers check above at run
  // time — a hardcoded id would rot the moment the seed changed.
];

/** Rows in a list response, wherever the payload happens to keep them. */
const count = (body) =>
  Array.isArray(body) ? body.length
  : Array.isArray(body?.items) ? body.items.length
  : Array.isArray(body?.data) ? body.data.length
  : '';

/**
 * A login failure here is nearly always one of two known setup states, and
 * both have a one-line fix. Name it rather than printing a stack, so the next
 * run of this script does not turn into another investigation.
 */
const diagnose = (err) => {
  const msg = String(err.message ?? err);
  if (/fetch failed|ECONNREFUSED/i.test(msg)) {
    return [
      `API not answering on ${BASE} — start it with: pnpm --filter api start:dev`,
      `  (if that exits with "Can't reach database server", bring Postgres up first: docker compose up -d)`,
    ].join('\n');
  }
  if (/^login 401/.test(msg)) {
    return [
      `Tenant "${TENANT}" has no login for ${EMAIL} — the dev DB holds a different dataset.`,
      '  Re-seed with: pnpm --filter @greatsales/db db:seed:promech',
      '  (the API e2e suites reseed the same Postgres, which is what wipes it)',
    ].join('\n');
  }
  return msg;
};

const login = async () => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, email: EMAIL, password: PASSWORD, tokenDelivery: 'body' }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  return (await res.json()).accessToken;
};

// `process.exitCode` rather than `process.exit()`: an abrupt exit while a
// socket is still open trips a libuv assertion on Windows, which buries the
// message this script exists to print.
const token = await login().catch((e) => {
  console.error(`LOGIN FAILED — ${diagnose(e)}`);
  process.exitCode = 1;
  return null;
});
let failed = 0;
for (const [feature, path] of token ? CHECKS : []) {
  let status = 0;
  let note = '';
  try {
    const res = await fetch(`${BASE}/${path}`, { headers: { authorization: `Bearer ${token}` } });
    status = res.status;
    const body = await res.json().catch(() => null);
    note = res.ok ? `${count(body)} rows` : String(body?.message ?? '').slice(0, 60);
  } catch (e) {
    note = e.message.slice(0, 60);
  }
  const ok = status === 200;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${status || '---'}  ${feature.padEnd(11)} ${path.padEnd(30)} ${note}`);
}

if (token) {
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} passed (tenant=${TENANT}, period=${PERIOD})`);
  if (failed) process.exitCode = 1;
}
