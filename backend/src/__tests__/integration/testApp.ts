/**
 * Creates a minimal Express app for integration tests.
 * Uses the real admin/access routers and real Prisma, but bypasses Passport
 * session auth by injecting a test user directly onto req.user.
 */
import express from 'express'
import type { User } from '@prisma/client'
import adminRouter from '../../routes/admin'
import accessRouter from '../../routes/api/v1/access'
import apiInvitationsRouter from '../../routes/api/v1/invitations'

export const testAdmin: Partial<User> = {
  id: 'test-admin-id',
  name: 'Test Admin',
  email: 'admin@test.com',
  sub: 'test-admin-sub',
  provider: 'google',
  isGlobalAdmin: true,
}

export function makeTestApp() {
  const app = express()
  app.use(express.json())

  // Bypass authentication: set req.user and req.isAuthenticated for all requests
  app.use((req, _res, next) => {
    req.user = testAdmin as User
    // Passport types isAuthenticated as a type predicate; cast to satisfy TS
    ;(req as { isAuthenticated: () => boolean }).isAuthenticated = () => true
    next()
  })

  app.use('/admin', adminRouter)
  app.use('/api/v1', accessRouter)
  app.use('/api/v1/invitations', apiInvitationsRouter)

  return app
}
