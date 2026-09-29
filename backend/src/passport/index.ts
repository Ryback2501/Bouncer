import passport from "passport";
import { createHash } from "crypto";
import { prisma } from "../prisma";
import { setupGoogleStrategy } from "./googleStrategy";
import { setupMicrosoftStrategy } from "./microsoftStrategy";
import { setupGitHubStrategy } from "./githubStrategy";
import { setupLinkedInStrategy } from "./linkedinStrategy";
import { ensureBouncerDefaults, BOUNCER_APP_CUSTOM_ID, BOUNCER_ADMIN_ROLE_CUSTOM_ID } from "../lib/bouncerDefaults";
import { config } from "../config";
import { recordAudit, logAuditOnly, type AuditActor } from "../services/auditService";

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
  /** Signed in by accepting an invitation (admin or app), as opposed to an ordinary admin login. */
  viaInvite: boolean;
  redirectUri: string | null;
  appCustomId: string;
}

export interface AcceptResult {
  user: Express.User;
  outcome: AcceptOutcome;
}

// Advisory-lock key serialising first-admin bootstraps across concurrent requests and replicas
// (distinct from the migration runner's key in lib/migrate.ts).
const BOOTSTRAP_LOCK_KEY = 7_207_311;

type SignInProfile = { sub: string; provider: string; name: string; email: string };

// Audit helpers for sign-in (B-16). A user actor is id + display name, never the email; a rejected
// stranger is identified by provider + sub.
function userActor(user: { id: string; name: string | null }, ip?: string | null): AuditActor {
  return { type: "user", id: user.id, label: user.name ?? null, ip: ip ?? null };
}

// A rejected known user (no or expired portal role) is stored. A rejected stranger is log-only:
// anyone with an OAuth account can trigger that at will, and storing it would let them grow the
// audit table on demand — the same rule as the other unauthenticated rejections.
async function auditRejected(
  reason: string,
  profile: SignInProfile,
  ip?: string | null,
  user?: { id: string; name: string | null }
): Promise<void> {
  const details = { provider: profile.provider, sub: profile.sub, reason };
  if (user) {
    await recordAudit({ action: "auth.login_rejected", outcome: "denied", actor: userActor(user, ip), details });
    return;
  }
  logAuditOnly({
    action: "auth.login_rejected",
    outcome: "denied",
    actor: { type: "anonymous", id: null, label: null, ip: ip ?? null },
    details,
  });
}

