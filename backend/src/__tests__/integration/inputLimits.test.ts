/**
 * B-13. Every string the API accepts has a maximum length. The audit got a 50 KB application name
 * stored (201); nothing but the 100 KB body limit bounded names, customIds, subs, labels, URLs or
 * the user search. Each field is checked at its limit (accepted) and one past it (400
 * validation_error, nothing stored). Real routers and PostgreSQL, so the API-key routes run with a
 * real key.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { randomBytes } from 'node:crypto'
import { prisma } from '../../prisma'
import { makeTestApp } from './testApp'

const app = makeTestApp()
const PREFIX = `int-limits-${randomBytes(4).toString('hex')}`

const str = (len: number, base = '') => base + 'x'.repeat(len - base.length)
const url = (len: number) => str(len, 'https://example.com/')

function expectRejected(res: request.Response) {
  expect(res.status).toBe(400)
  expect(res.body.error).toBe('validation_error')
}

let appId: string
let roleId: string
let apiKey: string

beforeAll(async () => {
  appId = (await request(app).post('/admin/applications').send({ name: 'Limits', customId: PREFIX })).body.id
  roleId = (await request(app).post(`/admin/applications/${appId}/roles`).send({ name: 'Editor', customId: 'editor' })).body.id
  apiKey = (await request(app).post(`/admin/applications/${appId}/api-keys`).send({ label: 'limits' })).body.rawKey
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
  await prisma.application.deleteMany({ where: { customId: { startsWith: PREFIX } } })
})

describe('applications', () => {
  it("rejects the audit's 50 KB name and stores nothing", async () => {
    const res = await request(app).post('/admin/applications').send({ name: 'x'.repeat(50_000), customId: `${PREFIX}-big` })
    expectRejected(res)
    expect(await prisma.application.findUnique({ where: { customId: `${PREFIX}-big` } })).toBeNull()
  })

  it('caps name at 200 and customId at 100', async () => {
    expectRejected(await request(app).post('/admin/applications').send({ name: str(201), customId: `${PREFIX}-n` }))
    expectRejected(await request(app).post('/admin/applications').send({ name: 'ok', customId: str(101, PREFIX) }))
    expect((await request(app).post('/admin/applications').send({ name: str(200), customId: str(100, PREFIX) })).status).toBe(201)
    expectRejected(await request(app).patch(`/admin/applications/${appId}`).send({ name: str(201) }))
  })

  it('caps each redirect URI at 2048 characters and the list at 50', async () => {
    expectRejected(await request(app).patch(`/admin/applications/${appId}`).send({ redirectUris: [url(2049)] }))
    expectRejected(await request(app).patch(`/admin/applications/${appId}`).send({
      redirectUris: Array.from({ length: 51 }, (_, i) => `https://example.com/${i}`),
    }))
    const ok = await request(app).patch(`/admin/applications/${appId}`).send({
      redirectUris: [url(2048), ...Array.from({ length: 49 }, (_, i) => `https://example.com/${i}`)],
    })
    expect(ok.status).toBe(200)
  })
})

describe('roles', () => {
  it('caps name at 200 and customId at 100', async () => {
    expectRejected(await request(app).post(`/admin/applications/${appId}/roles`).send({ name: str(201), customId: 'r1' }))
    expectRejected(await request(app).post(`/admin/applications/${appId}/roles`).send({ name: 'ok', customId: str(101) }))
    expect((await request(app).post(`/admin/applications/${appId}/roles`).send({ name: str(200), customId: str(100) })).status).toBe(201)
    expectRejected(await request(app).patch(`/admin/applications/${appId}/roles/${roleId}`).send({ name: str(201) }))
  })
})

describe('users', () => {
  it('caps name at 200, sub at 255 and provider at 50', async () => {
    expectRejected(await request(app).post('/admin/users').send({ name: str(201), sub: `${PREFIX}-a`, provider: 'google' }))
    expectRejected(await request(app).post('/admin/users').send({ name: 'ok', sub: str(256, PREFIX), provider: 'google' }))
    expectRejected(await request(app).post('/admin/users').send({ name: 'ok', sub: `${PREFIX}-b`, provider: str(51) }))
    const created = await request(app).post('/admin/users').send({ name: str(200), sub: str(255, PREFIX), provider: str(50) })
    expect(created.status).toBe(201)
    expectRejected(await request(app).patch(`/admin/users/${created.body.id}`).send({ name: str(201) }))
  })

  it('caps the assigned roleId at 64 characters', async () => {
    const user = await request(app).post('/admin/users').send({ name: 'Assignee', sub: `${PREFIX}-assignee`, provider: 'google' })
    expectRejected(await request(app).put(`/admin/users/${user.body.id}/roles/${appId}`).send({ roleId: str(65) }))
  })

  it('caps the search at 200 characters', async () => {
    expectRejected(await request(app).get('/admin/users').query({ search: str(201) }))
    expect((await request(app).get('/admin/users').query({ search: str(200) })).status).toBe(200)
  })
})

describe('api keys and invitations', () => {
  it('caps the key label at 100', async () => {
    expectRejected(await request(app).post(`/admin/applications/${appId}/api-keys`).send({ label: str(101) }))
    expect((await request(app).post(`/admin/applications/${appId}/api-keys`).send({ label: str(100) })).status).toBe(201)
  })

  it('caps the admin invitation redirect URI at 2048', async () => {
    expectRejected(await request(app).post('/admin/invitations').send({ applicationId: appId, roleId, redirectUri: url(2049) }))
  })
})

describe('external API', () => {
  const auth = () => ({ Authorization: `Bearer ${apiKey}` })

  it('caps the access check sub at 255 and provider at 50', async () => {
    expectRejected(await request(app).get('/api/v1/access').set(auth()).query({ sub: str(256), provider: 'google' }))
    expectRejected(await request(app).get('/api/v1/access').set(auth()).query({ sub: 'a', provider: str(51) }))
    // At the limits the query is valid and simply finds nobody.
    const res = await request(app).get('/api/v1/access').set(auth()).query({ sub: str(255), provider: str(50) })
    expect(res.status).toBe(404)
  })

  it('caps the invitation role at 100 and redirect URI at 2048', async () => {
    expectRejected(await request(app).post('/api/v1/invitations').set(auth()).send({ role: str(101) }))
    expectRejected(await request(app).post('/api/v1/invitations').set(auth()).send({ role: 'editor', redirectUri: url(2049) }))
    const res = await request(app).post('/api/v1/invitations').set(auth()).send({ role: str(100, 'no-such-role-') })
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('role_not_found')
  })
})
