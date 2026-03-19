import { Router, Request, Response } from "express";
import * as svc from "../../services/applicationService";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  res.json(await svc.listApplications());
});

router.post("/", async (req: Request, res: Response) => {
  const { name, customId } = req.body;
  if (!name || !customId) { res.status(400).json({ error: "name and customId are required" }); return; }
  try {
    res.status(201).json(await svc.createApplication({ name, customId }));
  } catch (e: any) {
    if (e.code === "P2002") { res.status(409).json({ error: "customId already exists" }); return; }
    throw e;
  }
});

router.get("/:appId", async (req: Request, res: Response) => {
  const app = await svc.getApplication(req.params.appId);
  if (!app) { res.status(404).json({ error: "not_found" }); return; }
  res.json(app);
});

router.patch("/:appId", async (req: Request, res: Response) => {
  const { app } = await ensureBouncerDefaults();
  if (req.params.appId === app.id) { res.status(403).json({ error: "The Bouncer application cannot be modified" }); return; }
  const { name, customId } = req.body;
  try {
    res.json(await svc.updateApplication(req.params.appId, { name, customId }));
  } catch (e: any) {
    if (e.code === "P2025") { res.status(404).json({ error: "not_found" }); return; }
    if (e.code === "P2002") { res.status(409).json({ error: "customId already exists" }); return; }
    throw e;
  }
});

router.delete("/:appId", async (req: Request, res: Response) => {
  const { app } = await ensureBouncerDefaults();
  if (req.params.appId === app.id) { res.status(403).json({ error: "The Bouncer application cannot be deleted" }); return; }
  try {
    await svc.deleteApplication(req.params.appId);
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2025") { res.status(404).json({ error: "not_found" }); return; }
    throw e;
  }
});

export default router;
