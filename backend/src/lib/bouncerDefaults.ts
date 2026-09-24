import { Application, Role } from "@prisma/client";
import { prisma } from "../prisma";

// The admin portal is modelled as an ordinary Application, identified by this customId. Holding
// its `admin` role is what grants a portal session, so anything that could act on this application
// is a privilege-escalation surface — see the guards in routes/admin and middleware/apiKeyAuth.
export const BOUNCER_APP_CUSTOM_ID = "bouncer";
export const BOUNCER_ADMIN_ROLE_CUSTOM_ID = "admin";

let cached: { app: Application; role: Role } | null = null;

export async function ensureBouncerDefaults(): Promise<{ app: Application; role: Role }> {
  if (cached) return cached;

  const app = await prisma.application.upsert({
    where: { customId: BOUNCER_APP_CUSTOM_ID },
    update: {},
    create: { name: "Bouncer", customId: BOUNCER_APP_CUSTOM_ID },
  });

  const role = await prisma.role.upsert({
    where: {
      applicationId_customId: { applicationId: app.id, customId: BOUNCER_ADMIN_ROLE_CUSTOM_ID },
    },
    update: {},
    create: { name: "Admin", customId: BOUNCER_ADMIN_ROLE_CUSTOM_ID, applicationId: app.id },
  });

  cached = { app, role };
  return cached;
}

// The guards below resolve the row being acted on and compare its customId, rather than comparing
// route parameters against the ids in `cached`. That cache is populated once at boot and never
// invalidated, so after a database reset under a running process (bash-scripts/resetDB.sh does
// exactly that, without restarting the backend) it holds ids that match nothing — and an id-based
// guard would silently stop firing, leaving the portal application and its admin role unprotected.
// middleware/apiKeyAuth.ts has always worked this way; these bring the admin routes in line.
//
// A row that does not exist yields false, so a bad id falls through to the handler's own 404
// rather than being swallowed here.

/** Is this application the admin portal's own record? */
export async function isBouncerApplication(applicationId: string): Promise<boolean> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { customId: true },
  });
  return app?.customId === BOUNCER_APP_CUSTOM_ID;
}

/**
 * Is this the admin role of the admin portal — the role that grants a portal session?
 *
 * Both halves must match. Any application may have a role called `admin`, and protecting those too
 * would stop operators managing roles in their own applications.
 */
export async function isBouncerAdminRole(roleId: string): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { customId: true, application: { select: { customId: true } } },
  });
  return (
    role?.customId === BOUNCER_ADMIN_ROLE_CUSTOM_ID &&
    role.application.customId === BOUNCER_APP_CUSTOM_ID
  );
}
