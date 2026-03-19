import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "../prisma";

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "invalid_api_key" });
    return;
  }

  const rawKey = auth.slice(7);
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { application: true },
  });

  if (!apiKey) {
    res.status(401).json({ error: "invalid_api_key" });
    return;
  }

  // Fire-and-forget: update lastUsedAt
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  req.bouncerApp = apiKey.application;
  next();
}
