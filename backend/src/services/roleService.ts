import { prisma } from "../prisma";

export async function listRoles(applicationId: string) {
  return prisma.role.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { userRoles: true } } },
  });
}

export async function getRole(id: string) {
  return prisma.role.findUnique({ where: { id } });
}

export async function createRole(applicationId: string, data: { name: string; customId: string }) {
  return prisma.role.create({ data: { ...data, applicationId } });
}

export async function updateRole(id: string, data: { name?: string; customId?: string }) {
  return prisma.role.update({ where: { id }, data });
}

export async function deleteRole(id: string) {
  return prisma.role.delete({ where: { id } });
}
