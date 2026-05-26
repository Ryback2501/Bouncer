/**
 * Playwright global setup — seeds the database with a test admin user
 * and obtains an authenticated session by calling the test-login endpoint.
 * The session state is saved to .auth/admin.json for use in tests.
 */
import { chromium } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Single origin since the backend serves both API and SPA. Must match the baseURL in
// playwright.config.ts.
const APP_URL = 'http://localhost:3000'
const AUTH_DIR = '.auth'
const AUTH_FILE = `${AUTH_DIR}/admin.json`

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

    // Obtain an authenticated session via the test-login endpoint
    const browser = await chromium.launch()
    const context = await browser.newContext({ baseURL: APP_URL })
    const page = await context.newPage()

    // POST to the test-only login endpoint (only available when NODE_ENV=test)
    const res = await page.request.post(`${APP_URL}/auth/test-login`)
    if (!res.ok()) {
      throw new Error(`test-login failed: ${res.status()} ${await res.text()}`)
    }

    // Save auth state (cookies) so test files can reuse the session
    await context.storageState({ path: AUTH_FILE })
    await browser.close()

    console.log('E2E global setup: admin session saved to', AUTH_FILE)
  } finally {
    await prisma.$disconnect()
  }
}

export default globalSetup
