# Bouncer

Bouncer is a Role-Based Access Control (RBAC) service with an admin UI and a public REST API. It lets you centrally manage which users have which roles across multiple applications, and exposes a simple API that your connected apps can query to check permissions at runtime.

## What it does

- **Applications** — register each of your apps in Bouncer with a name and a unique ID.
- **Roles** — define roles per application (e.g. `admin`, `editor`, `viewer`).
- **Users** — manage users identified by their OAuth `sub` and provider.
- **Assignments** — assign a role to a user within an application, with optional expiry.
- **Access API** — connected apps call `GET /api/v1/access?sub=<sub>` with an API key to check whether a user has an active role, getting back the role details or a clear error (`user_not_found` / `role_inactive`).

## Admin access

The Bouncer admin portal is itself modelled as an application inside Bouncer. The first person to sign in via OAuth becomes the global administrator. After that, new admins can only be added via single-use invitation links generated from the Admin Access page.

## Quick start

Bouncer ships as a single Docker image that serves both the admin UI and the API from one origin. Pick whichever path fits your situation.

### From Docker Hub (no clone needed)

The official image is published at [`ryback2501/bouncer`](https://hub.docker.com/r/ryback2501/bouncer) on Docker Hub. It's multi-arch (`linux/amd64` + `linux/arm64`) so it runs on standard cloud x86, AWS Graviton, Oracle Cloud Free Tier ARM Ampere, Apple Silicon dev machines, and Raspberry Pi 4/5 alike.

Two tags are pushed per release:

- `ryback2501/bouncer:<version>` — immutable, pin-able (e.g. `ryback2501/bouncer:0.3.0`).
- `ryback2501/bouncer:latest` — always points at the newest published version.

The minimal compose file looks like this (you still need to provide the OAuth secrets — see the [OAuth provider setup](#oauth-provider-setup) section):

```yaml
# compose.yml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: bouncer
      POSTGRES_PASSWORD: bouncer
      POSTGRES_DB: bouncer
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bouncer"]
      interval: 5s

  bouncer:
    image: ryback2501/bouncer:latest
    restart: unless-stopped
    ports:
      - "80:3000"          # browse http://localhost
    environment:
      DATABASE_URL: postgresql://bouncer:bouncer@postgres:5432/bouncer
      FRONTEND_URL: http://localhost
      NODE_ENV: production
      SESSION_SECRET: <openssl rand -base64 48>
      ENCRYPTION_KEY: <openssl rand -base64 32>
      ADMIN_ALLOWED_EMAILS: you@example.com
      # OAuth provider credentials (at least one required); see OAuth provider setup below
      GOOGLE_CLIENT_ID:
      GOOGLE_CLIENT_SECRET:
      GOOGLE_CALLBACK_URL: http://localhost/auth/google/callback
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

Start the stack: `docker compose up -d`, then open `http://localhost` and sign in via OAuth. The first sign-in matching `ADMIN_ALLOWED_EMAILS` becomes the global administrator.

### From source (for development or local hacking)

Clone the repo, then:

1. Copy `backend/.env.example` to `backend/.env` and fill in the secrets (see the [OAuth provider setup](#oauth-provider-setup) section — at least one provider must be configured to sign in).
2. Generate a `SESSION_SECRET` (≥32 chars in production): `openssl rand -base64 48`
3. Generate an `ENCRYPTION_KEY` (required in production, encrypts user emails at rest): `openssl rand -base64 32`
4. Bring up Postgres + Bouncer (builds the image locally): `bash bash-scripts/runBouncer.sh`
5. Open `http://localhost` in a browser. The first OAuth sign-in becomes the global admin.

To stop: `bash bash-scripts/stopBouncer.sh` (preserves the Postgres volume). Use `--purge` to also drop the volume and locally-built images.

## OAuth provider setup

Bouncer signs users in via OAuth and uses the provider-returned `sub` claim as the canonical user identifier. **At least one provider must be configured** for anyone to sign in — pick whichever fits your audience and skip the others. The callback URL pattern is always `<your-bouncer-origin>/auth/<provider>/callback`, where `<your-bouncer-origin>` is the URL users visit in their browser (e.g. `http://localhost` for local docker, or `https://bouncer.example.com` in production). The examples below assume local docker (`http://localhost`); swap in your real origin for a deployed instance.

For each provider you enable, set the three env vars listed at the end of its section in `backend/.env`.

### Google

1. Go to the [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials). Pick or create a project.
2. If prompted, configure the **OAuth consent screen** first (User Type: *External*; add an app name, support email, and developer contact). The required scopes are `.../auth/userinfo.email` and `.../auth/userinfo.profile` — both are added automatically.
3. **Create credentials → OAuth client ID**. Application type: *Web application*.
4. Under **Authorized redirect URIs**, add `http://localhost/auth/google/callback` (and your production URL too, if relevant).
5. Save and copy the **Client ID** and **Client secret**.

```env
GOOGLE_CLIENT_ID=<paste-here>
GOOGLE_CLIENT_SECRET=<paste-here>
GOOGLE_CALLBACK_URL=http://localhost/auth/google/callback
```

### Microsoft

1. Sign in to the [Azure Portal](https://portal.azure.com/) and go to **Microsoft Entra ID → App registrations → New registration**.
2. Give the app a name. Pick the supported account type that fits your needs (single-tenant restricts sign-in to one Microsoft 365 organisation; "Accounts in any organisational directory and personal Microsoft accounts" is the broadest).
3. **Redirect URI**: platform *Web*, value `http://localhost/auth/microsoft/callback`. Register.
4. From the app's overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**. For multi-tenant setups, use `common` as the tenant.
5. Go to **Certificates & secrets → Client secrets → New client secret**. Copy the secret **Value** immediately (it's only shown once).
6. Under **API permissions**, ensure *Microsoft Graph → Delegated → User.Read* is granted (it's the default on new registrations).

```env
MICROSOFT_CLIENT_ID=<application-client-id>
MICROSOFT_CLIENT_SECRET=<secret-value>
MICROSOFT_TENANT_ID=common       # or your tenant ID for single-tenant
MICROSOFT_CALLBACK_URL=http://localhost/auth/microsoft/callback
```

### GitHub

1. Go to [Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/developers).
2. **Application name**: Bouncer (or whatever you like). **Homepage URL**: `http://localhost`. **Authorization callback URL**: `http://localhost/auth/github/callback`. Register.
3. Copy the **Client ID**. Click **Generate a new client secret** and copy the value immediately (it's only shown once).
4. Bouncer requests the `user:email` scope. No further configuration is required — GitHub does not require explicit scope pre-registration.

```env
GITHUB_CLIENT_ID=<client-id>
GITHUB_CLIENT_SECRET=<client-secret>
GITHUB_CALLBACK_URL=http://localhost/auth/github/callback
```

### LinkedIn

1. Go to the [LinkedIn Developer portal → My apps → Create app](https://www.linkedin.com/developers/apps). You need a LinkedIn Page to associate with the app (a personal page works for testing).
2. Fill in the app name, the associated page, and upload a logo. Submit.
3. In the **Auth** tab, under **OAuth 2.0 settings → Authorized redirect URLs for your app**, add `http://localhost/auth/linkedin/callback`.
4. In the **Products** tab, request access to **Sign In with LinkedIn using OpenID Connect**. This is auto-approved; once granted it enables the `openid`, `profile`, and `email` scopes Bouncer needs.
5. Back in **Auth**, copy the **Client ID** and **Client Secret** from the *Application credentials* card.

```env
LINKEDIN_CLIENT_ID=<client-id>
LINKEDIN_CLIENT_SECRET=<client-secret>
LINKEDIN_CALLBACK_URL=http://localhost/auth/linkedin/callback
```

### Production notes

- **HTTPS is required by every provider** for non-localhost callbacks. Once you put Bouncer behind a real domain, update each provider's redirect URL list to the `https://…` version and update the matching `*_CALLBACK_URL` env vars.
- **Don't delete the localhost callbacks** — keeping both lets you sign in to your production instance from production *and* test locally against the same provider credentials.
- For Google, you may need to publish the OAuth consent screen (move it out of "Testing" mode) once you have real users.
- For Microsoft single-tenant apps, only users in that tenant can sign in. For broader audiences, set `supported account types` to "any organisational directory and personal Microsoft accounts" and use `MICROSOFT_TENANT_ID=common`.

## API reference

Bouncer ships an OpenAPI 3.1 specification for the public API at [`api-specs/external-api.yaml`](api-specs/external-api.yaml). This is the contract your connected applications integrate against: endpoints for checking access and minting user invitations, authenticated with an application API key (`Authorization: Bearer bncr_<key>`).

Paste the file into an OpenAPI viewer such as [editor.swagger.io](https://editor.swagger.io) to browse it interactively.
