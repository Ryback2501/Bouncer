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