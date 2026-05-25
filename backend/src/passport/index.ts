import passport from "passport";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import { setupGoogleStrategy } from "./googleStrategy";
import { setupMicrosoftStrategy } from "./microsoftStrategy";
import { setupGitHubStrategy } from "./githubStrategy";
import { setupLinkedInStrategy } from "./linkedinStrategy";
import { ensureBouncerDefaults } from "../lib/bouncerDefaults";

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
        include: { application: { select: { customId: true } } },
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

      // Same upsert as assignmentService.assignRole, but on the transaction client.
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

      await tx.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });

      const isAdminInvite =
        invitation.applicationId === bouncerApp.id && invitation.roleId === adminRole.id;
      return {
        user,
        outcome: {
          kind: isAdminInvite ? "admin" : "app",
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
  const adminCount = await prisma.userRole.count({
    where: { applicationId: bouncerApp.id, roleId: adminRole.id },
  });
  if (adminCount === 0) {
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
