import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// INFO-01. The guard used to check only "signed in?" and relied on deserializeUser (another file)
// to guarantee that every signed-in user is a portal admin. It now checks the admin role itself.
vi.mock('../lib/bouncerDefaults', async (orig) => ({
  ...(await orig<typeof import('../lib/bouncerDefaults')>()),
  hasActivePortalAdminRole: vi.fn(),
}))
vi.mock('../services/auditService', async (orig) => ({
  ...(await orig<typeof import('../services/auditService')>()),
  logAuditOnly: vi.fn(),
}))

import { requireAdmin } from '../middleware/requireAdmin'
import { hasActivePortalAdminRole } from '../lib/bouncerDefaults'
import { logAuditOnly } from '../services/auditService'

const isAdmin = vi.mocked(hasActivePortalAdminRole)

function makeReq(authenticated: boolean, user?: { id: string; name: string }): Request {
  return { isAuthenticated: () => authenticated, user, ip: '10.0.0.9', method: 'GET', baseUrl: '/admin', path: '/users' } as unknown as Request
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('requireAdmin', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lets a signed-in portal admin through', async () => {
    isAdmin.mockResolvedValue(true)
    const next = vi.fn() as unknown as NextFunction
    await requireAdmin(makeReq(true, { id: 'u1', name: 'Pat' }), makeRes(), next)
    expect(isAdmin).toHaveBeenCalledWith('u1')
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it('returns 401 when the request is not signed in', async () => {
    const next = vi.fn() as unknown as NextFunction
    const res = makeRes()
    await requireAdmin(makeReq(false), res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' })
    expect(next).not.toHaveBeenCalled()
    expect(isAdmin).not.toHaveBeenCalled()
  })

  // The core of INFO-01: even if a session exists, a user without the active portal admin role is
  // refused here — the guard no longer depends on deserializeUser alone.
  it('returns 401 for a signed-in user without the portal admin role, and logs it as a warning', async () => {
    isAdmin.mockResolvedValue(false)
    const next = vi.fn() as unknown as NextFunction
    const res = makeRes()
    await requireAdmin(makeReq(true, { id: 'u2', name: 'Sam' }), res, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ error: 'unauthorized' })
    expect(next).not.toHaveBeenCalled()
    expect(logAuditOnly).toHaveBeenCalledWith(
      {
        action: 'admin.access_denied',
        outcome: 'denied',
        actor: { type: 'user', id: 'u2', label: 'Sam', ip: '10.0.0.9' },
        details: { reason: 'no_portal_role', method: 'GET', path: '/admin/users' },
      },
      'warn'
    )
  })

  it('passes a database error on instead of letting the request through', async () => {
    isAdmin.mockRejectedValue(new Error('db down'))
    const next = vi.fn() as unknown as NextFunction
    await requireAdmin(makeReq(true, { id: 'u1', name: 'Pat' }), makeRes(), next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'db down' }))
  })
})
