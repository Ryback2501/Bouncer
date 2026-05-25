import { prisma } from "../prisma";
import { randomBytes, createHash } from "crypto";

export async function listApiKeys(applicationId: string) {
  return prisma.apiKey.findMany({
    where: { applicationId },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });
}

export async function createApiKey(
  applicationId: string,
  opts?: { label?: string; expiresAt?: Date | null }
) {
  const rawKey = `bncr_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const apiKey = await prisma.apiKey.create({
    data: { applicationId, keyHash, label: opts?.label, expiresAt: opts?.expiresAt ?? null },
    select: { id: true, label: true, expiresAt: true, createdAt: true },
  });
  return { ...apiKey, rawKey };
}

export async function deleteApiKey(id: string) {
  return prisma.apiKey.delete({ where: { id } });
}
