import { test, expect } from '@playwright/test'

/**
 * User management E2E tests.
 * Uses the admin session from global.setup.ts.
 */

test.use({ storageState: '.auth/admin.json' })

test.describe('Users', () => {
  test('lists users and shows at least the seeded admin', async ({ page }) => {
    await page.goto('/users')
    await expect(page.getByRole('link', { name: 'E2E Admin' })).toBeVisible()
  })

  test('opens user detail page and shows Role Assignments section', async ({ page }) => {
    await page.goto('/users')
    await page.getByRole('link', { name: 'E2E Admin' }).click()
    await expect(page).toHaveURL(/\/users\/.+/)
    await expect(page.getByText('Role Assignments')).toBeVisible()
  })
})
