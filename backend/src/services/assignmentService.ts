import { prisma } from "../prisma";

export async function getUserRoles(userId: string) {
  return prisma.userRole.findMany({
    where: { userId },
    include: { application: true, role: true },
    orderBy: { assignedAt: "desc" },
  });
}

export async function assignRole(
  userId: string,
  applicationId: string,
  data: { roleId: string; active?: boolean; expiredAt?: Date | null }
) {
  return prisma.userRole.upsert({
    where: { userId_applicationId: { userId, applicationId } },
    update: { roleId: data.roleId, active: data.active ?? true, expiredAt: data.expiredAt ?? null },
    create: {
      userId,
      applicationId,
      roleId: data.roleId,
      active: data.active ?? true,
      expiredAt: data.expiredAt ?? null,
    },
    include: { application: true, role: true },
  });
}

export async function removeRole(userId: string, applicationId: string) {
  return prisma.userRole.delete({
    where: { userId_applicationId: { userId, applicationId } },
  });
}
