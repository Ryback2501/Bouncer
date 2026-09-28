import { Router, Request, Response } from "express";
import { z } from "zod";
import { nameField, customIdField, redirectUrisField } from "../../lib/inputLimits";
import * as svc from "../../services/applicationService";
import { isBouncerApplication } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { auditRequest, changedFields } from "../../services/auditService";

const router = Router();

const createApplicationSchema = z.object({
  name: nameField,
  customId: customIdField,
  redirectUris: redirectUrisField.optional(),
});

const updateApplicationSchema = z.object({
  name: nameField.optional(),
  customId: customIdField.optional(),
  redirectUris: redirectUrisField.optional(),
});

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  res.json(await svc.listApplications());
}));

router.post("/", validateBody(createApplicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, customId, redirectUris } = req.body as z.infer<typeof createApplicationSchema>;
  try {
    const app = await svc.createApplication({ name, customId, redirectUris });
    await auditRequest(req, { action: "application.create", target: { type: "application", id: app.id, label: app.name }, details: { customId } });
    res.status(201).json(app);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.get("/:appId", asyncHandler(async (req: Request, res: Response) => {
  const app = await svc.getApplication(req.params.appId);
  if (!app) { res.status(404).json({ error: "not_found" }); return; }
  res.json(app);
}));

router.patch("/:appId", validateBody(updateApplicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const target = { type: "application", id: req.params.appId };
  if (await isBouncerApplication(req.params.appId)) {
    await auditRequest(req, { action: "application.update", outcome: "denied", target });
    res.status(403).json({ error: "The Bouncer application cannot be modified" });
    return;
  }
  const { name, customId, redirectUris } = req.body as z.infer<typeof updateApplicationSchema>;
  try {
    const app = await svc.updateApplication(req.params.appId, { name, customId, redirectUris });
    await auditRequest(req, { action: "application.update", target: { ...target, label: app.name }, details: { fields: changedFields({ name, customId, redirectUris }) } });
    res.json(app);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:appId", asyncHandler(async (req: Request, res: Response) => {
  const target = { type: "application", id: req.params.appId };
  if (await isBouncerApplication(req.params.appId)) {
    await auditRequest(req, { action: "application.delete", outcome: "denied", target });
    res.status(403).json({ error: "The Bouncer application cannot be deleted" });
    return;
  }
  try {
    const app = await svc.deleteApplication(req.params.appId);
    await auditRequest(req, { action: "application.delete", target: { ...target, label: app.name }, details: { customId: app.customId } });
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
