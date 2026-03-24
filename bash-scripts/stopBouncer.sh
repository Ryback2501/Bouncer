#!/usr/bin/env bash
set -e

PIDS=$(lsof -ti :3000,:5173 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo "Bouncer is not running."
  exit 0
fi

kill $PIDS
echo "Bouncer stopped."
