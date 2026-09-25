import { vi, describe, it, expect, afterEach } from 'vitest'
import request from 'supertest'
import type { createApp as CreateApp } from '../app'

vi.mock('../prisma', () => ({ prisma: { $queryRaw: vi.fn() } }))

// B-07. The real app wiring follows the deployment's origin, not NODE_ENV: setup.ts runs as
// NODE_ENV=test, which used to mean "no Secure cookies" regardless of how Bouncer is reached.
// Each case reloads config + app so a different FRONTEND_URL takes effect.
async function appFor(frontendUrl: string) {
  vi.resetModules()
  process.env.FRONTEND_URL = frontendUrl
  delete process.env.TRUST_PROXY
  const { createApp } = await vi.importActual<{ createApp: typeof CreateApp }>('../app')
  return createApp()
}

const csrfCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('x-csrf-token='))

describe('security wiring follows FRONTEND_URL', () => {
  const original = process.env.FRONTEND_URL
  afterEach(() => {
    process.env.FRONTEND_URL = original
  })

  it('https origin: Secure CSRF cookie and one trusted proxy hop', async () => {
    const app = await appFor('https://bouncer.example.com')
    const res = await request(app).get('/auth/csrf-token')
    expect(csrfCookie(res)).toMatch(/;\s*Secure/i)
    expect(app.get('trust proxy')).toBe(1)
  })

  it('http origin: no Secure flag, and X-Forwarded-For is not trusted', async () => {
    const app = await appFor('http://localhost')
    const res = await request(app).get('/auth/csrf-token')
    expect(csrfCookie(res)).toBeDefined()
    expect(csrfCookie(res)).not.toMatch(/;\s*Secure/i)
    expect(app.get('trust proxy')).toBe(false)
  })
})
