import { Router, Request, Response } from "express";
import * as svc from "../../services/invitationService";
import { handlePrismaError } from "../../lib/prismaErrors";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  res.json(await svc.listInvitations());
});

router.post("/", async (req: Request, res: Response) => {
  const invitation = await svc.createInvitation(req.user!.id);
  res.status(201).json(invitation);
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await svc.deleteInvitation(req.params.id);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

export default router;
