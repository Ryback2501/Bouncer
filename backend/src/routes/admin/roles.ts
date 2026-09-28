import { Router, Request, Response } from "express";
import { z } from "zod";
import { nameField, customIdField } from "../../lib/inputLimits";
import * as svc from "../../services/roleService";
import { isBouncerAdminRole } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { auditRequest, changedFields } from "../../services/auditService";

const router = Router({ mergeParams: true });

const createRoleSchema = z.object({
  name: nameField,
  customId: customIdField,
});

const updateRoleSchema = z.object({
  name: nameField.optional(),
  customId: customIdField.optional(),
});

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.listRoles(req.params.appId));
}));

router.post("/", validateBody(createRoleSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, customId } = req.body as z.infer<typeof createRoleSchema>;
  try {
    const role = await svc.createRole(req.params.appId, { name, customId });
    await auditRequest(req, { action: "role.create", target: { type: "role", id: role.id, label: role.name }, details: { applicationId: req.params.appId, customId } });
    res.status(201).json(role);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.patch("/:roleId", validateBody(updateRoleSchema), asyncHandler(async (req: Request, res: Response) => {
  const target = { type: "role", id: req.params.roleId };
  if (await isBouncerAdminRole(req.params.roleId)) {
    await auditRequest(req, { action: "role.update", outcome: "denied", target, details: { applicationId: req.params.appId } });
    res.status(403).json({ error: "The Bouncer admin role cannot be modified" });
    return;
  }
  const { name, customId } = req.body as z.infer<typeof updateRoleSchema>;
  try {
    const role = await svc.updateRole(req.params.appId, req.params.roleId, { name, customId });
    await auditRequest(req, { action: "role.update", target: { ...target, label: role.name }, details: { applicationId: req.params.appId, fields: changedFields({ name, customId }) } });
    res.json(role);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:roleId", asyncHandler(async (req: Request, res: Response) => {
  const target = { type: "role", id: req.params.roleId };
  if (await isBouncerAdminRole(req.params.roleId)) {
    await auditRequest(req, { action: "role.delete", outcome: "denied", target, details: { applicationId: req.params.appId } });
    res.status(403).json({ error: "The Bouncer admin role cannot be deleted" });
    return;
  }
  try {
    const role = await svc.deleteRole(req.params.appId, req.params.roleId);
    await auditRequest(req, { action: "role.delete", target: { ...target, label: role.name }, details: { applicationId: req.params.appId, customId: role.customId } });
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
