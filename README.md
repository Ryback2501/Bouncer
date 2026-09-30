# Bouncer

Bouncer decides **who can use your applications, and with which role**.

You register your applications in Bouncer and give each of them roles (for example `admin`, `editor`,
`viewer`). Then you give roles to people. When someone uses one of your applications, the application
asks Bouncer: *"What role does this person have here?"* Bouncer answers with the role, or says that the
person has no access.

People sign in with an account they already have: **Google, Microsoft, GitHub or LinkedIn**. Bouncer
has no passwords of its own.

**Words used in this guide**

- **Application** — one of your apps, registered in Bouncer.
- **Role** — a level of access inside one application (for example `editor`).
- **User** — a person, known by their sign-in account (the provider and the account ID, called `sub`).
- **Assignment** — "this user has this role in this application". It can have an end date.
- **API key** — a secret that one of your applications uses to talk to Bouncer.
- **Admin** — a person who manages Bouncer itself, in the Bouncer admin website.

Contents: [Install and run](#install-and-run) · [Integrate your applications](#integrate-your-applications) ·
[Security](#security) · [For developers](#for-developers) · [License](#license)

---

## Install and run

Bouncer is **one Docker image**. It contains the admin website and the API. It needs a **PostgreSQL 16**
database. There are two ways to run it:

- **Option A** — use the ready-made image from Docker Hub. Best for most people.
- **Option B** — build the image yourself from this repository. Best if you want to change the code.

### What you need

- Docker with Docker Compose.
- At least **one sign-in provider** (Google, Microsoft, GitHub or LinkedIn). See
  [Set up sign-in providers](#set-up-sign-in-providers).
- `openssl`, to create random secrets (it is already installed on most Linux and macOS systems).

### Option A — the image from Docker Hub

The image is [`ryback2501/bouncer`](https://hub.docker.com/r/ryback2501/bouncer). It works on normal
servers (`linux/amd64`) and on ARM machines (`linux/arm64`: AWS Graviton, Oracle Cloud Ampere, Apple
Silicon, Raspberry Pi 4/5). Each release publishes two tags:

- `ryback2501/bouncer:<version>` — one exact version, for example `ryback2501/bouncer:0.3.0`. Use this
  in production, so that updates happen only when you choose.
- `ryback2501/bouncer:latest` — always the newest version.

**1. Create the secrets.** Run each command and keep the result. Each value must be different.

```bash
openssl rand -hex 24      # database password  → POSTGRES_PASSWORD (use it twice below)
openssl rand -base64 48   # → SESSION_SECRET
openssl rand -base64 48   # → CSRF_SECRET (a second, different value)
openssl rand -base64 32   # → ENCRYPTION_KEY
```

Keep `ENCRYPTION_KEY` safe and never change it: Bouncer uses it to encrypt email addresses in the
database. Without it, those addresses cannot be read again.

**2. Create a file called `compose.yml`** with this content, and put in your values:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: bouncer
      POSTGRES_PASSWORD: <your database password>
      POSTGRES_DB: bouncer
    # No "ports:" here on purpose: only Bouncer needs to reach the database.
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bouncer"]
      interval: 5s

  bouncer:
    image: ryback2501/bouncer:latest
    restart: unless-stopped
    ports:
      - "80:3000"          # then open http://localhost
    environment:
      DATABASE_URL: postgresql://bouncer:<your database password>@postgres:5432/bouncer
      FRONTEND_URL: http://localhost
      NODE_ENV: production
      SESSION_SECRET: <your SESSION_SECRET>
      CSRF_SECRET: <your CSRF_SECRET>
      ENCRYPTION_KEY: <your ENCRYPTION_KEY>
      ADMIN_ALLOWED_EMAILS: you@example.com
      # Sign-in providers: fill in at least one. Leave the others empty.
      GOOGLE_CLIENT_ID:
      GOOGLE_CLIENT_SECRET:
      GOOGLE_CALLBACK_URL: http://localhost/auth/google/callback
      MICROSOFT_CLIENT_ID:
      MICROSOFT_CLIENT_SECRET:
      MICROSOFT_TENANT_ID: <your tenant ID>
      MICROSOFT_CALLBACK_URL: http://localhost/auth/microsoft/callback
      GITHUB_CLIENT_ID:
      GITHUB_CLIENT_SECRET:
      GITHUB_CALLBACK_URL: http://localhost/auth/github/callback
      LINKEDIN_CLIENT_ID:
      LINKEDIN_CLIENT_SECRET:
      LINKEDIN_CALLBACK_URL: http://localhost/auth/linkedin/callback
    depends_on:
      postgres:
        condition: service_healthy
    # Extra protection: the container's files are read-only (only /tmp can be written),
    # it has no special system powers, and it can never gain more.
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true

volumes:
  postgres_data:
```

**3. Start it:**

```bash
docker compose up -d
```

**4. Open** `http://localhost` and sign in. See [The first admin](#the-first-admin).

Good to know:

- **Database updates are automatic.** When Bouncer starts, it updates the database structure if a new
  version needs it. You do not need to run anything. (To do this yourself instead, set
  `MIGRATE_ON_START=false`.)
- **Health check.** `docker ps` shows `healthy` when Bouncer works and can reach its database. You can
  also open `/health`: it answers `{"status":"ok","db":"ok"}`.
- **Do not publish the database port.** If you need it on the server itself, publish it only as
  `"127.0.0.1:5432:5432"`. Docker's published ports go around the server's firewall.

### Option B — build from source

Use this to run Bouncer from this repository, for example to test a change. You also need
**Node.js** (the script uses `npx`).

```bash
git clone https://github.com/Ryback2501/Bouncer.git
cd Bouncer
bash bash-scripts/runBouncer.sh
```

`runBouncer.sh` builds the image and starts Bouncer and PostgreSQL. The first time, it creates
`backend/.env` with new random secrets. Bouncer does **not** start yet: it still needs your email, so
the script stops with an error about `ADMIN_ALLOWED_EMAILS`. That is expected. Then:

1. Open `backend/.env`. Set `ADMIN_ALLOWED_EMAILS` to your email, and fill in at least one sign-in
   provider (see [Set up sign-in providers](#set-up-sign-in-providers)).
2. Run `bash bash-scripts/runBouncer.sh` again.
3. Open `http://localhost` and sign in.

Other commands:

- **Stop:** `bash bash-scripts/stopBouncer.sh` — your data is kept.
- **Stop and delete everything:** `bash bash-scripts/stopBouncer.sh --purge` — deletes the database too.
- **Other Docker Compose commands:** use `bash bash-scripts/compose.sh …`, for example
  `bash bash-scripts/compose.sh ps` or `bash bash-scripts/compose.sh logs -f bouncer`. A plain
  `docker compose …` does not work here, because it does not know the database password.

The database is published only on this machine (`127.0.0.1:5432`), not on the network.

### The first admin

The first admin is created **once**, when Bouncer is new:

1. Put your email in `ADMIN_ALLOWED_EMAILS` (you can list several, separated by commas).
2. Sign in with an account that has that email.

That first person becomes the **global admin**. After that, nobody else can become admin just by
signing in.

**To add more admins:** in the admin website, open **Invitations** and create an invitation for the
**Bouncer** application. You must enter the new admin's email. Send them the link. It works **once**,
for **4 hours**, and only for someone who signs in with that email.

### Set up sign-in providers

Bouncer needs **at least one** sign-in provider. Choose the ones your users have. For each provider, you
create an "app" in the provider's website and copy two values (a client ID and a client secret) into
Bouncer's settings.

The **callback URL** is the address the provider sends people back to after they sign in. It is always:

```
<your Bouncer address>/auth/<provider>/callback
```

The examples below use `http://localhost`. On a real server, use your real address, for example
`https://bouncer.example.com/auth/google/callback`.

#### Google

1. Open the [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
   Choose or create a project.
2. If Google asks, set up the **OAuth consent screen** first (User type: *External*; add an app name
   and a support email).
3. Click **Create credentials → OAuth client ID**. Application type: *Web application*.
4. Under **Authorized redirect URIs**, add `http://localhost/auth/google/callback`.
5. Save. Copy the **Client ID** and the **Client secret**.

```env
GOOGLE_CLIENT_ID=<client ID>
GOOGLE_CLIENT_SECRET=<client secret>
GOOGLE_CALLBACK_URL=http://localhost/auth/google/callback
```

When you have real users, publish the consent screen (move it out of *Testing*).

#### Microsoft

1. Open the [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID → App registrations → New registration**.
2. Choose a name and who can sign in ("supported account types").
3. **Redirect URI**: platform *Web*, value `http://localhost/auth/microsoft/callback`. Click **Register**.
4. On the overview page, copy the **Application (client) ID** and the **Directory (tenant) ID**.
5. Open **Certificates & secrets → New client secret**. Copy the **Value** right away (it is shown only once).
6. Check that **API permissions** has *Microsoft Graph → User.Read* (new registrations have it).

```env
MICROSOFT_CLIENT_ID=<application (client) ID>
MICROSOFT_CLIENT_SECRET=<secret value>
MICROSOFT_TENANT_ID=<directory (tenant) ID>
MICROSOFT_CALLBACK_URL=http://localhost/auth/microsoft/callback
```

**Use your own tenant ID.** You can set `MICROSOFT_TENANT_ID=common` so that people from *any*
Microsoft organisation can sign in. But then any organisation can also give its accounts any email
address, so an invitation that is limited to one email is **not** safe against a Microsoft sign-in. See
[SECURITY.md](SECURITY.md).

#### GitHub

1. Open [Settings → Developer settings → OAuth Apps → New OAuth App](https://github.com/settings/developers).
2. **Homepage URL**: `http://localhost`. **Authorization callback URL**: `http://localhost/auth/github/callback`.
   Click **Register application**.
3. Copy the **Client ID**. Click **Generate a new client secret** and copy it right away (it is shown only once).

```env
GITHUB_CLIENT_ID=<client ID>
GITHUB_CLIENT_SECRET=<client secret>
GITHUB_CALLBACK_URL=http://localhost/auth/github/callback
```

#### LinkedIn

1. Open the [LinkedIn Developer portal → Create app](https://www.linkedin.com/developers/apps). You need
   a LinkedIn Page for the app (a test page is fine).
2. In the **Auth** tab, add `http://localhost/auth/linkedin/callback` under **Authorized redirect URLs**.
3. In the **Products** tab, add **Sign In with LinkedIn using OpenID Connect** (approved automatically).
4. In the **Auth** tab, copy the **Client ID** and the **Client Secret**.

```env
LINKEDIN_CLIENT_ID=<client ID>
LINKEDIN_CLIENT_SECRET=<client secret>
LINKEDIN_CALLBACK_URL=http://localhost/auth/linkedin/callback
```

#### On a real server

- Providers need **HTTPS** for any address that is not `localhost`. Add the `https://…` callback URL
  in each provider and update the matching `*_CALLBACK_URL` setting.
- You can keep the `http://localhost` callback URLs too, so the same provider apps also work for local tests.

### Settings

Bouncer reads its settings from environment variables. It **refuses to start** if a required setting is
missing or too weak, and it says which one.

| Setting | Required? | What it is |
|---|---|---|
| `DATABASE_URL` | yes | How to reach PostgreSQL: `postgresql://user:password@host:5432/database`. |
| `FRONTEND_URL` | yes | The address people use to open Bouncer, for example `https://bouncer.example.com`. Invitation links use it. |
| `SESSION_SECRET` | yes | Random secret for sign-in sessions. At least 32 characters. |
| `CSRF_SECRET` | yes | Random secret for form protection. At least 32 characters, different from `SESSION_SECRET`. |
| `ENCRYPTION_KEY` | yes | Key that encrypts email addresses in the database (`openssl rand -base64 32`). Never change it. |
| `ADMIN_ALLOWED_EMAILS` | yes | Emails allowed to become the first admin, separated by commas. |
| `<PROVIDER>_CLIENT_ID`, `_CLIENT_SECRET`, `_CALLBACK_URL` | at least one provider | Sign-in providers: `GOOGLE`, `MICROSOFT`, `GITHUB`, `LINKEDIN`. |
| `MICROSOFT_TENANT_ID` | no | Your Microsoft tenant ID. Default `common` (see the warning above). |
| `TRUST_PROXY` | no | Only if a proxy (for example Nginx or Traefik) is in front of Bouncer: the number of proxies (`1`, `2`…) or their IP range. `true` is not accepted. |
| `PORT` | no | Port inside the container. Default `3000`. |
| `NODE_ENV` | no | `production` gives compact logs. It does not switch any security feature on or off. |
| `LOG_LEVEL` | no | How much to log: `info` (default), `warn`, `error`, `debug`… |
| `AUDIT_RETENTION_DAYS` | no | How many days to keep the audit log. Default `90`. |
| `MIGRATE_ON_START` | no | Update the database structure when Bouncer starts. Default `true`. |
| `EXPOSE_ERROR_DETAILS` | no | Only for debugging on your own computer: shows internal error text. Default `false`. |

The full list, with notes, is in [`backend/.env.example`](backend/.env.example).

### Running in production

- **Use HTTPS.** Put Bouncer behind a proxy that handles HTTPS (for example Nginx, Traefik or Caddy),
  and set `FRONTEND_URL` to your `https://` address. With an `https://` address, Bouncer trusts one
  proxy automatically. If you have more proxies, set `TRUST_PROXY`.
- **Use a fixed version** of the image (`ryback2501/bouncer:<version>`) and update on purpose.
- **Back up the database** regularly, for example:
  `docker compose exec postgres pg_dump -U bouncer bouncer > bouncer-backup.sql`
- **Keep your secrets safe**, especially `ENCRYPTION_KEY`.
- Read [SECURITY.md](SECURITY.md) for all security settings.

---

## Integrate your applications

Your application talks to Bouncer **from its server** (never from the browser), with an **API key**.

### 1. Connect an application

In the Bouncer admin website:

1. **Applications → New application.** Give it a name and a short unique ID (for example `shop`).
   If you want Bouncer to send people back to your application after they accept an invitation, add
   your application's address to its **redirect URIs** (for example `https://shop.example.com`).
2. **Roles.** Create the roles your application needs (for example `buyer`, `seller`). Each role has a
   name and a short ID; your application uses the ID.
3. **API keys.** Create an API key. **Copy it right away:** Bouncer shows it only once. You can give it
   an end date. Keep it secret, like a password.

### 2. Check a user's access

When a person signs in to your application, your application learns two things from the sign-in
provider: which **provider** it was (`google`, `microsoft`, `github` or `linkedin`) and the person's
account ID (`sub`). Send both to Bouncer:

```bash
curl -H "Authorization: Bearer bncr_…" \
  "https://bouncer.example.com/api/v1/access?sub=109876543210&provider=google"
```

Bouncer answers:

| Answer | Meaning |
|---|---|
| `200` | The person has an active role. The answer includes the role, for example `"role": {"customId": "buyer", …}`. |
| `404` `user_not_found` | Bouncer does not know this person, or the person has no role in your application. |
| `403` `role_inactive` | The person has a role, but it is switched off or has ended (`expiredAt` says when). |
| `400` `validation_error` | `sub` or `provider` is missing or too long. |
| `401` `invalid_api_key` / `api_key_expired` | The API key is wrong, deleted, or past its end date. |

Example of a `200` answer:

```json
{
  "sub": "109876543210",
  "application": { "id": "…", "customId": "shop", "name": "Shop" },
  "role": { "id": "…", "customId": "buyer", "name": "Buyer" }
}
```

Both values are needed: the same `sub` can exist at two different providers.

### 3. Invite new users

Your application can ask Bouncer for an **invitation link** for a new person:

```bash
curl -X POST -H "Authorization: Bearer bncr_…" -H "Content-Type: application/json" \
  -d '{"role": "buyer", "redirectUri": "https://shop.example.com/welcome", "email": "ana@example.com"}' \
  https://bouncer.example.com/api/v1/invitations
```

- `role` (required): the role's short ID.
- `redirectUri` (optional): where to send the person after they accept. Its address must be in the
  application's redirect URIs.
- `email` (optional): only a person who signs in with this email can accept.

Bouncer answers with an `inviteUrl` and `expiresAt`. **You** send the link to the person (by email, in a
message…): Bouncer does not send emails. The link works **once**, for **24 hours**. Send it exactly as
it is: the secret part is after the `#`, and some link-tracking tools remove it.

When the person opens the link and signs in, Bouncer creates the user, gives them the role in your
application, and sends them to `redirectUri` (or to a Bouncer confirmation page). From then on,
`GET /api/v1/access` returns their role.

### Limits

- Each API key can make **300 requests per minute**. Bouncer also allows **500 requests per
  15 minutes from one IP address** in total. Above that, it answers `429 Too Many Requests`.
- Answers are never cached (`Cache-Control: no-store`).

### Full API description

The complete, exact description of the API is in [`api-specs/external-api.yaml`](api-specs/external-api.yaml)
(OpenAPI 3.1). You can open it in a viewer such as [editor.swagger.io](https://editor.swagger.io).

---

## Security

- Nobody has a password in Bouncer: people sign in with Google, Microsoft, GitHub or LinkedIn.
- Only admins can use the admin website, and an admin loses access as soon as their admin role is
  removed or ends.
- API keys and invitation tokens are stored only as a hash. Email addresses are encrypted.
- Admin invitations work only for the named email, once, for 4 hours.
- The **Audit log** page shows who did what and when (sign-ins, changes, invitations, API keys). It keeps
  90 days by default.
- Requests are rate-limited, and the Docker container runs with extra protection (read-only, no special
  system powers).

Details, settings and known limits: [SECURITY.md](SECURITY.md).

---

## For developers

The repository has three parts:

- `backend/` — the server and API (TypeScript, Express, Prisma, PostgreSQL).
- `frontend/` — the admin website (React, Vite).
- `e2e/` — browser tests (Playwright).

**Run without Docker** (to see code changes right away):

1. Start PostgreSQL. The simplest way: `bash bash-scripts/runBouncer.sh` (it publishes the database on
   `127.0.0.1:5432`, and `backend/.env` already points to it).
2. Backend: `cd backend && npm install && npx prisma generate && npm run dev` → API on `http://localhost:3000`.
3. Frontend: `cd frontend && npm install && npm run dev` → website on `http://localhost:5173`. It forwards
   `/auth`, `/admin` and `/api` to the backend. To sign in here, set `FRONTEND_URL` and the provider
   callback URLs to `http://localhost:5173` in `backend/.env`.

**Tests:**

- Backend unit tests: `cd backend && npm run test:run`
- Backend integration tests (need a PostgreSQL test database in `DATABASE_URL`): `cd backend && npm run test:integration`
- Frontend tests: `cd frontend && npm run test:run`
- Browser tests (need the backend running on port 3000): `cd e2e && npm test`

**Helper scripts** in `bash-scripts/`:

- `runBouncer.sh` / `stopBouncer.sh [--purge]` — start / stop the Docker version.
- `compose.sh …` — run any Docker Compose command with the right settings.
- `resetDB.sh` — empty and rebuild the local development database.
- `runPrismaStudio.sh` — open Prisma Studio, a website to look inside the database.

---

## License

[MIT](LICENSE).
