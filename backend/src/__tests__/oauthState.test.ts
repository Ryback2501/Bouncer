import { vi, describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'

// `routes/auth.ts` reads the provider client ids at module load (requireProvider(...) sits in
// argument position), so the config has to be mocked before the router is imported or every
// route answers 501. SESSION_SECRET/NODE_ENV are needed too: the router imports middleware/csrf,
// which evaluates doubleCsrf({...}) at load.
const mockConfig = vi.hoisted(() => ({
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-secret-minimum-sixteen-chars!!',
  FRONTEND_URL: 'http://localhost:5173',
  GOOGLE_CLIENT_ID: 'test-google-id',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  MICROSOFT_CLIENT_ID: 'test-microsoft-id',
  MICROSOFT_CLIENT_SECRET: 'test-microsoft-secret',
  MICROSOFT_TENANT_ID: 'common',
  MICROSOFT_CALLBACK_URL: 'http://localhost:3000/auth/microsoft/callback',
  GITHUB_CLIENT_ID: 'test-github-id',
  GITHUB_CLIENT_SECRET: 'test-github-secret',
  GITHUB_CALLBACK_URL: 'http://localhost:3000/auth/github/callback',
  LINKEDIN_CLIENT_ID: 'test-linkedin-id',
  LINKEDIN_CLIENT_SECRET: 'test-linkedin-secret',
  LINKEDIN_CALLBACK_URL: 'http://localhost:3000/auth/linkedin/callback',
}))
vi.mock('../config', () => ({ config: mockConfig }))
vi.mock('../prisma', () => ({ prisma: { invitation: { findFirst: vi.fn() } } }))

import express from 'express'
import session from 'express-session'
import passport from 'passport'
import authRouter from '../routes/auth'
import { setupGoogleStrategy } from '../passport/googleStrategy'
import { setupMicrosoftStrategy } from '../passport/microsoftStrategy'
import { setupGitHubStrategy } from '../passport/githubStrategy'
import { setupLinkedInStrategy } from '../passport/linkedinStrategy'

// A bare harness rather than createApp(): the real app's connect-pg-simple store would turn every
// assertion below into a live Postgres write, and configurePassport() would additionally pull in
// ensureBouncerDefaults()'s DB upsert. The state store only needs *a* session, so the default
// in-memory store is enough. Mirrors __tests__/integration/testApp.ts.
function makeApp() {
  const app = express()
  app.use(session({ secret: mockConfig.SESSION_SECRET, resave: false, saveUninitialized: false }))
  app.use(passport.initialize())
  app.use('/auth', authRouter)
  return app
}

const app = makeApp()

beforeAll(() => {
  setupGoogleStrategy()
  setupMicrosoftStrategy()
  setupGitHubStrategy()
  setupLinkedInStrategy()
})

afterAll(() => {
  for (const name of ['google', 'microsoft', 'github', 'linkedin']) passport.unuse(name)
})

async function authorizeUrl(provider: string): Promise<URL> {
  const res = await request(app).get(`/auth/${provider}`)
  expect(res.status).toBe(302)
  return new URL(res.headers.location)
}

describe('OAuth authorization request hardening', () => {
  // Without `state` the flow is open to login CSRF (RFC 6749 §10.12): an attacker can bind a
  // victim's browser to an identity of the attacker's choosing. passport-oauth2 installs a
  // NullStore — no state sent, and verify() always succeeds — unless `state: true` is set.
  for (const provider of ['google', 'microsoft', 'github']) {
    it(`GET /auth/${provider} sends a state parameter`, async () => {
      const url = await authorizeUrl(provider)
      expect(url.searchParams.get('state')).toBeTruthy()
    })

    it(`GET /auth/${provider} sends an S256 PKCE challenge`, async () => {
      const url = await authorizeUrl(provider)
      expect(url.searchParams.get('code_challenge')).toBeTruthy()
      expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    })
  }

  // LinkedIn goes through passport-openidconnect, which always installs a state store — it never
  // had the NullStore problem. No nonce: LinkedIn does not echo one back in the ID token, and
  // passport-openidconnect fails the login when a requested nonce is missing.
  it('GET /auth/linkedin sends state and does not request a nonce', async () => {
    const url = await authorizeUrl('linkedin')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('nonce')).toBeNull()
  })

  it('issues a different state on every authorization request', async () => {
    const [a, b] = await Promise.all([authorizeUrl('google'), authorizeUrl('google')])
    expect(a.searchParams.get('state')).not.toBe(b.searchParams.get('state'))
  })
})

// The invite token used to ride in ?invite= on this request, which put it in the access log. It now
// reaches the session via POST /auth/invite instead, so the start URL must carry nothing.
describe('OAuth start no longer accepts an invite token in the URL', () => {
  it('ignores ?invite= and does not forward it to the provider', async () => {
    const res = await request(app).get('/auth/google?invite=sometoken')
    expect(res.status).toBe(302)
    const url = new URL(res.headers.location)
    expect(url.searchParams.get('invite')).toBeNull()
    expect(res.headers.location).not.toContain('sometoken')
  })
})

describe('OAuth callback state verification', () => {
  // The heart of the fix. A callback arriving with a state the server never issued must be
  // rejected. This needs no network stubbing: every strategy verifies state and fails before it
  // attempts the token exchange, so a passing test proves the store is non-null — which is
  // exactly what regressed here. Covering all four providers, not just google: linkedin in
  // particular runs on a different library with different semantics.
  for (const provider of ['google', 'microsoft', 'github', 'linkedin']) {
    it(`rejects a ${provider} callback whose state was never issued`, async () => {
      const res = await request(app).get(`/auth/${provider}/callback?code=stolen-code&state=forged`)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`${mockConfig.FRONTEND_URL}/login?error=auth_failed`)
    })

    it(`rejects a ${provider} callback with no state at all`, async () => {
      const res = await request(app).get(`/auth/${provider}/callback?code=stolen-code`)
      expect(res.status).toBe(302)
      expect(res.headers.location).toBe(`${mockConfig.FRONTEND_URL}/login?error=auth_failed`)
    })
  }
})
