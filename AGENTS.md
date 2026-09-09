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
- **Check what the API on :3001 is actually running before you trust a probe.** A server started
  as `node apps/api/dist/main` serves the last *build*, not the working tree, so a source change
  you just made is invisible and a green probe proves nothing about it. `netstat -ano | grep :3001`
  then `Get-CimInstance Win32_Process -Filter "ProcessId = <pid>"` shows the command line; if it
  names `dist/main`, restart it as `start:dev` (watch mode) or `pnpm build` first.
- `pnpm wiring` needs no running server: it reads the Nest controllers and greps web + mobile for
  the calls, so it answers "which endpoint has no client?" while `pnpm smoke` answers "does the
  endpoint actually work?". Run both; neither replaces the other.
- Neither script drives a browser. For that, load each feature under
  `/managements/:managementId/<feature key>` (keys live in `apps/web/src/data/features.ts`) and
  watch for a non-200 in the network log.

---

# PRODUCTION: THE AWS BOX

Settled facts. Do not re-derive them and do not go looking in the console.

| | |
| --- | --- |
| Instance | `i-0cc1f215b9bb900ad` — c7i-flex.large, 2 vCPU / 4GB, eu-west-2a |
| Address | https://18-130-99-225.sslip.io — Elastic IP `18.130.99.225` (`eipalloc-03b19235f5f3140d5`) |
| Access | **SSM Run Command only.** There is no SSH key and port 22 is closed. |
| App root | `/opt/greatsales` — compose file, Caddyfile, `.env` (mode 600), `backup.sh` |
| Secrets | generated ON the box at first deploy, never in git, never on a command line |
| Buckets | `greatsales-deploy-…` (image tarballs), `greatsales-backups-…` (pg_dump) |
| Backup | nightly 02:15 UTC, systemd timer `greatsales-backup.timer` → S3 |
| Alerting | SNS `greatsales-alerts` in **both** eu-west-2 and us-east-1 → kannankaruppaiya10@gmail.com |

```bash
pnpm deploy:aws                             # build here, ship through S3, deploy over SSM
pnpm deploy:aws --skip-build                # redeploy the images already in S3
pnpm box 'docker compose ps'                # run any shell command on the box over SSM
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
- **Images are built on the developer machine, never on the box.** 4GB is enough to RUN the
  stack beside Postgres and nowhere near enough to build it.
- The deploy is ordered `migrate → rotate greatsales_app's password → start the API`. That
  order is not cosmetic: the RLS migration creates the role with the literal password
  `greatsales_app`, so starting the API first fails authentication and takes the deploy down
  before it reaches the line that would have fixed it.
- `.env` is written once and then left alone. Regenerating it would invalidate every signed-in
  session (new JWT secrets) and lock the API out of its own database (new DB passwords).

## The hostname and its certificate

`sslip.io` resolves `18-130-99-225.sslip.io` to `18.130.99.225` with no registrar, no DNS
records to keep and no signup, and it sits on the Public Suffix List so Let's Encrypt treats
each name under it as its own registrable domain rather than sharing one rate limit with
every other user. Caddy fetches and renews the certificate on its own.

To move to a real domain later, point an A record at the Elastic IP and change two lines in
`/opt/greatsales/.env` — `SITE_ADDRESS` (the bare hostname) and `CORS_ORIGIN` (the same host
as an `https://` URL) — then `docker compose up -d --force-recreate caddy api`. Both have to
change together: the console is served from the API's origin, and the env contract rejects a
`CORS_ORIGIN` that does not match.

`apps/mobile/app.json` carries the same URL in `extra.apiBaseUrl`, which is what a release
build falls back to when there is no Metro host to infer from.

## Alerting, and what it does and does not cover

| Alarm | Region | Fires when |
| --- | --- | --- |
| `greatsales-prod-unreachable` | us-east-1 | A Route 53 health check against `https://…/api/v1/health/ready` fails from AWS's external checkers. Covers the app, Caddy, the certificate and the network — not just the box. |
| `greatsales-box-status-check-failed` | eu-west-2 | EC2 reports the instance itself unhealthy. |

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
curl -X POST https://18-130-99-225.sslip.io/api/v1/customers -H "Authorization: Bearer $TOK"   -H 'Content-Type: application/json'   -d '{"name":"__sentry_probe__","salespersonId":"<a real user id>","industryId":"nope"}'
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

### 7. Security

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
