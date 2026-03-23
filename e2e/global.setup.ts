/**
 * Playwright global setup — seeds the database with a test admin user
 * and obtains an authenticated session by calling the test-login endpoint.
 * The session state is saved to .auth/admin.json for use in tests.
 */
import { chromium } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { mkdir } from 'fs/promises'
import { existsSync } from 'fs'

const BACKEND_URL = 'http://localhost:3000'
const AUTH_DIR = '.auth'
const AUTH_FILE = `${AUTH_DIR}/admin.json`

async function globalSetup() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
  })

  try {
    // Ensure the .auth directory exists
    if (!existsSync(AUTH_DIR)) await mkdir(AUTH_DIR, { recursive: true })

    // Seed: create or upsert a test admin user
    await prisma.user.upsert({
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

    // Obtain an authenticated session via the test-login endpoint
    const browser = await chromium.launch()
    const context = await browser.newContext({ baseURL: BACKEND_URL })
    const page = await context.newPage()

    // POST to the test-only login endpoint (only available when NODE_ENV=test)
    const res = await page.request.post(`${BACKEND_URL}/auth/test-login`)
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
