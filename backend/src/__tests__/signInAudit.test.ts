import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Request, Response } from 'express'

// B-16. Every sign-in decision is audited: successful logins, rejections with a reason, the one-time
// first-admin bootstrap, invitation redemption and logout — with the client IP, and never the email.
const mockConfig = vi.hoisted(() => ({
  ADMIN_ALLOWED_EMAILS: [] as string[],
  NODE_ENV: 'test',
  FRONTEND_URL: 'http://localhost:5173',
  SESSION_SECRET: 'test-secret-minimum-sixteen-chars!!',
  CSRF_SECRET: 'test-csrf-secret-distinct-from-session!!',
}))
vi.mock('../config', () => ({ config: mockConfig }))

vi.mock('../lib/bouncerDefaults', async (orig) => ({
  ...(await orig<typeof import('../lib/bouncerDefaults')>()),
  ensureBouncerDefaults: vi.fn().mockResolvedValue({
    app: { id: 'bouncer-app', customId: 'bouncer' },
    role: { id: 'admin-role' },
  }),
}))

vi.mock('../prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
    userRole: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('../services/auditService', async (orig) => ({
  ...(await orig<typeof import('../services/auditService')>()),
  recordAudit: vi.fn().mockResolvedValue(undefined),
  logAuditOnly: vi.fn(),
}))

import { prisma } from '../prisma'
import { recordAudit, logAuditOnly } from '../services/auditService'
import { findOrCreateUser } from '../passport'
import { finishAuth, logoutHandler } from '../routes/auth'

const pu = prisma.user as unknown as Record<string, ReturnType<typeof vi.fn>>
const pur = prisma.userRole as unknown as Record<string, ReturnType<typeof vi.fn>>
const ptx = prisma.$transaction as unknown as ReturnType<typeof vi.fn>
const audit = vi.mocked(recordAudit)
const logOnly = vi.mocked(logAuditOnly)

const IP = '203.0.113.9'
const profile = { sub: 'g-123', provider: 'google', name: 'Pat', email: 'pat@example.com' }
const anonymous = { type: 'anonymous', id: null, label: null, ip: IP }

function expectNoEmail() {
  expect(JSON.stringify(audit.mock.calls)).not.toContain('pat@example.com')
}

describe('findOrCreateUser records its decision', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.ADMIN_ALLOWED_EMAILS = []
    pu.findUnique.mockResolvedValue(null)
    pu.count.mockResolvedValue(1)
  })

  it('bootstrap: the first global admin', async () => {
    pu.count.mockResolvedValue(0)
    ptx.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ user: { create: vi.fn().mockResolvedValue({ id: 'u1', name: 'Pat' }) }, userRole: { create: vi.fn() } })
    )
    await findOrCreateUser(profile, undefined, IP)
    expect(audit).toHaveBeenCalledWith({
      action: 'auth.bootstrap',
      actor: { type: 'user', id: 'u1', label: 'Pat', ip: IP },
      target: { type: 'user', id: 'u1', label: 'Pat' },
      details: { provider: 'google' },
    })
    expectNoEmail()
  })

  // A stranger can trigger these at will (any OAuth account), so they are log lines, not rows.
  it('rejected: not on the bootstrap allowlist (log only)', async () => {
    pu.count.mockResolvedValue(0)
    mockConfig.ADMIN_ALLOWED_EMAILS = ['someone-else@example.com']
    expect(await findOrCreateUser(profile, undefined, IP)).toBeNull()
    expect(audit).not.toHaveBeenCalled()
    expect(logOnly).toHaveBeenCalledWith({
      action: 'auth.login_rejected',
      outcome: 'denied',
      actor: anonymous,
      details: { provider: 'google', sub: 'g-123', reason: 'not_allowlisted' },
    })
    expectNoEmail()
  })

  it('rejected: an existing user without the portal role', async () => {
    pu.findUnique.mockResolvedValue({ id: 'u2', name: 'Pat' })
    pur.findFirst.mockResolvedValue(null)
    expect(await findOrCreateUser(profile, undefined, IP)).toBeNull()
    expect(audit).toHaveBeenCalledWith({
      action: 'auth.login_rejected',
      outcome: 'denied',
      actor: { type: 'user', id: 'u2', label: 'Pat', ip: IP },
      details: { provider: 'google', sub: 'g-123', reason: 'no_portal_role' },
    })
  })

  it('rejected: an expired portal role', async () => {
    pu.findUnique.mockResolvedValue({ id: 'u2', name: 'Pat' })
    pur.findFirst.mockResolvedValue({ expiredAt: new Date(Date.now() - 1000) })
    await findOrCreateUser(profile, undefined, IP)
    expect(audit.mock.calls[0][0]).toMatchObject({ outcome: 'denied', details: { reason: 'portal_role_expired' } })
  })

  it('rejected: a stranger once admins exist and there is no invitation (log only)', async () => {
    await findOrCreateUser(profile, undefined, IP)
    expect(audit).not.toHaveBeenCalled()
    expect(logOnly).toHaveBeenCalledWith({
      action: 'auth.login_rejected',
      outcome: 'denied',
      actor: anonymous,
      details: { provider: 'google', sub: 'g-123', reason: 'not_invited' },
    })
  })

  it('rejected: an unknown, used or expired invitation (log only)', async () => {
    ptx.mockImplementation(async (cb: (tx: unknown) => unknown) => cb({ invitation: { findFirst: vi.fn().mockResolvedValue(null) } }))
    expect(await findOrCreateUser(profile, 'rawtoken', IP)).toBeNull()
    expect(audit).not.toHaveBeenCalled()
    expect(logOnly).toHaveBeenCalledWith({
      action: 'auth.login_rejected',
      outcome: 'denied',
      actor: anonymous,
      details: { provider: 'google', sub: 'g-123', reason: 'invalid_invitation' },
    })
    expect(JSON.stringify(logOnly.mock.calls)).not.toContain('rawtoken')
  })

  // B-19: an invitation bound to an email is only redeemed by a sign-in reporting that email.
  function boundInviteTx(email: string) {
    return {
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv9', applicationId: 'bouncer-app', roleId: 'admin-role', redirectUri: null, email,
          application: { customId: 'bouncer' }, role: { customId: 'admin' },
        }),
        update: vi.fn(),
      },
      user: { upsert: vi.fn().mockResolvedValue({ id: 'u9', name: 'Pat', isGlobalAdmin: false }) },
      userRole: { upsert: vi.fn(), count: vi.fn() },
    }
  }

  it('a bound invitation is redeemed by the matching email, whatever its case', async () => {
    const tx = boundInviteTx('pat@example.com')
    ptx.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx))
    const result = await findOrCreateUser({ ...profile, email: 'Pat@Example.COM' }, 'rawtoken', IP)
    expect(result?.user).toMatchObject({ id: 'u9' })
    expect(tx.invitation.update).toHaveBeenCalled()
  })

  it('a bound invitation is refused for another email and stays unused', async () => {
    const tx = boundInviteTx('invitee@example.com')
    ptx.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx))
    expect(await findOrCreateUser(profile, 'rawtoken', IP)).toBeNull()
    expect(tx.user.upsert).not.toHaveBeenCalled()
    expect(tx.userRole.upsert).not.toHaveBeenCalled()
    expect(tx.invitation.update).not.toHaveBeenCalled()
    expect(audit).not.toHaveBeenCalled()
    expect(logOnly).toHaveBeenCalledWith({
      action: 'auth.login_rejected',
      outcome: 'denied',
      actor: anonymous,
      details: { provider: 'google', sub: 'g-123', reason: 'invite_email_mismatch' },
    })
    const logged = JSON.stringify(logOnly.mock.calls)
    expect(logged).not.toContain('invitee@example.com')
    expect(logged).not.toContain('pat@example.com')
  })

  it('invitation redeemed (after the transaction commits)', async () => {
    const tx = {
      invitation: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv1', applicationId: 'app1', roleId: 'r1', redirectUri: null,
          application: { customId: 'shop' }, role: { customId: 'editor' },
        }),
        update: vi.fn(),
      },
      user: { upsert: vi.fn().mockResolvedValue({ id: 'u3', name: 'Pat', isGlobalAdmin: false }) },
      userRole: { upsert: vi.fn(), count: vi.fn() },
    }
    ptx.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx))
    await findOrCreateUser(profile, 'rawtoken', IP)
    expect(audit).toHaveBeenCalledWith({
      action: 'invitation.redeem',
      actor: { type: 'user', id: 'u3', label: 'Pat', ip: IP },
      target: { type: 'invitation', id: 'inv1' },
      details: { applicationId: 'app1', roleId: 'r1' },
    })
    expect(JSON.stringify(audit.mock.calls)).not.toContain('rawtoken')
  })
})

