import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import logger from "../lib/logger";
import { asyncHandler } from "../lib/asyncHandler";
import { BOUNCER_APP_CUSTOM_ID } from "../lib/bouncerDefaults";

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

  // Fire-and-forget: update lastUsedAt. Deliberately before the portal check below, so a
  // portal-scoped key that is still being used shows recent activity in the admin UI's "Last Used"
  // column — that is how an operator learns the key is live and must be revoked, rather than
  // having to read the server log.
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch((err) => logger.error({ err }, "Failed to update API key lastUsedAt"));

  // The admin portal is not an API consumer. Its Application record holds the `admin` role that
  // grants a portal session, so a key issued for it could mint global-admin invitations via
  // /api/v1/invitations and probe admin membership via /api/v1/access. Rejecting here covers the
  // whole /api/v1 surface, including routes added later, and neutralises any such key that a
  // pre-existing deployment already has. Creating one is separately refused in routes/admin/apiKeys.
  if (apiKey.application.customId === BOUNCER_APP_CUSTOM_ID) {
    logger.warn(
      { apiKeyId: apiKey.id },
      "Rejected an API key issued for the Bouncer portal application; it should be revoked"
    );
    res.status(403).json({ error: "api_key_not_permitted" });
    return;
  }

  req.bouncerApp = apiKey.application;
  next();
});
