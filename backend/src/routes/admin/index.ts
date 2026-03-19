import { Router, Request, Response } from "express";
import { requireAdmin } from "../../middleware/requireAdmin";
import applicationsRouter from "./applications";
import rolesRouter from "./roles";
import usersRouter from "./users";
import assignmentsRouter from "./assignments";
import apiKeysRouter from "./apiKeys";
import invitationsRouter from "./invitations";
import adminsRouter from "./admins";
import { prisma } from "../../prisma";

const router = Router();
router.use(requireAdmin);

router.get("/me", (req: Request, res: Response) => {
  res.json(req.user);
});

router.get("/dashboard", async (_req: Request, res: Response) => {
  const [applications, users, roles, assignments] = await Promise.all([
    prisma.application.count(),
    prisma.user.count(),
    prisma.role.count(),
    prisma.userRole.count(),
  ]);
  res.json({ applications, users, roles, assignments });
});

router.use("/applications", applicationsRouter);
router.use("/applications/:appId/roles", rolesRouter);
router.use("/applications/:appId/api-keys", apiKeysRouter);
router.use("/users", usersRouter);
router.use("/users/:userId/roles", assignmentsRouter);
router.use("/invitations", invitationsRouter);
router.use("/admins", adminsRouter);

export default router;