describe('the OAuth callback and logout record the session', () => {
  beforeEach(() => vi.clearAllMocks())

  const user = { id: 'u1', name: 'Pat', provider: 'google', email: 'pat@example.com' }

  it('login into the portal', async () => {
    const res = { redirect: vi.fn() } as unknown as Response
    await finishAuth({ user, ip: IP } as unknown as Request, res)
    expect(audit).toHaveBeenCalledWith({
      action: 'auth.login',
      actor: { type: 'user', id: 'u1', label: 'Pat', ip: IP },
      details: { provider: 'google', viaInvite: false },
    })
    expect(res.redirect).toHaveBeenCalled()
    expectNoEmail()
  })

  it('login through an admin invitation is flagged as via invite', async () => {
    const res = { redirect: vi.fn() } as unknown as Response
    const req = { user, ip: IP, inviteOutcome: { kind: 'admin', viaInvite: true, redirectUri: null, appCustomId: 'bouncer' } }
    await finishAuth(req as unknown as Request, res)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login', details: { provider: 'google', viaInvite: true } }))
  })

  it('the invite path of findOrCreateUser reports viaInvite', async () => {
    const tx = {
      invitation: {
        findFirst: vi.fn().mockResolvedValue({ id: 'inv2', applicationId: 'bouncer-app', roleId: 'admin-role', redirectUri: null, application: { customId: 'bouncer' }, role: { customId: 'admin' } }),
        update: vi.fn(),
      },
      user: { upsert: vi.fn().mockResolvedValue({ id: 'u4', name: 'Pat', isGlobalAdmin: false }) },
      userRole: { upsert: vi.fn(), count: vi.fn() },
    }
    ptx.mockImplementation(async (cb: (t: unknown) => unknown) => cb(tx))
    const result = await findOrCreateUser(profile, 'rawtoken', IP)
    expect(result?.outcome).toMatchObject({ kind: 'admin', viaInvite: true })
  })

  it('login through an application invitation', async () => {
    const res = { redirect: vi.fn() } as unknown as Response
    const req = { user, ip: IP, inviteOutcome: { kind: 'app', viaInvite: true, redirectUri: null, appCustomId: 'shop' }, logout: (cb: (e?: unknown) => void) => cb() }
    await finishAuth(req as unknown as Request, res)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login', details: { provider: 'google', viaInvite: true, application: 'shop' } }))
  })

  it('logout by a signed-in admin', async () => {
    const res = { clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn(), json: vi.fn() }
    const req = { user, ip: IP, logout: (cb: (e?: unknown) => void) => cb(), session: { destroy: (cb: () => void) => cb() } }
    await logoutHandler(req as unknown as Request, res as unknown as Response)
    expect(audit).toHaveBeenCalledWith({ action: 'auth.logout', actor: { type: 'user', id: 'u1', label: 'Pat', ip: IP } })
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('a logout without a session records nothing', async () => {
    const res = { clearCookie: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn(), json: vi.fn() }
    const req = { ip: IP, logout: (cb: (e?: unknown) => void) => cb(), session: { destroy: (cb: () => void) => cb() } }
    await logoutHandler(req as unknown as Request, res as unknown as Response)
    expect(audit).not.toHaveBeenCalled()
  })
})
