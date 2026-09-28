import { Request, Response, NextFunction } from "express";
import { logAuditOnly } from "../services/auditService";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  // Audit log line only (B-16), and at info: every anonymous visit to the SPA hits this once.
  logAuditOnly(
    {
      action: "admin.unauthenticated",
      outcome: "denied",
      actor: { type: "anonymous", id: null, label: null, ip: req.ip ?? null },
      details: { method: req.method, path: `${req.baseUrl}${req.path}` },
    },
    "info"
  );
  res.status(401).json({ error: "unauthorized" });
}
