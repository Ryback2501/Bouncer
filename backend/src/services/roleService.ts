import { prisma } from "../prisma";

export async function listRoles(applicationId: string) {
  return prisma.role.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function getRoleByCustomId(applicationId: string, customId: string) {
  return prisma.role.findUnique({
    where: { applicationId_customId: { applicationId, customId } },
  });
}

export async function createRole(applicationId: string, data: { name: string; customId: string }) {
  return prisma.role.create({ data: { ...data, applicationId } });
}

// Scoped to the application: a role of another application is not found (P2025 → 404), even when
// its id is known (B-11).
export async function updateRole(applicationId: string, id: string, data: { name?: string; customId?: string }) {
  return prisma.role.update({ where: { id, applicationId }, data });
}

export async function deleteRole(applicationId: string, id: string) {
  return prisma.role.delete({ where: { id, applicationId } });
}
