#!/usr/bin/env bash
# Every built screen against its board, in one pass.
#
# Needs the Metro dev server, not an export:
#   EXPO_OFFLINE=1 npx expo start --web --port 8081 --non-interactive
#
# A rebuild took three minutes; a dev-server run takes about five seconds, so
# a wrong margin is a five-second round trip instead of a coffee break.
set -u
BASE="${BASE:-http://localhost:8081}"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
while IFS=: read -r spec route; do
  printf '%-18s ' "$spec"
  if NODE_PATH="$DIR/../../node_modules" node "$DIR/scripts/design-parity.cjs" "$spec" "$BASE$route" \
      >"/tmp/parity-$spec.txt" 2>&1; then
    echo 'matches the board'
  else
    echo 'FAILED'
    grep -E 'off$|NOT FOUND|console errors' "/tmp/parity-$spec.txt" | sed 's/^/    /'
    fail=1
  fi
done <<'SCREENS'
01-splash:/
01a-login:/login
01b-location:/location
01b-c-off:/location-off
01b-d-retry:/location-retry
01b-info:/location-info
01b-e-enabled:/location-enabled
01c-preparing:/preparing
01d-sales-home:/home
02a-1-sales-progress:/sales-progress
02a-3-breakdown:/sales-breakdown
02a-4-insights:/sales-insights
02b-1-actions:/actions
SCREENS
exit $fail
