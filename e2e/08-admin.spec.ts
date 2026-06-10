import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('IT Admin', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'it_admin')
  })

  test('Dashboard loads (KPIs or table visible)', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)
    assertNoErrors(errors, 'admin/dashboard')
    const content = page.locator('table, [role="grid"], .sui-kpi-v2, .sui-glass-panel, [class*="kpi"]').first()
    await expect(content).toBeVisible({ timeout: 5000 })
  })

  test('Activation control or status indicator visible', async ({ page }) => {
    await page.goto('/admin/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    const activateBtn = page.locator('button:has-text("Activate")')
    const statusBadge = page.locator('text=/activated|inactive|active|pending/i')
    const eitherVisible = await activateBtn.first().isVisible().catch(() => false)
      || await statusBadge.first().isVisible().catch(() => false)
    expect(eitherVisible, 'No activation controls on admin dashboard').toBe(true)
  })

  test('Users page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'admin/users')
  })

  test('School profile page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/school')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'admin/school')
    await expect(page.locator('input').first()).toBeVisible()
  })

  test('API settings page loads with AT/SMS section', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/api')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'admin/api')
    const atSection = page.locator("text=/africa.s talking|sms|api/i").first()
    await expect(atSection).toBeVisible()
  })

  test('System settings page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'admin/settings')
  })

  test('Templates page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/admin/templates')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'admin/templates')
  })
})
