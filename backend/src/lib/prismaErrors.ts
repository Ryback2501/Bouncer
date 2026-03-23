import { Response } from "express"

export function handlePrismaError(e: unknown, res: Response): boolean {
  const code = (e as { code?: string }).code
  if (code === "P2002") { res.status(409).json({ error: "already_exists" }); return true }
  if (code === "P2025") { res.status(404).json({ error: "not_found" }); return true }
  if (code === "P2003") { res.status(400).json({ error: "invalid_relation" }); return true }
  return false
}
