import { prisma } from "../prisma";
import { randomBytes, createHash } from "crypto";
import { config } from "../config";

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export async function createInvitation(createdById: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const { token: _hash, ...invitation } = await prisma.invitation.create({
    data: { token: tokenHash, createdById, expiresAt },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return {
    ...invitation,
    inviteUrl: `${config.FRONTEND_URL}/invite/${rawToken}`,
  };
}

export async function listInvitations() {
  const invitations = await prisma.invitation.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });
  return invitations.map(({ token: _hash, ...inv }) => inv);
}

export async function deleteInvitation(id: string) {
  return prisma.invitation.delete({ where: { id } });
}
