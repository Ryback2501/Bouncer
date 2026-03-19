import { Router, Request, Response } from "express";
import * as svc from "../../services/apiKeyService";

const router = Router({ mergeParams: true });

router.get("/", async (req: Request, res: Response) => {
  res.json(await svc.listApiKeys(req.params.appId));
});

router.post("/", async (req: Request, res: Response) => {
  const { label } = req.body;
  const result = await svc.createApiKey(req.params.appId, label);
  res.status(201).json(result);
});

router.delete("/:keyId", async (req: Request, res: Response) => {
  try {
    await svc.deleteApiKey(req.params.keyId);
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2025") { res.status(404).json({ error: "not_found" }); return; }
    throw e;
  }
});

export default router;
