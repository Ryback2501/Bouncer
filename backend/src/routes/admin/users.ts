import { Router, Request, Response } from "express";
import { z } from "zod";
import * as svc from "../../services/userService";
import { prisma } from "../../prisma";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody, validateQuery } from "../../middleware/validate";

const router = Router();

const listUsersSchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createUserSchema = z.object({
  name: z.string().min(1),
  sub: z.string().min(1),
  provider: z.string().min(1),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  sub: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
});

router.get("/", validateQuery(listUsersSchema), async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as z.infer<typeof listUsersSchema>;
  res.json(await svc.listUsers({ search, page, limit }));
});

router.post("/", validateBody(createUserSchema), async (req: Request, res: Response) => {
  const { name, sub, provider } = req.body as z.infer<typeof createUserSchema>;
  try {
    res.status(201).json(await svc.createUser({ name, sub, provider }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

router.get("/:userId", async (req: Request, res: Response) => {
  const user = await svc.getUser(req.params.userId);
  if (!user) { res.status(404).json({ error: "not_found" }); return; }
  res.json(user);
});

router.patch("/:userId", validateBody(updateUserSchema), async (req: Request, res: Response) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (target?.isGlobalAdmin) { res.status(403).json({ error: "The global admin cannot be modified" }); return; }
  const { name, sub, provider } = req.body as z.infer<typeof updateUserSchema>;
  try {
    res.json(await svc.updateUser(req.params.userId, { name, sub, provider }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

router.delete("/:userId", async (req: Request, res: Response) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (target?.isGlobalAdmin) { res.status(403).json({ error: "The global admin cannot be deleted" }); return; }
  try {
    await svc.deleteUser(req.params.userId);
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
});

export default router;
