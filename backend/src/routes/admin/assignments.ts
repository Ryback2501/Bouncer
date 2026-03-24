import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/assignmentService";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";

const router = Router({ mergeParams: true });

const upsertAssignmentSchema = z.object({
  roleId: z.string().min(1),
  active: z.boolean().optional().default(true),
  expiredAt: z.string().datetime().nullable().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  res.json(await svc.getUserRoles(req.params.userId));
});

router.put("/:appId", validateBody(upsertAssignmentSchema), async (req: Request, res: Response) => {
  const { roleId, active, expiredAt } = req.body as z.infer<typeof upsertAssignmentSchema>;
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
