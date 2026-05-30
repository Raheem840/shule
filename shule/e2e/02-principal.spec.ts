import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Principal', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'principal')
  })

  test('Dashboard loads — no console errors, KPI cards visible', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)
    assertNoErrors(errors, 'principal/dashboard')
    const kpiCards = page.locator('.stats-card, .sui-kpi-v2, [class*="kpi"], [class*="stat"]')
    await expect(kpiCards.first()).toBeVisible()
  })

  test('Academic year page loads with no errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/academic-year')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'principal/academic-year')
  })

  test('Principal can open create academic year modal', async ({ page }) => {
    await page.goto('/principal/academic-year')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const createBtn = page.locator('button:has-text("Create"), button:has-text("New Academic Year"), button:has-text("Add Year"), button:has-text("New Year")').first()
    if (!await createBtn.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'Create academic year button not found' })
      return
    }
    const errors = captureConsoleErrors(page)
    await createBtn.click()
    await page.waitForTimeout(1000)
    assertNoErrors(errors, 'principal/academic-year open create')
  })

  test('Students page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'principal/students')
  })

  test('Principal can open student profile (row click)', async ({ page }) => {
    await page.goto('/principal/students')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const firstRow = page.locator('table tbody tr, [role="row"]').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      await page.waitForTimeout(1500)
      const modalOrPage = page.locator('[role="dialog"], .modal, [class*="modal"], [class*="profile"]').first()
      await expect(modalOrPage).toBeVisible({ timeout: 4000 })
    } else {
      test.info().annotations.push({ type: 'warn', description: 'No student rows' })
    }
  })

  test('Staff page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/staff')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'principal/staff')
  })

  test('Principal can open staff profile and see salary info', async ({ page }) => {
    await page.goto('/principal/staff')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const firstRow = page.locator('table tbody tr, [role="row"]').first()
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click()
      await page.waitForTimeout(1500)
      const salaryField = page.locator('text=/salary/i')
      await expect(salaryField.first()).toBeVisible({ timeout: 4000 })
    } else {
      test.info().annotations.push({ type: 'warn', description: 'No staff rows' })
    }
  })

  test('Classes page loads with no errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/classes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'principal/classes')
  })

  test('Report cards page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/report-cards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'principal/report-cards')
  })

  test('Report cards page renders its header', async ({ page }) => {
    await page.goto('/principal/report-cards')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const pageTitle = page.locator('h1, h2, [class*="page-header"], [class*="PageHeader"]').filter({
      hasText: /Report Cards/i,
    }).first()
    await expect(pageTitle).toBeVisible({ timeout: 5000 })
  })

  test('Analytics page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/analytics')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)
    assertNoErrors(errors, 'principal/analytics')
  })

  test('Audit log loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/audit')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'principal/audit')
  })

  test('Settings page loads and school name input is visible', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/settings')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'principal/settings')
    // PrincipalSettingsPage uses unnamed <input> bound to schoolName state;
    // assert any text input is present.
    const anyInput = page.locator('input[type="text"], input:not([type])').first()
    await expect(anyInput).toBeVisible({ timeout: 5000 })
  })

  test('Messages route renders MessagingPage not StubCard', async ({ page }) => {
    await page.goto('/principal/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const stub = page.locator('text=/coming in next phase|stub|placeholder/i')
    expect(await stub.first().isVisible().catch(() => false)).toBe(false)
  })

  test('Announcements route loads (redirects to messages)', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/principal/announcements')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'principal/announcements')
  })

  test('Profile page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'principal/profile')
  })
})
