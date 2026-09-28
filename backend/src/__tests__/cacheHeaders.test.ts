import { vi, describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'

vi.mock('../prisma', () => ({ prisma: { $queryRaw: vi.fn().mockResolvedValue([1]) } }))

// B-17. API responses carry admin data, role decisions and CSRF tokens; no shared cache (proxy, CDN)
// may store them. Every response under /admin, /auth and /api — success, rejection or 404 — is
// `Cache-Control: no-store`. None of these requests needs the database.
describe('API responses are never cacheable', () => {
  const app = createApp()

  const cases: [string, () => request.Test][] = [
    ['admin data (rejected: no session)', () => request(app).get('/admin/users')],
    ['the audit log (rejected: no session)', () => request(app).get('/admin/audit')],
    ['an admin write rejected by CSRF', () => request(app).post('/admin/applications').send({})],
    ['the CSRF token', () => request(app).get('/auth/csrf-token')],
    ['a malformed JSON body rejected before any route', () => request(app).post('/api/v1/invitations').set('Content-Type', 'application/json').send('{bad')],
    ['an access check (rejected: no key)', () => request(app).get('/api/v1/access?sub=x&provider=google')],
    ['an unknown API route', () => request(app).get('/api/v1/nope').set('Accept', 'application/json')],
  ]
  for (const [what, send] of cases) {
    it(`no-store on ${what}`, async () => {
      const res = await send()
      expect(res.headers['cache-control']).toBe('no-store')
    })
  }

  it('leaves the health check alone', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['cache-control']).not.toBe('no-store')
  })
})
