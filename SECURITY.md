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
- **There is no test, debug, or bypass login route** in any build, and no value of `NODE_ENV`
  unlocks one — OAuth is the only way to obtain a portal session. The e2e suite seeds a session
  row directly against its own database instead of asking the server for one.

## Required configuration (fails closed)

`src/config.ts` validates the environment at startup and **refuses to boot** — in every
`NODE_ENV`, not only `production` — unless:

| Variable | Requirement |
|---|---|
| `SESSION_SECRET` | ≥ 32 chars. Generate: `openssl rand -base64 48`. |
| `ADMIN_ALLOWED_EMAILS` | Non-empty. Comma-separated emails permitted to **bootstrap the first global admin** — closes the "first OAuth sign-in wins admin" race. |
| `ENCRYPTION_KEY` | Base64-encoded 32-byte key for encrypting PII at rest. Generate: `openssl rand -base64 32`. |

It also warns (without refusing) when no OAuth provider (`*_CLIENT_ID` + `*_CLIENT_SECRET`) is
configured — nobody could sign in — and, in `production`, when `DATABASE_URL` has no
`sslmode=require`.

**No security behaviour depends on `NODE_ENV`.** The image is routinely run as `development` or
`test`, so each protection follows the deployment itself instead: cookies and proxy trust follow
`FRONTEND_URL`, rate limits are always on, and error details are hidden unless explicitly
exposed. `NODE_ENV` only changes the log format (pretty unless `production`) and the sslmode
advisory. See `backend/.env.example` for the full list.

## Network / reverse proxy

- Terminate TLS at a reverse proxy / ingress and route `/`, `/api`, `/auth`, `/admin` to the right
  service (the SPA uses same-origin relative URLs).
- **`TRUST_PROXY`**: when unset (or empty), one proxy hop is trusted exactly when `FRONTEND_URL` is
  `https://` — Bouncer never terminates TLS itself, so an https origin means a TLS proxy is in
  front. With an `http://` origin nothing is trusted, so clients cannot choose their own IP via
  `X-Forwarded-For`. Set it explicitly for other topologies (e.g. `2` for two proxies,
  `false` to trust none). Behind a proxy, do not also expose the backend port directly.
- Session and CSRF cookies are `httpOnly` and `sameSite` (`lax` / `strict`), and `Secure` exactly
  when `FRONTEND_URL` is `https://`. Passport regenerates the session on login (anti
  session-fixation). Logout is `POST /auth/logout`.
- Rate limits (all routes, stricter on `/auth` and per API key on `/api/v1`) are always on; there
  is no mode that switches them off.

## Database hardening (data at rest)

- **Transport:** require TLS — `...?sslmode=require` (or `verify-full` with a CA).
- **Least privilege:** connect as a role that owns no more than the app schema; do **not** use a
  superuser or the DB owner for the app runtime.
- **Strong credentials:** never ship the dev `bouncer:bouncer` password; use a secrets manager.
- **At rest:** run Postgres on an encrypted volume/disk; restrict network access to the app only.
- **Already protected in-app:** API keys and invitation tokens are stored as SHA-256 hashes; Bouncer
  stores **no** OAuth access/refresh tokens. PII (`email`) is **encrypted at rest** with AES-256-GCM
  via a Prisma client extension (keyed by `ENCRYPTION_KEY`) — transparent on read/write. After
  enabling it on an existing database, run the one-off backfill:
  `cd backend && npx tsx scripts/encrypt-emails.ts` (idempotent).

## API keys

- Hashed at rest; shown in cleartext only once at creation.
- Optional **expiry** (`expiresAt`) — expired keys are rejected (`401 api_key_expired`).
- **Per-API-key rate limiting** on `/api/v1/*` (default 300 req/min/key) bounds the blast radius of a
  leaked key.
- **Rotation:** create a new key, switch the app over, then delete the old one.
- **The Bouncer application cannot be issued a key.** The admin portal is modelled as an application
  of its own, and it owns the `admin` role that grants a portal session — so a key scoped to it could
  mint global-admin invitations and probe who holds admin. Creating one is refused (`403`), and any
  key that already exists is rejected across the whole of `/api/v1` (`403 api_key_not_permitted`) and
  logged as a warning. Such a key remains visible in the admin UI so it can be revoked.

## Invitation links

- Single-use, 24-hour expiry, stored only as a SHA-256 hash.
- **The token never reaches a server.** It is carried in the URL **fragment**
  (`https://…/invite#<token>`), which browsers do not transmit, so it appears in no access log —
  Bouncer's, the reverse proxy's, or any CDN's. The admin portal sends it onward in a request body,
  never a URL, and the OAuth step reads it from the session.
- **Deliver the link verbatim.** Any intermediary that rebuilds the URL server-side — some
  click-trackers and link rewriters — never sees the fragment and will silently strip it, producing
  a link that does not work.
- **Redemption requires a deliberate choice.** Opening an invite link only *describes* the
  invitation; the token is attached to the browser session solely when the recipient picks a sign-in
  provider on that page. Viewing a forwarded link therefore cannot make an unrelated later sign-in
  redeem it. One invitation is held at a time, so choosing a provider on a second invite replaces the
  first.
- **An invite link is a bearer credential — treat it like a password reset link.** Anyone holding it
  can redeem it, and nothing binds it to the intended recipient's identity. In particular, a tenant
  administrator who can mint invitations for their own application can send one to a Bouncer
  administrator and, if that person accepts it, have them enrolled in that application and role.
  Acceptance is always an explicit action on the invite page, but it is not otherwise restricted.

## Application security

- **Headers:** `helmet` sets them for both the API and the admin SPA, which are served from the
  same origin: a locked-down CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  and HSTS.
- **CORS:** restricted to `FRONTEND_URL` with credentials.
- **CSRF:** double-submit token protection on all `/admin/*` mutations.
- **OAuth flow integrity:** every provider sends and verifies a single-use `state` parameter
  (anti login-CSRF, RFC 6749 §10.12); Google/Microsoft/GitHub additionally use a PKCE `S256`
  challenge. LinkedIn (OIDC) deliberately requests **no** `nonce` — it does not echo one back in
  the ID token, and passport-openidconnect fails a login whose requested nonce is missing. State
  and the PKCE verifier are held in the session, so the session cookie must reach the callback:
  keep it `sameSite=lax`. `strict` would drop it on the provider's redirect back and break
  sign-in entirely.
- **One flow at a time per browser session:** the state slot is per provider and single-use, so
  starting a second sign-in in another tab invalidates the first. The stale tab lands on
  `/login?error=auth_failed`.
- **Input validation:** Zod on all request bodies/queries.
- **Logging:** `Authorization`, `Cookie`, and `Set-Cookie` are redacted, and request URLs are
  sanitised before they are written — the logged `url`, the parsed `query`, and the `Location`
  response header all have the values of `invite`, `code`, `state` and `nonce` blanked, in both the
  access log and the error handler. Parameter names survive so a log line is still diagnostic.
  Internal error messages are never returned to clients, unless `EXPOSE_ERROR_DETAILS=true` is
  set explicitly — for local debugging only; never set it on a reachable deployment.

## Known / accepted

- `npm audit` reports moderate advisories for **esbuild** (via `vite`/`vitest`). These affect only the
  local **dev server**, not the production static bundle, and the fix is a breaking `vitest@4` upgrade;
  CI gates on `--audit-level=high`. Revisit when upgrading the test stack.

## Reporting

Report suspected vulnerabilities privately to the maintainers rather than opening a public issue.
