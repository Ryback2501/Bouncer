import { prisma } from "../prisma";

export async function listApplications() {
  return prisma.application.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { roles: true, userRoles: true, apiKeys: true } } },
  });
}

export async function getApplication(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: { _count: { select: { roles: true, userRoles: true } } },
  });
}

export async function createApplication(data: { name: string; customId: string }) {
  return prisma.application.create({ data });
}

export async function updateApplication(id: string, data: { name?: string; customId?: string }) {
  return prisma.application.update({ where: { id }, data });
}

export async function deleteApplication(id: string) {
  return prisma.application.delete({ where: { id } });
}
