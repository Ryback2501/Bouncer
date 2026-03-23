import { Router, Request, Response } from "express";
import * as svc from "../../services/assignmentService";
import { handlePrismaError } from "../../lib/prismaErrors";

const router = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response) => {
  res.json(await svc.getUserRoles(req.params.userId));
});

router.put("/:appId", async (req: Request, res: Response) => {
  const { roleId, active, expiredAt } = req.body;
  if (!roleId) { res.status(400).json({ error: "roleId is required" }); return; }
  try {
    res.json(
      await svc.assignRole(req.params.userId, req.params.appId, {
        roleId,
        active: active ?? true,
        expiredAt: expiredAt ? new Date(expiredAt) : null,
      })
    );
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

router.delete("/:appId", async (req: Request, res: Response) => {
  try {
    await svc.removeRole(req.params.userId, req.params.appId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

export default router;
