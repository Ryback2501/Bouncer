#!/usr/bin/env bash
# Build (incrementally) and start the full Bouncer stack on Docker: postgres + the single
# Bouncer image (Express serves both the API and the built SPA on one origin).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./_dockerLib.sh
source "$REPO_ROOT/bash-scripts/_dockerLib.sh"

ensure_env_file

echo "--- docker compose up -d --build ---"
compose up -d --build

echo "--- Waiting for /health and / ---"
if ! npx --yes wait-on \
      http://localhost/health \
      http://localhost \
      --timeout 60000; then
  echo "Stack did not become healthy within 60s. Recent logs:" >&2
  compose logs --no-color --tail=200 >&2 || true
  exit 1
fi

echo ""
echo "Bouncer is running:"
echo "  Bouncer (SPA + API)  http://localhost"
echo "  Postgres             localhost:5432"
echo ""
echo "Images in use:"
compose images
echo ""
echo "Stop with: bash bash-scripts/stopBouncer.sh [--purge]"
