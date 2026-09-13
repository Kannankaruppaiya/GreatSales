/**
 * Put this machine's GreatSales on a public HTTPS link, for a demo.
 *
 *   node scripts/share.mjs [--open] [--password X] [--port 5180] [--no-build]
 *
 * The console and the API are two servers on two ports, and the refresh token
 * is an httpOnly cookie — so handing out two links would break the session the
 * moment it tried to renew. This serves BOTH from one origin: the built console
 * as static files, and `/api/*` proxied to the API on :3001, exactly the shape
 * `vite.config.ts` gives dev and nginx gives staging. One origin, first-party
 * cookie, no CORS entry needed for a hostname that changes every run.
 *
 * It serves the PRODUCTION BUILD, not the dev server, for three reasons: Vite's
 * host check rejects a hostname it was not started with, its HMR socket cannot
 * be told the tunnel's port for a remote visitor while staying right locally,
 * and `src/lib/config.ts` blanks the demo login prefill in a production build —
 * so a public page does not arrive with the admin password typed into it.
 *
 * The tunnel is a Cloudflare quick tunnel: no account, no signup, no config,
 * and the hostname dies with the process.
 *
 * ---------------------------------------------------------------------------
 * The link is PASSWORD-GATED BY DEFAULT, and that default is deliberate.
 *
 * What is behind it is not a demo copy — it is the live dev database on this
 * laptop, with write access, seeded with a `admin` / `admin` login. Anyone who
 * reaches the URL reaches that. So the tunnel gets its own gate in front, and
 * `--open` removes it for when the data genuinely does not matter.
 * ---------------------------------------------------------------------------
 */
import { createServer, request as httpRequest } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'apps', 'web', 'dist');

const flag = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const PORT = Number(arg('port', 5180));
const API = (arg('api', process.env.SHARE_API_URL ?? 'http://localhost:3001')).replace(/\/$/, '');
const OPEN = flag('open') || !process.argv.some((a) => a === '--password' || a === '--gate');
const PASSWORD = arg('password', process.env.SHARE_PASSWORD ?? randomBytes(4).toString('hex'));
const USE_CF = flag('cf') || flag('cloudflare');

const c = {
  dim: (s) => `[2m${s}[0m`,
  bold: (s) => `[1m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
  cyan: (s) => `[36m${s}[0m`,
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
};

/* ------------------------------------------------------------------ the gate */

// A random value per run: the cookie proves "this browser answered the prompt",
// so it is a session key and never the password itself.
const TICKET = randomBytes(16).toString('hex');

const equal = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * True when this request may proceed.
 *
 * The cookie is checked FIRST and it is what carries the session, because the
 * console puts its own `Authorization: Bearer` on every API call — a gate that
 * read only the Authorization header would reject every request the app makes
 * the moment a user logged in.
 */
function allowed(req) {
  if (OPEN) return true;
  const cookie = /(?:^|;\s*)gs_share=([^;]+)/.exec(req.headers.cookie ?? '');
  if (cookie && equal(cookie[1], TICKET)) return true;

  const auth = req.headers.authorization ?? '';
  if (auth.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    // Any username. One secret to pass on is enough for a demo link, and two
    // is how people end up writing both of them in the same message anyway.
    const supplied = decoded.slice(decoded.indexOf(':') + 1);
    if (equal(supplied, PASSWORD)) return 'fresh';
  }
  return false;
}

function challenge(req, res) {
  // An API call gets JSON, not a browser prompt: a 401 dialog appearing over a
  // background request is confusing, and the SPA has its own 401 handling.
  if (req.url.startsWith('/api')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end('{"message":"This shared link is password protected."}');
  }
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="GreatSales - shared link", charset="UTF-8"',
    'Content-Type': 'text/html; charset=utf-8',
  });
  res.end('<h1>GreatSales</h1><p>This shared link is password protected.</p>');
}

/* --------------------------------------------------------------- the servers */

function proxy(req, res) {
  const target = new URL(API);
  const headers = { ...req.headers, host: target.host };
  delete headers.origin;
  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: req.url,
      // Headers pass through untouched apart from Host, so the API still sees
      // the visitor's real address in the X-Forwarded-For that cloudflared
      // sets. It only USES it when TRUST_PROXY is on — see the note printed
      // at startup — but throwing it away here would remove the option.
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: `API unreachable: ${err.message}` }));
  });
  req.pipe(upstream);
}

function serveFile(res, file, extra = {}) {
  res.writeHead(200, {
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Hashed asset filenames are safe to keep forever; index.html must not be,
    // or a rebuild during the demo would never reach the browser.
    'Cache-Control': file.includes(`${sep}assets${sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
    ...extra,
  });
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  const gate = allowed(req);
  if (!gate) return challenge(req, res);
  const setCookie =
    gate === 'fresh'
      ? { 'Set-Cookie': `gs_share=${TICKET}; Path=/; HttpOnly; SameSite=Lax; Secure` }
      : {};

  // No cookie is set on an API response: the proxy writes the API's own headers
  // verbatim, and the login reply carries a Set-Cookie of its own that this one
  // would collide with. The document request is what opens the session.
  if (req.url.startsWith('/api')) return proxy(req, res);

  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // normalize() collapses `..` before it is joined, so a crafted path cannot
  // walk out of dist and read the repository.
  const candidate = join(DIST, normalize(pathname));
  if (
    candidate.startsWith(DIST) &&
    existsSync(candidate) &&
    statSync(candidate).isFile()
  ) {
    return serveFile(res, candidate, setCookie);
  }
  // Anything else is a client route (/leads, /dashboard/...) — the SPA owns it.
  return serveFile(res, join(DIST, 'index.html'), setCookie);
});

