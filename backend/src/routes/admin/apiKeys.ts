import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/apiKeyService";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router({ mergeParams: true });

const createApiKeySchema = z.object({
  label: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.listApiKeys(req.params.appId));
}));

router.post("/", validateBody(createApiKeySchema), asyncHandler(async (req: Request, res: Response) => {
  const { label, expiresAt } = req.body as z.infer<typeof createApiKeySchema>;
  const result = await svc.createApiKey(req.params.appId, {
    label,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });
  res.status(201).json(result);
}));

router.delete("/:keyId", asyncHandler(async (req: Request, res: Response) => {
  try {
    await svc.deleteApiKey(req.params.keyId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
