import { Router, Request, Response } from "express";
import * as svc from "../../services/invitationService";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

// The admin UI manages only Bouncer admin invitations (app = bouncer, role = admin).
router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const { app } = await ensureBouncerDefaults();
  res.json(await svc.listInvitations(app.id));
}));

router.post("/", asyncHandler(async (req: Request, res: Response) => {
  const { app, role } = await ensureBouncerDefaults();
  const invitation = await svc.createInvitation({
    applicationId: app.id,
    roleId: role.id,
    createdById: req.user!.id,
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
