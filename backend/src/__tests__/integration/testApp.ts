/**
 * Creates a minimal Express app for integration tests.
 * Uses the real admin/access routers and real Prisma, but bypasses Passport
 * session auth by injecting a test user directly onto req.user.
 */
import express from 'express'
import type { User, Prisma } from '@prisma/client'
import { prisma } from '../../prisma'
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

/**
 * Create the one global admin a test needs. The database allows at most one (B-20, partial unique
 * index User_single_global_admin), so the flag is first cleared on any other row — test DB only.
 */
export async function makeGlobalAdmin(data: Omit<Prisma.UserCreateInput, 'isGlobalAdmin'>) {
  await prisma.user.updateMany({ where: { isGlobalAdmin: true }, data: { isGlobalAdmin: false } })
  return prisma.user.create({ data: { ...data, isGlobalAdmin: true } })
}
