import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: { invitation: { findFirst: vi.fn() }, $queryRaw: vi.fn() },
}))

import { prisma } from '../prisma'
import request from 'supertest'
import { createApp } from '../app'

const inv = prisma.invitation as unknown as Record<string, ReturnType<typeof vi.fn>>
const app = createApp()

describe('GET /auth/invite/:token', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns valid: true when a matching unexpired invitation exists', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    inv.findFirst.mockResolvedValue({ expiresAt })
    const res = await request(app).get('/auth/invite/somerawtoken')
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.expiresAt).toBe(expiresAt)
  })

  it('returns valid: false when no matching invitation is found', async () => {
    inv.findFirst.mockResolvedValue(null)
    const res = await request(app).get('/auth/invite/somerawtoken')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ valid: false, expiresAt: null })
  })

  it('hashes the token before querying the database', async () => {
    inv.findFirst.mockResolvedValue(null)
    const { createHash } = await import('crypto')
    const expectedHash = createHash('sha256').update('somerawtoken').digest('hex')
    await request(app).get('/auth/invite/somerawtoken')
    expect(inv.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ token: expectedHash }) })
    )
  })
})
