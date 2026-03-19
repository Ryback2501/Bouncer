import { prisma } from "../prisma";
import { randomBytes } from "crypto";
import { config } from "../config";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export async function createInvitation(createdById: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const invitation = await prisma.invitation.create({
    data: { token, createdById, expiresAt },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return {
    ...invitation,
    inviteUrl: `${config.FRONTEND_URL}/invite/${token}`,
  };
}

export async function listInvitations() {
  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return invitations.map(inv => ({
    ...inv,
    inviteUrl: `${config.FRONTEND_URL}/invite/${inv.token}`,
  }));
}

export async function deleteInvitation(id: string) {
  return prisma.invitation.delete({ where: { id } });
}
