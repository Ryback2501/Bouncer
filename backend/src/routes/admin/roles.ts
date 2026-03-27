import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/roleService";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router({ mergeParams: true });

const createRoleSchema = z.object({
  name: z.string().min(1),
  customId: z.string().min(1),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  customId: z.string().min(1).optional(),
});

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.listRoles(req.params.appId));
}));

router.post("/", validateBody(createRoleSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, customId } = req.body as z.infer<typeof createRoleSchema>;
  try {
    res.status(201).json(await svc.createRole(req.params.appId, { name, customId }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.patch("/:roleId", validateBody(updateRoleSchema), asyncHandler(async (req: Request, res: Response) => {
  const { role } = await ensureBouncerDefaults();
  if (req.params.roleId === role.id) { res.status(403).json({ error: "The Bouncer admin role cannot be modified" }); return; }
  const { name, customId } = req.body as z.infer<typeof updateRoleSchema>;
  try {
    res.json(await svc.updateRole(req.params.roleId, { name, customId }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:roleId", asyncHandler(async (req: Request, res: Response) => {
  const { role } = await ensureBouncerDefaults();
  if (req.params.roleId === role.id) { res.status(403).json({ error: "The Bouncer admin role cannot be deleted" }); return; }
  try {
    await svc.deleteRole(req.params.roleId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
