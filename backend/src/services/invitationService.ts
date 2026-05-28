import { prisma } from "../prisma";
import { randomBytes, createHash } from "crypto";
import { config } from "../config";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export async function createInvitation(opts: {
  applicationId: string;
  roleId: string;
  createdById?: string | null;
  redirectUri?: string | null;
}) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { token: _hash, ...invitation } = await prisma.invitation.create({
    data: {
      token: tokenHash,
      applicationId: opts.applicationId,
      roleId: opts.roleId,
      createdById: opts.createdById ?? null,
      redirectUri: opts.redirectUri ?? null,
      expiresAt,
    },
    include: {
      createdBy: { select: { name: true, email: true } },
      application: { select: { id: true, name: true, customId: true } },
      role: { select: { id: true, name: true, customId: true } },
    },
  });
  return {
    ...invitation,
    inviteUrl: `${config.FRONTEND_URL}/invite/${rawToken}`,
  };
}

// Lists every invitation (across all applications) when called without an argument; or
// filters to a single application when called with one. The admin UI calls it unfiltered
// and groups by `application.id` client-side.
export async function listInvitations(applicationId?: string) {
  const invitations = await prisma.invitation.findMany({
    where: applicationId ? { applicationId } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true, email: true } },
      application: { select: { id: true, name: true, customId: true } },
      role: { select: { id: true, name: true, customId: true } },
    },
  });
  return invitations.map(({ token: _hash, ...inv }) => inv);
}

export async function deleteInvitation(id: string) {
  return prisma.invitation.delete({ where: { id } });
}
