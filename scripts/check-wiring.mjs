#!/usr/bin/env node
/**
 * Frontend <-> backend wiring check.
 *
 * Answers one question fast: which API endpoints does the backend expose, and
 * which of them does a frontend actually call?
 *
 * It reads the NestJS controllers for the endpoint list (no running server
 * needed) and scans the web and mobile sources for API calls, then diffs the
 * two. Static analysis only, so it runs in about a second and works in CI.
 *
 *   node scripts/check-wiring.mjs          # table + summary
 *   node scripts/check-wiring.mjs --json   # machine-readable
 *   node scripts/check-wiring.mjs --strict # exit 1 if anything is unwired
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // repo root, one level up from scripts/
const API_SRC = join(ROOT, 'apps/api/src');
const FRONTENDS = [
  { name: 'web', dir: join(ROOT, 'apps/web/src') },
  { name: 'mobile', dir: join(ROOT, 'apps/mobile/src') },
];
const GLOBAL_PREFIX = '/api/v1'; // keep in sync with apps/api/src/main.ts

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const strict = args.has('--strict');

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, out);
    else if (test(full)) out.push(full);
  }
  return out;
}

const joinPath = (...parts) =>
  '/' +
  parts
    .flatMap((p) => String(p ?? '').split('/'))
    .filter(Boolean)
    .join('/');

const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// ---------------------------------------------------------------------------
// Backend: every route the API exposes, read off the controller decorators.
// ---------------------------------------------------------------------------
function collectEndpoints() {
  const endpoints = [];
  for (const file of walk(API_SRC, (f) => f.endsWith('.controller.ts'))) {
    const src = readFileSync(file, 'utf8');
    // @Controller() / @Controller('auth') / @Controller({ path: 'auth' })
    const ctrl = src.match(
      /@Controller\(\s*(?:{[^}]*?path:\s*)?['"`]?([^'"`)\s,}]*)/,
    );
    const base = ctrl ? ctrl[1] : '';
    const routeRe = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?/g;
    for (const m of src.matchAll(routeRe)) {
      const [, verb, sub = ''] = m;
      endpoints.push({
        method: verb.toUpperCase(),
        path: joinPath(GLOBAL_PREFIX, base, sub),
        source: `${relative(ROOT, file)}:${lineOf(src, m.index)}`,
      });
    }
  }
  return endpoints.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

// ---------------------------------------------------------------------------
// Frontends: calls made through the shared `api()` helper, plus any raw fetch.
//
// Import statements are stripped first — a module path like "../lib/auth"
// otherwise looks exactly like a request path and reports as a phantom call.
// ---------------------------------------------------------------------------
function stripImports(src) {
  // Blank the text in place rather than deleting it: every character position
  // is preserved, so reported line numbers still match the real file.
  const blank = (match) => match.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/\/\/.*$/gm, blank)
    .replace(/^\s*import\s[\s\S]*?from\s*['"][^'"]*['"];?\s*$/gm, blank)
    .replace(/^\s*import\s*['"][^'"]*['"];?\s*$/gm, blank)
    .replace(/^\s*export\s[\s\S]*?from\s*['"][^'"]*['"];?\s*$/gm, blank);
}

/**
 * Normalizes a path as written in client code to a full API path:
 * a leading base-URL expression is dropped, `${...}` and `:id` become `*`,
 * and a path that omits the global prefix gets it.
 */
function toApiPath(raw) {
  let p = raw.trim().replace(/\?[\s\S]*$/, '');
  p = p.replace(/^\$\{[^}]*\}/, ''); // `${BASE}/auth/refresh` -> `/auth/refresh`
  p = p.replace(/:[A-Za-z_]\w*/g, '*'); // `/customers/:id`      -> `/customers/*`

  // Resolve interpolation per segment. A segment that is entirely an
  // expression is a path parameter (`/customers/${id}`), while a literal
  // prefix followed by one is a suffix such as an appended query string
  // (`/customers${buildQuery(...)}`) — keep the prefix, drop the rest.
  const segments = p.split('/').map((seg) => {
    const at = seg.indexOf('${');
    if (at === -1) return seg;
    return at === 0 ? '*' : seg.slice(0, at);
  });
  p = segments.filter((seg, i) => seg !== '' || i === 0).join('/');

  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.startsWith(GLOBAL_PREFIX)) p = joinPath(GLOBAL_PREFIX, p);
  return p.replace(/\/+$/, '') || '/';
}

/**
 * The argument text of a call, from `openIndex` (its "(") to the matching ")".
 * A fixed-size window would bleed into whatever follows and pick up the method
 * of the *next* call, so the parens are balanced properly instead.
 */
function callArgs(src, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return src.slice(openIndex, i);
    }
  }
  return src.slice(openIndex, openIndex + 400);
}

