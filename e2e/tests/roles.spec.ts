import { test, expect } from '@playwright/test'

/**
 * Role management E2E tests.
 * Uses the admin session from global.setup.ts.
 */

test.use({ storageState: '.auth/admin.json' })

test.describe('Roles', () => {
  test('creates a role and it appears in the list', async ({ page }) => {
    const ROLE_NAME = `E2E Role ${Date.now()}`
    const ROLE_ID = `e2e-role-${Date.now()}`

    // Navigate to Applications and open the Roles page for the first app
    await page.goto('/applications')
    await page.getByRole('link', { name: /Roles/i }).first().click()
    await expect(page).toHaveURL(/\/applications\/.+\/roles/)

    // Open the New Role form. RoleList renders the "New Role" button in both the
    // header AND the empty-state action when the app has no roles yet — `.first()`
    // disambiguates without coupling to which one renders.
    await page.getByRole('button', { name: /New Role/i }).first().click()

    // Fill in the form
    await page.getByLabel('Name').fill(ROLE_NAME)
    await page.getByLabel('ID').fill(ROLE_ID)
    await page.getByRole('button', { name: /Create/i }).click()

    // Verify the role appears in the list
    await expect(page.getByText(ROLE_NAME)).toBeVisible()
  })
})
