/**
 * INFO-01. Through the real app — real session store, real passport, real signed session cookies —
 * only an active portal admin gets into /admin. A user who merely holds a role in some other
 * application is refused, and so is an admin whose portal role expired or was deactivated
 * mid-session. Real PostgreSQL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import type { Express } from 'express'
import { prisma } from '../../prisma'
import { createApp } from '../../app'
import { configurePassport } from '../../passport'
import { ensureBouncerDefaults, hasActivePortalAdminRole } from '../../lib/bouncerDefaults'

const PREFIX = `int-guard-${randomBytes(4).toString('hex')}`
const HOUR = 60 * 60 * 1000

let app: Express
let bouncerAppId: string
let adminRoleId: string
let otherAppId: string
let otherRoleId: string

// The cookie express-session expects: "s:" + sid + "." + base64 HMAC-SHA256(sid) (cf. e2e/global.setup.ts).
function cookieFor(sid: string) {
  const mac = createHmac('sha256', process.env.SESSION_SECRET!).update(sid).digest('base64').replace(/=+$/, '')
  return `connect.sid=${encodeURIComponent(`s:${sid}.${mac}`)}`
}

// A signed-in session for `userId`, stored the way express-session + passport store one.
async function signIn(userId: string) {
  const sid = randomUUID()
  const expire = new Date(Date.now() + HOUR)
  const sess = {
    cookie: { originalMaxAge: HOUR, expires: expire.toISOString(), secure: false, httpOnly: true, path: '/', sameSite: 'lax' },
    passport: { user: userId },
  }
  await prisma.$executeRawUnsafe(
    'INSERT INTO "session" ("sid", "sess", "expire") VALUES ($1, $2::json, $3)',
    sid, JSON.stringify(sess), expire
  )
  return cookieFor(sid)
}

async function makeUser(name: string, roles: { applicationId: string; roleId: string; active?: boolean; expiredAt?: Date | null }[]) {
  const user = await prisma.user.create({ data: { name, sub: `${PREFIX}-${name}`, provider: 'google' } })
  for (const r of roles) {
    await prisma.userRole.create({ data: { userId: user.id, active: true, expiredAt: null, ...r } })
  }
  return user
}

beforeAll(async () => {
  await configurePassport()
  app = createApp()
  // connect-pg-simple creates its `session` table lazily on the first store access.
  await request(app).get('/admin/users').set('Cookie', cookieFor(randomUUID()))

  const { app: bouncerApp, role: adminRole } = await ensureBouncerDefaults()
  bouncerAppId = bouncerApp.id
  adminRoleId = adminRole.id
  const other = await prisma.application.create({ data: { name: 'Shop', customId: `${PREFIX}-shop` } })
  otherAppId = other.id
  otherRoleId = (await prisma.role.create({ data: { name: 'Editor', customId: 'editor', applicationId: otherAppId } })).id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { sub: { startsWith: PREFIX } } })
  await prisma.application.deleteMany({ where: { customId: { startsWith: PREFIX } } })
})

describe('the /admin guard, end to end', () => {
  it('lets an active portal admin in', async () => {
    const admin = await makeUser('admin', [{ applicationId: bouncerAppId, roleId: adminRoleId }])
    const res = await request(app).get('/admin/users').set('Cookie', await signIn(admin.id))
    expect(res.status).toBe(200)
  })

  it('refuses a signed-in user who only holds a role in another application', async () => {
    const outsider = await makeUser('outsider', [{ applicationId: otherAppId, roleId: otherRoleId }])
    const res = await request(app).get('/admin/users').set('Cookie', await signIn(outsider.id))
    expect(res.status).toBe(401)
    expect(res.body).toEqual({ error: 'unauthorized' })
  })

  it('refuses an admin whose portal role has expired', async () => {
    const expired = await makeUser('expired', [{ applicationId: bouncerAppId, roleId: adminRoleId, expiredAt: new Date(Date.now() - 1000) }])
    const res = await request(app).get('/admin/users').set('Cookie', await signIn(expired.id))
    expect(res.status).toBe(401)
  })

  it('ends a live admin session on the next request once the role is deactivated', async () => {
    const admin = await makeUser('demoted', [{ applicationId: bouncerAppId, roleId: adminRoleId }])
    const cookie = await signIn(admin.id)
    expect((await request(app).get('/admin/users').set('Cookie', cookie)).status).toBe(200)
    await prisma.userRole.updateMany({ where: { userId: admin.id }, data: { active: false } })
    expect((await request(app).get('/admin/users').set('Cookie', cookie)).status).toBe(401)
  })
})

describe('hasActivePortalAdminRole', () => {
  it('is true only for an active, unexpired Bouncer admin role', async () => {
    const future = new Date(Date.now() + HOUR)
    const past = new Date(Date.now() - HOUR)
    const cases: [string, Parameters<typeof makeUser>[1], boolean][] = [
      ['h-active', [{ applicationId: bouncerAppId, roleId: adminRoleId }], true],
      ['h-future', [{ applicationId: bouncerAppId, roleId: adminRoleId, expiredAt: future }], true],
      ['h-past', [{ applicationId: bouncerAppId, roleId: adminRoleId, expiredAt: past }], false],
      ['h-inactive', [{ applicationId: bouncerAppId, roleId: adminRoleId, active: false }], false],
      ['h-other', [{ applicationId: otherAppId, roleId: otherRoleId }], false],
      ['h-none', [], false],
    ]
    for (const [name, roles, expected] of cases) {
      const user = await makeUser(name, roles)
      expect(await hasActivePortalAdminRole(user.id), name).toBe(expected)
    }
  })
})
