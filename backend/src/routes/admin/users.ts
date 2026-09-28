import { Router, Request, Response } from "express";
import { z } from "zod";
import { LIMITS, nameField, subField, providerField } from "../../lib/inputLimits";
import * as svc from "../../services/userService";
import { prisma } from "../../prisma";
import { handlePrismaError } from "../../lib/prismaErrors";
import { validateBody, validateQuery } from "../../middleware/validate";
import { asyncHandler } from "../../lib/asyncHandler";
import { auditRequest, changedFields } from "../../services/auditService";

const router = Router();

const listUsersSchema = z.object({
  search: z.string().max(LIMITS.search).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createUserSchema = z.object({
  name: nameField,
  sub: subField,
  provider: providerField,
});

const updateUserSchema = z.object({
  name: nameField.optional(),
  sub: subField.optional(),
  provider: providerField.optional(),
});

router.get("/", validateQuery(listUsersSchema), asyncHandler(async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as z.infer<typeof listUsersSchema>;
  res.json(await svc.listUsers({ search, page, limit }));
}));

router.post("/", validateBody(createUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, sub, provider } = req.body as z.infer<typeof createUserSchema>;
  try {
    const user = await svc.createUser({ name, sub, provider });
    await auditRequest(req, { action: "user.create", target: { type: "user", id: user.id, label: user.name }, details: { provider } });
    res.status(201).json(user);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.get("/:userId", asyncHandler(async (req: Request, res: Response) => {
  const user = await svc.getUser(req.params.userId);
  if (!user) { res.status(404).json({ error: "not_found" }); return; }
  res.json(user);
}));

router.patch("/:userId", validateBody(updateUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (target?.isGlobalAdmin) {
    await auditRequest(req, { action: "user.update", outcome: "denied", target: { type: "user", id: target.id, label: target.name } });
    res.status(403).json({ error: "The global admin cannot be modified" });
    return;
  }
  const { name, sub, provider } = req.body as z.infer<typeof updateUserSchema>;
  try {
    const user = await svc.updateUser(req.params.userId, { name, sub, provider });
    await auditRequest(req, { action: "user.update", target: { type: "user", id: user.id, label: user.name }, details: { fields: changedFields({ name, sub, provider }) } });
    res.json(user);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

router.delete("/:userId", asyncHandler(async (req: Request, res: Response) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.userId } });
  if (target?.isGlobalAdmin) {
    await auditRequest(req, { action: "user.delete", outcome: "denied", target: { type: "user", id: target.id, label: target.name } });
    res.status(403).json({ error: "The global admin cannot be deleted" });
    return;
  }
  try {
    const user = await svc.deleteUser(req.params.userId);
    await auditRequest(req, { action: "user.delete", target: { type: "user", id: user.id, label: user.name }, details: { provider: user.provider } });
    res.status(204).send();
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    throw e;
  }
}));

export default router;
