import { Router, Request, Response } from "express";
import { z } from "zod";
import { labelField } from "../../lib/inputLimits";
import * as svc from "../../services/apiKeyService";
import { isBouncerApplication } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { auditRequest } from "../../services/auditService";

const router = Router({ mergeParams: true });

const createApiKeySchema = z.object({
  label: labelField.optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.listApiKeys(req.params.appId));
}));

// Issuing a key for the Bouncer application itself would hand its holder a route to global admin
// (it owns the `admin` role), so refuse — matching the guards on modifying and deleting that
// application. Listing and revoking below stay open, so a key from an older deployment can still
// be found and removed; apiKeyAuth rejects it at use in the meantime.
router.post("/", validateBody(createApiKeySchema), asyncHandler(async (req: Request, res: Response) => {
  if (await isBouncerApplication(req.params.appId)) {
    await auditRequest(req, { action: "api_key.create", outcome: "denied", target: { type: "api_key" }, details: { applicationId: req.params.appId } });
    res.status(403).json({ error: "The Bouncer application cannot be issued API keys" });
    return;
  }
  const { label, expiresAt } = req.body as z.infer<typeof createApiKeySchema>;
  const result = await svc.createApiKey(req.params.appId, {
    label,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });
  // Never the raw key: only its id, label and application.
  await auditRequest(req, { action: "api_key.create", target: { type: "api_key", id: result.id, label: result.label }, details: { applicationId: req.params.appId } });
  res.status(201).json(result);
}));

router.delete("/:keyId", asyncHandler(async (req: Request, res: Response) => {
  try {
    const key = await svc.deleteApiKey(req.params.appId, req.params.keyId);
    await auditRequest(req, { action: "api_key.delete", target: { type: "api_key", id: key.id, label: key.label }, details: { applicationId: req.params.appId } });
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
