/**
 * Integration tests for app-scoped invitations:
 *  - POST /api/v1/invitations (mint) via the real API-key-authed route + real DB.
 *  - Acceptance via findOrCreateUser (the OAuth verify step), against the real DB.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../../prisma'
import { findOrCreateUser } from '../../passport'
import { ensureBouncerDefaults } from '../../lib/bouncerDefaults'
import { makeTestApp } from './testApp'

const app = makeTestApp()
const PREFIX = `int-invite-${randomBytes(4).toString('hex')}`

let app1Id: string
let editorRoleId: string
let app2Id: string
let rawApiKey: string
let adminInviteId: string | null = null

const hash = (raw: string) => createHash('sha256').update(raw).digest('hex')

async function createInviteRow(opts: {
  applicationId: string; roleId: string; redirectUri?: string | null; expiresAt?: Date
}) {
  const raw = randomBytes(16).toString('hex')
  const row = await prisma.invitation.create({
    data: {
      token: hash(raw),
      applicationId: opts.applicationId,
      roleId: opts.roleId,
      redirectUri: opts.redirectUri ?? null,
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 60_000),
    },
  })
  return { raw, id: row.id }
}

beforeAll(async () => {
  const a1 = await prisma.application.create({
    data: { name: 'Invite App 1', customId: `${PREFIX}-app1`, redirectUris: ['https://app.example.com'] },
  })
  app1Id = a1.id
  editorRoleId = (await prisma.role.create({
    data: { name: 'Editor', customId: 'editor', applicationId: app1Id },
  })).id

  const a2 = await prisma.application.create({
    data: { name: 'Invite App 2', customId: `${PREFIX}-app2` },
  })
  app2Id = a2.id
  await prisma.role.create({ data: { name: 'Viewer', customId: 'viewer', applicationId: app2Id } })

  rawApiKey = `bncr_${randomBytes(32).toString('hex')}`
  await prisma.apiKey.create({ data: { applicationId: app1Id, keyHash: hash(rawApiKey), label: 'invite' } })
})

afterAll(async () => {
  if (adminInviteId) await prisma.invitation.deleteMany({ where: { id: adminInviteId } })
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
  // App deletion cascades roles, apiKeys, userRoles, and invitations for these apps.
  await prisma.application.deleteMany({ where: { customId: { startsWith: PREFIX } } })
})

describe('POST /api/v1/invitations (mint)', () => {
  it('creates an invitation scoped to the API key app + requested role', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${rawApiKey}`)
      .send({ role: 'editor', redirectUri: 'https://app.example.com/welcome' })

    expect(res.status).toBe(201)
    expect(res.body.inviteUrl).toMatch(/\/invite\/[0-9a-f]{64}$/)
    expect(res.body.expiresAt).toBeTruthy()

    const created = await prisma.invitation.findMany({ where: { applicationId: app1Id } })
    expect(created).toHaveLength(1)
    expect(created[0].roleId).toBe(editorRoleId)
    expect(created[0].redirectUri).toBe('https://app.example.com/welcome')
    expect(created[0].createdById).toBeNull()
  })

  it('rejects a redirectUri whose origin is not in the app allowlist (400)', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${rawApiKey}`)
      .send({ role: 'editor', redirectUri: 'https://evil.example.com/x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('redirect_uri_not_allowed')
  })

  it('rejects a role that belongs to a different application (404)', async () => {
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${rawApiKey}`)
      .send({ role: 'viewer' }) // 'viewer' exists only in app2
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('role_not_found')
  })

  it('rejects a missing API key (401)', async () => {
    const res = await request(app).post('/api/v1/invitations').send({ role: 'editor' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('invalid_api_key')
  })
})

describe('invitation acceptance (findOrCreateUser)', () => {
  it('accepts an app invite: creates the user, assigns the role, consumes the invite', async () => {
    const { raw, id } = await createInviteRow({
      applicationId: app1Id, roleId: editorRoleId, redirectUri: 'https://app.example.com/welcome',
    })

    const result = await findOrCreateUser(
      { sub: `${PREFIX}-alice`, provider: 'google', name: 'Alice', email: 'alice@test.com' },
      raw,
    )

    expect(result).not.toBeNull()
    expect(result!.outcome.kind).toBe('app')
    expect(result!.outcome.redirectUri).toBe('https://app.example.com/welcome')
    expect(result!.outcome.appCustomId).toBe(`${PREFIX}-app1`)

    const user = await prisma.user.findUnique({ where: { sub_provider: { sub: `${PREFIX}-alice`, provider: 'google' } } })
    expect(user).not.toBeNull()
    expect(user!.isGlobalAdmin).toBe(false)

    const userRole = await prisma.userRole.findUnique({
      where: { userId_applicationId: { userId: user!.id, applicationId: app1Id } },
    })
    expect(userRole!.roleId).toBe(editorRoleId)

    const used = await prisma.invitation.findUnique({ where: { id } })
    expect(used!.usedAt).not.toBeNull()
  })

  it('rejects a second use of the same invite', async () => {
    const { raw } = await createInviteRow({ applicationId: app1Id, roleId: editorRoleId })
    const first = await findOrCreateUser(
      { sub: `${PREFIX}-bob`, provider: 'google', name: 'Bob', email: 'bob@test.com' }, raw,
    )
    expect(first).not.toBeNull()
    const second = await findOrCreateUser(
      { sub: `${PREFIX}-bob`, provider: 'google', name: 'Bob', email: 'bob@test.com' }, raw,
    )
    expect(second).toBeNull()
  })

  it('rejects an expired invite', async () => {
    const { raw } = await createInviteRow({
      applicationId: app1Id, roleId: editorRoleId, expiresAt: new Date(Date.now() - 1000),
    })
    const result = await findOrCreateUser(
      { sub: `${PREFIX}-carol`, provider: 'google', name: 'Carol', email: 'carol@test.com' }, raw,
    )
    expect(result).toBeNull()
  })

  it('adds a role to an existing user invited to a different app', async () => {
    const viewerRole = await prisma.role.findUnique({
      where: { applicationId_customId: { applicationId: app2Id, customId: 'viewer' } },
    })
    const { raw } = await createInviteRow({ applicationId: app2Id, roleId: viewerRole!.id })

    // Alice already exists (accepted app1's invite in the first test).
    const result = await findOrCreateUser(
      { sub: `${PREFIX}-alice`, provider: 'google', name: 'Alice', email: 'alice@test.com' }, raw,
    )
    expect(result!.outcome.kind).toBe('app')

    const user = await prisma.user.findUnique({ where: { sub_provider: { sub: `${PREFIX}-alice`, provider: 'google' } } })
    const roles = await prisma.userRole.findMany({ where: { userId: user!.id } })
    expect(roles.map(r => r.applicationId).sort()).toEqual([app1Id, app2Id].sort())
  })

  it('treats a Bouncer admin invite as an admin outcome (keeps portal session)', async () => {
    const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults()
    const { raw, id } = await createInviteRow({ applicationId: bouncerApp.id, roleId: adminRole.id })
    adminInviteId = id

    const result = await findOrCreateUser(
      { sub: `${PREFIX}-dave`, provider: 'google', name: 'Dave', email: 'dave@test.com' }, raw,
    )
    expect(result!.outcome.kind).toBe('admin')
  })
})
