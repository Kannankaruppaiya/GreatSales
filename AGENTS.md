# AGENTS.md — GreatSales CRM

> **Scope:** This file governs every agent, contributor, and automated worker touching this
> repository. It is the standing engineering contract for the project. Read it before planning,
> before writing code, and before claiming anything is done.

---

# RUNNING AND CHECKING THIS APP LOCALLY

Do not re-derive any of this. Ports, credentials and the seed command are settled; the only
correct response to "is everything still wired?" is to run the commands below.

```bash
pnpm facts                                             # what exists: features, pages, wiring, env — answer questions from this
pnpm parity                                            # what web can do that mobile cannot, per feature
docker compose up -d                                   # Postgres :5433, Redis :6380
pnpm --filter @greatsales/db db:seed:promech           # the authoritative dataset, tenant_promech
pnpm --filter api start:dev                            # API on :3001, prefix /api/v1
pnpm --filter web dev                                  # web on :5174, proxies /api/v1
pnpm wiring                                            # static: which endpoints no client calls
pnpm smoke -- --period 2026-06                         # runtime: every feature's read endpoint, ~3s
pnpm design                                            # static: design-token drift in apps/web, ratcheted
pnpm verify                                            # wiring + design + smoke + API unit + web unit suites
pnpm test:e2e:qa                                       # browser QA sweep: pages, RBAC, CRUD, API contract
pnpm test:e2e                                          # the whole Playwright suite (adds the older page specs)
pnpm share                                             # this machine's app on a public HTTPS link, for a demo
pnpm icons                                             # redraw every favicon and app icon from the brand mark
```

- **A question about the application is answered by `pnpm facts`, not by reading the repository.**
- **"What is missing on mobile?" is answered by `pnpm parity`.** It lists, per feature,
  the endpoints the web client calls and the mobile client does not, plus any mobile
  query hook that nothing outside `gs/queries` imports — the case where `pnpm wiring`
  counts an endpoint as reachable on mobile because a hook exists, while no screen ever
  calls it. Both halves are recomputed from the source, so neither can drift.
  It derives the feature matrix from `features.ts`, the router, the controllers and the tests on
  every run, so it cannot go stale the way a checklist does. A SessionStart hook
  (`.claude/settings.json`) already injects its one-line form at the start of every session.
- Logins: `admin@greatsales.local` / `admin`, everyone else `<username>@greatsales.local` /
  `1234`, tenant `tenant_promech`.
- `pnpm smoke` names its own fix when it fails — a refused connection or a wrong dataset each
  print the one command that repairs it. Trust that line instead of investigating.
- `pnpm test:e2e:qa` drives a real browser, so it needs the API on :3001 and the Promech
  seed already in place; Playwright starts the web server itself. It creates records through
  the UI and deletes them through the API afterwards, so it leaves the dataset as it found it.
  The specs live in `tests/e2e/qa/` and take their page list from
  `apps/web/src/data/features.ts` — declare a feature there and the sweep covers it next run.
- **The API e2e suites (`pnpm --filter api test:e2e`) reseed the same Postgres** and destroy the
  Promech data. Re-run `db:seed:promech` afterwards.
- **Give the API a moment after a reseed.** `db:seed:promech` TRUNCATEs every table while the
  server is still holding connections to them, so the first requests after it can come back 500 —
  including `/auth/login`, which makes an unrelated test suite fail at its first step with
  nothing to do with the code. Wait for `curl localhost:3001/api/v1/health` to answer 200 before
  starting a run.
- **Check what the API on :3001 is actually running before you trust a probe.** A server started
  as `node apps/api/dist/main` serves the last *build*, not the working tree, so a source change
  you just made is invisible and a green probe proves nothing about it. `netstat -ano | grep :3001`
  then `Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"` shows the command line; if it
  names `dist/main`, restart it as `start:dev` (watch mode) or `pnpm build` first.
- `pnpm wiring` needs no running server: it reads the Nest controllers and greps web + mobile for
  the calls, so it answers "which endpoint has no client?" while `pnpm smoke` answers "does the
  endpoint actually work?". Run both; neither replaces the other.
- **Showing the app to somebody who is not on this machine is `pnpm share`, and nothing else.**
  It builds the console, serves `dist/` and proxies `/api` to :3001 from ONE port, then opens a
  Cloudflare quick tunnel (no account, no signup) and prints the `https://….trycloudflare.com`
  link. One origin is the whole point: the refresh token is an httpOnly `SameSite=Lax` cookie, so
  two tunnels — one per port — would log every visitor out at the first token rotation. It serves
  the production build rather than the dev server because Vite rejects a hostname it was not
  started with, its HMR socket cannot be told the tunnel's port, and `src/lib/config.ts` blanks
  the demo login prefill in a production build, which is what keeps `admin` / `admin` from
  arriving pre-typed on a public page. The link is password-gated by default (`--open` removes
  the gate, `--password X` sets it); the gate is a Basic prompt that trades itself for a cookie,
  because the console sends its own `Authorization: Bearer` on every API call and a header-only
  gate would reject them all. The hostname is new every run and dies with the process.
