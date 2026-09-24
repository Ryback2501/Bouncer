import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/assignmentService";
import { prisma } from "../../prisma";
import { isBouncerApplication, isBouncerAdminRole } from "../../lib/bouncerDefaults";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router({ mergeParams: true });

const upsertAssignmentSchema = z.object({
  roleId: z.string().min(1),
  active: z.boolean().optional().default(true),
  expiredAt: z.string().datetime().nullable().optional(),
});

// The global admin's portal role can be neither changed nor removed (only restored — see PUT) — the
// same rule users.ts applies to the global admin's user record. Stripping it would lock the portal out; before the bootstrap
// became a one-time latch it re-armed "first user becomes global admin" for the next sign-in (B-05).
// Other admins' portal roles, and the global admin's roles elsewhere, stay manageable.
async function isGlobalAdminPortalRole(userId: string, appId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } });
  return !!user?.isGlobalAdmin && (await isBouncerApplication(appId));
}

const PROTECTED = { error: "The global admin's portal role cannot be changed" };

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  res.json(await svc.getUserRoles(req.params.userId));
}));

router.put("/:appId", validateBody(upsertAssignmentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { roleId, active, expiredAt } = req.body as z.infer<typeof upsertAssignmentSchema>;
  // The one change allowed is a repair: back to the admin role, active, with no expiry. A portal
  // role that is already inactive, expiring or missing must not be stuck that way.
  const isRestore = active !== false && !expiredAt && (await isBouncerAdminRole(roleId));
  if (!isRestore && (await isGlobalAdminPortalRole(req.params.userId, req.params.appId))) {
    res.status(403).json(PROTECTED);
    return;
  }
  try {
    res.json(
      await svc.assignRole(req.params.userId, req.params.appId, {
        roleId,
        active: active ?? true,
        expiredAt: expiredAt ? new Date(expiredAt) : null,
      })
    );
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:appId", asyncHandler(async (req: Request, res: Response) => {
  if (await isGlobalAdminPortalRole(req.params.userId, req.params.appId)) { res.status(403).json(PROTECTED); return; }
  try {
    await svc.removeRole(req.params.userId, req.params.appId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
