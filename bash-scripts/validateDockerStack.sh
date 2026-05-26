#!/usr/bin/env bash
# Smoke-test the dockerized Bouncer stack: builds the images, brings everything up,
# verifies the backend answers /health, that nginx serves the SPA shell, and that the
# reverse proxy actually routes /admin/* into the backend (401 unauth, not the SPA's
# index.html). Used by both the /validate-docker slash command and the `docker` CI job.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./_dockerLib.sh
source "$REPO_ROOT/bash-scripts/_dockerLib.sh"

LOG_DIR="$REPO_ROOT/.docker-validate-logs"
mkdir -p "$LOG_DIR"

cleanup() {
  local rc=$?
  if (( rc != 0 )); then
    echo ""
    echo "--- FAILED (rc=$rc). docker compose logs (tail 200) ---" >&2
    compose logs --no-color --tail=200 | tee "$LOG_DIR/compose-logs.txt" >&2 || true
  fi
  echo ""
  echo "--- Tearing down (down -v) ---"
  compose down -v >/dev/null 2>&1 || true
  exit $rc
}
trap cleanup EXIT

ensure_env_file

echo "--- docker compose build ---"
compose build

echo "--- docker compose up -d ---"
compose up -d

echo "--- Waiting for /health and / ---"
npx --yes wait-on \
  http://localhost:3000/health \
  http://localhost \
  --timeout 60000

echo "--- Smoke assertions ---"

# 1. Backend /health returns the documented JSON.
HEALTH_BODY="$(curl -fsS http://localhost:3000/health)"
echo "  /health body: $HEALTH_BODY"
echo "$HEALTH_BODY" | grep -q '"status":"ok"' \
  || { echo "FAIL: /health did not report status=ok" >&2; exit 1; }
echo "$HEALTH_BODY" | grep -q '"db":"ok"' \
  || { echo "FAIL: /health did not report db=ok" >&2; exit 1; }

# 2. Frontend nginx serves the SPA shell.
SPA_BODY="$(curl -fsS http://localhost/)"
echo "$SPA_BODY" | grep -q '<div id="root"' \
  || { echo "FAIL: SPA shell missing <div id=\"root\">" >&2; exit 1; }
echo "  SPA shell served by nginx OK"

# 3. The proxy actually reaches the backend (and the backend's auth chain blocks unauth).
PROXY_STATUS="$(curl -s -o /dev/null -w '%{http_code}' http://localhost/admin/applications)"
echo "  /admin/applications via nginx -> $PROXY_STATUS"
[[ "$PROXY_STATUS" == "401" ]] \
  || { echo "FAIL: expected 401 from proxied /admin/applications, got $PROXY_STATUS" >&2; exit 1; }

echo ""
echo "Docker stack smoke test PASSED."
