#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting Prisma Studio..."
cd "$REPO_ROOT/backend"
npx prisma studio &
STUDIO_PID=$!

echo "Waiting for Prisma Studio to be ready..."
until curl -s http://localhost:5555 > /dev/null 2>&1; do
  sleep 1
done

echo "Opening browser..."
xdg-open http://localhost:5555 2>/dev/null || open http://localhost:5555 2>/dev/null || true

echo "Prisma Studio is running. Press Ctrl+C to stop."
trap "kill $STUDIO_PID 2>/dev/null; exit 0" INT TERM
wait $STUDIO_PID
