/**
 * Integration test for the full role-assignment → access-check flow.
 * Creates real DB rows (user, application, role, api key, user-role assignment)
 * and verifies the external /api/v1/access endpoint returns the correct result.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

// Unique prefixes so parallel test runs don't collide
const PREFIX = `int-access-${randomBytes(4).toString('hex')}`

let appId: string
let roleId: string
let userId: string
let rawApiKey: string

beforeAll(async () => {
  // Create application
  const appRow = await prisma.application.create({
    data: { name: 'Access Test App', customId: `${PREFIX}-app` },
  })
  appId = appRow.id

  // Create role
  const roleRow = await prisma.role.create({
    data: { name: 'Viewer', customId: 'viewer', applicationId: appId },
  })
  roleId = roleRow.id

  // Create user
  const userRow = await prisma.user.create({
    data: { name: 'Test User', sub: `${PREFIX}-sub`, provider: 'google' },
  })
  userId = userRow.id

  // Create API key for this application
  rawApiKey = `bncr_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawApiKey).digest('hex')
  await prisma.apiKey.create({ data: { applicationId: appId, keyHash, label: 'test' } })

  // Assign role to user
  await prisma.userRole.create({
    data: { userId, applicationId: appId, roleId, active: true, expiredAt: null },
  })
})

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.apiKey.deleteMany({ where: { applicationId: appId } })
  await prisma.role.deleteMany({ where: { applicationId: appId } })
  await prisma.application.deleteMany({ where: { id: appId } })
})

describe('GET /api/v1/access — full flow integration', () => {
  it('returns role info when user has an active assignment', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.role.customId).toBe('viewer')
    expect(res.body.application.customId).toBe(`${PREFIX}-app`)
  })

  it('returns 404 when user does not exist', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: 'unknown-sub', provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(404)
    expect(res.body.error).toBe('user_not_found')
  })

  it('returns 403 when role assignment is inactive', async () => {
    await prisma.userRole.update({
      where: { userId_applicationId: { userId, applicationId: appId } },
      data: { active: false },
    })

    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('role_inactive')

    // Restore
    await prisma.userRole.update({
      where: { userId_applicationId: { userId, applicationId: appId } },
      data: { active: true },
    })
  })

  it('returns 401 with invalid API key', async () => {
    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', 'Bearer bncr_0000000000000000000000000000000000000000000000000000000000000000')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_api_key')
  })
})
