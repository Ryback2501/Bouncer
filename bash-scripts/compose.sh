#!/usr/bin/env bash
# Run any `docker compose` command against the local stack with the same environment
# runBouncer.sh / stopBouncer.sh use. docker-compose.yml has no default POSTGRES_PASSWORD (B-08),
# so a bare `docker compose ps` fails; this reads it from backend/.env (via .env.docker).
# Usage: bash bash-scripts/compose.sh ps | logs -f bouncer | exec postgres psql -U bouncer
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./_dockerLib.sh
source "$REPO_ROOT/bash-scripts/_dockerLib.sh"

compose "$@"
