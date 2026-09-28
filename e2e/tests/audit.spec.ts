import { test, expect } from '@playwright/test'

/**
 * Audit log E2E test (B-16): an admin change shows up on the Audit log page.
 * Uses the admin session from global.setup.ts.
 */

test.use({ storageState: '.auth/admin.json' })

test.describe('Audit log', () => {
  test('an application created by the admin is listed as application.create', async ({ page }) => {
    const APP_NAME = `E2E Audit App ${Date.now()}`

    // Create it through the API with the admin session (admin writes need the CSRF token).
    const { csrfToken } = await (await page.request.get('/auth/csrf-token')).json()
    const created = await page.request.post('/admin/applications', {
      headers: { 'x-csrf-token': csrfToken },
      data: { name: APP_NAME, customId: `e2e-audit-${Date.now()}` },
    })
    expect(created.status()).toBe(201)

    await page.goto('/audit')
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()

    // Narrow to application events. The select can render before React hydrates and a change
    // made then is dropped, so retry until the filtered list shows the new application.
    await expect(async () => {
      await page.getByLabel('Category').selectOption('application.')
      await expect(page.getByText(APP_NAME)).toBeVisible({ timeout: 1_000 })
    }).toPass({ timeout: 15_000 })

    const row = page.getByRole('row').filter({ hasText: APP_NAME })
    await expect(row.getByText('application.create')).toBeVisible()
    await expect(row.getByText('Success')).toBeVisible()
  })
})
