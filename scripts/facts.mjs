#!/usr/bin/env node
/**
 * What this application is, right now, derived from the code.
 *
 * Every number here is computed on each run — the feature registry, the router,
 * the controllers, the mobile screens, the tests. Nothing is hand-maintained,
 * so it cannot drift the way a checklist document does. Answer questions like
 * "how many pages are there" or "is payments wired end to end" from this
 * instead of reading the repository again.
 *
 *   node scripts/facts.mjs          # feature matrix + environment
 *   node scripts/facts.mjs --json   # machine-readable
 *   node scripts/facts.mjs --short  # one screen
 *   node scripts/facts.mjs --parity # what a salesperson can do on web but not in the sales app
 *   node scripts/facts.mjs --hook   # same, as SessionStart hook JSON
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const short = args.has('--short');
/** SessionStart hook form: the same one-screen summary, wrapped so the harness injects it as context. */
const asHook = args.has('--hook');
/** Per-feature web/mobile capability diff — what a phone still cannot do. */
const parity = args.has('--parity');

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '');
const walk = (dir, test, out = []) => {
  const full = join(ROOT, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const p = join(dir, entry).split(sep).join('/'); // posix-style so key matching works on Windows too
    if (statSync(join(ROOT, p)).isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
};

// --- features: the registry is the single declaration of a navigable surface -
const registry = read('apps/web/src/data/features.ts');
const features = [...registry.matchAll(/key:\s*"([^"]+)"[\s\S]*?roles:\s*(ALL_ROLES|\[[^\]]*\])/g)].map(
  ([, key, roles]) => ({
    key,
    roles:
      roles === 'ALL_ROLES'
        ? ['super_admin', 'admin', 'mgmt', 'sales']
        : [...roles.matchAll(/"([^"]+)"/g)].map((m) => m[1]),
  }),
);

// --- routes ------------------------------------------------------------------
const appTsx = read('apps/web/src/App.tsx');
const routePaths = [...appTsx.matchAll(/<Route\s+[^>]*path=\{?["']([^"']+)["']/g)].map((m) => m[1]);
const redirects = [...appTsx.matchAll(/<Route[^>]*path="([^"]+)"[^>]*element=\{<Navigate/g)].length;
const webPages = walk('apps/web/src', (f) => f.endsWith('Page.tsx'));
// The salesperson's app. Its routes are files under src/app (expo-router).
const mobileScreens = walk('apps/mobilev2/src/app', (f) => f.endsWith('.tsx') && !f.endsWith('_layout.tsx'));

// --- endpoints and wiring: reuse the wiring checker rather than re-parsing ---
let wiring = { endpoints: [], orphanCalls: [] };
try {
  wiring = JSON.parse(
    execFileSync(process.execPath, [join(ROOT, 'scripts/check-wiring.mjs'), '--json'], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    }),
  );
} catch {
  /* the matrix still renders without it; the endpoint columns just read 0 */
}

/**
 * Which API paths belong to a feature. Derived from the feature key, plus the
 * handful of surfaces that own more than their own noun — listed explicitly
 * because guessing here would silently mis-attribute an endpoint.
 */
const EXTRA_PATHS = {
  products: ['principals'],
  users: ['roles', 'permissions', 'teams'],
  dashboard: [],
  // The Data page owns period locking (features/data/periodQueries.ts); the
  // rest of it is UI over the other resources and owns no route of its own.
  data: ['period-locks'],
};
const pathsFor = (key) => [key, ...(EXTRA_PATHS[key] ?? [])];
const endpointsFor = (key) =>
  wiring.endpoints.filter((e) => pathsFor(key).includes(e.path.split('/')[3]));

const testFiles = [
  ...walk('apps/web/src', (f) => /\.test\.tsx?$/.test(f)),
  ...walk('apps/web/tests', (f) => /\.test\.tsx?$/.test(f)),
  ...walk('apps/api/src', (f) => /\.spec\.ts$/.test(f)),
  ...walk('apps/api/test', (f) => /\.e2e-spec\.ts$/.test(f)),
];
const testsFor = (key) =>
  testFiles.filter((f) => f.toLowerCase().includes(key) || read(f).includes(`/${key}`)).length;

/**
 * The salesperson's field app (apps/mobilev2) measured against the web, for
 * the one role it serves. A route the web calls and the sales app does not is
 * a gap only if the sales role may call it — user admin, role editing, period
 * locking and payment writes are absent from a sales app on purpose, and
 * listing them as "missing" would bury the real gaps. The grants come from
 * ROLE_PERMISSIONS in @greatsales/shared, the same table the API enforces.
 */
let salesGrants = new Set();
try {
  const shared = createRequire(import.meta.url)(join(ROOT, 'packages/shared/dist/index.js'));
  salesGrants = new Set(shared.ROLE_PERMISSIONS?.sales ?? []);
} catch {
  /* shared not built — every permissioned route then reads as outside the role */
}
const salesMay = (e) => (e.permissions ?? []).every((p) => salesGrants.has(p));
/**
 * Open routes the sales app has no use for, each with the reason. They carry
 * no permission (any signed-in user may read them), so the grant check above
 * cannot exclude them; the reason is printed, so an entry has to justify
 * itself to stay.
 */
const SALES_APP_NOT_NEEDED = {
  'GET /api/v1/users': 'people pickers — the API assigns every sales record to the signed-in rep',
  'GET /api/v1/users/directory': 'people pickers — as above',
  'GET /api/v1/roles': 'role administration lives on the web console',
  'GET /api/v1/permissions': 'role administration lives on the web console',
};
const salesAppGap = (key) => {
  const webOnly = endpointsFor(key).filter(
    (e) => e.wiredBy.includes('web') && !e.wiredBy.includes('mobilev2'),
  );
  const call = (e) => `${e.method} ${e.path}`;
  return {
    missing: webOnly.filter((e) => salesMay(e) && !SALES_APP_NOT_NEEDED[call(e)]).map(call),
    notForSales: webOnly.filter((e) => !salesMay(e)).length,
    notNeeded: webOnly
      .filter((e) => SALES_APP_NOT_NEEDED[call(e)])
      .map((e) => `${call(e)} — ${SALES_APP_NOT_NEEDED[call(e)]}`),
  };
};

const MOBILE_SCREEN_NAME = { dashboard: 'home', leads: 'pipeline' };

const matrix = features.map((f) => {
  const eps = endpointsFor(f.key);
  return {
    ...f,
    page: webPages.some((p) => p.toLowerCase().includes(`/${f.key}/`)),
    route: routePaths.includes(f.key),
    // Where the sales app keeps each feature's list: a tab root or a
    // section folder. Dashboard is Home, leads are the Pipeline.
    // Top-level routes only, so a sub-screen such as lead/[id]/products.tsx
    // is not read as a Products feature.
    mobile: mobileScreens.some((s) => {
      const name = MOBILE_SCREEN_NAME[f.key] ?? f.key;
      const route = s.split(sep).join('/').replace(/^.*\/src\/app\//, '').replace(/^\([^/]+\)\//, '');
      return route === `${name}.tsx` || route === `${name}/index.tsx`;
    }),
    endpoints: eps.length,
    wired: eps.filter((e) => e.wiredBy.length > 0).length,
    tests: testsFor(f.key),
    salesAppGap: salesAppGap(f.key),
  };
});

// --- environment: the facts a session otherwise rediscovers every time -------
const launch = JSON.parse(read('.claude/launch.json') || '{"configurations":[]}');
const port = (name) => launch.configurations.find((c) => c.name === name)?.port ?? '?';
const dbPort = (read('docker-compose.yml').match(/(\d+):5432/) ?? [])[1] ?? '?';
const webEnv = read('apps/web/.env');
const envVal = (k) => (webEnv.match(new RegExp(`^${k}=(.*)$`, 'm')) ?? [])[1] ?? '?';

const env = {
  apiPort: port('api'),
  webPort: port('web'),
  dbPort,
  tenant: envVal('VITE_DEMO_TENANT_ID'),
  login: `${envVal('VITE_DEMO_EMAIL')} / ${envVal('VITE_DEMO_PASSWORD')}`,
  seed: 'pnpm --filter @greatsales/db db:seed:promech',
  verify: 'pnpm verify',
};

const totals = {
  features: features.length,
  webPages: webPages.length,
  webRoutes: routePaths.length,
  redirectRoutes: redirects,
  mobileScreens: mobileScreens.length,
  // CLIENT-FACING only, the same population check-wiring.mjs reports on. It
  // already marks the load balancer's probes `nonClient`; counting them here
  // made this line say 82/83 while `pnpm wiring` said 81/81 about the same
  // repository, and two scripts disagreeing about one fact is how a reader
  // stops believing either.
  endpoints: wiring.endpoints.filter((e) => !e.nonClient).length,
  endpointsWired: wiring.endpoints.filter(
    (e) => !e.nonClient && e.wiredBy.length > 0,
  ).length,
  testFiles: testFiles.length,
  docs: walk('.', (f) => f.endsWith('.md') && !f.includes('node_modules')).length,
};

const shortText =
  `GreatSales: ${totals.features} features · ${totals.webPages} web pages (${totals.webRoutes} routes) · ` +
      `${totals.mobileScreens} mobile screens · ${totals.endpointsWired}/${totals.endpoints} endpoints wired · ` +
      `${totals.testFiles} test files\n` +
      `  api :${env.apiPort} · web :${env.webPort} · postgres :${env.dbPort} · tenant ${env.tenant} · login ${env.login}\n` +
      `  seed: ${env.seed}\n  verify: ${env.verify}\n` +
  `  unwired: ${matrix.filter((f) => f.endpoints && f.wired < f.endpoints).map((f) => f.key).join(', ') || 'none'}`;

if (parity) {
  console.log('\nGreatSales — sales app (apps/mobilev2) against web, for the sales role\n');
  const salesBehind = matrix.filter((f) => f.salesAppGap.missing.length > 0);
  if (salesBehind.length === 0) {
    console.log('  Nothing. Every route a salesperson may call from the web, the sales app calls too.');
  }
  for (const f of salesBehind) {
    console.log(`  ${f.key}`);
    for (const call of f.salesAppGap.missing) console.log(`      - ${call}`);
  }
  const notNeeded = matrix.flatMap((f) => f.salesAppGap.notNeeded);
  if (notNeeded.length) {
    console.log('  Not called by the sales app, on purpose:');
    for (const line of notNeeded) console.log(`      - ${line}`);
  }
  const outside = matrix.reduce((n, f) => n + f.salesAppGap.notForSales, 0);
  console.log(
    `  (${outside} further web route${outside === 1 ? '' : 's'} need a permission the sales role does not hold — absent by design)\n`,
  );

} else if (asJson) {
  console.log(JSON.stringify({ totals, features: matrix, env }, null, 2));
} else if (asHook) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: shortText },
      suppressOutput: true,
    }),
  );
} else if (short) {
  console.log(shortText);
} else {
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\nGreatSales — what exists, derived from the code\n');
  console.log(`  ${pad('FEATURE', 13)}${pad('PAGE', 6)}${pad('ROUTE', 7)}${pad('MOBILE', 8)}${pad('API', 9)}${pad('TESTS', 6)}ROLES`);
  for (const f of matrix) {
    console.log(
      `  ${pad(f.key, 13)}${pad(f.page ? 'yes' : '—', 6)}${pad(f.route ? 'yes' : '—', 7)}` +
        `${pad(f.mobile ? 'yes' : '—', 8)}${pad(f.endpoints ? `${f.wired}/${f.endpoints}` : '—', 9)}` +
        `${pad(f.tests || '—', 6)}${f.roles.length === 4 ? 'all' : f.roles.join(',')}`,
    );
  }
  console.log(
    `\n  ${totals.webPages} web page components · ${totals.webRoutes} routes (${totals.redirectRoutes} redirects) · ` +
      `${totals.mobileScreens} mobile screens`,
  );
  console.log(`  ${totals.endpointsWired}/${totals.endpoints} API endpoints wired · ${totals.testFiles} test files · ${totals.docs} markdown docs`);
  console.log(
    `\n  api :${env.apiPort} · web :${env.webPort} · postgres :${env.dbPort} · tenant ${env.tenant} · login ${env.login}`,
  );
  console.log(`  seed: ${env.seed}\n  verify: ${env.verify}\n`);
}
