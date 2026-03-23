#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Starting Bouncer backend..."
cd "$REPO_ROOT/backend"
npm run dev &
BACKEND_PID=$!

echo "Starting Bouncer frontend..."
cd "$REPO_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait for the frontend dev server to be ready
echo "Waiting for frontend to be ready..."
until curl -s http://localhost:5173 > /dev/null 2>&1; do
  sleep 1
done

echo "Opening browser..."
xdg-open http://localhost:5173 2>/dev/null || open http://localhost:5173 2>/dev/null || true

echo "Bouncer is running. Press Ctrl+C to stop."
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
