#!/usr/bin/env bash
# Build (incrementally) and start the full Bouncer stack on Docker: postgres + backend +
# frontend, all wired through frontend/nginx.conf's reverse proxy. Mirrors the host-side
# runBouncer.sh but runs the production artefacts inside compose.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./_dockerLib.sh
source "$REPO_ROOT/bash-scripts/_dockerLib.sh"

ensure_env_file

echo "--- docker compose up -d --build ---"
compose up -d --build

echo "--- Waiting for backend /health and frontend / ---"
if ! npx --yes wait-on \
      http://localhost:3000/health \
      http://localhost \
      --timeout 60000; then
  echo "Stack did not become healthy within 60s. Recent logs:" >&2
  compose logs --no-color --tail=200 >&2 || true
  exit 1
fi

echo ""
echo "Bouncer is running:"
echo "  Frontend (SPA + reverse proxy)  http://localhost"
echo "  Backend API (direct, OAuth cb)  http://localhost:3000"
echo "  Postgres                        localhost:5432"
echo ""
echo "Images in use:"
compose images
echo ""
echo "Stop with: bash bash-scripts/stopBouncerDocker.sh [--purge]"
