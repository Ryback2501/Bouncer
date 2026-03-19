import { prisma } from "../prisma";
import { randomBytes, createHash } from "crypto";

export async function listApiKeys(applicationId: string) {
  return prisma.apiKey.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, lastUsedAt: true, createdAt: true },
  });
}

export async function createApiKey(applicationId: string, label?: string) {
  const rawKey = `bncr_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const apiKey = await prisma.apiKey.create({
    data: { applicationId, keyHash, label },
    select: { id: true, label: true, createdAt: true },
  });
  return { ...apiKey, rawKey };
}

export async function deleteApiKey(id: string) {
  return prisma.apiKey.delete({ where: { id } });
}
