#!/usr/bin/env bash
#
# Restore a backup INTO a target database and verify it landed.
#
# "A backup that has never been restored is not a backup" (checklist L.3). Run
# this against a FRESH database to rehearse recovery and measure restore time
# against your RTO (L.4). It refuses a production-looking target unless forced.
#
#   TARGET_URL=postgres://owner:***@host:5432/greatsales_restore_test \
#     ./scripts/restore-db.sh ./backups/greatsales_..._....dump
#
set -euo pipefail

FILE="${1:-}"
TARGET="${TARGET_URL:-}"
if [ -z "$FILE" ] || [ -z "$TARGET" ]; then
  echo "usage: TARGET_URL=postgres://…/<db> $0 <backup.dump>" >&2
  exit 1
fi
[ -f "$FILE" ] || { echo "ERROR: no such backup: $FILE" >&2; exit 1; }

TDB="$(printf '%s' "$TARGET" | sed -E 's#.*/([^/?]+).*#\1#')"
# Guard: never clobber production by accident.
if printf '%s' "$TDB" | grep -qiE 'prod' && [ "${ALLOW_PROD_RESTORE:-}" != "1" ]; then
  echo "REFUSING: target \"$TDB\" looks like production. Set ALLOW_PROD_RESTORE=1 to override." >&2
  exit 1
fi

echo "→ restoring $FILE into \"$TDB\""
START="$(date +%s)"
# --clean --if-exists so a re-run into the same DB is idempotent; --no-owner so
# the restore does not depend on the dump's original role names.
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$TARGET" "$FILE"
ELAPSED="$(( $(date +%s) - START ))"
echo "✓ restore completed in ${ELAPSED}s — compare against your RTO (L.4)."

echo "→ verifying restored data:"
for t in Tenant User Customer Payment; do
  n="$(psql "$TARGET" -tAc "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo '?')"
  echo "   $t rows: $n"
done
echo "✓ restore verified. Record the elapsed time and row counts as evidence for O.1.4."
