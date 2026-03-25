import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { createHash } from "crypto";
import { config } from "../config";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";

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

// ── GitHub ────────────────────────────────────────────────────────────────────
router.get("/github", requireProvider(config.GITHUB_CLIENT_ID), storeInviteToken, passport.authenticate("github", { scope: ["user:email"] }));
router.get(
  "/github/callback",
  requireProvider(config.GITHUB_CLIENT_ID),
  passport.authenticate("github", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  (_req: Request, res: Response) => res.redirect(`${config.FRONTEND_URL}/`)
);

// ── LinkedIn ──────────────────────────────────────────────────────────────────
router.get("/linkedin", requireProvider(config.LINKEDIN_CLIENT_ID), storeInviteToken, passport.authenticate("linkedin"));
router.get(
  "/linkedin/callback",
  requireProvider(config.LINKEDIN_CLIENT_ID),
  passport.authenticate("linkedin", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  (_req: Request, res: Response) => res.redirect(`${config.FRONTEND_URL}/`)
);

// ── Invitation preview (public) ───────────────────────────────────────────────
router.get("/invite/:token", asyncHandler(async (req: Request, res: Response) => {
  const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
  const invitation = await prisma.invitation.findFirst({
    where: {
      token: tokenHash,
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
}));

// ── Logout ────────────────────────────────────────────────────────────────────
router.get("/logout", (req: Request, res: Response) => {
  req.logout(() => {
    res.redirect(`${config.FRONTEND_URL}/login`);
  });
});

// ── Test-only login (E2E) ──────────────────────────────────────────────────────
// Only available in NODE_ENV=test. Creates a session for the first global admin,
// allowing E2E tests to bypass OAuth.
if (config.NODE_ENV === "test") {
  router.post("/test-login", asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.findFirst({ where: { isGlobalAdmin: true } });
    if (!user) {
      res.status(404).json({ error: "no_admin_user" });
      return;
    }
    req.login(user, (err) => {
      if (err) { res.status(500).json({ error: "login_failed" }); return; }
      res.json({ ok: true });
    });
  }));
}

export default router;
