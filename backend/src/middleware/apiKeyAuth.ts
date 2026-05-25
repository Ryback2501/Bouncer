import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import logger from "../lib/logger";
import { asyncHandler } from "../lib/asyncHandler";

export const apiKeyAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
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

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    res.status(401).json({ error: "api_key_expired" });
    return;
  }

  // Fire-and-forget: update lastUsedAt
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch((err) => logger.error({ err }, "Failed to update API key lastUsedAt"));

  req.bouncerApp = apiKey.application;
  next();
});
