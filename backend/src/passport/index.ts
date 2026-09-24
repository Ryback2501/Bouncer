import passport from "passport";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import { setupGoogleStrategy } from "./googleStrategy";
import { setupMicrosoftStrategy } from "./microsoftStrategy";
import { setupGitHubStrategy } from "./githubStrategy";
import { setupLinkedInStrategy } from "./linkedinStrategy";
import { ensureBouncerDefaults, BOUNCER_APP_CUSTOM_ID, BOUNCER_ADMIN_ROLE_CUSTOM_ID } from "../lib/bouncerDefaults";
import { config } from "../config";

export async function configurePassport() {
  await ensureBouncerDefaults();

  setupGoogleStrategy();
  setupMicrosoftStrategy();
  setupGitHubStrategy();
  setupLinkedInStrategy();

  passport.serializeUser((user: Express.User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) return done(null, false);

      const { app, role } = await ensureBouncerDefaults();
      const userRole = await prisma.userRole.findFirst({
        where: { userId: id, applicationId: app.id, roleId: role.id, active: true },
      });
      if (!userRole) return done(null, false);
      if (userRole.expiredAt && userRole.expiredAt < new Date()) return done(null, false);

      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}

// How the OAuth callback should finish: "admin" keeps a Bouncer portal session (admin login or
// admin invite); "app" means an external-app invite — log the user out and send them to the app.
export interface AcceptOutcome {
  kind: "admin" | "app";
  redirectUri: string | null;
  appCustomId: string;
}

export interface AcceptResult {
  user: Express.User;
  outcome: AcceptOutcome;
}

export async function findOrCreateUser(
  profile: { sub: string; provider: string; name: string; email: string },
  inviteToken?: string
): Promise<AcceptResult | null> {
  const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults();

  // ── Invitation path: accept an app-scoped (or admin) invite ─────────────────
  // The invitation carries its target application + role. Create/update the user, assign the
  // role (idempotent upsert), and consume the invite — all atomically.
  if (inviteToken) {
    return prisma.$transaction(async (tx) => {
      const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
      const invitation = await tx.invitation.findFirst({
        where: { token: tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        include: { application: { select: { customId: true } }, role: { select: { customId: true } } },
      });
      if (!invitation) return null;

      const user = await tx.user.upsert({
        where: { sub_provider: { sub: profile.sub, provider: profile.provider } },
        update: { name: profile.name, email: profile.email },
        create: {
          sub: profile.sub,
          provider: profile.provider,
          name: profile.name,
          email: profile.email,
          isGlobalAdmin: false,
        },
      });

      const toPortal = invitation.application.customId === BOUNCER_APP_CUSTOM_ID;
      const isAdminInvite = toPortal && invitation.role.customId === BOUNCER_ADMIN_ROLE_CUSTOM_ID;
      // The global admin's portal role is never replaced by an invite: any admin can add a second
      // role to the Bouncer app and invite them to it, and since the bootstrap no longer re-opens,
      // losing that role would lock the portal out for good. The invite is still consumed.
      const keepsPortalAdmin = user.isGlobalAdmin && toPortal && !isAdminInvite;

      // Same upsert as assignmentService.assignRole, but on the transaction client.
      if (!keepsPortalAdmin) {
        await tx.userRole.upsert({
          where: { userId_applicationId: { userId: user.id, applicationId: invitation.applicationId } },
          update: { roleId: invitation.roleId, active: true, expiredAt: null },
          create: {
            userId: user.id,
            applicationId: invitation.applicationId,
            roleId: invitation.roleId,
            active: true,
          },
        });
      }

      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });

      return {
        user,
        outcome: {
          kind: isAdminInvite || keepsPortalAdmin ? "admin" : "app",
          redirectUri: invitation.redirectUri,
          appCustomId: invitation.application.customId,
        },
      };
    });
  }

  // ── No invite: existing-admin login ─────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { sub_provider: { sub: profile.sub, provider: profile.provider } },
  });
  if (existing) {
    const userRole = await prisma.userRole.findFirst({
      where: { userId: existing.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
    });
    if (!userRole) return null;
    if (userRole.expiredAt && userRole.expiredAt < new Date()) return null;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: profile.name, email: profile.email },
    });
    return { user, outcome: { kind: "admin", redirectUri: null, appCustomId: bouncerApp.customId } };
  }

  // ── No invite, no user: bootstrap the very first user as global admin ────────
  // A one-time latch, not a count of current admin assignments. Assignments can drop back to zero
  // (the last admin's portal role removed), and a count would then hand global admin to whoever
  // signs in next. `isGlobalAdmin` is set only here and the API cannot delete that user or clear
  // the flag, so once it exists the bootstrap never re-opens. It also reads no cached ids, which
  // match nothing after a database reset under a running process.
  const bootstrapped = await prisma.user.count({ where: { isGlobalAdmin: true } });
  if (bootstrapped === 0) {
    // Bootstrap guard: only allowlisted emails may become the first global admin. This closes
    // the "first person to reach OAuth wins global admin" race. (Required in production via config.)
    const allowlist = config.ADMIN_ALLOWED_EMAILS;
    if (allowlist.length > 0 && !allowlist.includes(profile.email.toLowerCase())) {
      return null;
    }
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          sub: profile.sub,
          provider: profile.provider,
          name: profile.name,
          email: profile.email,
          isGlobalAdmin: true,
        },
      });
      await tx.userRole.create({
        data: { userId: created.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
      });
      return created;
    });
    return { user, outcome: { kind: "admin", redirectUri: null, appCustomId: bouncerApp.customId } };
  }

  // Admins exist, no invitation token — reject (non-invited, non-admin sign-in).
  return null;
}
