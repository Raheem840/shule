import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Bursar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'bursar')
  })

  test('Dashboard loads — zero 400 errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)
    const http400s = errors.filter(e => e.type === 'http_400')
    expect(http400s, `400 errors: ${JSON.stringify(http400s)}`).toHaveLength(0)
    assertNoErrors(errors, 'bursar/dashboard')
  })

  test('Fee ledger loads — no column errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/fees')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const colErrors = errors.filter(e => e.text.includes('column') && e.text.includes('exist'))
    expect(colErrors, `Column errors: ${JSON.stringify(colErrors)}`).toHaveLength(0)
    assertNoErrors(errors, 'bursar/fees')
  })

  test('Add payment page loads with student search', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/add-payment')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/add-payment')
    const searchInput = page.locator('input[placeholder*="student" i], input[placeholder*="search" i]').first()
    await expect(searchInput).toBeVisible({ timeout: 4000 })
  })

  test('SMS reminders page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/reminders')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/reminders')
  })

  test('Delivery log loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/delivery-log')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/delivery-log')
  })

  test('Salary page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/salaries')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/salaries')
  })

  test('Fee structure page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/fee-structure')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/fee-structure')
  })

  test('Fee reports page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/bursar/reports')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'bursar/reports')
  })

  test('Bursar cannot see exam results page', async ({ page }) => {
    await page.goto('/teacher/exams')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
  })
})
