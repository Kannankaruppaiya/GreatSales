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
 *   node scripts/facts.mjs --parity # per feature, what web can do that mobile cannot
 *   node scripts/facts.mjs --hook   # same, as SessionStart hook JSON
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const mobileScreens = walk('apps/mobile/src/app', (f) => f.endsWith('.tsx') && !f.endsWith('_layout.tsx'));

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
 * The endpoints a feature exposes on web but not on mobile.
 *
 * This is the honest form of "what is missing on the phone": not a hand-written
 * checklist that rots, but the set of calls the web client makes and the mobile
 * client does not, recomputed from the source on every run. A feature with no
 * mobile screen at all reports its whole surface here.
 */
const mobileGapFor = (key) =>
  endpointsFor(key)
    .filter((e) => e.wiredBy.includes('web') && !e.wiredBy.includes('mobile'))
    .map((e) => `${e.method} ${e.path}`);

/**
 * Mobile hooks that exist but that no screen ever calls.
 *
 * The wiring report counts an endpoint as reachable on mobile as soon as some
 * file under apps/mobile/src calls it — and a query module counts. That is how
 * a query module counts as a caller. A hook that nothing outside the query
 * layer imports is therefore a hole in the app that the endpoint table reports
 * as a working feature, so it gets named here instead. Everything outside
 * gs/queries counts as a caller, not just screens — shared components such as
 * RemarksPanel are how several hooks legitimately reach the UI.
 */
// Every identifier that appears anywhere in a screen. Comparing against a set
// of words avoids a word-boundary regex, which is easy to get subtly wrong and
// silently reports every hook as dead.
const screenIdentifiers = new Set(
  walk('apps/mobile/src', (f) => /\.tsx?$/.test(f) && !f.includes('/gs/queries/')).flatMap(
    (f) => read(f).match(/[A-Za-z_$][\w$]*/g) ?? [],
  ),
);
/** Query-layer plumbing other query modules build on, not a product surface. */
const QUERY_HELPER_MODULES = new Set(['cursorList']);

const deadMobileHooks = walk('apps/mobile/src/gs/queries', (f) => f.endsWith('.ts'))
  .flatMap((f) =>
    [...read(f).matchAll(/export function (use[A-Z]\w*)/g)].map((m) => ({
      hook: m[1],
      module: f.split('/').pop().replace('.ts', ''),
    })),
  )
  .filter(({ hook, module }) => !QUERY_HELPER_MODULES.has(module) && !screenIdentifiers.has(hook));

const matrix = features.map((f) => {
  const eps = endpointsFor(f.key);
  return {
    ...f,
    page: webPages.some((p) => p.toLowerCase().includes(`/${f.key}/`)),
    route: routePaths.includes(f.key),
    // The mobile tab bar routes the dashboard at index.tsx rather than dashboard.tsx.
    mobile: mobileScreens.some((s) => s.endsWith(`/${f.key === 'dashboard' ? 'index' : f.key}.tsx`)),
    endpoints: eps.length,
    wired: eps.filter((e) => e.wiredBy.length > 0).length,
    tests: testsFor(f.key),
    mobileGap: mobileGapFor(f.key),
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
  endpoints: wiring.endpoints.length,
  endpointsWired: wiring.endpoints.filter((e) => e.wiredBy.length > 0).length,
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
  console.log('\nGreatSales — what web can do that mobile cannot, derived from the code\n');
  const behind = matrix.filter((f) => !f.mobile || f.mobileGap.length > 0);
  if (behind.length === 0) {
    console.log('  Nothing. Every endpoint a web page calls, a mobile screen calls too.\n');
  }
  for (const f of behind) {
    const head = f.mobile ? `${f.key}` : `${f.key}  (no mobile screen at all)`;
    console.log(`  ${head}`);
    for (const call of f.mobileGap) console.log(`      - ${call}`);
    if (f.mobileGap.length === 0) console.log('      - read-only parity; the screen itself is missing');
    console.log('');
  }
  if (deadMobileHooks.length > 0) {
    console.log('  Wired in the mobile data layer, but no mobile screen calls it:');
    for (const { hook, module } of deadMobileHooks) console.log(`      - ${hook}  (queries/${module}.ts)`);
    console.log('');
  }

  const total = matrix.reduce((n, f) => n + f.mobileGap.length, 0);
  console.log(`  ${total} endpoint${total === 1 ? '' : 's'} reachable on web but not on mobile, across ${behind.length} features\n`);
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
