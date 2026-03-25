import { Router, Request, Response } from "express";
import { prisma } from "../../prisma";
import { ensureBouncerDefaults } from "../../lib/bouncerDefaults";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();

router.get("/", asyncHandler(async (_req: Request, res: Response) => {
  const { app, role } = await ensureBouncerDefaults();
  const userRoles = await prisma.userRole.findMany({
    where: { applicationId: app.id, roleId: role.id },
    include: { user: true },
    orderBy: { assignedAt: "asc" },
  });
  res.json(userRoles.map(ur => ({
    id: ur.user.id,
    name: ur.user.name,
    email: ur.user.email,
    provider: ur.user.provider,
    isGlobalAdmin: ur.user.isGlobalAdmin,
    createdAt: ur.user.createdAt,
  })));
}));

export default router;
