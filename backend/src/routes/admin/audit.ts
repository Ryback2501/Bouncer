import { Router, Request, Response } from "express";
import { z } from "zod";
import { LIMITS } from "../../lib/inputLimits";
import { validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { listAudit } from "../../services/auditService";

const router = Router();

// Security audit log (B-16), newest first. `action` is a prefix ("auth." = every sign-in event).
const listAuditSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  action: z.string().max(LIMITS.customId).optional(),
  actorId: z.string().max(LIMITS.id).optional(),
  outcome: z.enum(["success", "denied", "failure"]).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
});

router.get("/", validateQuery(listAuditSchema), asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, action, actorId, outcome, since, until } = req.query as z.infer<typeof listAuditSchema>;
  res.json(await listAudit({
    page,
    limit,
    action,
    actorId,
    outcome,
    since: since ? new Date(since) : undefined,
    until: until ? new Date(until) : undefined,
  }));
}));

export default router;
