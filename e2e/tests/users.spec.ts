import { test, expect } from '@playwright/test'
import * as path from 'path'

/**
 * User management E2E tests.
 * Uses the admin session from global.setup.ts.
 */

test.use({ storageState: path.join(__dirname, '../.auth/admin.json') })

test.describe('Users', () => {
  test('lists users and shows at least the seeded admin', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL('/users')
    // The E2E admin seeded in global.setup.ts should appear
    await expect(page.getByText('E2E Admin')).toBeVisible()
  })

  test('opens user detail page and shows Role Assignments section', async ({ page }) => {
    await page.goto('/users')
    // Click the first user row to open their detail page
    await page.getByText('E2E Admin').click()
    await expect(page).toHaveURL(/\/users\/.+/)
    await expect(page.getByText('Role Assignments')).toBeVisible()
  })
})
