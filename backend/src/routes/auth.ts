import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { createHash } from "crypto";
import { z } from "zod";
import { config } from "../config";
import { prisma } from "../prisma";
import { asyncHandler } from "../lib/asyncHandler";
import { validateBody } from "../middleware/validate";
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

// Final step of every OAuth callback. The verify step set req.session.inviteOutcome:
// - "app"  → external-app invite: do NOT keep a portal session; log out and send the user to the
//            app's redirect URL (or a confirmation page).
// - "admin" (or undefined) → admin login / admin invite: keep the portal session, go to the portal.
function finishAuth(req: Request, res: Response) {
  const outcome = req.inviteOutcome;

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
router.get("/google", requireProvider(config.GOOGLE_CLIENT_ID), passport.authenticate("google", { scope: ["profile", "email"] }));
router.get(
  "/google/callback",
  requireProvider(config.GOOGLE_CLIENT_ID),
  passport.authenticate("google", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── Microsoft ─────────────────────────────────────────────────────────────────
router.get("/microsoft", requireProvider(config.MICROSOFT_CLIENT_ID), passport.authenticate("microsoft"));
router.get(
  "/microsoft/callback",
  requireProvider(config.MICROSOFT_CLIENT_ID),
  passport.authenticate("microsoft", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── GitHub ────────────────────────────────────────────────────────────────────
router.get("/github", requireProvider(config.GITHUB_CLIENT_ID), passport.authenticate("github", { scope: ["user:email"] }));
router.get(
  "/github/callback",
  requireProvider(config.GITHUB_CLIENT_ID),
  passport.authenticate("github", { failureRedirect: `${config.FRONTEND_URL}/login?error=auth_failed` }),
  finishAuth
);

// ── LinkedIn ──────────────────────────────────────────────────────────────────
router.get("/linkedin", requireProvider(config.LINKEDIN_CLIENT_ID), passport.authenticate("linkedin"));
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

// ── Invitation preview and staging (public) ───────────────────────────────────
// Both take the token in a POST body rather than a URL: request bodies are never logged, so the
// token reaches no log line, reverse-proxy access log or browser history. The invite link itself
// carries it in the URL fragment, which a browser never transmits.
//
// Preview and staging are separate on purpose. Preview runs when the invite page loads; staging must
// only happen when the recipient deliberately picks a provider. If loading the page were enough to
// arm the session, anyone who merely opened a forwarded invite link — an existing admin, say — would
// redeem that invitation on their next ordinary sign-in, without ever choosing to.
const inviteTokenSchema = z.object({ token: z.string().min(1) });

async function findLiveInvitation(token: string) {
  return prisma.invitation.findFirst({
    where: {
      token: createHash("sha256").update(token).digest("hex"),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      expiresAt: true,
      application: { select: { name: true } },
      role: { select: { name: true } },
    },
  });
}

// Read-only: describes the invitation so the page can show what is being accepted.
router.post("/invite", validateBody(inviteTokenSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as z.infer<typeof inviteTokenSchema>;
  const invitation = await findLiveInvitation(token);
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

// Called only from the invite page's provider button, immediately before navigating to
// /auth/<provider>. Putting the token in the session here is what lets that navigation be a bare URL
// with nothing sensitive in it. A token that does not resolve is not stored, so a dead link cannot
// wedge the session into the invite branch of findOrCreateUser.
router.post("/invite/stage", validateBody(inviteTokenSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as z.infer<typeof inviteTokenSchema>;
  if (!(await findLiveInvitation(token))) {
    res.status(404).json({ error: "invitation_not_found" });
    return;
  }
  req.session.inviteToken = token;
  res.status(204).send();
}));

// ── Logout (POST: sameSite=lax cookie makes cross-site POST CSRF-safe) ──────────
router.post("/logout", (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) { res.status(500).json({ error: "logout_failed" }); return; }
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.status(204).send();
    });
  });
});

// There is deliberately no test-only / bypass login route here. OAuth is the only way to
// obtain a portal session in every environment. The e2e suite seeds a session row directly
// (see e2e/global.setup.ts) rather than asking the server for a credential-free one.

export default router;
