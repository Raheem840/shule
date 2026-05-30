import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Director of Studies', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'dos')
  })

  test('Dashboard loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)
    assertNoErrors(errors, 'dos/dashboard')
  })

  test('Subjects page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/subjects')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'dos/subjects')
  })

  test('Classes page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/classes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'dos/classes')
  })

  test('Teachers page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/teachers')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'dos/teachers')
  })

  test('All Journals page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/journals')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'dos/journals')
  })

  test('Curriculum page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/dos/curriculum')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'dos/curriculum')
  })

  test('Mark topic covered fires mutation (if topics exist)', async ({ page }) => {
    await page.goto('/dos/curriculum')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const coverBtn = page.locator('button:has-text("Mark Covered"), button:has-text("Mark as Covered")').first()
    if (!await coverBtn.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'No uncovered topics found' })
      return
    }
    const errors = captureConsoleErrors(page)
    await coverBtn.click()
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'dos/curriculum mark-covered')
  })

  test('DoS is hard-blocked from finance routes', async ({ page }) => {
    for (const route of ['/bursar/fees', '/bursar/salaries']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
    }
  })

  test('DoS messages route is real MessagingPage', async ({ page }) => {
    await page.goto('/dos/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    expect(await page.locator('text=/coming in next phase|stub|placeholder/i').first().isVisible().catch(() => false)).toBe(false)
  })
})
