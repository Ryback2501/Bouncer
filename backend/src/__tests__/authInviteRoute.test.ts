import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../prisma', () => ({
  prisma: { invitation: { findFirst: vi.fn() }, $queryRaw: vi.fn() },
}))

import { prisma } from '../prisma'
import request from 'supertest'
import { createApp } from '../app'

const inv = prisma.invitation as unknown as Record<string, ReturnType<typeof vi.fn>>
const app = createApp()

// The token arrives in the request body, never in the URL: bodies are not logged, so there is
// nothing here for a log or a reverse proxy to capture.
describe('POST /auth/invite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns valid: true when a matching unexpired invitation exists', async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    inv.findFirst.mockResolvedValue({ expiresAt })
    const res = await request(app).post('/auth/invite').send({ token: 'somerawtoken' })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    expect(res.body.expiresAt).toBe(expiresAt)
  })

  it('returns valid: false when no matching invitation is found', async () => {
    inv.findFirst.mockResolvedValue(null)
    const res = await request(app).post('/auth/invite').send({ token: 'somerawtoken' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ valid: false, expiresAt: null })
  })

  it('hashes the token before querying the database', async () => {
    inv.findFirst.mockResolvedValue(null)
    const { createHash } = await import('crypto')
    const expectedHash = createHash('sha256').update('somerawtoken').digest('hex')
    await request(app).post('/auth/invite').send({ token: 'somerawtoken' })
    expect(inv.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ token: expectedHash }) })
    )
  })

  it('rejects a missing or empty token', async () => {
    for (const body of [{}, { token: '' }, { token: 123 }]) {
      const res = await request(app).post('/auth/invite').send(body)
      expect(res.status).toBe(400)
    }
    expect(inv.findFirst).not.toHaveBeenCalled()
  })

  // Preview is read-only. If loading the invite page armed the session, anyone who merely opened a
  // forwarded invite link — an existing admin, say — would redeem that invitation on their next
  // unrelated sign-in, without ever choosing to.
  it('does not stage the token, even for a valid invitation', async () => {
    inv.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000).toISOString() })
    const res = await request(app).post('/auth/invite').send({ token: 'somerawtoken' })
    expect(res.status).toBe(200)
    expect(res.body.valid).toBe(true)
    // Nothing was written to the session, so express-session issues no cookie.
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('no longer exposes the token in a URL path', async () => {
    const res = await request(app).get('/auth/invite/somerawtoken')
    expect(res.status).toBe(404)
  })
})

// Reached only from the invite page's provider button, so that redemption follows a deliberate
// choice rather than a page view.
describe('POST /auth/invite/stage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores a valid token in the session', async () => {
    inv.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60_000).toISOString() })
    const res = await request(app).post('/auth/invite/stage').send({ token: 'somerawtoken' })
    expect(res.status).toBe(204)
    expect(String(res.headers['set-cookie'])).toMatch(/connect\.sid/)
  })

  // A dead token must not be stored: it would send every later sign-in from this browser down the
  // invite branch of findOrCreateUser, which fails, locking the user out of an otherwise fine login.
  it('refuses a token that does not resolve and stores nothing', async () => {
    inv.findFirst.mockResolvedValue(null)
    const res = await request(app).post('/auth/invite/stage').send({ token: 'bogus' })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('invitation_not_found')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('rejects a missing or empty token', async () => {
    for (const body of [{}, { token: '' }]) {
      const res = await request(app).post('/auth/invite/stage').send(body)
      expect(res.status).toBe(400)
    }
    expect(inv.findFirst).not.toHaveBeenCalled()
  })
})
