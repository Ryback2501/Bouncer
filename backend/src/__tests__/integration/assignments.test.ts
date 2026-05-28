/**
 * Integration tests for the role-assignment admin routes.
 * Covers the full assign → verify → update → remove lifecycle,
 * including cross-referencing with the external /api/v1/access endpoint.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

const PREFIX = `int-assign-${randomBytes(4).toString('hex')}`

let appId: string
let roleIdA: string
let roleIdB: string
let userId: string
let rawApiKey: string

beforeAll(async () => {
  const appRow = await prisma.application.create({
    data: { name: 'Assignment Test App', customId: `${PREFIX}-app` },
  })
  appId = appRow.id

  const roleA = await prisma.role.create({
    data: { name: 'Viewer', customId: 'viewer', applicationId: appId },
  })
  roleIdA = roleA.id

  const roleB = await prisma.role.create({
    data: { name: 'Editor', customId: 'editor', applicationId: appId },
  })
  roleIdB = roleB.id

  const userRow = await prisma.user.create({
    data: { name: 'Assignment User', sub: `${PREFIX}-sub`, provider: 'google' },
  })
  userId = userRow.id

  rawApiKey = `bncr_${randomBytes(32).toString('hex')}`
  const keyHash = createHash('sha256').update(rawApiKey).digest('hex')
  await prisma.apiKey.create({ data: { applicationId: appId, keyHash, label: 'test' } })
})

afterAll(async () => {
  await prisma.userRole.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.apiKey.deleteMany({ where: { applicationId: appId } })
  await prisma.application.deleteMany({ where: { id: appId } })
})

describe('Role assignments — integration', () => {
  it('PUT /admin/users/:userId/roles/:appId assigns a role and returns 200', async () => {
    const res = await request(app)
      .put(`/admin/users/${userId}/roles/${appId}`)
      .send({ roleId: roleIdA })

    expect(res.status).toBe(200)
    expect(res.body.roleId).toBe(roleIdA)
    expect(res.body.active).toBe(true)
  })

  it('GET /admin/users/:userId/roles returns the assigned role', async () => {
    const res = await request(app).get(`/admin/users/${userId}/roles`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const assignment = res.body.find((r: { applicationId: string }) => r.applicationId === appId)
    expect(assignment).toBeDefined()
    expect(assignment.roleId).toBe(roleIdA)
  })

  it('PUT (upsert) updates the role when called again with a different roleId', async () => {
    const res = await request(app)
      .put(`/admin/users/${userId}/roles/${appId}`)
      .send({ roleId: roleIdB })

    expect(res.status).toBe(200)
    expect(res.body.roleId).toBe(roleIdB)
  })

  it('GET /api/v1/access returns 200 for the assigned user', async () => {
    await request(app)
      .put(`/admin/users/${userId}/roles/${appId}`)
      .send({ roleId: roleIdA, active: true })

    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(200)
    expect(res.body.role.id).toBe(roleIdA)
  })

  it('PUT with active:false → /api/v1/access returns 403 role_inactive', async () => {
    await request(app)
      .put(`/admin/users/${userId}/roles/${appId}`)
      .send({ roleId: roleIdA, active: false })

    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(403)
    expect(res.body.error).toBe('role_inactive')

    // Restore for next tests
    await request(app)
      .put(`/admin/users/${userId}/roles/${appId}`)
      .send({ roleId: roleIdA, active: true })
  })

  it('DELETE /admin/users/:userId/roles/:appId removes assignment and returns 204', async () => {
    const del = await request(app).delete(`/admin/users/${userId}/roles/${appId}`)
    expect(del.status).toBe(204)

    const res = await request(app)
      .get('/api/v1/access')
      .query({ sub: `${PREFIX}-sub`, provider: 'google' })
      .set('Authorization', `Bearer ${rawApiKey}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /admin/assignments (cross-app listing)', () => {
  let secondAppId: string
  let secondRoleId: string
  let secondUserId: string

  beforeAll(async () => {
    // Add a row in a second application so the listing must return assignments from > 1 app.
    const a2 = await prisma.application.create({
      data: { name: 'Assignments Test App 2', customId: `${PREFIX}-app2` },
    })
    secondAppId = a2.id
    const role2 = await prisma.role.create({
      data: { name: 'Reader', customId: 'reader', applicationId: secondAppId },
    })
    secondRoleId = role2.id
    const u2 = await prisma.user.create({
      data: { name: 'Second User', sub: `${PREFIX}-sub2`, provider: 'github' },
    })
    secondUserId = u2.id
    await prisma.userRole.create({
      data: { userId: secondUserId, applicationId: secondAppId, roleId: secondRoleId, active: true },
    })
    // Restore the row in the first app that the prior tests removed.
    await prisma.userRole.create({
      data: { userId, applicationId: appId, roleId: roleIdA, active: true },
    })
  })

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { userId: secondUserId } })
    await prisma.user.deleteMany({ where: { id: secondUserId } })
    await prisma.application.deleteMany({ where: { id: secondAppId } })
  })

  it('returns rows from multiple applications with user, role, and application includes', async () => {
    const res = await request(app).get('/admin/assignments')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    const ours = res.body.filter((row: { applicationId: string }) =>
      [appId, secondAppId].includes(row.applicationId)
    )
    expect(ours.map((r: { applicationId: string }) => r.applicationId).sort()).toEqual(
      [appId, secondAppId].sort()
    )

    for (const row of ours) {
      expect(row).toHaveProperty('user.id')
      expect(row).toHaveProperty('user.provider')
      expect(row).toHaveProperty('role.id')
      expect(row).toHaveProperty('role.customId')
      expect(row).toHaveProperty('application.id')
      expect(row).toHaveProperty('application.customId')
    }
  })
})
