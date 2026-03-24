import { Router, Request, Response } from "express";
import { z } from "zod";
import { apiKeyAuth } from "../../../middleware/apiKeyAuth";
import { prisma } from "../../../prisma";
import { validateQuery } from "../../../middleware/validate";

const router = Router();

const accessQuerySchema = z.object({
  sub: z.string().min(1),
  provider: z.string().optional(),
});

router.get("/access", apiKeyAuth, validateQuery(accessQuerySchema), async (req: Request, res: Response) => {
  const { sub, provider } = req.query as z.infer<typeof accessQuerySchema>;

  const application = req.bouncerApp!;

  const user = provider
    ? await prisma.user.findUnique({ where: { sub_provider: { sub, provider } } })
    : await prisma.user.findFirst({ where: { sub } });

  if (!user) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const userRole = await prisma.userRole.findUnique({
    where: { userId_applicationId: { userId: user.id, applicationId: application.id } },
    include: { role: true },
  });

  if (!userRole) {
    res.status(404).json({ error: "user_not_found" });
    return;
  }

  const now = new Date();
  const isExpired = userRole.expiredAt !== null && userRole.expiredAt < now;
  if (!userRole.active || isExpired) {
    res.status(403).json({
      error: "role_inactive",
      expiredAt: userRole.expiredAt?.toISOString() ?? null,
    });
    return;
  }

  res.json({
    sub,
    application: {
      id: application.id,
      customId: application.customId,
      name: application.name,
    },
    role: {
      id: userRole.role.id,
      customId: userRole.role.customId,
      name: userRole.role.name,
    },
  });
});

export default router;
