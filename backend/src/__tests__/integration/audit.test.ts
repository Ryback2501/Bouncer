/**
 * B-16. Admin changes, invitations and refused protected actions are recorded in AuditEvent with
 * the acting admin (or API key), the target and the client IP — and never a secret. Real routers
 * and PostgreSQL; the harness signs every request in as testAdmin.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../prisma'
import { makeTestApp, testAdmin } from './testApp'
import { ensureBouncerDefaults } from '../../lib/bouncerDefaults'
import { pruneAudit } from '../../services/auditService'

const app = makeTestApp()
const PREFIX = `int-audit-${randomBytes(4).toString('hex')}`
const startedAt = new Date()

const lastEvent = (action: string, where: Record<string, unknown> = {}) =>
  prisma.auditEvent.findFirst({ where: { action, createdAt: { gte: startedAt }, ...where }, orderBy: { createdAt: 'desc' } })

function expectAdminActor(e: { actorType: string; actorId: string | null; actorLabel: string | null; ip: string | null } | null) {
  expect(e).not.toBeNull()
  expect(e!.actorType).toBe('user')
  expect(e!.actorId).toBe(testAdmin.id)
  expect(e!.actorLabel).toBe(testAdmin.name)
  expect(e!.ip).toBeTruthy()
}

let appId: string

beforeAll(async () => {
  // Admin invitations store createdById = req.user.id, so the synthetic admin needs a real row.
  await prisma.user.upsert({
    where: { id: testAdmin.id! },
    update: {},
    create: { id: testAdmin.id!, name: testAdmin.name!, email: testAdmin.email!, sub: testAdmin.sub!, provider: testAdmin.provider!, isGlobalAdmin: true },
  })
  appId = (await request(app).post('/admin/applications').send({ name: `${PREFIX} App`, customId: PREFIX })).body.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
  await prisma.application.deleteMany({ where: { customId: { startsWith: PREFIX } } })
  await prisma.auditEvent.deleteMany({ where: { createdAt: { gte: startedAt } } })
})

describe('admin changes are audited', () => {
  it('applications: create, update, delete', async () => {
    const created = await lastEvent('application.create', { targetId: appId })
    expectAdminActor(created)
    expect(created).toMatchObject({ outcome: 'success', targetType: 'application', targetLabel: `${PREFIX} App` })

    const other = (await request(app).post('/admin/applications').send({ name: 'Temp', customId: `${PREFIX}-tmp` })).body.id
    await request(app).patch(`/admin/applications/${other}`).send({ name: 'Renamed' })
    const updated = await lastEvent('application.update', { targetId: other })
    expectAdminActor(updated)
    expect(updated!.details).toEqual({ fields: ['name'] })

    await request(app).delete(`/admin/applications/${other}`)
    const deleted = await lastEvent('application.delete', { targetId: other })
    expectAdminActor(deleted)
    expect(deleted!.targetLabel).toBe('Renamed')
  })

  it('roles: create, update, delete', async () => {
    const roleId = (await request(app).post(`/admin/applications/${appId}/roles`).send({ name: 'Editor', customId: 'editor' })).body.id
    expect(await lastEvent('role.create', { targetId: roleId })).toMatchObject({ targetType: 'role', targetLabel: 'Editor', details: { applicationId: appId } })
    await request(app).patch(`/admin/applications/${appId}/roles/${roleId}`).send({ name: 'Writer' })
    expect((await lastEvent('role.update', { targetId: roleId }))!.details).toEqual({ applicationId: appId, fields: ['name'] })
    await request(app).delete(`/admin/applications/${appId}/roles/${roleId}`)
    expectAdminActor(await lastEvent('role.delete', { targetId: roleId }))
  })

  it('users and assignments: create, update, assign, remove, delete', async () => {
    const userId = (await request(app).post('/admin/users').send({ name: 'Bob', sub: `${PREFIX}-bob`, provider: 'google' })).body.id
    expect(await lastEvent('user.create', { targetId: userId })).toMatchObject({ targetType: 'user', targetLabel: 'Bob' })
    await request(app).patch(`/admin/users/${userId}`).send({ name: 'Robert' })
    expect((await lastEvent('user.update', { targetId: userId }))!.details).toEqual({ fields: ['name'] })

    const roleId = (await request(app).post(`/admin/applications/${appId}/roles`).send({ name: 'Viewer', customId: 'viewer' })).body.id
    await request(app).put(`/admin/users/${userId}/roles/${appId}`).send({ roleId })
    expect(await lastEvent('assignment.set', { targetId: userId })).toMatchObject({
      targetType: 'user',
      details: { applicationId: appId, roleId, active: true, expiredAt: null },
    })
    await request(app).delete(`/admin/users/${userId}/roles/${appId}`)
    expect(await lastEvent('assignment.remove', { targetId: userId })).toMatchObject({ details: { applicationId: appId } })

    await request(app).delete(`/admin/users/${userId}`)
    expect(await lastEvent('user.delete', { targetId: userId })).toMatchObject({ targetLabel: 'Robert' })
  })

  it('API keys: create and delete, without the raw key anywhere', async () => {
    const created = (await request(app).post(`/admin/applications/${appId}/api-keys`).send({ label: 'ci' })).body
    const ev = await lastEvent('api_key.create', { targetId: created.id })
    expect(ev).toMatchObject({ targetType: 'api_key', targetLabel: 'ci', details: { applicationId: appId } })
    expect(JSON.stringify(ev)).not.toContain(created.rawKey)

    await request(app).delete(`/admin/applications/${appId}/api-keys/${created.id}`)
    expectAdminActor(await lastEvent('api_key.delete', { targetId: created.id }))
  })

  it('invitations: admin create/delete, and API-key create with the key as actor', async () => {
    const roleId = (await request(app).post(`/admin/applications/${appId}/roles`).send({ name: 'Guest', customId: 'guest' })).body.id
    const inv = (await request(app).post('/admin/invitations').send({ applicationId: appId, roleId })).body
    expect(await lastEvent('invitation.create', { targetId: inv.id })).toMatchObject({ actorType: 'user', details: { applicationId: appId, roleId } })
    await request(app).delete(`/admin/invitations/${inv.id}`)
    expectAdminActor(await lastEvent('invitation.delete', { targetId: inv.id }))

    const key = (await request(app).post(`/admin/applications/${appId}/api-keys`).send({ label: 'minter' })).body
    const minted = await request(app).post('/api/v1/invitations').set('Authorization', `Bearer ${key.rawKey}`).send({ role: 'guest' })
    expect(minted.status).toBe(201)
    const ev = await lastEvent('invitation.create', { actorId: key.id })
    expect(ev).toMatchObject({ actorType: 'api_key', actorLabel: 'minter', targetType: 'invitation', details: { applicationId: appId, roleId } })
    const token = minted.body.inviteUrl.split('#')[1]
    expect(JSON.stringify(ev)).not.toContain(token)
  })

  it('a refused protected action is recorded as denied', async () => {
    const { app: bouncerApp } = await ensureBouncerDefaults()
    const res = await request(app).delete(`/admin/applications/${bouncerApp.id}`)
    expect(res.status).toBe(403)
    const ev = await lastEvent('application.delete', { targetId: bouncerApp.id })
    expectAdminActor(ev)
    expect(ev!.outcome).toBe('denied')
  })
})

describe('GET /admin/audit', () => {
  it('lists newest first with pagination and filters', async () => {
    const all = await request(app).get('/admin/audit').query({ limit: 2 })
    expect(all.status).toBe(200)
    expect(all.body.limit).toBe(2)
    expect(all.body.events).toHaveLength(2)
    expect(all.body.total).toBeGreaterThan(2)
    const [a, b] = all.body.events
    expect(new Date(a.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(b.createdAt).getTime())

    const roles = await request(app).get('/admin/audit').query({ action: 'role.', limit: 100 })
    expect(roles.body.events.length).toBeGreaterThan(0)
    expect(roles.body.events.every((e: { action: string }) => e.action.startsWith('role.'))).toBe(true)

    const denied = await request(app).get('/admin/audit').query({ outcome: 'denied' })
    expect(denied.body.events.every((e: { outcome: string }) => e.outcome === 'denied')).toBe(true)

    expect((await request(app).get('/admin/audit').query({ limit: 101 })).status).toBe(400)
    expect((await request(app).get('/admin/audit').query({ outcome: 'maybe' })).status).toBe(400)
  })

  it('never exposes an email address', async () => {
    const res = await request(app).get('/admin/audit').query({ limit: 100 })
    expect(JSON.stringify(res.body)).not.toContain(testAdmin.email)
  })
})

describe('retention', () => {
  it('prunes only events older than the retention period', async () => {
    const old = await prisma.auditEvent.create({
      data: { action: 'test.old', outcome: 'success', actorType: 'anonymous', createdAt: new Date(Date.now() - 91 * 86_400_000) },
    })
    const fresh = await prisma.auditEvent.create({ data: { action: 'test.fresh', outcome: 'success', actorType: 'anonymous' } })
    await pruneAudit(90)
    expect(await prisma.auditEvent.findUnique({ where: { id: old.id } })).toBeNull()
    expect(await prisma.auditEvent.findUnique({ where: { id: fresh.id } })).not.toBeNull()
  })
})
