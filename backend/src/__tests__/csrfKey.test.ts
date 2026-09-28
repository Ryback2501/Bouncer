import { describe, it, expect } from 'vitest'
import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { doubleCsrf } from 'csrf-csrf'
import { generateCsrfToken, doubleCsrfProtection } from '../middleware/csrf'
import { errorHandler } from '../middleware/errorHandler'

// B-15. CSRF tokens used to be HMAC-signed with SESSION_SECRET, the key that also signs session
// cookies. They now have their own CSRF_SECRET: a token minted with SESSION_SECRET must not pass.
// A minimal app with an in-memory session store stands in for the real one (whose store needs a DB);
// the protection and generator under test are the real ones from middleware/csrf.
const signedWithSessionSecret = doubleCsrf({
  getSecret: () => process.env.SESSION_SECRET!,
  getSessionIdentifier: (req) => req.sessionID ?? '',
  cookieName: 'x-csrf-token',
  cookieOptions: { sameSite: 'strict', path: '/', secure: false, httpOnly: true },
  getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
})

function makeApp() {
  const app = express()
  app.use(cookieParser())
  app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: true }))
  app.get('/token', (req, res) => { res.json({ token: generateCsrfToken(req, res) }) })
  app.get('/token-with-session-secret', (req, res) => {
    res.json({ token: signedWithSessionSecret.generateCsrfToken(req, res) })
  })
  app.post('/write', doubleCsrfProtection, (_req, res) => { res.status(204).end() })
  app.use(errorHandler)
  return app
}

describe('CSRF tokens are signed with CSRF_SECRET', () => {
  it('accepts a token issued by the app', async () => {
    const agent = request.agent(makeApp())
    const { token } = (await agent.get('/token')).body
    expect((await agent.post('/write').set('x-csrf-token', token)).status).toBe(204)
  })

  it('rejects a token signed with SESSION_SECRET', async () => {
    const agent = request.agent(makeApp())
    const { token } = (await agent.get('/token-with-session-secret')).body
    const res = await agent.post('/write').set('x-csrf-token', token)
    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'invalid_csrf_token' })
  })
})
