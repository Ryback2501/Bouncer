import { vi, describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from '../app'

vi.mock('../prisma', () => ({ prisma: { $queryRaw: vi.fn() } }))

// B-10. Through the real app wiring: requests rejected by body-parser, csrf-csrf or routing answer
// with their own 4xx and a JSON code. They all used to come back as 500 internal_error (and an
// unmatched route as Express's HTML "Cannot GET" page). None of these reach the session store.
describe('client errors keep their status through the real app', () => {
  const app = createApp()

  it('malformed JSON → 400 invalid_json', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Content-Type', 'application/json')
      .send('{bad')
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'invalid_json' })
  })

  it('oversized body → 413 payload_too_large', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ x: 'a'.repeat(200_000) }))
    expect(res.status).toBe(413)
    expect(res.body).toEqual({ error: 'payload_too_large' })
  })

  it('admin write without a CSRF token → 403 invalid_csrf_token', async () => {
    const res = await request(app).post('/admin/applications').send({})
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'invalid_csrf_token' })
  })

  it('unmatched API route → JSON 404 not_found', async () => {
    const res = await request(app).get('/api/v1/nope').set('Accept', 'application/json')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not_found' })
  })
})

// A deployment whose STATIC_DIR has no built index.html is a server fault. sendFile's ENOENT carries
// status 404, which would otherwise pass for a client error: a JSON 404 and a warning, hiding it.
describe('a missing SPA shell is a server error', () => {
  const original = process.env.STATIC_DIR
  afterEach(() => {
    if (original === undefined) delete process.env.STATIC_DIR
    else process.env.STATIC_DIR = original
  })

  it('answers a page load with 500 internal_error when index.html is missing', async () => {
    vi.resetModules()
    process.env.STATIC_DIR = mkdtempSync(path.join(tmpdir(), 'bouncer-empty-spa-'))
    const { createApp: createFreshApp } = await vi.importActual<{ createApp: typeof createApp }>('../app')
    const res = await request(createFreshApp()).get('/applications').set('Accept', 'text/html')
    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'internal_error' })
  })
})