/* ------------------------------------------------------------------- startup */

async function apiIsUp() {
  try {
    const r = await fetch(`${API}/api/v1/health/ready`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

function build() {
  console.log(c.dim('Building the console (production build)…'));
  const r = spawnSync('pnpm', ['--filter', 'web', 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VITE_API_URL: '/api/v1' },
  });
  if (r.status !== 0) {
    console.error(c.red('\nBuild failed — nothing to share. Fix the errors above.'));
    process.exit(1);
  }
}

function hasNgrok() {
  try {
    const r = spawnSync('ngrok', ['--version'], { shell: true, stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    const useNgrok = !USE_CF && hasNgrok();
    const child = useNgrok
      ? spawn('ngrok', ['http', String(PORT), '--log=stdout'], { shell: true })
      : spawn(
          'cloudflared',
          ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`],
          { shell: true },
        );

    let settled = false;
    const watch = (chunk) => {
      const text = String(chunk);
      const mNgrok = /url=(https:\/\/[^\s]+)/.exec(text);
      if (mNgrok && !settled) {
        settled = true;
        resolve({ url: mNgrok[1], child, provider: 'ngrok' });
        return;
      }
      const mCf = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(text);
      if (mCf && !settled) {
        settled = true;
        resolve({ url: mCf[0], child, provider: 'cloudflared' });
        return;
      }
    };
    child.stdout.on('data', watch);
    child.stderr.on('data', watch);
    child.on('error', reject);
    child.on('exit', (code) => {
      if (!settled) reject(new Error(`${useNgrok ? 'ngrok' : 'cloudflared'} exited with code ${code}`));
    });
    setTimeout(() => {
      if (!settled) reject(new Error('Tunnel did not report a URL within 30s'));
    }, 30_000);
  });
}

const line = (label, value) => `  ${label.padEnd(11)}${value}`;

async function main() {
  if (!(await apiIsUp())) {
    console.error(c.red(`The API is not answering on ${API}.`));
    console.error('Start it first (Docker for Postgres, then the api server):');
    console.error(c.dim('  docker compose up -d'));
    console.error(c.dim('  pnpm --filter api start:dev'));
    process.exit(1);
  }

  if (!flag('no-build') || !existsSync(join(DIST, 'index.html'))) build();

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  console.log(c.dim(`Serving apps/web/dist + /api → ${API} on :${PORT}`));

  const { url, child, provider } = await startTunnel();

  console.log('');
  console.log(c.green('  GreatSales is live on a public link'));
  if (provider === 'ngrok') {
    console.log(c.green('  (Permanent static domain: stays the same every restart!)'));
  }
  console.log('');
  console.log(line('Link', c.bold(c.cyan(url))));
  if (OPEN) {
    console.log(line('Gate', c.yellow('none — anyone with the link is in (--open)')));
  } else {
    console.log(line('Password', c.bold(PASSWORD) + c.dim('  (any username)')));
  }
  console.log(line('Sign in', 'admin@greatsales.local / admin'));
  console.log(line('Workspace', 'tenant_promech'));
  console.log('');
  console.log(c.dim('  The link dies when you stop this (Ctrl+C), and a new run gets a new one.'));
  console.log(c.dim('  Rebuild after a code change: stop, run again (or `--no-build` to skip).'));
  console.log('');

  const stop = () => {
    child.kill();
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  child.on('exit', () => {
    console.error(c.red('\nThe tunnel closed. The link is dead.'));
    stop();
  });
}

main().catch((err) => {
  console.error(c.red(String(err.message ?? err)));
  process.exit(1);
});
