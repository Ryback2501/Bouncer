import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'

// B-16. Rejections anyone can trigger without credentials (unknown/expired API key, no admin
// session, bad CSRF token) are audit LOG lines only — never AuditEvent rows, or an attacker could
// grow the table at will. They carry the client IP and never the presented secret.
vi.mock('../prisma', () => ({
  prisma: { apiKey: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) }, auditEvent: { create: vi.fn() } },
}))
vi.mock('../services/auditService', async (orig) => ({
  ...(await orig<typeof import('../services/auditService')>()),
  logAuditOnly: vi.fn(),
  recordAudit: vi.fn(),
}))

import { prisma } from '../prisma'
import { logAuditOnly, recordAudit } from '../services/auditService'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import { requireAdmin } from '../middleware/requireAdmin'
import { errorHandler } from '../middleware/errorHandler'

const pk = prisma.apiKey as unknown as Record<string, ReturnType<typeof vi.fn>>
const logOnly = vi.mocked(logAuditOnly)
const IP = '198.51.100.4'
const RAW = 'bncr_' + 'a'.repeat(64)

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}
const next = vi.fn() as unknown as NextFunction
const anonymous = { type: 'anonymous', id: null, label: null, ip: IP }

describe('rejections are audit log lines, not rows', () => {
  beforeEach(() => vi.clearAllMocks())

  it('missing API key', async () => {
    await apiKeyAuth({ headers: {}, ip: IP } as unknown as Request, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith({ action: 'api_key.rejected', outcome: 'denied', actor: anonymous, details: { reason: 'missing_key' } })
  })

  it('unknown API key — and never the key itself', async () => {
    pk.findUnique.mockResolvedValue(null)
    await apiKeyAuth({ headers: { authorization: `Bearer ${RAW}` }, ip: IP } as unknown as Request, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith({ action: 'api_key.rejected', outcome: 'denied', actor: anonymous, details: { reason: 'unknown_key' } })
    const logged = JSON.stringify(logOnly.mock.calls)
    expect(logged).not.toContain(RAW)
    expect(logged).not.toContain(createHash('sha256').update(RAW).digest('hex'))
  })

  it('expired API key names the key', async () => {
    pk.findUnique.mockResolvedValue({ id: 'k1', label: 'old', expiresAt: new Date(Date.now() - 1000), application: { customId: 'shop' } })
    await apiKeyAuth({ headers: { authorization: `Bearer ${RAW}` }, ip: IP } as unknown as Request, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith({
      action: 'api_key.rejected', outcome: 'denied', actor: { type: 'api_key', id: 'k1', label: 'old', ip: IP }, details: { reason: 'expired' },
    })
  })

  it('a key issued for the portal application names the key', async () => {
    pk.findUnique.mockResolvedValue({ id: 'k2', label: 'legacy', expiresAt: null, application: { customId: 'bouncer' } })
    await apiKeyAuth({ headers: { authorization: `Bearer ${RAW}` }, ip: IP } as unknown as Request, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith({
      action: 'api_key.rejected', outcome: 'denied', actor: { type: 'api_key', id: 'k2', label: 'legacy', ip: IP }, details: { reason: 'portal_key' },
    })
  })

  it('no admin session (logged at info: every anonymous page load hits it)', () => {
    requireAdmin({ isAuthenticated: () => false, ip: IP, method: 'GET', baseUrl: '/admin', path: '/users' } as unknown as Request, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith(
      { action: 'admin.unauthenticated', outcome: 'denied', actor: anonymous, details: { method: 'GET', path: '/admin/users' } },
      'info'
    )
  })

  it('bad CSRF token, attributed to the signed-in admin', () => {
    const req = { user: { id: 'u1', name: 'Pat' }, ip: IP, method: 'POST', url: '/admin/applications', baseUrl: '/admin', path: '/applications' } as unknown as Request
    errorHandler(Object.assign(new Error('invalid csrf token'), { status: 403, code: 'EBADCSRFTOKEN' }), req, makeRes(), next)
    expect(logOnly).toHaveBeenCalledWith({
      action: 'admin.csrf_rejected', outcome: 'denied', actor: { type: 'user', id: 'u1', label: 'Pat', ip: IP }, details: { method: 'POST', path: '/admin/applications' },
    })
  })

  it('none of them writes an AuditEvent row', () => {
    expect(recordAudit).not.toHaveBeenCalled()
  })
})
