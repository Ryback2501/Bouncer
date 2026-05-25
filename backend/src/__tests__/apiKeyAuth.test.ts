import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('../prisma', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '../prisma'
import { apiKeyAuth } from '../middleware/apiKeyAuth'
import type { Request, Response, NextFunction } from 'express'

const p = prisma.apiKey as unknown as Record<string, ReturnType<typeof vi.fn>>

function makeReq(authHeader?: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request
}

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response
  ;(res.status as ReturnType<typeof vi.fn>).mockReturnValue(res)
  return res
}

describe('apiKeyAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when Authorization header is missing', async () => {
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    await apiKeyAuth(makeReq(), res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'invalid_api_key' })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    await apiKeyAuth(makeReq('Basic abc123'), res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when key is not found in database', async () => {
    p.findUnique.mockResolvedValue(null)
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    await apiKeyAuth(makeReq('Bearer invalid-key'), res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 api_key_expired when the key has expired', async () => {
    const rawKey = 'bncr_expiredkey'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    p.findUnique.mockResolvedValue({
      id: 'k1', keyHash, expiresAt: new Date(Date.now() - 1000),
      application: { id: 'app1', customId: 'my-app' },
    })
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    await apiKeyAuth(makeReq(`Bearer ${rawKey}`), res, next)
    expect((res.status as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401)
    expect((res.json as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({ error: 'api_key_expired' })
    expect(next).not.toHaveBeenCalled()
  })

  it('allows a key whose expiresAt is in the future', async () => {
    const rawKey = 'bncr_validkey'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const mockApp = { id: 'app1', customId: 'my-app' }
    p.findUnique.mockResolvedValue({ id: 'k1', keyHash, expiresAt: new Date(Date.now() + 60_000), application: mockApp })
    p.update.mockResolvedValue({})
    const req = makeReq(`Bearer ${rawKey}`)
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction
    await apiKeyAuth(req, res, next)
    expect(req.bouncerApp).toEqual(mockApp)
    expect(next).toHaveBeenCalledOnce()
  })

  it('sets req.bouncerApp and calls next for a valid key', async () => {
    const rawKey = 'bncr_testkey'
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const mockApp = { id: 'app1', name: 'My App', customId: 'my-app' }
    const mockApiKey = { id: 'k1', keyHash, application: mockApp }

    p.findUnique.mockResolvedValue(mockApiKey)
    p.update.mockResolvedValue({})

    const req = makeReq(`Bearer ${rawKey}`)
    const res = makeRes()
    const next = vi.fn() as unknown as NextFunction

    await apiKeyAuth(req, res, next)

    expect(p.findUnique).toHaveBeenCalledWith({
      where: { keyHash },
      include: { application: true },
    })
    expect(req.bouncerApp).toEqual(mockApp)
    expect(next).toHaveBeenCalledOnce()
  })
})
