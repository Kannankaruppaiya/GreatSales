#!/usr/bin/env node
/**
 * Deploy GreatSales to the production EC2 box.
 *
 * The box has 2GB of RAM and runs Postgres; building there would compete with
 * a live database for memory and has no upside, so images are built here and
 * shipped as tarballs through S3. The box is reached with SSM Run Command, not
 * SSH: there is no key to lose and port 22 is closed in the security group.
 *
 * Secrets are generated ON the box on first deploy and left alone afterwards,
 * so they never travel through this machine, a command line, or a log.
 *
 *   node scripts/deploy-aws.mjs            build, push, deploy
 *   node scripts/deploy-aws.mjs --skip-build   reuse the images already in S3
 *   node scripts/deploy-aws.mjs --no-rebuild   reuse the LOCAL images, ship them again
 *   node scripts/deploy-aws.mjs --only web     ship ONLY the web image (fast frontend deploy)
 */
import { execFileSync, execSync } from 'node:child_process';
import { createReadStream, createWriteStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const REGION = 'ap-south-1';
const INSTANCE = 'i-08e5747f469972dc8';
const BUCKET = 'greatsales-deploy-887793660359-aps1';
const REMOTE = '/opt/greatsales';
const ARCHIVE = 'images.tar.gz';

// Two different kinds of "don't build", because they fail for different reasons:
// --skip-build   the images in S3 are already the ones you want; ship nothing.
// --no-rebuild   the LOCAL images are good but S3 does not have them (a failed
//                upload, a new bucket). Rebuilding to recover from that is a
//                10-minute npm install that can itself fail on a bad link.
const skipBuild = process.argv.includes('--skip-build');
const noRebuild = process.argv.includes('--no-rebuild');

// --only web  ships just the web image. The two images are ~230MB and ~27MB, so
// on a slow uplink a one-line frontend change costs 20 minutes of upload for
// 27MB of actual difference. Only meaningful for a box that ALREADY has the
// other image loaded -- a fresh box needs a full deploy first.
const ALL_APPS = ['api', 'web'];
const onlyIndex = process.argv.indexOf('--only');
const APPS =
  onlyIndex === -1
    ? ALL_APPS
    : (process.argv[onlyIndex + 1] ?? '').split(',').map((a) => a.trim()).filter(Boolean);
for (const app of APPS) {
  if (!ALL_APPS.includes(app)) {
    console.error(`--only takes ${ALL_APPS.join(' and ')}, got "${app}"`);
    process.exit(2);
  }
}
if (APPS.length === 0) {
  console.error('--only needs at least one image');
  process.exit(2);
}
const tag = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

const log = (m) => console.log(`\n\x1b[36m▸ ${m}\x1b[0m`);
const sh = (cmd, opts = {}) =>
  execSync(cmd, { stdio: 'inherit', encoding: 'utf8', ...opts });
// PYTHONIOENCODING: the AWS CLI is a Python program, and on a Windows console
// it dies trying to print any non-cp1252 character that the box echoed back.
const shOut = (cmd) =>
  execSync(cmd, {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  }).trim();
// Windows paths reach the AWS CLI as file:// URLs, which need forward slashes.
const toPosix = (p) => p.split(String.fromCharCode(92)).join('/');

/** Run a shell script on the box and wait for it, surfacing its output. */
function onBox(name, script) {
  const dir = mkdtempSync(join(tmpdir(), 'gs-ssm-'));
  const paramsFile = join(dir, 'p.json');
  execFileSync('node', [
    '-e',
    `require('fs').writeFileSync(${JSON.stringify(paramsFile)}, JSON.stringify({ commands: ${JSON.stringify([script])} }))`,
  ]);

  const commandId = JSON.parse(
    shOut(
      `aws ssm send-command --region ${REGION} --instance-ids ${INSTANCE} ` +
        `--document-name AWS-RunShellScript --comment ${JSON.stringify(name)} ` +
        `--timeout-seconds 1800 --parameters file://${toPosix(paramsFile)}`,
    ),
  ).Command.CommandId;

  // SSM has no blocking call, so poll. A deploy that hangs is more useful
  // visible than silently timed out.
  for (let i = 0; i < 240; i++) {
    execSync('node -e "setTimeout(()=>{},5000)"'); // 5s, no shell sleep on Windows
    const inv = JSON.parse(
      shOut(
        `aws ssm get-command-invocation --region ${REGION} ` +
          `--command-id ${commandId} --instance-id ${INSTANCE}`,
      ),
    );
    if (inv.Status === 'InProgress' || inv.Status === 'Pending') continue;
    rmSync(dir, { recursive: true, force: true });
    if (inv.StandardOutputContent) console.log(inv.StandardOutputContent);
    if (inv.Status !== 'Success') {
      console.error(inv.StandardErrorContent || '(no stderr)');
      throw new Error(`${name} failed on the box: ${inv.Status}`);
    }
    return inv.StandardOutputContent;
  }
  throw new Error(`${name} did not finish within 20 minutes`);
}

// ---------------------------------------------------------------------------
if (!skipBuild) {
  if (noRebuild) {
    log('Reusing the local images');
    // Refuse to ship what is not there, and refuse to ship the wrong CPU: an
    // arm64 image loads happily on the box and only fails at container start
    // with "exec format error", long after the deploy reported success.
    for (const app of APPS) {
      const arch = shOut(
        `docker image inspect greatsales/${app}:latest --format "{{.Architecture}}"`,
      );
      if (arch !== 'amd64') {
        throw new Error(
          `greatsales/${app}:latest is ${arch}, but the box is amd64. Rebuild without --no-rebuild.`,
        );
      }
      console.log(`  greatsales/${app}:latest (${arch})`);
    }
  } else {
    log(`Building images (tag ${tag}): ${APPS.join(', ')}`);
    // The box is x86_64; this machine may not be, and a silently mismatched
    // architecture only shows up as "exec format error" at container start.
    for (const app of APPS) {
      sh(
        `docker build --platform linux/amd64 -f apps/${app}/Dockerfile ` +
          `-t greatsales/${app}:${tag} -t greatsales/${app}:latest .`,
      );
    }
  }

  log('Saving images');
  sh(
    `docker save ${APPS.map((a) => `greatsales/${a}:latest`).join(' ')} -o images.tar`,
  );

  // MEASURED, not assumed: this only saves about 2.5% (258.5MiB -> 251.9MiB).
  // buildkit already stores layers compressed, so `docker save` output is
  // essentially incompressible -- the earlier claim here that gzip would cut it
  // to a third was wrong. It is kept because `docker load` sniffs the magic
  // bytes (so the box needs no extra step) and a few MB off a ~20 minute upload
  // is still free, but do NOT expect it to make a slow deploy fast. If you want
  // that, the fix is a registry the box pulls from, not better compression.
  // Done with node's zlib rather than a `| gzip` pipe because execSync runs
  // through cmd.exe on Windows, where that pipe does not exist.
  log('Compressing');
  await pipeline(
    createReadStream('images.tar'),
    createGzip({ level: 6 }),
    createWriteStream(ARCHIVE),
  );
  rmSync('images.tar', { force: true });
  const localSize = statSync(ARCHIVE).size;
  console.log(`  ${(localSize / 1024 / 1024).toFixed(1)}MB compressed`);

  // `aws s3 cp` has been seen exiting 0 on a transfer that stopped less than
  // half way through, leaving the PREVIOUS object in place and no multipart
  // upload to find. A deploy then either 404s on the box or, worse, silently
  // ships the last image again. Trust the bucket, not the exit status -- and
  // because this is a home uplink pushing ~250MB, expect it to need more than
  // one go rather than failing the whole deploy on the first stall.
  const ATTEMPTS = 4;
  let remoteSize = -1;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    log(`Uploading images (attempt ${attempt} of ${ATTEMPTS})`);
    try {
      sh(
        `aws s3 cp ${ARCHIVE} s3://${BUCKET}/${ARCHIVE} --region ${REGION} --only-show-errors`,
        {
          env: {
            ...process.env,
            // Fewer, larger parts and adaptive retries: the default 10-way
            // concurrency is what saturates and then stalls a thin uplink.
            AWS_MAX_ATTEMPTS: '10',
            AWS_RETRY_MODE: 'adaptive',
            AWS_REQUEST_CHECKSUM_CALCULATION: 'when_supported',
          },
        },
      );
    } catch (e) {
      console.error(`  upload attempt ${attempt} errored: ${e.message}`);
    }

    try {
      remoteSize = Number(
        JSON.parse(
          shOut(
            `aws s3api head-object --bucket ${BUCKET} --key ${ARCHIVE} --region ${REGION}`,
          ),
        ).ContentLength,
      );
    } catch {
      remoteSize = -1; // no object at all
    }

    if (remoteSize === localSize) {
      console.log(`  verified ${remoteSize} bytes in s3://${BUCKET}/${ARCHIVE}`);
      break;
    }
    console.error(
      `  incomplete: S3 has ${remoteSize} bytes, local archive is ${localSize}`,
    );
    if (attempt === ATTEMPTS) {
      throw new Error(
        `upload did not complete after ${ATTEMPTS} attempts. Nothing was deployed.`,
      );
    }
  }
}

