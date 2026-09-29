import { Router, Request, Response } from "express";
import { z } from "zod";
import { urlField, emailField } from "../../lib/inputLimits";
import { BOUNCER_APP_CUSTOM_ID } from "../../lib/bouncerDefaults";
import * as svc from "../../services/invitationService";
import { prisma } from "../../prisma";
import { validateBody } from "../../middleware/validate";
import { handlePrismaError } from "../../lib/prismaErrors";
import { asyncHandler } from "../../lib/asyncHandler";
import { auditRequest } from "../../services/auditService";
import { isAllowedRedirectUri } from "../../lib/redirectUri";

const router = Router();

const createSchema = z.object({
  applicationId: z.string().uuid(),
  roleId: z.string().uuid(),
  redirectUri: urlField.optional(),
  // The invitee (B-19): only a sign-in reporting this email can redeem the invitation. Required
  // for the Bouncer portal, optional for applications.
  email: emailField.optional(),
});

// List every invitation across all applications. The admin UI groups by application.
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  res.json(await svc.listInvitations());
}));

// Mint an invitation for any (application, role) pair. The acceptance flow in
// passport/findOrCreateUser dispatches on (applicationId, roleId): when it resolves to the
// Bouncer app + admin role, the post-accept flow establishes a portal session (admin
// invite); anything else logs the user out and redirects to redirectUri (or the
// /invited?app=<customId> confirmation page).
router.post("/", validateBody(createSchema), asyncHandler(async (req: Request, res: Response) => {
  const { applicationId, roleId, redirectUri, email } = req.body as z.infer<typeof createSchema>;

  // Role must belong to the requested application.
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.applicationId !== applicationId) {
    res.status(400).json({ error: "role_not_in_application" });
    return;
  }

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) {
    res.status(400).json({ error: "application_not_found" });
    return;
  }

  // A portal invitation grants access to Bouncer itself, so it must name its invitee (B-19): a
  // leaked link is then useless to anyone signing in with a different email.
  const portal = application.customId === BOUNCER_APP_CUSTOM_ID;
  if (portal && !email) {
    res.status(400).json({ error: "email_required" });
    return;
  }

  // If a redirectUri is supplied, its origin must be in the application's allowlist.
  if (redirectUri && !isAllowedRedirectUri(redirectUri, application.redirectUris)) {
    res.status(400).json({ error: "redirect_uri_not_allowed" });
    return;
  }

  const invitation = await svc.createInvitation({
    applicationId,
    roleId,
    createdById: req.user!.id,
    redirectUri: redirectUri ?? null,
    email: email ?? null,
    portal,
  });
  await auditRequest(req, { action: "invitation.create", target: { type: "invitation", id: invitation.id }, details: { applicationId, roleId } });
  res.status(201).json(invitation);
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  try {
    const invitation = await svc.deleteInvitation(req.params.id);
    await auditRequest(req, { action: "invitation.delete", target: { type: "invitation", id: invitation.id }, details: { applicationId: invitation.applicationId, roleId: invitation.roleId } });
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
