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
import { makeTestApp, testAdmin } from './testApp'

const app = makeTestApp()
const PREFIX = `int-invite-${randomBytes(4).toString('hex')}`

let app1Id: string
let editorRoleId: string
let app2Id: string
let rawApiKey: string
let apiKeyId: string
let adminInviteId: string | null = null
// A key against the *real* Bouncer application, so it is not covered by the PREFIX cascade.
let bouncerKeyId: string | null = null

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
  apiKeyId = (await prisma.apiKey.create({
    data: { applicationId: app1Id, keyHash: hash(rawApiKey), label: 'invite' },
  })).id

  // The admin POST route writes Invitation.createdById = req.user.id. Ensure a real user row
  // exists for the synthetic test admin so the FK resolves.
  await prisma.user.upsert({
    where: { id: testAdmin.id! },
    update: {},
    create: {
      id: testAdmin.id!,
      name: testAdmin.name!,
      email: testAdmin.email!,
      sub: testAdmin.sub!,
      provider: testAdmin.provider!,
      isGlobalAdmin: true,
    },
  })
})

afterAll(async () => {
  if (bouncerKeyId) await prisma.apiKey.deleteMany({ where: { id: bouncerKeyId } })
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
    expect(res.body.inviteUrl).toMatch(/\/invite#[0-9a-f]{64}$/)
    expect(res.body.expiresAt).toBeTruthy()

    const created = await prisma.invitation.findMany({ where: { applicationId: app1Id } })
    expect(created).toHaveLength(1)
    expect(created[0].roleId).toBe(editorRoleId)
    expect(created[0].redirectUri).toBe('https://app.example.com/welcome')
    expect(created[0].createdById).toBeNull()
    expect(created[0].createdByApiKeyId).toBe(apiKeyId)
    expect(created[0].createdByApiKeyLabel).toBe('invite')
  })

  // The attribution is a snapshot, not a foreign key: revoking (hard-deleting) the key that minted
  // an invitation must not erase who minted it.
  it('keeps the key attribution after that key is deleted', async () => {
    const raw = `bncr_${randomBytes(32).toString('hex')}`
    const key = await prisma.apiKey.create({
      data: { applicationId: app1Id, keyHash: hash(raw), label: 'short-lived' },
    })
    const res = await request(app)
      .post('/api/v1/invitations')
      .set('Authorization', `Bearer ${raw}`)
      .send({ role: 'editor' })
    expect(res.status).toBe(201)

    await prisma.apiKey.delete({ where: { id: key.id } })

    const minted = await prisma.invitation.findFirst({ where: { createdByApiKeyId: key.id } })
    expect(minted).not.toBeNull()
    expect(minted!.createdByApiKeyLabel).toBe('short-lived')
  })

  // B-03. The admin portal is itself an Application holding the `admin` role that grants a portal
  // session, so a key issued for it used to mint a genuine global-admin invitation here (verified
  // during the audit: 201, invitation targeting bouncer/admin). The portal is not an API consumer —
  // its keys must be rejected across /api/v1 entirely.
  describe('a key belonging to the Bouncer application itself', () => {
    let bouncerRawKey: string

    beforeAll(async () => {
      const { app: bouncerApp } = await ensureBouncerDefaults()
      bouncerRawKey = `bncr_${randomBytes(32).toString('hex')}`
      const row = await prisma.apiKey.create({
        data: { applicationId: bouncerApp.id, keyHash: hash(bouncerRawKey), label: 'int-b03' },
      })
      bouncerKeyId = row.id
    })

    it('cannot mint a global-admin invitation', async () => {
      const { app: bouncerApp } = await ensureBouncerDefaults()
      const before = await prisma.invitation.count({ where: { applicationId: bouncerApp.id } })

      const res = await request(app)
        .post('/api/v1/invitations')
        .set('Authorization', `Bearer ${bouncerRawKey}`)
        .send({ role: 'admin' })

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('api_key_not_permitted')

      const after = await prisma.invitation.count({ where: { applicationId: bouncerApp.id } })
      expect(after).toBe(before)
    })

    it('cannot probe admin membership via /api/v1/access', async () => {
      const res = await request(app)
        .get('/api/v1/access')
        .query({ sub: 'anything', provider: 'google' })
        .set('Authorization', `Bearer ${bouncerRawKey}`)

      expect(res.status).toBe(403)
      expect(res.body.error).toBe('api_key_not_permitted')
    })
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

// B-05. The bootstrap is a one-time latch now, so the global admin's portal role must not be lost
// any other way either. Any admin can add a second role to the Bouncer app and invite the global
// admin to it; accepting must not overwrite their admin role (that would lock the portal out).
describe('the global admin accepting a Bouncer invite for another role', () => {
  it('consumes the invite but keeps their portal admin role', async () => {
    const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults()
    const owner = await prisma.user.create({
      data: { name: 'Owner', sub: `${PREFIX}-owner`, provider: 'google', isGlobalAdmin: true },
    })
    await prisma.userRole.create({
      data: { userId: owner.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true },
    })
    const viewer = await prisma.role.create({
      data: { name: 'Viewer', customId: `${PREFIX}-viewer`, applicationId: bouncerApp.id },
    })
    try {
      const { raw, id } = await createInviteRow({ applicationId: bouncerApp.id, roleId: viewer.id })

      const result = await findOrCreateUser(
        { sub: `${PREFIX}-owner`, provider: 'google', name: 'Owner', email: 'owner@test.com' }, raw,
      )

      expect(result!.outcome.kind).toBe('admin')
      const portalRole = await prisma.userRole.findUnique({
        where: { userId_applicationId: { userId: owner.id, applicationId: bouncerApp.id } },
      })
      expect(portalRole!.roleId).toBe(adminRole.id)
      expect((await prisma.invitation.findUnique({ where: { id } }))!.usedAt).not.toBeNull()
    } finally {
      await prisma.role.delete({ where: { id: viewer.id } }) // cascades its invitation
    }
  })
})

describe('POST /admin/invitations (admin UI cross-app mint)', () => {
  it('creates an invitation for a non-Bouncer app + role (201) with creator + includes', async () => {
    const res = await request(app)
      .post('/admin/invitations')
      .send({ applicationId: app1Id, roleId: editorRoleId, redirectUri: 'https://app.example.com/welcome' })

    expect(res.status).toBe(201)
    expect(res.body.inviteUrl).toMatch(/\/invite#[0-9a-f]{64}$/)
    expect(res.body.applicationId).toBe(app1Id)
    expect(res.body.roleId).toBe(editorRoleId)
    expect(res.body.application?.customId).toBe(`${PREFIX}-app1`)
    expect(res.body.role?.customId).toBe('editor')
  })

  it('rejects a role that does not belong to the supplied application (400)', async () => {
    // editorRoleId belongs to app1; pair it with app2 to force the mismatch.
    const res = await request(app)
      .post('/admin/invitations')
      .send({ applicationId: app2Id, roleId: editorRoleId })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('role_not_in_application')
  })

  it('rejects a redirectUri whose origin is not in the app allowlist (400)', async () => {
    const res = await request(app)
      .post('/admin/invitations')
      .send({ applicationId: app1Id, roleId: editorRoleId, redirectUri: 'https://evil.example.com/x' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('redirect_uri_not_allowed')
  })
})

describe('GET /admin/invitations (cross-app listing)', () => {
  it('returns invitations across all applications with application + role includes', async () => {
    const res = await request(app).get('/admin/invitations')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const ours = res.body.filter((inv: { applicationId: string }) =>
      [app1Id, app2Id].includes(inv.applicationId)
    )
    expect(ours.length).toBeGreaterThan(0)
    for (const inv of ours) {
      expect(inv).toHaveProperty('application.id')
      expect(inv).toHaveProperty('application.customId')
      expect(inv).toHaveProperty('role.id')
      expect(inv).toHaveProperty('role.customId')
    }
  })
})
