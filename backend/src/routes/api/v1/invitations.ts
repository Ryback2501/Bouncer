import { Router, Request, Response } from "express";
import { z } from "zod";
import { apiKeyAuth } from "../../../middleware/apiKeyAuth";
import { validateBody } from "../../../middleware/validate";
import { asyncHandler } from "../../../lib/asyncHandler";
import { isAllowedRedirectUri } from "../../../lib/redirectUri";
import * as roleService from "../../../services/roleService";
import * as invitationService from "../../../services/invitationService";

const router = Router();

const createInvitationSchema = z.object({
  role: z.string().min(1),
  redirectUri: z.string().url().optional(),
});

// Mint a single-use invitation for the application the API key belongs to. The user accepts it
// at inviteUrl (Bouncer-hosted OAuth), which creates the user and assigns the requested role.
router.post("/", apiKeyAuth, validateBody(createInvitationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { role, redirectUri } = req.body as z.infer<typeof createInvitationSchema>;
  const application = req.bouncerApp!;

  const targetRole = await roleService.getRoleByCustomId(application.id, role);
  if (!targetRole) {
    res.status(404).json({ error: "role_not_found" });
    return;
  }

  if (redirectUri && !isAllowedRedirectUri(redirectUri, application.redirectUris)) {
    res.status(400).json({ error: "redirect_uri_not_allowed" });
    return;
  }

  const invitation = await invitationService.createInvitation({
    applicationId: application.id,
    roleId: targetRole.id,
    redirectUri: redirectUri ?? null,
  });

  res.status(201).json({
    inviteUrl: invitation.inviteUrl,
    expiresAt: invitation.expiresAt,
  });
}));

export default router;
