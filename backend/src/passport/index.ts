import passport from "passport";
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

export async function findOrCreateUser(
  profile: { sub: string; provider: string; name: string; email: string },
  inviteToken?: string
): Promise<Express.User | null> {
  const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults();

  // Case 1: user already exists — check they still have active Bouncer admin role
  const existing = await prisma.user.findUnique({
    where: { sub_provider: { sub: profile.sub, provider: profile.provider } },
  });
  if (existing) {
    const userRole = await prisma.userRole.findFirst({
      where: { userId: existing.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
    });
    if (!userRole) return null;
    if (userRole.expiredAt && userRole.expiredAt < new Date()) return null;
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: profile.name, email: profile.email },
    });
  }

  // Case 2: no Bouncer admin UserRole exists at all — bootstrap first user as global admin
  const adminCount = await prisma.userRole.count({
    where: { applicationId: bouncerApp.id, roleId: adminRole.id },
  });
  if (adminCount === 0) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          sub: profile.sub,
          provider: profile.provider,
          name: profile.name,
          email: profile.email,
          isGlobalAdmin: true,
        },
      });
      await tx.userRole.create({
        data: { userId: user.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
      });
      return user;
    });
  }

  // Case 3: admins exist, no invitation token — reject
  if (!inviteToken) return null;

  // Case 4: validate invitation and create user + role atomically
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.invitation.findFirst({
      where: { token: inviteToken, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!invitation) return null;

    const user = await tx.user.create({
      data: {
        sub: profile.sub,
        provider: profile.provider,
        name: profile.name,
        email: profile.email,
        isGlobalAdmin: false,
      },
    });
    await tx.userRole.create({
      data: { userId: user.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
    });
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });
    return user;
  });
}
