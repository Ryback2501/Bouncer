/**
 * Playwright global setup — seeds the database with a test admin user and mints an
 * authenticated session for it. The session state is saved to .auth/admin.json for use
 * in tests.
 *
 * The session is created by writing directly to the session store rather than by asking
 * the server for one: the backend deliberately exposes no test-only login route, so OAuth
 * is the only server-side path to a portal session in every environment.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

// Single origin since the backend serves both API and SPA. Must match the baseURL in
// playwright.config.ts.
const APP_URL = 'http://localhost:3000'
const AUTH_DIR = '.auth'
const AUTH_FILE = `${AUTH_DIR}/admin.json`

// Matches the backend's express-session cookie maxAge.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

// express-session signs `connect.sid` with cookie-signature: `s:<sid>.<base64 hmac>` with
// base64 padding stripped. Reproduced here so the cookie we hand Playwright is one the
// backend accepts.
function signedCookieValue(sid: string, secret: string): string {
  const mac = createHmac('sha256', secret).update(sid).digest('base64').replace(/=+$/, '')
  return `s:${sid}.${mac}`
}

async function globalSetup() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  try {
    // Ensure the .auth directory exists
    if (!existsSync(AUTH_DIR)) await mkdir(AUTH_DIR, { recursive: true })

    // Seed: create or upsert a test admin user
    const user = await prisma.user.upsert({
      where: { sub_provider: { sub: 'e2e-admin', provider: 'google' } },
      update: { isGlobalAdmin: true },
      create: {
        name: 'E2E Admin',
        email: 'e2e@test.com',
        sub: 'e2e-admin',
        provider: 'google',
        isGlobalAdmin: true,
      },
    })

    // Ensure the bouncer app + admin role exist (mirrors ensureBouncerDefaults in the backend)
    const bouncerApp = await prisma.application.upsert({
      where: { customId: 'bouncer' },
      update: {},
      create: { name: 'Bouncer', customId: 'bouncer' },
    })
    const adminRole = await prisma.role.upsert({
      where: { applicationId_customId: { applicationId: bouncerApp.id, customId: 'admin' } },
      update: {},
      create: { name: 'Admin', customId: 'admin', applicationId: bouncerApp.id },
    })

    // Assign the bouncer admin role to the e2e user (required by deserializeUser)
    await prisma.userRole.upsert({
      where: { userId_applicationId: { userId: user.id, applicationId: bouncerApp.id } },
      update: { active: true, expiredAt: null, roleId: adminRole.id },
      create: { userId: user.id, applicationId: bouncerApp.id, roleId: adminRole.id, active: true, expiredAt: null },
    })

    // Must be the same secret the backend process is running with, or it will reject the
    // cookie's signature.
    const secret = process.env.SESSION_SECRET
    if (!secret) {
      throw new Error('SESSION_SECRET is required: it must match the running backend.')
    }

    // Mint a session the way express-session + passport store one. passport.serializeUser
    // writes the user id to session.passport.user; deserializeUser re-checks the Bouncer
    // admin role on every request, so the seeded assignment above is what keeps it valid.
    const sid = randomUUID()
    const expires = new Date(Date.now() + SESSION_TTL_MS)
    const sess = {
      cookie: {
        originalMaxAge: SESSION_TTL_MS,
        expires: expires.toISOString(),
        secure: false,
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
      },
      passport: { user: user.id },
    }

    const cookieValue = encodeURIComponent(signedCookieValue(sid, secret))

    // The `session` table belongs to connect-pg-simple, not to a Prisma migration, and it is
    // created lazily on the store's first read/write — which on a virgin database has not
    // happened yet (saveUninitialized is false, so booting and serving /health never touch the
    // store). Make one request carrying a validly signed cookie: express-session unsigns it,
    // calls store.get(), and connect-pg-simple creates the table before the response returns.
    //
    // Deliberately letting it own its own DDL rather than issuing CREATE TABLE here: its
    // table.sql has a bare `CREATE TABLE` guarded only by a prior to_regclass check, so a
    // concurrent create of ours could make it throw — and it caches that rejected promise for
    // the life of the process, which would break every later session operation.
    // 401 is the expected answer; we only care about the side effect.
    await fetch(`${APP_URL}/admin/me`, { headers: { cookie: `connect.sid=${cookieValue}` } }).catch(
      (err: Error) => {
        throw new Error(
          `Backend unreachable at ${APP_URL} (${err.message}). It must be running before e2e starts.`
        )
      }
    )

    try {
      await prisma.$executeRaw`
        INSERT INTO "session" ("sid", "sess", "expire")
        VALUES (${sid}, ${JSON.stringify(sess)}::json, ${expires})
        ON CONFLICT ("sid") DO UPDATE SET "sess" = EXCLUDED."sess", "expire" = EXCLUDED."expire"`
    } catch (err) {
      throw new Error(
        `Could not write the e2e session row (${(err as Error).message}). The backend must be ` +
          `running against this same database — it owns the session table.`
      )
    }

    // Fail fast and legibly if the stored session shape ever stops matching what
    // express-session/passport expect, instead of letting every authenticated spec bounce
    // to /login with no explanation.
    const check = await fetch(`${APP_URL}/admin/me`, {
      headers: { cookie: `connect.sid=${cookieValue}` },
    })
    if (!check.ok) {
      throw new Error(
        `Seeded session was rejected by the backend (${check.status}). Either SESSION_SECRET ` +
          `does not match the running backend, or the express-session/passport session format ` +
          `has changed and this setup needs updating.`
      )
    }

    // Playwright storageState — written directly; no browser needed to produce it.
    const storageState = {
      cookies: [
        {
          name: 'connect.sid',
          value: cookieValue,
          domain: 'localhost',
          path: '/',
          expires: Math.floor(expires.getTime() / 1000),
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        },
      ],
      origins: [],
    }
    await writeFile(AUTH_FILE, JSON.stringify(storageState, null, 2))

    console.log('E2E global setup: admin session saved to', AUTH_FILE)
  } finally {
    await prisma.$disconnect()
  }
}

export default globalSetup
