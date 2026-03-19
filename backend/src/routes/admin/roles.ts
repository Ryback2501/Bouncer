import { Router, Request, Response } from "express";
import * as svc from "../../services/roleService";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";

const router = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response) => {
  res.json(await svc.listRoles(req.params.appId));
});

router.post("/", async (req: Request, res: Response) => {
  const { name, customId } = req.body;
  if (!name || !customId) { res.status(400).json({ error: "name and customId are required" }); return; }
  try {
    res.status(201).json(await svc.createRole(req.params.appId, { name, customId }));
  } catch (e: any) {
    if (e.code === "P2002") { res.status(409).json({ error: "customId already exists in this application" }); return; }
    throw e;
  }
});

router.patch("/:roleId", async (req: Request, res: Response) => {
  const { role } = await ensureBouncerDefaults();
  if (req.params.roleId === role.id) { res.status(403).json({ error: "The Bouncer admin role cannot be modified" }); return; }
  const { name, customId } = req.body;
  try {
    res.json(await svc.updateRole(req.params.roleId, { name, customId }));
  } catch (e: any) {
    if (e.code === "P2025") { res.status(404).json({ error: "not_found" }); return; }
    if (e.code === "P2002") { res.status(409).json({ error: "customId already exists in this application" }); return; }
    throw e;
  }
});

router.delete("/:roleId", async (req: Request, res: Response) => {
  const { role } = await ensureBouncerDefaults();
  if (req.params.roleId === role.id) { res.status(403).json({ error: "The Bouncer admin role cannot be deleted" }); return; }
  try {
    await svc.deleteRole(req.params.roleId);
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2025") { res.status(404).json({ error: "not_found" }); return; }
    throw e;
  }
});

export default router;
