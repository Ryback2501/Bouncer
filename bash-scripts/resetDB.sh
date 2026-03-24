#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Resetting Bouncer database..."
cd "$REPO_ROOT/backend"

npx prisma migrate reset --force

echo "Database reset complete."
