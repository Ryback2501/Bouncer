import { Router, Request, Response } from "express";
import * as svc from "../../services/userService";
import { prisma } from "../../prisma";
import { handlePrismaError } from "../../lib/prismaErrors";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const { search, page, limit } = req.query;
  res.json(
    await svc.listUsers({
      search: search as string | undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  );
});

router.post("/", async (req: Request, res: Response) => {
  const { name, sub, provider } = req.body;
  if (!name || !sub || !provider) { res.status(400).json({ error: "name, sub and provider are required" }); return; }
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

router.patch("/:userId", async (req: Request, res: Response) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (target?.isGlobalAdmin) { res.status(403).json({ error: "The global admin cannot be modified" }); return; }
  const { name, sub, provider } = req.body;
  try {
    res.json(await svc.updateUser(req.params.userId, { name, sub, provider }));
  } catch (e) {
    if (handlePrismaError(e, res)) return;
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
