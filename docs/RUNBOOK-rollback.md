# Runbook — Deploy Rollback

Satisfies go-live blocker **O.1.5** ("rollback has been rehearsed, not just
written") and checklist **K.2.7** (11-BUILD-INFRA). Rollback must be *rehearsed*
in staging before launch — a written procedure nobody has run is not a rollback.

## Principle

Application rollback (revert to the previous image) and **schema** rollback are
different problems. Prisma migrations are **forward-only**: `migrate deploy`
never auto-reverts. So the safe posture is:

- **Additive migrations deploy ahead of the code that uses them.** A new column
  is nullable / has a default; a drop happens a release *later*, after nothing
  reads it. This keeps the previous image compatible with the new schema, so an
  app rollback needs **no** schema rollback.
- Because of that, the common rollback is purely **redeploy the previous image
  tag** — fast and safe.
- A schema change that is *not* backward-compatible must ship with a written,
  tested compensating migration (or a restore point) BEFORE it deploys.

## A. Fast path — app rollback (backward-compatible schema)

```bash
# Images are tagged per release (see apps/*/Dockerfile). Redeploy the prior tag.
#   e.g. on the orchestrator / CDK service:
#   API: greatsales-api:<previous-sha>
#   Web: greatsales-web:<previous-sha>
```

1. Identify the last-known-good image tags (previous release SHAs).
2. Redeploy them (CDK service update / orchestrator rollback to previous task
   definition).
3. Watch the readiness probe (`/health/ready`, O.1.7) go green and confirm the
   dashboards (O.2.4) recover.

## B. Schema rollback (only when a migration was NOT backward-compatible)

1. Stop the deploy; put the API in maintenance if writes could corrupt.
2. Restore the **pre-launch backup** taken immediately before the deploy
   (O.2.2) using [`RUNBOOK-backup-restore.md`](RUNBOOK-backup-restore.md) §2
   into the production DB (`ALLOW_PROD_RESTORE=1`, with sign-off).
3. Redeploy the previous image tag (§A).
4. Reconcile any writes accepted between deploy and rollback from the WAL / audit
   log.

Prefer §A always; §B loses data written since the backup, so a
non-backward-compatible migration is a decision to make deliberately, not on
launch night.

## C. Decision criteria — agree BEFORE launch (O.2.3)

| Trigger | Threshold | Who calls it |
| --- | --- | --- |
| Error rate | ______ over ______ min | ______ |
| p95 latency | ______ | ______ |
| Readiness failing | any sustained | ______ |
| Data-integrity alarm | any | ______ |

## D. Rehearsal (this is what ticks O.1.5)

In **staging** (`docker-compose.staging.yml` or the staging stack):

1. Deploy release N, take a backup.
2. Deploy release N+1 (with a migration).
3. Execute §A (and, for a non-backward-compatible change, §B) and confirm the
   app is healthy on N again.
4. Record the run — date, elapsed time, and the commands — as the evidence for
   O.1.5.