export async function findOrCreateUser(
  profile: SignInProfile,
  inviteToken?: string,
  ip?: string | null
): Promise<AcceptResult | null> {
  const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults();

  // ── Invitation path: accept an app-scoped (or admin) invite ─────────────────
  // The invitation carries its target application + role. Create/update the user, assign the
  // role (idempotent upsert), and consume the invite — all atomically.
  if (inviteToken) {
    const accepted = await prisma.$transaction(async (tx) => {
      const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
      const invitation = await tx.invitation.findFirst({
        where: { token: tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        include: { application: { select: { customId: true } }, role: { select: { customId: true } } },
      });
      if (!invitation) return null;
      // Bound to an invitee (B-19): only a sign-in reporting that email may use it. Refused without
      // consuming it, so the rightful invitee can still accept.
      if (invitation.email && invitation.email !== profile.email.trim().toLowerCase()) {
        return { mismatch: true as const };
      }

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

      // A kept portal role only earns a portal session if it is usable: the per-request session check
      // would otherwise reject an inactive or expired one straight after the redirect.
      const keptRoleUsable =
        keepsPortalAdmin &&
        (await tx.userRole.count({
          where: {
            userId: user.id,
            active: true,
            OR: [{ expiredAt: null }, { expiredAt: { gt: new Date() } }],
            application: { customId: BOUNCER_APP_CUSTOM_ID },
            role: { customId: BOUNCER_ADMIN_ROLE_CUSTOM_ID },
          },
        })) > 0;

      const result: AcceptResult = {
        user,
        outcome: {
          kind: isAdminInvite || keptRoleUsable ? "admin" : "app",
          viaInvite: true,
          redirectUri: invitation.redirectUri,
          appCustomId: invitation.application.customId,
        },
      };
      return { result, invitation: { id: invitation.id, applicationId: invitation.applicationId, roleId: invitation.roleId } };
    });
    // Audited once the transaction has committed, so only a redemption that actually happened is recorded.
    if (!accepted) {
      await auditRejected("invalid_invitation", profile, ip);
      return null;
    }
    if ("mismatch" in accepted) {
      await auditRejected("invite_email_mismatch", profile, ip);
      return null;
    }
    await recordAudit({
      action: "invitation.redeem",
      actor: userActor(accepted.result.user, ip),
      target: { type: "invitation", id: accepted.invitation.id },
      details: { applicationId: accepted.invitation.applicationId, roleId: accepted.invitation.roleId },
    });
    return accepted.result;
  }

  // ── No invite: existing-admin login ─────────────────────────────────────────
  const existing = await prisma.user.findUnique({
    where: { sub_provider: { sub: profile.sub, provider: profile.provider } },
  });
  if (existing) {
    const userRole = await prisma.userRole.findFirst({
      where: { userId: existing.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
    });
    if (!userRole) {
      await auditRejected("no_portal_role", profile, ip, existing);
      return null;
    }
    if (userRole.expiredAt && userRole.expiredAt < new Date()) {
      await auditRejected("portal_role_expired", profile, ip, existing);
      return null;
    }
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: { name: profile.name, email: profile.email },
    });
    return { user, outcome: { kind: "admin", viaInvite: false, redirectUri: null, appCustomId: bouncerApp.customId } };
  }

  // ── No invite, no user: bootstrap the very first user as global admin ────────
  // A one-time latch, not a count of current admin assignments. Assignments can drop back to zero
  // (the last admin's portal role removed), and a count would then hand global admin to whoever
  // signs in next. `isGlobalAdmin` is set only here and the API cannot delete that user or clear
  // the flag, so once it exists the bootstrap never re-opens. The check itself reads no cached ids,
  // so a database reset under a running process cannot open it either.
  // Atomic (B-20): the check and the create run in one transaction holding an advisory lock, so
  // simultaneous first sign-ins queue up and only the first finds the latch open — the others then
  // see the admin and are refused like any uninvited stranger. The partial unique index
  // User_single_global_admin is the database-level backstop should anything slip past the lock.
  // Fast path, outside any transaction: once bootstrapped (the normal state), a stranger's sign-in
  // is refused without queueing on the lock — a flood of them would otherwise tie up pooled
  // connections. The locked transaction below re-checks, so this cannot open the latch twice.
  if ((await prisma.user.count({ where: { isGlobalAdmin: true } })) > 0) {
    await auditRejected("not_invited", profile, ip);
    return null;
  }
  let bootstrap: { user: Express.User } | { reason: "not_invited" | "not_allowlisted" };
  try {
    bootstrap = await prisma.$transaction(async (tx) => {
      // Transaction-scoped: released on commit or rollback. $executeRaw, not $queryRaw — the
      // function returns `void`, which the query path cannot deserialise.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`;
      const bootstrapped = await tx.user.count({ where: { isGlobalAdmin: true } });
      if (bootstrapped > 0) return { reason: "not_invited" as const };
      // Bootstrap guard: only allowlisted emails may become the first global admin. This closes
      // the "first person to reach OAuth wins global admin" race. (Required via config.)
      const allowlist = config.ADMIN_ALLOWED_EMAILS;
      if (allowlist.length > 0 && !allowlist.includes(profile.email.toLowerCase())) {
        return { reason: "not_allowlisted" as const };
      }
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
      return { user: created };
    });
  } catch (err) {
    // A unique violation here means someone else won (the single-admin index, or the same account's
    // duplicate callback): refuse this sign-in rather than fail with a 500.
    if ((err as { code?: string } | null)?.code === "P2002") {
      await auditRejected("bootstrap_taken", profile, ip);
      return null;
    }
    throw err;
  }
  if ("reason" in bootstrap) {
    await auditRejected(bootstrap.reason, profile, ip);
    return null;
  }
  const { user } = bootstrap;
  await recordAudit({
    action: "auth.bootstrap",
    actor: userActor(user, ip),
    target: { type: "user", id: user.id, label: user.name ?? null },
    details: { provider: profile.provider },
  });
  return { user, outcome: { kind: "admin", viaInvite: false, redirectUri: null, appCustomId: bouncerApp.customId } };
}
