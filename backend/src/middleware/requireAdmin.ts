import { Request, Response, NextFunction } from "express";
import { logAuditOnly, auditActor } from "../services/auditService";
import { hasActivePortalAdminRole } from "../lib/bouncerDefaults";

/**
 * Guard for every /admin route: the caller must be a signed-in **portal admin**.
 *
 * Invariant (INFO-01): a session only stays signed in while its user holds the Bouncer
 * application's `admin` role, active and not expired — passport's deserializeUser
 * (passport/index.ts) re-checks that on every request and drops the session otherwise. So today
 * "signed in" already implies "portal admin".
 *
 * This guard does not rely on that alone: it checks the role again itself, with its own database
 * lookup (hasActivePortalAdminRole), so a future change elsewhere — a looser deserializeUser, a
 * second role on the Bouncer application, per-application admins — cannot silently open the admin
 * API. If this second check ever fails for a signed-in user, the invariant has been broken
 * somewhere, which is why it is logged as a warning.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
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
    return;
  }

  try {
    if (await hasActivePortalAdminRole(req.user!.id)) return next();
  } catch (err) {
    next(err);
    return;
  }

  logAuditOnly(
    {
      action: "admin.access_denied",
      outcome: "denied",
      actor: auditActor(req),
      details: { reason: "no_portal_role", method: req.method, path: `${req.baseUrl}${req.path}` },
    },
    "warn"
  );
  res.status(401).json({ error: "unauthorized" });
}
