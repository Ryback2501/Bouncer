import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { config } from "../config";
import { prisma } from "../prisma";

const router = Router();

function requireProvider(clientId: string | undefined) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!clientId) {
      res.status(501).json({ error: "provider_not_configured" });
      return;
    }
    next();
  };
}

function storeInviteToken(req: Request, _res: Response, next: NextFunction) {
  if (typeof req.query.invite === "string") {
    req.session.inviteToken = req.query.invite;
  }
  next();
}

// ── Google ────────────────────────────────────────────────────────────────────
router.get("/google", requireProvider(config.GOOGLE_CLIENT_ID), storeInviteToken, passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  requireProvider(config.GOOGLE_CLIENT_ID),
  passport.authenticate("google", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  (_req: Request, res: Response) => res.redirect(`${config.FRONTEND_URL}/`)
);

// ── Microsoft ─────────────────────────────────────────────────────────────────
router.get("/microsoft", requireProvider(config.MICROSOFT_CLIENT_ID), storeInviteToken, passport.authenticate("microsoft"));
router.get(
  "/microsoft/callback",
  requireProvider(config.MICROSOFT_CLIENT_ID),
  passport.authenticate("microsoft", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  (_req: Request, res: Response) => res.redirect(`${config.FRONTEND_URL}/`)
);

// ── Apple ─────────────────────────────────────────────────────────────────────
router.get("/apple", requireProvider(config.APPLE_CLIENT_ID), storeInviteToken, passport.authenticate("apple"));
router.post(
  "/apple/callback",
  requireProvider(config.APPLE_CLIENT_ID),
  passport.authenticate("apple", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  (_req: Request, res: Response) => res.redirect(`${config.FRONTEND_URL}/`)
);

// ── Invitation preview (public) ───────────────────────────────────────────────
router.get("/invite/:token", async (req: Request, res: Response) => {
  const invitation = await prisma.invitation.findFirst({
    where: {
      token: req.params.token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { expiresAt: true },
  });
  if (!invitation) {
    res.json({ valid: false, expiresAt: null });
    return;
  }
  res.json({ valid: true, expiresAt: invitation.expiresAt });
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.get("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    res.redirect(`${config.FRONTEND_URL}/login`);
  });
});

export default router;
