import { Application, Role } from "@prisma/client";
import { prisma } from "../prisma";

let cached: { app: Application; role: Role } | null = null;

export async function ensureBouncerDefaults(): Promise<{ app: Application; role: Role }> {
  if (cached) return cached;

  const app = await prisma.application.upsert({
    where: { customId: "bouncer" },
    update: {},
    create: { name: "Bouncer", customId: "bouncer" },
  });

  const role = await prisma.role.upsert({
    where: { applicationId_customId: { applicationId: app.id, customId: "admin" } },
    update: {},
    create: { name: "Admin", customId: "admin", applicationId: app.id },
  });

  cached = { app, role };
  return cached;
}
