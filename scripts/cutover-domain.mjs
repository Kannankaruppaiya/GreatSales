#!/usr/bin/env node
/**
 * Move the production box from serving plain HTTP on its IP to serving HTTPS on
 * a real hostname.
 *
 *   node scripts/cutover-domain.mjs                  # greatworksapp.in
 *   node scripts/cutover-domain.mjs app.example.com  # some other name
 *   node scripts/cutover-domain.mjs --rollback       # back to plain HTTP on the IP
 *
 * Why this is a script and not four commands in a runbook:
 *
 *  * `SITE_ADDRESS` and `CORS_ORIGIN` MUST change together. The console is
 *    served from the API's own origin and the env contract refuses to boot on a
 *    CORS_ORIGIN that does not match the site. Changing one by hand and not the
 *    other takes the API down.
 *  * Caddy asks Let's Encrypt for a certificate the instant it starts with a
 *    hostname. If DNS does not already point here the challenge fails, and
 *    failed challenges burn a rate limit that is counted per registered domain
 *    per week. So DNS is checked BEFORE anything is touched, not after.
 *  * A failed cutover leaves the site unreachable rather than merely ugly:
 *    with a hostname set, Caddy stops serving the bare IP. So .env is backed up
 *    first and restored automatically if the new address does not come up.
 */
import { execFileSync } from 'node:child_process';
import { Resolver } from 'node:dns/promises';

const REGION = process.env.AWS_REGION ?? 'ap-south-1';
const INSTANCE = process.env.GS_INSTANCE_ID ?? 'i-08e5747f469972dc8';
const EXPECTED_IP = process.env.GS_BOX_IP ?? '35.154.59.213';
const REMOTE = '/opt/greatsales';

const rollback = process.argv.includes('--rollback');
const host = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? 'greatworksapp.in';
let wwwEnabled = false;

const log = (m) => console.log(`\n\x1b[36m> ${m}\x1b[0m`);

