#!/usr/bin/env bash
#
# Critical-journey smoke test against the BUILT API artifact (apps/api/dist),
# not ts-jest source — proof the shipped build actually serves the core journey
# (go-live blocker O.1.14). Run it in CI against a production-shaped image, and
# on launch day against the deployed URL by pointing BASE at it.
#
# Requires: a built API (`pnpm --filter api build`), a migrated + seeded
# database, and the server's env (DATABASE_URL, JWT secrets, CORS_ORIGIN, …).
# The server is started with whatever env is exported into this shell.
#
#   BASE=http://127.0.0.1:3000/api/v1   # default; override to hit a deployed URL
#   START=1                             # start ./apps/api/dist/main.js ourselves
#                                       # (unset → assume the server is already up)
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:${PORT:-3000}/api/v1}"
SERVER_PID=""

if [ "${START:-0}" = "1" ]; then
  DIST="apps/api/dist/main.js"
  [ -f "$DIST" ] || { echo "ERROR: $DIST missing — run 'pnpm --filter api build'" >&2; exit 1; }
  echo "→ starting built API: node $DIST"
  node "$DIST" & SERVER_PID=$!
  trap '[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true' EXIT
fi

fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }
json_field() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{console.log(JSON.parse(s)[process.argv[1]]||"")}catch{console.log("")}})' "$1"; }

echo "→ waiting for readiness at $BASE/health/ready"
for i in $(seq 1 30); do
  curl -fsS "$BASE/health/ready" >/dev/null 2>&1 && { echo "  ready"; break; }
  [ "$i" = 30 ] && fail "never became ready"
  sleep 1
done

echo "→ login (critical journey)"
TOKEN=$(curl -fsS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d '{"tenantId":"tenant_acme","email":"admin@acme.test","password":"Passw0rd!","tokenDelivery":"body"}' \
  | json_field accessToken)
[ -n "$TOKEN" ] || fail "login returned no access token"
echo "  authenticated"

echo "→ tenant-scoped read (GET /customers)"
curl -fsS "$BASE/customers?limit=5" -H "Authorization: Bearer $TOKEN" >/dev/null || fail "customers read failed"

echo "→ write (POST /customers)"
CID=$(curl -fsS -X POST "$BASE/customers" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke Test Co","salespersonId":"user_sales1_acme"}' | json_field id)
[ -n "$CID" ] || fail "customer create returned no id"
echo "  created customer $CID"

echo "→ auth is enforced (unauthenticated → 401)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/customers")
[ "$code" = "401" ] || fail "unauthenticated request returned $code, expected 401"

echo "→ Swagger disabled in this build (→ 404)"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/docs")
[ "$code" = "404" ] || fail "swagger returned $code, expected 404 (O.1.12)"

echo "✓ SMOKE PASS — the built artifact serves login → tenant-scoped read → write, enforces auth, and hides Swagger."
