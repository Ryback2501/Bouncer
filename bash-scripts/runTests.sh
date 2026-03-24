#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export DATABASE_URL=postgresql://bouncer:bouncer@localhost:5432/bouncer_test
export SESSION_SECRET=ci-session-secret-minimum-sixteen-chars
export FRONTEND_URL=http://localhost:5173
export NODE_ENV=test

# ── Install dependencies ───────────────────────────────────────────────────────
echo "--- Installing dependencies ---"
cd "$REPO_ROOT/backend" && npm ci
cd "$REPO_ROOT/frontend" && npm ci
cd "$REPO_ROOT/e2e"     && npm ci

# ── Prisma setup ──────────────────────────────────────────────────────────────
echo "--- Generating Prisma client ---"
cd "$REPO_ROOT/backend" && npx prisma generate

echo "--- Copying Prisma client to e2e ---"
cp -r "$REPO_ROOT/backend/node_modules/.prisma" "$REPO_ROOT/e2e/node_modules/"

echo "--- Running database migrations ---"
cd "$REPO_ROOT/backend" && npx prisma migrate deploy

# ── Playwright browsers ───────────────────────────────────────────────────────
echo "--- Installing Playwright browsers ---"
cd "$REPO_ROOT/e2e" && npx playwright install --with-deps chromium

# ── Backend: typecheck · lint · unit tests · build · audit ────────────────────
echo "--- Backend: typecheck ---"
cd "$REPO_ROOT/backend" && npx tsc --noEmit

echo "--- Backend: lint ---"
cd "$REPO_ROOT/backend" && npm run lint

echo "--- Backend: unit tests ---"
cd "$REPO_ROOT/backend" && npm run test:run

echo "--- Backend: build ---"
cd "$REPO_ROOT/backend" && npm run build

echo "--- Backend: security audit ---"
cd "$REPO_ROOT/backend" && npm audit --audit-level=high

# ── Frontend: typecheck · lint · unit tests · build · audit ───────────────────
echo "--- Frontend: typecheck ---"
cd "$REPO_ROOT/frontend" && npx tsc -b

echo "--- Frontend: lint ---"
cd "$REPO_ROOT/frontend" && npm run lint

echo "--- Frontend: unit tests ---"
cd "$REPO_ROOT/frontend" && npm run test:run

echo "--- Frontend: build ---"
cd "$REPO_ROOT/frontend" && npm run build

echo "--- Frontend: security audit ---"
cd "$REPO_ROOT/frontend" && npm audit --audit-level=high

# ── Backend integration tests ─────────────────────────────────────────────────
echo "--- Backend: integration tests ---"
cd "$REPO_ROOT/backend" && npm run test:integration

# ── E2E tests ─────────────────────────────────────────────────────────────────
echo "--- Starting backend server ---"
cd "$REPO_ROOT/backend" && npm run start &
BACKEND_PID=$!

echo "--- Starting frontend dev server ---"
cd "$REPO_ROOT/frontend" && npm run dev &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "--- Waiting for servers ---"
npx wait-on http://localhost:3000/health http://localhost:5173 --timeout 30000

echo "--- E2E tests ---"
cd "$REPO_ROOT/e2e" && npm run test

echo "--- All tests passed ---"
