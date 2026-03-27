#!/usr/bin/env bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.2.3"
  exit 1
fi

VERSION="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "--- Bumping version to $VERSION ---"

cd "$REPO_ROOT/backend" && npm version "$VERSION" --no-git-tag-version
cd "$REPO_ROOT/frontend" && npm version "$VERSION" --no-git-tag-version
cd "$REPO_ROOT/e2e"     && npm version "$VERSION" --no-git-tag-version

echo "--- Done: all packages are now at $VERSION ---"
