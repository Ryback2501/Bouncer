#!/usr/bin/env bash
# Stop the Bouncer docker stack. Default preserves the postgres volume so running
# runBouncer.sh again resumes with the same data. Pass --purge to also drop the volume
# AND remove the locally-built bouncer-* images (destructive).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=./_dockerLib.sh
source "$REPO_ROOT/bash-scripts/_dockerLib.sh"

PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
    -h|--help)
      echo "Usage: $0 [--purge]"
      echo "  (no args)  docker compose down — containers + network removed, volume kept"
      echo "  --purge    docker compose down -v --rmi local — also drops volume and local images"
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

if (( PURGE == 1 )); then
  echo "--- docker compose down -v --rmi local (destructive) ---"
  compose down -v --rmi local
else
  echo "--- docker compose down (volume preserved) ---"
  compose down
fi
