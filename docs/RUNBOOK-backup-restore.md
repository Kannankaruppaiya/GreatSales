# Runbook — Backup & Restore

Satisfies go-live blocker **O.1.4** ("a backup has been restored and verified")
and checklist section **L.3–L.6** (12-DATA-OPERATIONS). The scripts referenced
here live in [`../scripts/`](../scripts).

> A backup that has never been restored is **not a backup**. The tick on O.1.4
> is earned by running the *restore* drill below and recording its output — not
> by taking a dump.

## 0. Prerequisites

- `pg_dump` / `pg_restore` / `psql` (Postgres 16 client — matches the server).
- `DIRECT_URL` for the source DB (the **owner** role; the RLS-bound
  `greatsales_app` role cannot read every table, so it cannot back up).
- For offsite copies: AWS CLI with access to the backup bucket.

## 1. Take a backup

```bash
DIRECT_URL="postgres://greatsales:***@<host>:5432/greatsales" \
BACKUP_DIR=/var/backups/greatsales \
BACKUP_S3_URI=s3://greatsales-backups/prod \
  ./scripts/backup-db.sh
```

The script dumps in Postgres **custom format** (`-Fc`), then verifies the
artifact with `pg_restore --list` before reporting success. With `BACKUP_S3_URI`
set it copies the dump offsite, KMS-encrypted, into a **separate failure domain**
from the primary (L.6).

**Automate it.** In production this runs on a schedule (managed snapshots on
RDS, plus this logical dump for portability). Managed automated backups + a
retention window cover **L.1/L.2**.

## 2. Rehearse a restore — this is what ticks O.1.4

Restore into a **fresh, throwaway** database and verify:

```bash
# Create an empty target first (owner connection):
psql "$DIRECT_URL" -c 'CREATE DATABASE greatsales_restore_test;'

TARGET_URL="postgres://greatsales:***@<host>:5432/greatsales_restore_test" \
  ./scripts/restore-db.sh /var/backups/greatsales/greatsales_greatsales_<stamp>.dump
```

The script prints the **elapsed restore time** (compare against your agreed RTO
— L.4) and **row counts** for `Tenant`/`User`/`Customer`/`Payment` (proof the
data landed). It refuses a target whose name looks like `prod` unless
`ALLOW_PROD_RESTORE=1`.

**Record the evidence** on the checklist: the command, the elapsed time, and the
row counts. That is what a stranger can re-run.

## 3. After a verified restore

- Point-in-time recovery (**L.5**): enable WAL archiving / RDS PITR and test
  restoring to a specific timestamp, not just the latest snapshot.
- Confirm the restored DB passes the RLS boot guard (the API refuses to start if
  the runtime role can bypass RLS) before pointing any app at it.
- Re-run `prisma migrate status` against the restored DB to confirm the schema
  version matches the app you intend to run.

## RTO / RPO targets

Fill these in with the business and measure against them:

| Objective | Target | Last measured |
| --- | --- | --- |
| RPO (max data loss) | ______ | ______ |
| RTO (max downtime)  | ______ | ______ (from §2 elapsed) |
