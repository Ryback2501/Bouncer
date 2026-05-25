import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { createHash } from "crypto";
import { config } from "../config";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { generateCsrfToken } from "../middleware/csrf";

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

// Final step of every OAuth callback. The verify step set req.session.inviteOutcome:
// - "app"  → external-app invite: do NOT keep a portal session; log out and send the user to the
//            app's redirect URL (or a confirmation page).
// - "admin" (or undefined) → admin login / admin invite: keep the portal session, go to the portal.
function finishAuth(req: Request, res: Response) {
  const outcome = req.session.inviteOutcome;
  delete req.session.inviteOutcome;

  if (outcome?.kind === "app") {
    const redirectTo =
      outcome.redirectUri ?? `${config.FRONTEND_URL}/invited?app=${encodeURIComponent(outcome.appCustomId)}`;
    req.logout((err) => {
      if (err) { res.redirect(`${config.FRONTEND_URL}/login?error=logout_failed`); return; }
      res.redirect(redirectTo);
    });
    return;
  }

  res.redirect(`${config.FRONTEND_URL}/`);
}

// ── Google ────────────────────────────────────────────────────────────────────
router.get("/google", requireProvider(config.GOOGLE_CLIENT_ID), storeInviteToken, passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  requireProvider(config.GOOGLE_CLIENT_ID),
  passport.authenticate("google", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── Microsoft ─────────────────────────────────────────────────────────────────
router.get("/microsoft", requireProvider(config.MICROSOFT_CLIENT_ID), storeInviteToken, passport.authenticate("microsoft"));
router.get(
  "/microsoft/callback",
  requireProvider(config.MICROSOFT_CLIENT_ID),
  passport.authenticate("microsoft", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── GitHub ────────────────────────────────────────────────────────────────────
router.get("/github", requireProvider(config.GITHUB_CLIENT_ID), storeInviteToken, passport.authenticate("github", { scope: ["user:email"] }));
router.get(
  "/github/callback",
  requireProvider(config.GITHUB_CLIENT_ID),
  passport.authenticate("github", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── LinkedIn ──────────────────────────────────────────────────────────────────
router.get("/linkedin", requireProvider(config.LINKEDIN_CLIENT_ID), storeInviteToken, passport.authenticate("linkedin"));
router.get(
  "/linkedin/callback",
  requireProvider(config.LINKEDIN_CLIENT_ID),
  passport.authenticate("linkedin", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── CSRF token (public) ───────────────────────────────────────────────────────
router.get("/csrf-token", (req: Request, res: Response) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// ── Invitation preview (public) ───────────────────────────────────────────────
router.get("/invite/:token", asyncHandler(async (req: Request, res: Response) => {
  const tokenHash = createHash("sha256").update(req.params.token).digest("hex");
  const invitation = await prisma.invitation.findFirst({
    where: {
      token: tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      expiresAt: true,
      application: { select: { name: true } },
      role: { select: { name: true } },
    },
  });
  if (!invitation) {
    res.json({ valid: false, expiresAt: null });
    return;
  }
  res.json({
    valid: true,
    expiresAt: invitation.expiresAt,
    application: invitation.application,
    role: invitation.role,
  });
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
