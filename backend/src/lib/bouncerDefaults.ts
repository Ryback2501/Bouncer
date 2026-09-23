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
