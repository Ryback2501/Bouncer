/**
 * B-11. Writes nested under /admin/applications/:appId must only reach objects of that application.
 * The api-key delete and the role update/delete used to act on the object id alone, so App A's URL
 * could delete App B's key or rename/delete App B's role. Real PostgreSQL — no Prisma mocks.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()

let appA: string
let appB: string

beforeEach(async () => {
  appA = (await request(app).post('/admin/applications').send({ name: 'Scope A', customId: 'test-int-scope-a' })).body.id
  appB = (await request(app).post('/admin/applications').send({ name: 'Scope B', customId: 'test-int-scope-b' })).body.id
})

afterEach(async () => {
  await prisma.application.deleteMany({ where: { customId: { startsWith: 'test-int-scope-' } } })
})

describe('API keys are scoped to the application in the URL', () => {
  it("does not delete another application's key", async () => {
    const keyB = (await request(app).post(`/admin/applications/${appB}/api-keys`).send({ label: 'b' })).body.id

    const res = await request(app).delete(`/admin/applications/${appA}/api-keys/${keyB}`)
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'not_found' })
    expect(await prisma.apiKey.findUnique({ where: { id: keyB } })).not.toBeNull()

    expect((await request(app).delete(`/admin/applications/${appB}/api-keys/${keyB}`)).status).toBe(204)
    expect(await prisma.apiKey.findUnique({ where: { id: keyB } })).toBeNull()
  })
})

describe('roles are scoped to the application in the URL', () => {
  let roleB: string

  beforeEach(async () => {
    roleB = (await request(app).post(`/admin/applications/${appB}/roles`).send({ name: 'Editor', customId: 'editor' })).body.id
  })

  it("does not rename another application's role", async () => {
    const res = await request(app).patch(`/admin/applications/${appA}/roles/${roleB}`).send({ name: 'Hijacked' })
    expect(res.status).toBe(404)
    expect((await prisma.role.findUnique({ where: { id: roleB } }))?.name).toBe('Editor')

    const ok = await request(app).patch(`/admin/applications/${appB}/roles/${roleB}`).send({ name: 'Writer' })
    expect(ok.status).toBe(200)
    expect(ok.body.name).toBe('Writer')
  })

  it("does not delete another application's role", async () => {
    const res = await request(app).delete(`/admin/applications/${appA}/roles/${roleB}`)
    expect(res.status).toBe(404)
    expect(await prisma.role.findUnique({ where: { id: roleB } })).not.toBeNull()

    expect((await request(app).delete(`/admin/applications/${appB}/roles/${roleB}`)).status).toBe(204)
    expect(await prisma.role.findUnique({ where: { id: roleB } })).toBeNull()
  })
})

// Found in review alongside B-11: the assignment PUT stored any roleId under :appId, so App A's
// assignment could point at App B's role — and the access API then reported App B's role to App A.
describe('assignments only accept a role of the application in the URL', () => {
  const sub = 'test-int-scope-user'
  let userId: string
  let roleA: string
  let roleB: string

  beforeEach(async () => {
    userId = (await request(app).post('/admin/users').send({ name: 'Scope User', sub, provider: 'google' })).body.id
    roleA = (await request(app).post(`/admin/applications/${appA}/roles`).send({ name: 'Viewer', customId: 'viewer' })).body.id
    roleB = (await request(app).post(`/admin/applications/${appB}/roles`).send({ name: 'Owner', customId: 'owner' })).body.id
  })

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { sub } })
  })

  it("rejects another application's role", async () => {
    const res = await request(app).put(`/admin/users/${userId}/roles/${appA}`).send({ roleId: roleB })
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: 'role_not_in_application' })
    expect(await prisma.userRole.findFirst({ where: { userId } })).toBeNull()

    const ok = await request(app).put(`/admin/users/${userId}/roles/${appA}`).send({ roleId: roleA })
    expect(ok.status).toBe(200)
    expect(ok.body.roleId).toBe(roleA)
  })
})
