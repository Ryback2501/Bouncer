import { test, expect } from '@playwright/test'

/**
 * Public-facing page tests — no session required.
 * These verify the login page and invite accept page behave correctly
 * without needing OAuth credentials.
 */

test.describe('Login page', () => {
  test('renders the Bouncer heading and three OAuth buttons', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Bouncer')).toBeVisible()
    await expect(page.getByRole('link', { name: /Google/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Microsoft/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Apple/ })).toBeVisible()
  })

  test('shows error message when ?error=auth_failed is in the URL', async ({ page }) => {
    await page.goto('/login?error=auth_failed')
    await expect(page.getByText(/authentication failed/i)).toBeVisible()
  })

  test('redirects unauthenticated users to /login when accessing /users', async ({ page }) => {
    await page.goto('/users')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Invite accept page', () => {
  test('shows invalid/expired message for a non-existent invite token', async ({ page }) => {
    await page.goto('/invite/0000000000000000000000000000000000000000000000000000000000000000')
    await expect(page.getByText(/invalid|expired/i)).toBeVisible()
  })
})
