import { prisma } from "../prisma";

export async function listUsers(opts: { search?: string; page?: number; limit?: number }) {
  const { search, page = 1, limit = 20 } = opts;
  const where = search
    ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { sub: { contains: search, mode: "insensitive" as const } }] }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { userRoles: true } } },
    }),
  ]);
  return { total, page, limit, users };
}

export async function getUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      userRoles: {
        include: { application: true, role: true },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
}

export async function createUser(data: { name: string; sub: string; provider: string }) {
  return prisma.user.create({ data });
}

export async function updateUser(id: string, data: { name?: string; sub?: string; provider?: string }) {
  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}
