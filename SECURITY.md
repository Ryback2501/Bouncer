# Bouncer — Security & Production Hardening

Bouncer is an access-control service, so its own security posture matters. This document covers the
built-in protections and what an operator must do to deploy it safely.

## Threat model (summary)

- **External apps** authenticate to the public API (`/api/v1/*`) with a per-application API key
  (`Authorization: Bearer bncr_…`). Keys are high-entropy, stored only as a SHA-256 hash, and never
  logged.
- **Admins** authenticate to the portal via OAuth (Google/Microsoft/GitHub/OpenID). Only users
  holding the active Bouncer **admin** role get a session; everyone else is rejected.
- **End users** never authenticate to Bouncer directly except to accept an invitation.

## Required production configuration (fails closed)

`src/config.ts` validates the environment at startup and **refuses to boot** in
`NODE_ENV=production` unless:

| Variable | Requirement |
|---|---|
| `SESSION_SECRET` | ≥ 32 chars. Generate: `openssl rand -base64 48`. |
| `ADMIN_ALLOWED_EMAILS` | Non-empty. Comma-separated emails permitted to **bootstrap the first global admin** — closes the "first OAuth sign-in wins admin" race. |
| One OAuth provider | At least one `*_CLIENT_ID` + `*_CLIENT_SECRET` pair. |
| `DATABASE_URL` | Should include `sslmode=require` (warns if absent). |

See `backend/.env.example` for the full list.

## Network / reverse proxy

- Terminate TLS at a reverse proxy / ingress and route `/`, `/api`, `/auth`, `/admin` to the right
  service (the SPA uses same-origin relative URLs).
- Set **`TRUST_PROXY`** (defaults to `1` in production) so `secure` session cookies are issued and
  client IPs are correct for rate-limiting.
- Session cookies are `httpOnly`, `sameSite=lax`, and `secure` in production. Passport regenerates
  the session on login (anti session-fixation). Logout is `POST /auth/logout`.

## Database hardening (data at rest)

- **Transport:** require TLS — `...?sslmode=require` (or `verify-full` with a CA).
- **Least privilege:** connect as a role that owns no more than the app schema; do **not** use a
  superuser or the DB owner for the app runtime.
- **Strong credentials:** never ship the dev `bouncer:bouncer` password; use a secrets manager.
- **At rest:** run Postgres on an encrypted volume/disk; restrict network access to the app only.
- **Already protected in-app:** API keys and invitation tokens are stored as SHA-256 hashes; Bouncer
  stores **no** OAuth access/refresh tokens. PII (`email`) is plaintext today — application-layer
  encryption of `email` is tracked separately.

## API keys

- Hashed at rest; shown in cleartext only once at creation.
- Optional **expiry** (`expiresAt`) — expired keys are rejected (`401 api_key_expired`).
- **Per-API-key rate limiting** on `/api/v1/*` (default 300 req/min/key) bounds the blast radius of a
  leaked key.
- **Rotation:** create a new key, switch the app over, then delete the old one.

## Application security

- **Headers:** `helmet` on the API (locked-down CSP, no framing); the admin SPA gets a CSP +
  `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and HSTS from `nginx.conf`.
- **CORS:** restricted to `FRONTEND_URL` with credentials.
- **CSRF:** double-submit token protection on all `/admin/*` mutations.
- **Input validation:** Zod on all request bodies/queries.
- **Logging:** `Authorization`, `Cookie`, and `Set-Cookie` are redacted; internal error messages are
  never returned to clients in production.

## Known / accepted

- `npm audit` reports moderate advisories for **esbuild** (via `vite`/`vitest`). These affect only the
  local **dev server**, not the production static bundle, and the fix is a breaking `vitest@4` upgrade;
  CI gates on `--audit-level=high`. Revisit when upgrading the test stack.

## Reporting

Report suspected vulnerabilities privately to the maintainers rather than opening a public issue.