/** Run a script on the box over SSM and return its stdout. */
function onBox(script) {
  const sent = JSON.parse(
    execFileSync(
      'aws',
      ['ssm', 'send-command', '--instance-ids', INSTANCE, '--document-name',
       'AWS-RunShellScript', '--parameters',
       JSON.stringify({ commands: [script], executionTimeout: ['1800'] }),
       '--region', REGION, '--output', 'json'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ),
  ).Command.CommandId;

  const inFlight = new Set(['Pending', 'InProgress', 'Delayed']);
  for (let i = 0; i < 300; i++) {
    execFileSync('node', ['-e', 'setTimeout(()=>{},4000)']); // no shell sleep on Windows
    let out;
    try {
      out = JSON.parse(
        execFileSync(
          'aws',
          ['ssm', 'get-command-invocation', '--command-id', sent, '--instance-id',
           INSTANCE, '--region', REGION, '--output', 'json'],
          { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
        ),
      );
    } catch {
      continue; // the invocation is not registered for a moment after send
    }
    if (inFlight.has(out.Status)) continue;
    if (out.StandardOutputContent) process.stdout.write(out.StandardOutputContent);
    if (out.Status !== 'Success') {
      console.error(out.StandardErrorContent || '(no stderr)');
      throw new Error(`command failed on the box: ${out.Status}`);
    }
    return out.StandardOutputContent ?? '';
  }
  throw new Error('the box did not answer within 20 minutes');
}


/**
 * Resolve A records from the domain's OWN authoritative nameservers.
 *
 * The obvious `dns.resolve4()` asks whatever resolver this machine happens to
 * be configured with -- an ISP box, a router, a corporate forwarder -- and that
 * answer can be an hour stale after a record changes. It refused a cutover once
 * for exactly that reason, while Google and Cloudflare already served the new
 * address.
 *
 * Authoritative is also the RIGHT question, not merely the fresher one: Let's
 * Encrypt validates by querying the authoritative nameservers, so what they
 * answer is precisely what decides whether a certificate can be issued. A stale
 * cache on this machine has no bearing on it in either direction.
 */
async function resolveAuthoritative(name, zone) {
  const system = new Resolver();
  const nsHosts = await system.resolveNs(zone);
  const nsIps = (
    await Promise.all(
      nsHosts.map((h) => system.resolve4(h).catch(() => [])),
    )
  ).flat();
  if (nsIps.length === 0) throw new Error(`no reachable nameserver for ${zone}`);

  const authoritative = new Resolver();
  authoritative.setServers(nsIps);
  return authoritative.resolve4(name);
}

const siteAddress = rollback ? ':80' : host;
const corsOrigin = rollback ? `http://${EXPECTED_IP}` : `https://${host}`;
// The inert defaults match deploy/Caddyfile: an http:// address asks for no
// certificate, so the www block exists but does nothing.
const INERT_WWW = 'http://localhost:9080';
const INERT_PRIMARY = 'localhost';

if (!rollback) {
  log(`Checking that ${host} already points at ${EXPECTED_IP}`);
  let addresses;
  try {
    addresses = await resolveAuthoritative(host, host);
  } catch (e) {
    console.error(
      `\n${host} does not resolve (${e.code}).\n` +
        `Add an A record:  Type A   Name @   Value ${EXPECTED_IP}   TTL 600\n` +
        `If the registrar still shows the domain as pending verification, finish that first —\n` +
        `until then the domain does not exist at the registry and no record can take effect.\n` +
        `NOTHING was changed on the box.`,
    );
    process.exit(1);
  }
  // Decide whether to switch the www redirect block on, by asking DNS rather
  // than by assuming. Turning it on for a name that does NOT resolve here would
  // make Caddy fail an ACME challenge for it on every retry, and Let's Encrypt
  // counts those failures per registered domain per week -- so a www block
  // enabled by optimism can cost the real certificate.
  try {
    const www = await resolveAuthoritative(`www.${host}`, host);
    wwwEnabled = www.includes(EXPECTED_IP);
    console.log(
      wwwEnabled
        ? `  www.${host} -> ${www.join(', ')} (redirect to the bare name will be enabled)`
        : `  www.${host} resolves to ${www.join(', ')}, NOT this box — leaving the www block off`,
    );
  } catch {
    console.log(`  www.${host} does not resolve — leaving the www block off`);
  }

  if (!addresses.includes(EXPECTED_IP)) {
    console.error(
      `\n${host} resolves to ${addresses.join(', ')}, not ${EXPECTED_IP}.\n` +
        `Point it at the box before cutting over, or DNS still holds an old value —\n` +
        `wait out the TTL and re-run. NOTHING was changed on the box.`,
    );
    process.exit(1);
  }
  console.log(`  ${host} -> ${addresses.join(', ')}`);
}

log(rollback ? 'Rolling back to plain HTTP on the IP' : `Cutting over to https://${host}`);
onBox(`
set -euo pipefail
cd ${REMOTE}

cp -a .env .env.before-cutover

# Replace the key if it is already there, append it if it is not. The .env on
# this box was generated before the www block existed, so a plain sed would
# silently write nothing and Caddy would fall back to its inert defaults.
set_env() {
  if grep -qE "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s
' "$1" "$2" >> .env
  fi
}

set_env SITE_ADDRESS '${siteAddress}'
set_env CORS_ORIGIN '${corsOrigin}'
set_env WWW_SITE_ADDRESS '${wwwEnabled && !rollback ? `www.${host}` : INERT_WWW}'
set_env PRIMARY_HOST '${wwwEnabled && !rollback ? host : INERT_PRIMARY}'

chmod 600 .env
grep -E '^(SITE_ADDRESS|CORS_ORIGIN|WWW_SITE_ADDRESS|PRIMARY_HOST)=' .env

docker compose up -d --force-recreate caddy api

# Caddy needs a moment to complete the ACME challenge before anything answers.
for i in $(seq 1 30); do
  sleep 5
  if curl -fsS -o /dev/null --max-time 10 localhost/api/v1/health/ready; then
    echo "local health OK after $((i*5))s"
    break
  fi
done

if ! curl -fsS -o /dev/null --max-time 10 localhost/api/v1/health/ready; then
  echo "the stack did not come back; restoring the previous .env" >&2
  cp -a .env.before-cutover .env
  docker compose up -d --force-recreate caddy api
  exit 1
fi

docker compose ps --format "table {{.Service}}\t{{.Status}}"
`);

if (!rollback) {
  log('Verifying the certificate from outside');
  // From here, not the box: a certificate the box is happy with proves nothing
  // about what a real browser is served.
  for (let i = 0; i < 12; i++) {
    try {
      const body = execFileSync(
        'curl',
        ['-fsS', '--max-time', '15', `https://${host}/api/v1/health/ready`],
        { encoding: 'utf8' },
      );
      console.log(`  https://${host} -> ${body.trim()}`);

      if (wwwEnabled) {
        // A redirect is only real if a browser is served a VALID certificate
        // for the www name first -- curl WITHOUT -k proves exactly that.
        try {
          const redirect = execFileSync(
            'curl',
            ['-sS', '-o', '/dev/null', '-w', '%{http_code} -> %{redirect_url}',
             '--max-time', '15', `https://www.${host}/admin/login`],
            { encoding: 'utf8' },
          ).trim();
          console.log(`  https://www.${host} ${redirect}`);
        } catch {
          console.warn(
            `  www.${host} did not answer yet - its certificate may still be issuing.`,
          );
        }
      }

      console.log(`\nDone. The console is at https://${host}/admin/login`);
      console.log(
        `If anything is wrong: node scripts/cutover-domain.mjs --rollback`,
      );
      process.exit(0);
    } catch {
      execFileSync('node', ['-e', 'setTimeout(()=>{},10000)']);
    }
  }
  console.error(
    `\nThe box is healthy but https://${host} did not answer from here within two minutes.\n` +
      `Usually the certificate is still being issued — try the URL in a browser.\n` +
      `To undo: node scripts/cutover-domain.mjs --rollback`,
  );
  process.exit(1);
}

log(`Rolled back. The console is at http://${EXPECTED_IP}/admin/login`);
