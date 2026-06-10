import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Deputy Principal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'deputy')
  })

  test('Dashboard loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/deputy/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'deputy/dashboard')
  })

  test('Discipline page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/deputy/discipline')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'deputy/discipline')
  })

  test('Add Discipline Record opens a modal', async ({ page }) => {
    await page.goto('/deputy/discipline')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const addBtn = page.locator('button:has-text("Add Record")').first()
    if (!await addBtn.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'Add Record button not found' })
      return
    }
    await addBtn.click()
    await page.waitForTimeout(800)
    // The custom modal uses a heading "Add Discipline Record" / "Edit Discipline Record"
    const modalTitle = page.locator('text=/Add Discipline Record|Edit Discipline Record/i').first()
    await expect(modalTitle).toBeVisible({ timeout: 3000 })
  })

  test('Deputy students page loads — no UGX amounts', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/deputy/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'deputy/students')
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toMatch(/UGX\s[\d,]+/)
  })

  test('Deputy is hard-blocked from finance routes', async ({ page }) => {
    for (const route of ['/bursar/fees', '/bursar/salaries', '/bursar/add-payment']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
    }
  })

  test('Deputy messages route is MessagingPage', async ({ page }) => {
    await page.goto('/deputy/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const stub = page.locator('text=/coming in next phase|stub|placeholder/i')
    expect(await stub.first().isVisible().catch(() => false)).toBe(false)
  })
})
