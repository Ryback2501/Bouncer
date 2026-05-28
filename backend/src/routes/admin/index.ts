import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/requireAdmin";
import applicationsRouter from "./applications";
import rolesRouter from "./roles";
import usersRouter from "./users";
import assignmentsRouter from "./assignments";
import apiKeysRouter from "./apiKeys";
import invitationsRouter from "./invitations";
import { prisma } from "../../prisma";
import { asyncHandler } from "../../lib/asyncHandler";

const router = Router();
router.use(requireAdmin);

router.get("/me", (req: Request, res: Response) => {
  res.json(req.user);
});

router.get("/dashboard", asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const [applications, users, assignments, invitations] = await Promise.all([
    prisma.application.count(),
    prisma.user.count(),
    prisma.userRole.count(),
    prisma.invitation.count({
      where: { usedAt: null, expiresAt: { gt: now } },
    }),
  ]);
  res.json({ applications, users, assignments, invitations });
}));

// Cross-app assignment listing for the admin UI's Assignments page. Returns every UserRole
// row (active, inactive, and expired) with `user`, `role`, and `application` includes so
// the SPA can group by application client-side. Replaces the old GET /admin/admins, which
// was a special case of this query filtered to Bouncer-app + admin-role.
router.get("/assignments", asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.userRole.findMany({
    include: {
      user: {
        select: {
          id: true, name: true, email: true, sub: true, provider: true,
          isGlobalAdmin: true, createdAt: true,
        },
      },
      role: { select: { id: true, name: true, customId: true } },
      application: { select: { id: true, name: true, customId: true } },
    },
    orderBy: [{ application: { name: "asc" } }, { assignedAt: "asc" }],
  });
  res.json(rows);
}));

router.use("/applications", applicationsRouter);
router.use("/applications/:appId/roles", rolesRouter);
router.use("/applications/:appId/api-keys", apiKeysRouter);
router.use("/users", usersRouter);
router.use("/users/:userId/roles", assignmentsRouter);
router.use("/invitations", invitationsRouter);

export default router;