- Neither script drives a browser. For that, load each feature under
  `/managements/:managementId/<feature key>` (keys live in `apps/web/src/data/features.ts`) and
  watch for a non-200 in the network log.

## Turning a Penpot screen into code

`tools/penpot-to-code/` drives [FigmaToCode](https://github.com/bernaferrari/FigmaToCode)'s code
generators against our Penpot boards. FigmaToCode is a Figma plugin, but its generators only read
a plain Figma REST `JSON_REST_V1` node tree; the Figma API is used before them, to build that tree
and to flatten vectors. So we build the tree ourselves.

**Setup, once:** `pnpm design:setup` clones FigmaToCode to `~/FigmaToCode` (outside this repo: it
is GPL-3.0 and used as a dev-time tool, never linked into the product) and installs its backend
deps with pnpm 11. `PENPOT_TOKEN` in `.env.local` (Penpot → Settings → Access tokens) lets the
build pull the real images.

**Every board at once** — 75 screens in about three seconds:

```bash
pnpm design:all                       # defaults to ~/Downloads/greatsales-penpot-file.json
pnpm design:all --page mobiles --only "03A"
```

It writes, per board, a compact dump under `design-dumps/`, a standalone page and Tailwind JSX
under `design-reference/generated/`, plus an `index.html` contact sheet of every screen. Both
directories are gitignored: they regenerate from the Penpot file in seconds.

The input is the JSON Penpot's API returns for `get-file`. **Cloudflare challenges plain HTTP
clients on Penpot's `/api/` paths**, so curl and Node cannot fetch it even with a valid token; it
has to come from a browser tab that is already on design.penpot.app:

```js
const r = await fetch('/api/rpc/command/get-file?id=' + FILE_ID,
  { headers: { Authorization: 'Token ' + TOKEN, Accept: 'application/json' } });
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([await r.text()], { type: 'application/json' }));
a.download = 'greatsales-penpot-file.json'; a.click();
```

Images are the exception — `/assets/by-file-media-id/<id>` is not behind the challenge, so
`pull-images.mjs` fetches them straight from Node during the build.

**One board, live:** run `tools/penpot-to-code/penpot-extract.js` in the Penpot MCP with
`BOARD_NAME` set, save what it returns as `design-dumps/<board>.json`, then
`pnpm design:code design-dumps/<board>.json --framework Tailwind --mode jsx -o out.jsx`.
Frameworks: `HTML`, `Tailwind`, `Flutter`, `SwiftUI`, `Compose`. Use this when the live selection
matters; it costs ~24 KB of conversation per screen, because the plugin sandbox has no DOM, no
compression and no way to reach a local receiver, so every byte travels through the MCP result.

Three things were wrong before this pipeline matched Penpot, and they will bite again if the
mapping is rewritten: a Penpot shape's `transform` applies **about the centre of its selrect**
(applied raw, 503 of 2096 paths flew off their own viewBox); a path's box excludes its stroke, so
the SVG viewBox, not the selrect, is the node's box; and an inline `<svg>` sits on the text
baseline, so icons need `svg { display: block }` or short ones drop to the bottom of their line
box. Text keeps its per-run styles through this path, because the file format carries a style on
every run.

---

# PRODUCTION: THE AWS BOX

Settled facts. Do not re-derive them and do not go looking in the console.

| | |
| --- | --- |
| Instance | `i-08e5747f469972dc8` — t3.small, 2 vCPU / 2GB, ap-south-1a (Mumbai) |
| Address | **https://greatworksapp.in** (and `www.`, which 301s to it) — Elastic IP `35.154.59.213` (`eipalloc-0bee29ea84de2920e`). Let's Encrypt via Caddy, cut over 2026-09-20. |
| Security group | `sg-0eb64bff751477705` — 80/tcp, 443/tcp, 443/udp. Port 22 is not open. |
| Memory | 2GB + a 2GB swapfile (`vm.swappiness=10`). Postgres is tuned DOWN for this box — see below. |
| Access | **SSM Run Command only.** There is no SSH key and port 22 is closed. |
| App root | `/opt/greatsales` — compose file, Caddyfile, `.env` (mode 600), `backup.sh` |
| Secrets | generated ON the box at first deploy, never in git, never on a command line |
| Buckets | `greatsales-deploy-…` (image tarballs), `greatsales-backups-…` (pg_dump) |
| Backup | nightly 02:15 UTC, systemd timer `greatsales-backup.timer` → S3 |
| Alerting | SNS `greatsales-alerts` in **both** ap-south-1 and us-east-1 → kannankaruppaiya10@gmail.com |

```bash
pnpm deploy:aws                             # build here, ship through S3, deploy over SSM
pnpm deploy:aws --skip-build                # redeploy the images already in S3
pnpm deploy:aws --no-rebuild                # reship the LOCAL images (a failed upload), no rebuild
pnpm box 'docker compose ps'                # run any shell command on the box over SSM
pnpm domain:cutover                         # IP -> https://greatworksapp.in (checks DNS first)
pnpm domain:cutover -- --rollback           # back to plain HTTP on the IP
pnpm backup:drill                           # restore the newest S3 dump and diff it against live
```

- **`pnpm box` with an absolute path needs `MSYS_NO_PATHCONV=1` from Git Bash.** Git Bash
  rewrites a leading `/opt/...` into `C:/Program Files/...` before the argument ever reaches
  the script, and the box then fails with `No such file or directory` naming a Windows path
  it was never given. Prefix the command, e.g.
  `MSYS_NO_PATHCONV=1 pnpm box 'bash /opt/greatsales/backup.sh'`.
- **Take a backup before any deploy that carries a migration**: `pnpm box 'bash
  /opt/greatsales/backup.sh'` writes a dump to S3 and prints its size. The nightly timer is
  not close enough when you are about to change the schema.
- **Images are built on the developer machine, never on the box.** 2GB is enough to RUN the
  stack beside Postgres and nowhere near enough to build it.
- The deploy is ordered `migrate → rotate greatsales_app's password → start the API`. That
  order is not cosmetic: the RLS migration creates the role with the literal password
  `greatsales_app`, so starting the API first fails authentication and takes the deploy down
  before it reaches the line that would have fixed it.
- `.env` is written once and then left alone. Regenerating it would invalidate every signed-in
  session (new JWT secrets) and lock the API out of its own database (new DB passwords).

## The hostname and its certificate

**Done, 2026-09-20.** `greatworksapp.in` is registered at **GoDaddy** (not Route 53) and its
DNS is served by GoDaddy's nameservers (`ns53`/`ns54.domaincontrol.com`). The zone holds one
`A @ -> 35.154.59.213` (TTL 600) and GoDaddy's default `CNAME www -> @`. Caddy holds two
separate Let's Encrypt certificates, one per site block, and renews them itself.

This is the method GoDaddy itself documents for an external server — an A record while the
domain uses GoDaddy nameservers. The alternatives were checked and rejected: changing
nameservers would require a Route 53 hosted zone for no benefit, and GoDaddy **Forwarding**
both *locks the `@` A record* and does not support HTTPS at all.

There is **no CAA record** (so nothing restricts which CA may issue) and **no DS record** (so
DNSSEC is off). If either changes, certificate renewal is the first thing that breaks.

Do not edit `.env` by hand for this. `pnpm domain:cutover` refuses unless the name already
resolves to the Elastic IP (a failed ACME challenge burns a per-domain weekly rate limit),
changes both lines together, recreates `caddy` and `api`, verifies HTTPS from OUTSIDE the box,
and restores the previous `.env` automatically if the stack does not come back. Once a hostname
is set Caddy stops answering on the bare IP, so a failed cutover is an outage, not a cosmetic
problem — which is why the check runs before anything is touched.

`www` is handled. `deploy/Caddyfile` carries a second site block that takes a certificate for
`www.<host>` and 301s it to the bare name, so there is exactly one origin and no certificate
warning for people who type www. The block is driven by `WWW_SITE_ADDRESS` / `PRIMARY_HOST`,
whose defaults (`http://localhost:9080`, `localhost`) make it **inert**: an `http://` address
asks Caddy for no certificate at all, so it sits idle while the box serves its bare IP.

`pnpm domain:cutover` decides whether to switch it on by resolving `www.<host>` first, and
leaves it off unless that name already points at this box — enabling it for a name that does
not resolve would fail an ACME challenge on every retry, and Let's Encrypt counts those per
registered domain per week, which can cost you the real certificate.

Both shapes of this file were validated with `caddy validate` on the box before it shipped
(2026-09-20): IP mode and www-enabled mode both report `Valid configuration`. Do that again
after editing it — a Caddyfile that fails to parse takes the entire site down on restart:

```bash
pnpm box 'docker run --rm -e SITE_ADDRESS=":80" -v /opt/greatsales/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile'
```

### A page reload used to sign you out — fixed by HTTPS, do not "fix" it in code

Kept because the symptom is misleading. The refresh cookie is set `secure: !isDev`
(`apps/api/src/auth/auth.controller.ts`), so while the box served plain HTTP the browser
never stored it, and any full page load landed on the sign-in door. Verified resolved on
2026-09-20: a login over `https://greatworksapp.in` now returns
`Set-Cookie: gs_rt=...; HttpOnly; Secure; SameSite=Lax`.

If this ever reappears, the cause is the site being reached over plain HTTP — never relax
`secure`.

The Elastic IP is what makes this survive: stop and start the instance and the ephemeral public
address changes, but the EIP does not, so the A record never has to be touched again. Do not
release it — the previous box's EIP was released when it was terminated, which is why this one
has a new address.

`SITE_ADDRESS` and `CORS_ORIGIN` in `/opt/greatsales/.env` carry that hostname and **must change
together** — the console is served from the API's own origin, and the env contract rejects a
`CORS_ORIGIN` that does not match. After editing both:

```bash
pnpm box 'cd /opt/greatsales && docker compose up -d --force-recreate caddy api'
```

Order matters on a first cutover: point DNS first, confirm it resolves, and only then set
`SITE_ADDRESS` to the hostname. Caddy asks Let's Encrypt for a certificate the moment it starts
with a name, and a failed challenge against a name that does not resolve yet burns attempts
against the rate limit.

`apps/mobile/app.json` carries the same URL in `extra.apiBaseUrl`, which is what a release build
falls back to when there is no Metro host to infer from.

## What is on the production database right now

**Seeded with the Promech dataset on 2026-09-20**, deliberately, so the live site is not empty:
417 customers, 282 projections, 234 products, 141 payments, 12 users, in `tenant_promech`.

This was done with `seed-promech.ts` and `ALLOW_DESTRUCTIVE_SEED=1`. Understand what that means
before repeating it: **the seed TRUNCATEs every table first**. It does not merge, and it will
destroy real tenant data. The guard in `prisma/seed-guard.ts` refuses on `NODE_ENV=production`
and on a non-local host precisely to stop this happening by accident; the override is the honest
way to say "I mean it", and faking `NODE_ENV=development` is not.

**Take a backup first** (`pnpm box 'bash /opt/greatsales/backup.sh'`) — it was done here, and the
pre-seed dump is in the backups bucket if the old state is ever needed.

### The logins, which are NOT the dev ones

The seed creates `admin@greatsales.local` / `admin` and everyone else on `1234`. Those are fine
on a laptop and unacceptable on a public domain, so every account was changed immediately after
seeding:

| | |
| --- | --- |
| Workspace | `tenant_promech` — "Promech" |
| Admin | `greatworksramesh@gmail.com` — the password its owner chose |
| The 11 demo users | `<name>@greatsales.local`, all sharing one strong password |

Changed with `PATCH /users/:id`, **not** `POST /users/:id/reset-password`: the reset endpoint
sets `mustChangePassword`, which would force a password change on every demo account at first
sign-in and defeat the point of having them. `PATCH` re-hashes and leaves the flag alone.

The shared password must not contain a 4+ character fragment of any user's own name, email
local-part or username — and note that **`promech` is itself a username**, so a password built
around the company name is rejected for that account and no other, which is a confusing failure
if you do not know to expect it.

## Alerting, and what it does and does not cover

| Alarm | Region | Fires when |
| --- | --- | --- |
| `greatsales-prod-unreachable` | us-east-1 | Repointed to `greatworksapp.in` on 2026-09-20 and back to **OK** within 90s, after 11 days in ALARM pointing at the terminated box. Its `FullyQualifiedDomainName` is the one thing to update whenever the hostname changes — the check is HTTPS with SNI, so it also proves the certificate. A Route 53 health check against `https://…/api/v1/health/ready` fails from AWS's external checkers. Covers the app, Caddy, the certificate and the network — not just the box. |
| `greatsales-box-status-check-failed` | ap-south-1 | EC2 reports the instance itself unhealthy. |

The health check is external on purpose: a heartbeat published *by* the box cannot tell you
that the box is unreachable *from outside*, which is the failure the customer actually sees.
Route 53 health-check metrics only exist in us-east-1 and a CloudWatch alarm can only notify a
topic in its own region, which is why the SNS topic exists twice.

**Neither alarm reports application errors.** That is Sentry's job — project `greatsales-api`
in org `greatsales`, EU region. `SENTRY_DSN` lives in `/opt/greatsales/.env` and nowhere else;
it is a write-only ingest key, not a credential that can read anything back.

Only errors that are NOT `HttpException` are reported: a 400 or a 404 is a decision the code
made, and paging on those buries the ones that matter
(`apps/api/src/common/all-exceptions.filter.ts`). To raise a real one on purpose, POST a
customer with an `industryId` that does not exist — Prisma throws a foreign key error, the
filter reports it, and nothing is written:

```bash
curl -X POST https://greatworksapp.in/api/v1/customers -H "Authorization: Bearer $TOK"   -H 'Content-Type: application/json'   -d '{"name":"__sentry_probe__","salespersonId":"<a real user id>","industryId":"nope"}'
```

## Onboarding a customer

A production database has no tenant, no roles and no users — the seed scripts cannot be used
because every one of them truncates first.

```bash
pnpm db:provision -- --tenant acme --name "Acme Industrial" --admin-email ops@acme.com
```

It only ever inserts: it refuses a tenant id that already exists, upserts the global permission
catalogue, and prints the generated admin password once. The admin is created with
`mustChangePassword`, so that password is a hand-over secret rather than a credential.

`--admin-password <password>` sets a chosen credential instead of a generated one and clears
`mustChangePassword`, so the owner signs in with the password they were given. It is checked
against the same policy the API enforces (`packages/shared/src/password.ts`); a password that
fails is refused unless `--allow-weak-password` is also passed, and that escape hatch is
itself refused when `NODE_ENV=production`.

A second dev workspace exists alongside Promech: `tenant_trade` — "Trade", admin
`admin@trade.com` / `Admin@2026` (below the 12-character policy, so it was created with
`--allow-weak-password`; it has no data). **Every seed script TRUNCATEs the whole database, so
`db:seed:promech` destroys it.** Recreate it with:

```bash
pnpm db:provision -- --tenant trade --name "Trade" --admin-email admin@trade.com --admin-name "Trade Admin" --admin-password 'Admin@2026' --allow-weak-password
```

## Still open

- **The instance role cannot ship container logs.** Only the application's own uncaught
  errors reach Sentry; a container that dies before Nest starts leaves nothing outside
  journald. Granting `logs:*` on `/greatsales/*` and switching the compose logging driver to
  `awslogs` closes it.
- **The instance role cannot read its own backups.** `greatsales-deploy-buckets` grants
  `s3:PutObject` on the backups bucket and nothing else, so a restore cannot be driven from
  the box — `pnpm backup:drill` works around it by shipping the dump in over SSM, which stops
  working once a dump exceeds ~90KB base64. Grant `s3:GetObject` and `s3:ListBucket` on
  `greatsales-backups-…` before the database is big enough to matter.
- **A failed backup tells nobody.** The unit fails loudly into journald and no further. Giving
  the instance role `sns:Publish` on `greatsales-alerts` and adding `OnFailure=` to the unit
  closes it.
- **The AWS account is used through ROOT access keys.** A leak costs the whole account,
  including `ralp-app`. Create an IAM user and delete the root keys.

## The backup, and why it is now checked

Until 2026-09-06 the backups bucket had been empty for as long as the timer had existed. The
`backup.sh` written by `scripts/deploy-aws.mjs` had lost the line-continuations in its
`pg_dump | gzip | aws s3 cp` pipeline, so bash aborted on a bare leading `|` — but only
*after* `pg_dump` had already run, which meant every night dumped the entire database into the
systemd journal and uploaded nothing. The timer reported no error anybody looked at.

The pipeline is one line now and the script fails on a dump under 10KB. Run
`pnpm backup:drill` after any change to it: it restores the newest object that is genuinely in
S3 into a throwaway database on the box and fails if any table's row count differs from live.

---

# PRODUCTION-FIRST ENGINEERING DIRECTIVE

This project is a real production application.

Every decision, architecture choice, implementation, code change, database change, API, UI,
integration, configuration, test, and deployment must be approached as production engineering.

**Do NOT treat this project as:**

- A demo
- A prototype
- A proof of concept
- A tutorial
- A sample application
- A temporary implementation
- A throwaway project
- A mock application
- A simplified exercise

Assume that real users, real data, real business operations, real security threats, real failures,
real traffic, and real operational costs will exist.

The code must be written with the expectation that it will be deployed, maintained, monitored,
scaled, tested, audited, and extended for years.

---

## PRODUCTION MEANS

### 1. Functional correctness

The implementation must satisfy the actual business requirements, business rules, workflows, edge
cases, and acceptance criteria.

Do not implement only the happy path.

### 2. User scale

Never assume that only a small number of users will use the application.

Design and evaluate the system for growth from:

1,000 users → 10,000 users → 100,000 users → 1,000,000+ users where applicable.

Consider concurrent users, request volume, traffic spikes, peak usage, background processing,
database load, and resource consumption.

### 3. Data scale

Never assume that the database will remain small.

Consider: 10K → 100K → 1M → 10M+ records where applicable.

Evaluate indexes, query performance, pagination, connection pools, locking, transactions, data
growth, archival, partitioning, and migration requirements.

### 4. Performance

Do not assume that an implementation is acceptable simply because it works.

Consider:

- Response time
- Database query time
- API latency
- Frontend rendering
- Network requests
- Memory consumption
- CPU usage
- Large payloads
- Bundle size
- Expensive operations
- N+1 queries
- Caching opportunities

Performance must be measurable.

### 5. Scalability

Every major architectural decision must be evaluated for future growth.

Ask:

- What happens when traffic increases 10x?
- What happens when traffic increases 100x?
- What becomes the first bottleneck?
- Can the service scale horizontally?
- Does the database become the bottleneck?
- Is caching required?
- Should work become asynchronous?
- Are queues required?
- Is the architecture unnecessarily stateful?

Do not prematurely over-engineer, but do not knowingly create a scaling bottleneck.

### 6. Reliability

Assume that components will fail.

Consider:

- Database failure
- API failure
- Network failure
- Third-party service failure
- Timeout
- Partial failure
- Duplicate requests
- Duplicate jobs
- Worker failure
- Deployment failure
- Infrastructure failure

Define appropriate retry, timeout, fallback, idempotency, recovery, and graceful-degradation
strategies.

**A reporting window is a granularity plus an anchor, never a stored range.**
The dashboard offers a day, a week, a month or a year; `useUi` holds
`{granularity, anchor}` and `resolveRange` derives `from`/`to` on read, so a tab
left open overnight moves with the calendar instead of reporting yesterday as
today. The API is sent the resolved dates — it never learns which button was
pressed — and works out the months it needs from them with `monthsInRange`.

Two rules follow from the data model and both are easy to get wrong. A
`Projection`, a `SalesTarget` and a `PeriodLock` are keyed by `YYYY-MM`: a
commitment IS a month, so a day or a week resolves to the one month containing
it and the recurring cards name that month. Do NOT prorate a monthly commitment
across days — that is inventing numbers. And the new-sales half is scoped by two
different dates on purpose: committed is what was RAISED in the window
(`createdAt`), achieved is what was WON in it (`stageUpdatedAt`). Before this the
half was not scoped at all, which is why the old month dropdown showed the same
pipeline total under every month and looked broken.

`apps/web/src/data/periodRange.ts` MIRRORS `packages/shared/src/period-range.ts`
— the Vite build cannot consume the CJS shared dist, the same arrangement
`months.ts` uses. Two copies of date arithmetic is the dangerous kind of
duplication, so `tests/data/periodRange.test.ts` pins one side and
`dashboard.service.spec` the other. Change both, or neither.

### 7. Security

**Ask `pnpm wired` before reading the repository to find out what is wired.**
It runs the layer checks — frontend↔API (`check-wiring.mjs`), API↔tables
(`check-db-wiring.mjs`), live response↔declared type (`check-contract.mjs`) —
and prints only the exceptions. Reading the source to answer the same question
costs about 468,000 tokens; `pnpm wired --json` costs about 400, because
everything that is fine is left out. The scripts decide what is true; whether a
finding is a defect or a deliberate gap is the reader's judgement.

Two things about `check-db-wiring.mjs` are worth knowing before trusting or
extending it. Prisma nested writes address a table by its RELATION field, not
its model name — `salesOrder.create({ data: { items: { create: [...] } } })`
never says `salesOrderItem` — so a name-only scan reports four written tables as
untouched. And the seeds are counted separately from the application: a table
only a fixture writes is not a wired feature, and folding them into one corpus
turned four genuinely unwired tables green.

`check-wiring.mjs` finds a call by the LITERAL path it is written with, so two
things make a live route read as dead. A helper whose name is not in its list
(`apiFetchBlob` was missing, and `apiFetch` matched the start of it and then
failed) — add the name there rather than widening the pattern, longest first.
And a path built by a function instead of written out: prefer the literal at
the call site. A route nothing appears to call is a route somebody deletes.

`INFRASTRUCTURE_MODELS` is a map of model to REASON, and the reason is printed.
`PlatformUser` and `PlatformAuditLog` are listed there because the tenant app's
database role has SELECT revoked on both — code in `apps/api` touching either
would be the defect, not the fix. Adding a name without a reason that survives
review is how a checker stops meaning anything.

**Migrations must reach the TEST database too.** There are two — `greatsales`
and `greatsales_test` — and `db:deploy` only touches the first, so a migration
verified by hand against dev failed the suite with "the column does not exist",
which reads as a code fault and is not one. `pnpm --filter api test` now runs
`scripts/migrate-test-db.mjs` first; `pnpm db:deploy:test` runs it alone.


**Who may sign in from where is decided by the API, not by the client.**
`/auth/login` takes a `client` (`web` | `mobile`) and, on web, the `portal`
(`super_admin` | `admin` | `mgmt` | `sales`) whose URL was used. After the
password verifies — never before — the service checks both against
`CLIENT_ROLE_ALLOWLIST` and `roleMatchesPortal` in `packages/shared/src/auth.ts`
and refuses with 403. `mobile` currently admits `sales` only: the app has no
user administration, role editor or tenant settings, so an admin session there
buys nothing and only widens where an admin credential can be left signed in on
a personal phone. A permission backstop (`user.manage`, `role.manage`,
`period.manage`) refuses admin-like custom roles whatever a tenant named them.

Three things about this are easy to undo by accident:

- **The order matters.** A specific refusal before the password is checked is an
  account-enumeration oracle — it would tell an attacker which addresses are
  administrators. A wrong password answers `401 Invalid credentials` from every
  client; only a *correct* credential gets the specific 403.
- **The refresh token carries the client** (`cli` claim) and rotation re-checks
  it, so a session cannot widen by being refreshed from somewhere else, and an
  account promoted to admin loses its live phone session at the next rotation
  rather than at token expiry.
- **The per-role web URLs are decoration without the `portal` check.**
  `/admin/login` and `/sales/login` post identical bodies to the same endpoint.

There is no shared `/login`. Each role signs in at its own address —
`/super-admin/login`, `/admin/login`, `/management/login`, `/sales/login` — and
`/login` renders a page telling the visitor to use theirs. Signed-in URLs lead
with the role (`/admin/managements/:id/dashboard`), so an expired session is
returned to the right door and nowhere wider, and sign-out goes to the door the
person came through. `RequireRolePath` rejects a segment the session does not
hold. Do not reintroduce a portal switcher on the login page: it put every door
one click from the administrator form, which is the thing these addresses exist
to prevent.

Tests: `apps/api/src/auth/auth.service.spec.ts` → "client restriction" and
"web portal".


Assume that users may be malicious and that every externally accessible interface may be attacked.

Consider:

- Authentication
- Authorization
- RBAC
- Session security
- Input validation
- Output encoding
- SQL injection
- XSS
- CSRF
- SSRF
- IDOR/BOLA
- Privilege escalation
- Rate limiting
- Brute-force attacks
- Secrets exposure
- Sensitive data exposure
- File upload security
- Dependency vulnerabilities
- API abuse

**Never rely on frontend restrictions for security.**

### 8. Data integrity

Real production data must never be casually corrupted or lost.

Consider:

- Transactions
- Constraints
- Referential integrity
- Concurrency
- Duplicate submissions
- Idempotency
- Race conditions
- Migrations
- Backups
- Restore procedures
- Data retention
- Recovery procedures

### 9. Database engineering

Database design must be based on actual access patterns and future growth.

Consider:

- Schema design
- Relationships
- Indexes
- Constraints
- Query patterns
- Transactions
- Locks
- Connection limits
- Migration safety
- Backup and recovery
- Data growth

Do not blindly create tables based only on UI screens.

### 10. API engineering

APIs are production contracts.

Consider:

- Request validation
- Response validation
- Authentication
- Authorization
- Error contracts
- Status codes
- Pagination
- Filtering
- Sorting
- Rate limits
- Idempotency
- Versioning
- Backward compatibility
- Timeouts
- Retries
- Monitoring

Do not expose internal implementation details unnecessarily.

### 11. Frontend engineering

The frontend must be treated as production software, not visual mockup code.

Consider:

- Real API integration
- Loading states
- Error states
- Empty states
- Permission states
- Validation
- Accessibility
- Responsive behavior
- Performance
- State management
- Race conditions
- Network failures
- Offline/poor-network behavior where applicable
- Browser compatibility
- Security

### 12. Backend engineering

Backend code must enforce business rules independently of the frontend.

Consider:

- Business logic
- Validation
- Authorization
- Transactions
- Concurrency
- Error handling
- Logging
- Metrics
- Background processing
- Caching
- Queues
- Rate limiting
- Failure recovery
- Scalability

### 13. Observability

If something fails in production, engineers must be able to determine what happened.

Implement appropriate:

- Structured logging
- Error tracking
- Metrics
- Tracing
- Request IDs
- Correlation IDs
- Health checks
- Alerts
- Dashboards

Never create a production system that cannot be diagnosed.

### 14. Testing

Testing must verify more than whether the happy path works.

Consider: unit tests, integration tests, API tests, component tests, end-to-end tests, regression
tests, security tests, performance tests.

Test:

- Valid input
- Invalid input
- Boundary conditions
- Empty states
- Unauthorized access
- Concurrent requests
- Duplicate requests
- Service failures
- Database failures
- Large datasets
- High traffic

### 15. Deployment

Deployment is part of engineering, not an afterthought.

Consider:

- Environment configuration
- Secrets
- CI/CD
- Database migrations
- Deployment order
- Health checks
- Rollback
- Zero/minimal downtime
- Monitoring
- Post-deployment verification

Every risky deployment must have a recovery or rollback strategy.

### 16. Disaster recovery

Assume that serious failures can happen.

Consider:

- Backups
- Restore testing
- Recovery procedures
- Data recovery
- Service recovery
- Disaster scenarios
- Recovery Time Objective (RTO)
- Recovery Point Objective (RPO)

### 17. Maintainability

Code must be understandable and maintainable by developers who did not originally write it.

Avoid:

- Clever but unreadable code
- Unnecessary abstraction
- Hidden side effects
- Massive files
- Circular dependencies
- Duplicated business logic
- Hardcoded configuration
- Temporary hacks presented as permanent solutions

### 18. Extensibility

Do not design every feature only for today's requirements.

Consider how the system can safely evolve without requiring unnecessary rewrites.

But do not introduce abstractions without a real requirement.

### 19. Configuration

Environment-specific values must not be hardcoded.

Separate: development, testing, staging, production.

Manage secrets securely.

### 20. Third-party services

Never assume external services are permanently available.

For every external integration consider:

- Authentication
- Rate limits
- Pricing
- Timeouts
- Retries
- Failure behavior
- API changes
- Data privacy
- Vendor dependency
- Monitoring
- Fallback where necessary

### 21. Cost

Production architecture has operational cost.

Consider: compute, database, storage, bandwidth, APIs, AI model usage, token consumption,
third-party services, logging, monitoring.

Do not optimize only for technical elegance while ignoring operational cost.

### 22. AI token and context efficiency

AI-generated development must also be production-efficient.

Do not waste context on:

- Unrelated files
- Repeated information
- Huge logs
- Duplicate tool output
- Unnecessary tool definitions
- Entire repositories when only a few files are relevant
- Repeated explanations
- Unnecessary reasoning

Use:

- Targeted context retrieval
- Context budgets
- Prompt caching where supported
- Tool discovery
- Tool-result filtering
- Context compaction
- Persistent project documentation
- Task-specific context

Use the minimum context necessary to make the correct engineering decision.

**Do NOT reduce context at the expense of correctness.**

### 23. Backward compatibility

Before changing an existing API, schema, component, contract, or behavior, identify existing
consumers and dependencies.

Never assume that existing functionality can be changed freely.

### 24. Migrations

Any database, API, configuration, or architectural migration must consider:

- Existing production data
- Existing consumers
- Compatibility
- Deployment order
- Rollback
- Recovery

### 25. Auditability

Important business and security operations must be traceable where appropriate.

Consider:

- Who performed the action
- What changed
- When it changed
- Previous value
- New value
- Source/context of the action

### 26. Privacy and compliance

Treat sensitive and personal data carefully.

Consider:

- Data minimization
- Access control
- Encryption
- Retention
- Deletion
- Auditability
- Regulatory requirements applicable to the product

### 27. Accessibility

Production UI must be usable by people with different accessibility needs.

Consider:

- Keyboard navigation
- Screen readers
- Semantic HTML
- Focus management
- Contrast
- Form labels
- Error communication

### 28. Internationalization

Where applicable, do not assume:

- One language
- One currency
- One timezone
- One date format
- One number format

### 29. Failure before success

For every significant feature, think about failure scenarios before implementation.

Ask: **"What can go wrong?"**

Then define the appropriate behavior.

### 30. Change impact

Before modifying code, identify every potentially affected layer:

Frontend → State → API → Backend → Business Logic → Database → Authentication → Authorization →
Integrations → Tests → Monitoring → Deployment

Do not modify one layer blindly when the feature affects multiple layers.

### 31. No fake completion

Never claim a feature is production-ready when it contains:

- Fake APIs
- Hardcoded production behavior
- Fake authentication
- Fake authorization
- Placeholder business logic
- Unimplemented TODOs
- Silent error handling
- Temporary bypasses
- Dummy data inside production paths

If something is intentionally mocked, explicitly identify it as development-only.

### 32. AI must challenge bad requirements

Do not blindly follow instructions.

If the requested implementation is:

- Insecure
- Non-scalable
- Unmaintainable
- Unnecessarily expensive
- Architecturally inconsistent
- Likely to cause data loss
- Likely to create severe technical debt

**STOP and explain the problem before implementation.**

---

## 33. DEFINITION OF PRODUCTION-READY

A feature is production-ready only when:

| Area | Required state |
| --- | --- |
| Requirements | ✓ Complete |
| Business logic | ✓ Correct |
| Frontend | ✓ Complete |
| Backend | ✓ Complete |
| Database | ✓ Safe |
| API | ✓ Validated and secured |
| Authentication | ✓ Correct |
| Authorization | ✓ Enforced server-side |
| Error handling | ✓ Implemented |
| Edge cases | ✓ Considered |
| Security | ✓ Reviewed |
| Performance | ✓ Evaluated |
| Scalability | ✓ Evaluated |
| Testing | ✓ Completed appropriately |
| Observability | ✓ Available where required |
| Deployment | ✓ Safe |
| Rollback / recovery | ✓ Considered |
| Documentation | ✓ Updated |
| Maintainability | ✓ Acceptable |
| No known critical production blocker | ✓ Confirmed |

---

## FINAL DIRECTIVE

Do not ask:

> "How can I make this feature work?"

Think:

> "How do I implement this feature so that it remains correct, secure, observable, maintainable,
> testable, performant, scalable, recoverable, and operationally safe when real users, real data,
> real traffic, real failures, and future changes occur?"

The goal is not to generate code quickly.

**The goal is to generate production-quality software correctly.**