/** Reads `method: "PATCH"` out of a call's options object. Defaults to GET. */
function methodFrom(args) {
  const m = args.match(/method\s*:\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]/i);
  return m ? m[1].toUpperCase() : 'GET';
}

/**
 * Endpoints no client is expected to call — infrastructure probes rather than
 * product surface. Listed so the report stays honest instead of silently
 * counting them as gaps forever.
 */
/**
 * Endpoints no client is supposed to call. These are read by the load balancer
 * and the orchestrator, not by a screen, so "nothing calls it" is the design.
 */
const NON_CLIENT_ENDPOINTS = new Set([
  'GET /api/v1/health', // liveness — is the process up
  'GET /api/v1/health/ready', // readiness — can it serve (DB reachable). ALB/k8s probe.
]);

function collectClientCalls() {
  const calls = [];
  const isSource = (f) => /\.(t|j)sx?$/.test(f) && !/\.d\.ts$/.test(f);

  for (const { name, dir } of FRONTENDS) {
    for (const file of walk(dir, isSource)) {
      const original = readFileSync(file, 'utf8');
      const src = stripImports(original);

      // Request helpers this codebase uses. Add a name here rather than
      // widening the pattern, so an unrelated `x.fetch()` is not counted.
      // Longest first: `apiFetch` would otherwise match the start of
      // `apiFetchBlob` and then fail on the `B` where it wanted a `(`, so the
      // file-download route read as called by nobody.
      // The generic is matched as "anything but parens or a newline" so nested
      // type arguments (api<CursorPage<Customer>>) do not cut the match short.
      const callRe =
        /\b(api|apiFetchBlob|apiFetch|fetch|request)\s*(?:<[^()\n]*>)?\s*(\(\s*['"`]([^'"`]+)['"`])/g;

      for (const m of src.matchAll(callRe)) {
        const openIndex = m.index + m[0].length - m[2].length;
        calls.push({
          app: name,
          raw: m[3],
          path: toApiPath(m[3]),
          method: methodFrom(callArgs(src, openIndex)),
          source: `${relative(ROOT, file)}:${lineOf(src, m.index)}`,
        });
      }
    }
  }
  return calls;
}

/** Segment-wise match where `*` on either side is a wildcard. */
function pathsMatch(a, b) {
  const as = a.split('/').filter(Boolean);
  const bs = b.split('/').filter(Boolean);
  if (as.length !== bs.length) return false;
  return as.every((seg, i) => seg === bs[i] || seg === '*' || bs[i] === '*');
}

const matches = (call, endpoint) =>
  call.method === endpoint.method && pathsMatch(call.path, endpoint.path);

// ---------------------------------------------------------------------------
const endpoints = collectEndpoints();
const calls = collectClientCalls();

const report = endpoints.map((ep) => {
  const callers = calls.filter((c) => matches(c, ep));
  return {
    ...ep,
    wiredBy: [...new Set(callers.map((c) => c.app))],
    callers,
    nonClient: NON_CLIENT_ENDPOINTS.has(`${ep.method} ${ep.path}`),
  };
});
const clientFacing = report.filter((r) => !r.nonClient);
const orphans = calls.filter((c) => !endpoints.some((ep) => matches(c, ep)));
const wired = clientFacing.filter((r) => r.wiredBy.length > 0);

if (asJson) {
  console.log(JSON.stringify({ endpoints: report, orphanCalls: orphans }, null, 2));
} else {
  const total = clientFacing.length;
  const pct = total ? Math.round((wired.length / total) * 100) : 0;
  console.log('\nGreatSales — frontend/backend wiring\n');
  if (endpoints.length === 0) {
    console.log('  No endpoints found. Is apps/api/src present?\n');
  } else {
    const w = Math.max(...report.map((r) => r.method.length + r.path.length)) + 2;
    for (const r of report) {
      const label = `${r.method} ${r.path}`.padEnd(w);
      const status = r.nonClient
        ? 'n/a     (infrastructure probe)'
        : r.wiredBy.length
          ? `WIRED  (${r.wiredBy.join(', ')})`
          : 'NOT WIRED';
      const mark = r.nonClient ? '[-]' : r.wiredBy.length ? '[x]' : '[ ]';
      console.log(`  ${mark} ${label} ${status}`);
    }
    console.log(`\n  ${wired.length}/${total} client-facing endpoints wired (${pct}%)`);
  }
  const frontendFiles = FRONTENDS.reduce(
    (n, f) => n + walk(f.dir, (x) => /\.(t|j)sx?$/.test(x)).length,
    0,
  );
  console.log(`  ${calls.length} API call(s) found across ${frontendFiles} frontend file(s)`);
  if (orphans.length) {
    console.log('\n  Frontend calls with no matching backend route:');
    for (const o of orphans) {
      console.log(`    ${o.method} ${o.path}  <- ${o.source}`);
    }
  }
  console.log();
}

if (strict && (wired.length < clientFacing.length || orphans.length)) process.exit(1);
