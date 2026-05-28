import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/invitationService";
import { prisma } from "../../prisma";
import { validateBody } from "../../middleware/validate";
import { handlePrismaError } from "../../lib/prismaErrors";
import { asyncHandler } from "../../lib/asyncHandler";
import { isAllowedRedirectUri } from "../../lib/redirectUri";

const router = Router();

const createSchema = z.object({
  applicationId: z.string().uuid(),
  roleId: z.string().uuid(),
  redirectUri: z.string().url().optional(),
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
  const { applicationId, roleId, redirectUri } = req.body as z.infer<typeof createSchema>;

  // Role must belong to the requested application.
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role || role.applicationId !== applicationId) {
    res.status(400).json({ error: "role_not_in_application" });
    return;
  }

  // If a redirectUri is supplied, its origin must be in the application's allowlist.
  if (redirectUri) {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) {
      res.status(400).json({ error: "application_not_found" });
      return;
    }
    if (!isAllowedRedirectUri(redirectUri, application.redirectUris)) {
      res.status(400).json({ error: "redirect_uri_not_allowed" });
      return;
    }
  }

  const invitation = await svc.createInvitation({
    applicationId,
    roleId,
    createdById: req.user!.id,
    redirectUri: redirectUri ?? null,
  });
  res.status(201).json(invitation);
}));

router.delete("/:id", asyncHandler(async (req: Request, res: Response) => {
  try {
    await svc.deleteInvitation(req.params.id);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
