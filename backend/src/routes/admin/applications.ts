import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/applicationService";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

const createApplicationSchema = z.object({
  name: z.string().min(1),
  customId: z.string().min(1),
  redirectUris: z.array(z.string().url()).optional(),
});

const updateApplicationSchema = z.object({
  name: z.string().min(1).optional(),
  customId: z.string().min(1).optional(),
  redirectUris: z.array(z.string().url()).optional(),
});

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  res.json(await svc.listApplications());
}));

router.post("/", validateBody(createApplicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, customId, redirectUris } = req.body as z.infer<typeof createApplicationSchema>;
  try {
    res.status(201).json(await svc.createApplication({ name, customId, redirectUris }));
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
  const { app } = await ensureBouncerDefaults();
  if (req.params.appId === app.id) { res.status(403).json({ error: "The Bouncer application cannot be modified" }); return; }
  const { name, customId, redirectUris } = req.body as z.infer<typeof updateApplicationSchema>;
  try {
    res.json(await svc.updateApplication(req.params.appId, { name, customId, redirectUris }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:appId", asyncHandler(async (req: Request, res: Response) => {
  const { app } = await ensureBouncerDefaults();
  if (req.params.appId === app.id) { res.status(403).json({ error: "The Bouncer application cannot be deleted" }); return; }
  try {
    await svc.deleteApplication(req.params.appId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