log('Uploading compose + Caddyfile');
sh(`aws s3 cp deploy/docker-compose.prod.yml s3://${BUCKET}/docker-compose.yml --region ${REGION}`);
sh(`aws s3 cp deploy/Caddyfile s3://${BUCKET}/Caddyfile --region ${REGION}`);

log('Deploying on the box');
onBox(
  'greatsales deploy',
  `
set -euo pipefail
cd ${REMOTE}

# Wait for the bootstrap script to finish on a freshly launched box.
for i in $(seq 1 60); do [ -f ${REMOTE}/.provisioned ] && break; sleep 5; done

aws s3 cp s3://${BUCKET}/docker-compose.yml ./docker-compose.yml --region ${REGION}
aws s3 cp s3://${BUCKET}/Caddyfile ./Caddyfile --region ${REGION}
aws s3 cp s3://${BUCKET}/${ARCHIVE} ./${ARCHIVE} --region ${REGION}
docker load -i ${ARCHIVE}
rm -f ${ARCHIVE}

# Generate secrets ONCE. A re-run must not rotate them: the JWT secrets would
# invalidate every signed-in session and the DB passwords would lock the API
# out of its own database.
if [ ! -f .env ]; then
  umask 077
  cat > .env <<ENVEOF
POSTGRES_PASSWORD=$(openssl rand -hex 24)
APP_DB_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=http://35.154.59.213
SITE_ADDRESS=:80
SENTRY_DSN=
STORAGE_DRIVER=s3
S3_BUCKET=greatsales-attachments-887793660359-aps1
S3_REGION=ap-south-1
ENVEOF
  chmod 600 .env
  echo "generated ${REMOTE}/.env"
else
  echo "keeping existing ${REMOTE}/.env"
fi

set -a; . ./.env; set +a

docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U greatsales -d greatsales; do sleep 2; done

# The owner role's password is baked into the postgres image only on FIRST
# start, so align it with .env explicitly — otherwise a regenerated .env and an
# existing volume disagree and every connection fails.
docker compose exec -T postgres psql -U greatsales -d greatsales -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE greatsales ENCRYPTED PASSWORD '\${POSTGRES_PASSWORD}';" || true

# Migrations FIRST, on their own. They create greatsales_app with the literal
# password 'greatsales_app' (see the RLS migration), so the role has to exist
# AND be rotated before the API ever tries to connect. Starting everything at
# once failed authentication, took the whole deploy down, and never reached the
# rotation line that would have fixed it.
docker compose up -d --no-deps db-migrate
docker compose wait db-migrate || {
  docker compose logs --tail 40 db-migrate
  exit 1
}

# Postgres is not published outside this compose network, but a role that can
# read every tenant's data must not keep a password written in a migration file.
# Idempotent: a re-run sets the same value.
docker compose exec -T postgres psql -U greatsales -d greatsales -v ON_ERROR_STOP=1   -c "ALTER ROLE greatsales_app ENCRYPTED PASSWORD '\${APP_DB_PASSWORD}';"

docker compose up -d --wait --wait-timeout 300 || {
  echo '--- api ---';  docker compose logs --tail 60 api
  echo '--- migrate ---'; docker compose logs --tail 40 db-migrate
  exit 1
}

# Nightly pg_dump to S3. The instance role carries the write permission, so
# no credentials sit on the box. A backup nobody has restored is not a backup:
# see AGENTS.md for the restore drill this pairs with.
cat > /opt/greatsales/backup.sh <<'BAKEOF'
#!/bin/bash
set -euo pipefail
cd /opt/greatsales
STAMP=\$(date -u +%Y%m%dT%H%M%SZ)
DAY=\$(date -u +%Y/%m/%d)
DEST="s3://greatsales-backups-887793660359-aps1/postgres/\${DAY}/pg_dump-\${STAMP}.sql.gz"
# One line on purpose. This pipeline was written across three lines with
# continuations that did not survive being embedded in this script, leaving a
# bare "|" at the start of a line: bash refused the file, and because the
# refusal came AFTER pg_dump had already run, every nightly backup dumped the
# whole database into the systemd journal and uploaded nothing. The bucket was
# empty for as long as the timer had existed.
# The size is counted in the stream rather than read back with head-object,
# because the instance role can write to this bucket and not read it.
docker compose exec -T postgres pg_dump -U greatsales -d greatsales --clean --if-exists | gzip -9 | tee >(wc -c > /tmp/gs-backup-size) | aws s3 cp - "\$DEST" --region ap-south-1

# pipefail fails the unit on a failed pg_dump, but a stream that dies early
# still uploads whatever it managed. A dump this small is not a database.
SIZE=\$(cat /tmp/gs-backup-size)
if [ "\$SIZE" -lt 10000 ]; then
  echo "backup is only \$SIZE bytes - treating as failed" >&2
  exit 1
fi
echo "backup -> \$DEST (\$SIZE bytes)"
BAKEOF
chmod +x /opt/greatsales/backup.sh

# A systemd timer, not cron: Amazon Linux 2023 ships no crontab, and a timer
# survives reboots, logs to journald and is idempotent to re-install.
cat > /etc/systemd/system/greatsales-backup.service <<'SVCEOF'
[Unit]
Description=GreatSales nightly database backup to S3
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/greatsales/backup.sh
SVCEOF

cat > /etc/systemd/system/greatsales-backup.timer <<'TMREOF'
[Unit]
Description=Run the GreatSales backup nightly

[Timer]
OnCalendar=*-*-* 02:15:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
TMREOF

systemctl daemon-reload
systemctl enable --now greatsales-backup.timer
systemctl list-timers greatsales-backup.timer --no-pager | head -3

echo '--- containers ---'
docker compose ps
echo '--- health ---'
curl -fsS localhost/api/v1/health/ready && echo
echo '--- console ---'
curl -fsS -o /dev/null -w "web %{http_code}
" localhost/
`,
);

log(`Deployed. http://35.154.59.213  (tag ${tag})`);
