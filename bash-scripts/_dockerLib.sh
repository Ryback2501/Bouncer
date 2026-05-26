#!/usr/bin/env bash
# Shared helpers for the docker-stack scripts (runBouncerDocker, stopBouncerDocker,
# validateDockerStack). Sourced, not executed.

# REPO_ROOT must be set by the caller before sourcing.
: "${REPO_ROOT:?REPO_ROOT must be set before sourcing _dockerLib.sh}"

ENV_FILE="$REPO_ROOT/backend/.env"
ENV_EXAMPLE="$REPO_ROOT/backend/.env.example"
ENV_DOCKER="$REPO_ROOT/backend/.env.docker"

# Generate a CI-safe backend/.env from .env.example if one isn't already present. Fills in
# SESSION_SECRET and ENCRYPTION_KEY with fresh random values; leaves OAuth keys blank and
# POSTGRES_* at the example defaults. Idempotent: noop when the file exists.
ensure_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    return 0
  fi
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo "ERROR: $ENV_EXAMPLE not found; cannot bootstrap $ENV_FILE" >&2
    return 1
  fi
  echo "--- Generating $ENV_FILE from .env.example ---"
  local session_secret encryption_key
  session_secret="$(openssl rand -base64 48 | tr -d '\n')"
  encryption_key="$(openssl rand -base64 32 | tr -d '\n')"
  awk \
    -v ss="$session_secret" \
    -v ek="$encryption_key" \
    '
      /^SESSION_SECRET=/ { print "SESSION_SECRET=" ss; next }
      /^ENCRYPTION_KEY=/ { print "ENCRYPTION_KEY=" ek; next }
      { print }
    ' "$ENV_EXAMPLE" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

# Materialize backend/.env → backend/.env.docker with surrounding double/single quotes
# stripped from each VALUE. Comments and blank lines pass through. The result is what
# compose loads via `env_file: [{ path: ..., format: raw }]`, which disables variable
# interpolation so values containing literal `$` (random SESSION_SECRET / ENCRYPTION_KEY,
# some OAuth secrets) reach the container intact.
materialize_env_file() {
  [[ -f "$ENV_FILE" ]] || { echo "ERROR: $ENV_FILE missing" >&2; return 1; }
  awk '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { print; next }
    /=/ {
      eq = index($0, "=")
      key = substr($0, 1, eq)
      val = substr($0, eq + 1)
      first = substr(val, 1, 1)
      last  = substr(val, length(val), 1)
      if ((first == "\"" && last == "\"") || (first == "\047" && last == "\047")) {
        val = substr(val, 2, length(val) - 2)
      }
      print key val
      next
    }
    { print }
  ' "$ENV_FILE" > "$ENV_DOCKER"
  chmod 600 "$ENV_DOCKER"
}

# Read a single KEY=VALUE from a file (post-materialize, so quotes are already stripped).
read_env_value() {
  local key=$1 file=$2 line val
  [[ -f "$file" ]] || return 0
  line=$(grep -E "^${key}=" "$file" | head -1) || true
  [[ -n "$line" ]] || return 0
  val=${line#*=}
  printf '%s' "$val"
}

# Compose wrapper. Refreshes the materialized .env.docker every invocation and exports the
# three POSTGRES_* keys compose needs for variable interpolation in docker-compose.yml.
# The backend container reads the rest of the env (SESSION_SECRET, ENCRYPTION_KEY, OAuth
# secrets) from .env.docker via the service's `env_file:` field with `format: raw`.
compose() {
  materialize_env_file
  POSTGRES_USER=$(read_env_value POSTGRES_USER "$ENV_DOCKER") \
  POSTGRES_PASSWORD=$(read_env_value POSTGRES_PASSWORD "$ENV_DOCKER") \
  POSTGRES_DB=$(read_env_value POSTGRES_DB "$ENV_DOCKER") \
  docker compose "$@"
}
