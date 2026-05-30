import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Report Card End-to-End Workflow', () => {
  test('Secretary can open report cards page', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await loginAs(page, 'secretary')
    await page.goto('/secretary/report-cards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'report-cards/secretary')
  })

  test('Principal sees report cards page with status sections', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await loginAs(page, 'principal')
    await page.goto('/principal/report-cards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'report-cards/principal')
    // Confirm the page rendered its shell (PageHeader title), regardless of
    // whether any cards exist in the demo DB.
    const pageTitle = page.locator('h1, h2, [class*="page-header"], [class*="PageHeader"]').filter({
      hasText: /Report Cards/i,
    }).first()
    await expect(pageTitle).toBeVisible({ timeout: 5000 })
  })

  test('Unlock requires a reason input (if any approved cards exist)', async ({ page }) => {
    await loginAs(page, 'principal')
    await page.goto('/principal/report-cards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const unlockBtn = page.locator('button:has-text("Unlock")').first()
    if (!await unlockBtn.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'No approved cards to unlock' })
      return
    }
    await unlockBtn.click()
    await page.waitForTimeout(800)
    const reasonInput = page.locator('input[placeholder*="reason" i], textarea[placeholder*="reason" i]').first()
    await expect(reasonInput).toBeVisible({ timeout: 3000 })
  })

  test('Teacher report preview has no Approve button', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/report-preview')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const approveBtn = page.locator('button:has-text("Approve")')
    expect(await approveBtn.first().isVisible().catch(() => false), 'Teacher should not see Approve').toBe(false)
  })
})
