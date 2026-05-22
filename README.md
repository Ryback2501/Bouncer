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

## API reference

Bouncer ships OpenAPI 3.1 specifications under [`api-specs/`](api-specs/):

- **Public API for external apps** — [`api-specs/external-api.yaml`](api-specs/external-api.yaml). This is the contract your connected applications integrate against: a single endpoint, `GET /api/v1/access?sub=<sub>`, authenticated with an application API key (`Authorization: Bearer bncr_<key>`), returning the user's active role in that application or a clear error. See the spec for query parameters, response schemas, and status codes.
- **Admin API** — [`api-specs/admin-api.yaml`](api-specs/admin-api.yaml). The session-authenticated REST API behind the admin UI (applications, roles, users, assignments, API keys, and invitations).

Paste either file into an OpenAPI viewer such as [editor.swagger.io](https://editor.swagger.io) to browse it interactively.