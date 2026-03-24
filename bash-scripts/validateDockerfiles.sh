#!/usr/bin/env bash
# Validates source-build Dockerfiles by building them locally.
#
# Dockerfile.release files are NOT validated here — they require a published
# GitHub Release to download artifacts from, which may not exist yet.
# They will be exercised by the CD pipeline once a release is published.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

BACKEND_IMAGE="bouncer-backend:validate"
FRONTEND_IMAGE="bouncer-frontend:validate"

cleanup() {
  echo ""
  echo "--- Cleaning up images ---"
  docker rmi "$BACKEND_IMAGE" "$FRONTEND_IMAGE" 2>/dev/null || true
}
trap cleanup EXIT

echo "--- Validating backend/Dockerfile ---"
docker build \
  --file "$REPO_ROOT/backend/Dockerfile" \
  --tag "$BACKEND_IMAGE" \
  "$REPO_ROOT/backend"
echo "backend/Dockerfile OK"

echo ""
echo "--- Validating frontend/Dockerfile ---"
docker build \
  --file "$REPO_ROOT/frontend/Dockerfile" \
  --tag "$FRONTEND_IMAGE" \
  "$REPO_ROOT/frontend"
echo "frontend/Dockerfile OK"

echo ""
echo "All Dockerfiles validated successfully."
