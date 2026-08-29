#!/usr/bin/env bash
#
# Take a VERIFIED logical backup of the GreatSales Postgres database.
#
# Uses DIRECT_URL (the owner role) because pg_dump must read every table, which
# the RLS-bound runtime role (greatsales_app) deliberately cannot. A dump that
# cannot be listed by pg_restore is not a backup, so we verify structure before
# reporting success (checklist L.3 / O.1.4).
#
#   DIRECT_URL=postgres://owner:***@host:5432/greatsales ./scripts/backup-db.sh
#
# Optional:
#   BACKUP_DIR=/var/backups/greatsales   # where dumps land (default ./backups)
#   BACKUP_S3_URI=s3://bucket/greatsales # offsite copy in a separate failure
#                                        # domain, KMS-encrypted (L.6)
set -euo pipefail

SRC="${DIRECT_URL:-${DATABASE_URL:-}}"
if [ -z "$SRC" ]; then
  echo "ERROR: set DIRECT_URL (owner role) to the source database." >&2
  exit 1
fi

OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_NAME="$(printf '%s' "$SRC" | sed -E 's#.*/([^/?]+).*#\1#')"
FILE="$OUT_DIR/greatsales_${DB_NAME}_${STAMP}.dump"

echo "→ dumping \"$DB_NAME\" to $FILE"
# Custom format (-Fc): compressed, and restorable selectively with pg_restore.
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$SRC"

# Prove the artifact is a readable backup, not a truncated file.
pg_restore --list "$FILE" > /dev/null
echo "✓ backup verified (pg_restore --list ok): $FILE ($(du -h "$FILE" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$FILE" "${BACKUP_S3_URI%/}/" --sse aws:kms
  echo "✓ uploaded to ${BACKUP_S3_URI%/}/ (KMS-encrypted)"
fi
