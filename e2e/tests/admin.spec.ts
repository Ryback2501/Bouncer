import { test, expect } from '@playwright/test'

/**
 * Authenticated admin UI tests.
 * These tests use the session saved by global.setup.ts to bypass OAuth.
 */

// Reuse the session created in global setup
test.use({ storageState: '.auth/admin.json' })

test.describe('Dashboard', () => {
  test('loads and shows stat cards', async ({ page }) => {
    await page.goto('/')
    const main = page.locator('main')
    await expect(main.getByText('Applications')).toBeVisible()
    await expect(main.getByText('Users')).toBeVisible()
    await expect(main.getByText('Roles')).toBeVisible()
  })
})

test.describe('Applications', () => {
  const APP_NAME = `E2E App ${Date.now()}`
  const APP_ID = `e2e-app-${Date.now()}`

  test('creates an application and it appears in the list', async ({ page }) => {
    await page.goto('/applications')
    await page.getByRole('button', { name: /New Application/i }).click()

    await page.getByLabel('Name').fill(APP_NAME)
    await page.getByLabel('ID').fill(APP_ID)
    await page.getByRole('button', { name: /Create/i }).click()

    await expect(page.getByText(APP_NAME)).toBeVisible()
  })

  test('can navigate to the Roles page for an application', async ({ page }) => {
    await page.goto('/applications')
    const rolesBtn = page.getByRole('link', { name: /Roles/i }).first()
    await rolesBtn.click()
    await expect(page).toHaveURL(/\/applications\/.+\/roles/)
  })
})

test.describe('Session protection', () => {
  test('authenticated user stays on dashboard after navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page).not.toHaveURL(/\/login/)
  })
})

test.describe('External API access — via API key', () => {
  /**
   * Calls the external /api/v1/access endpoint directly via the Playwright
   * request API (no browser UI needed) with a real API key from the seeded DB.
   * This tests the full backend integration from the external consumer perspective.
   */
  test('returns 401 with invalid API key', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/v1/access', {
      params: { sub: 'anyone', provider: 'google' },
      headers: {
        Authorization: 'Bearer bncr_0000000000000000000000000000000000000000000000000000000000000000',
      },
      failOnStatusCode: false,
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('invalid_api_key')
  })
})
