import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Teacher', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'teacher')
  })

  test('Dashboard loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/dashboard')
  })

  test('Exam journal page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/exams')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/exams')
  })

  test('Exam journal shows draft/published status badges or empty state', async ({ page }) => {
    await page.goto('/teacher/exams')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const statusBadge = page.locator('text=/draft|published/i').first()
    const emptyState = page.locator('text=/no journals|no assessments|get started|no exams|empty/i').first()
    const eitherVisible = await statusBadge.isVisible().catch(() => false)
      || await emptyState.isVisible().catch(() => false)
    expect(eitherVisible).toBe(true)
  })

  test('Remarks page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/exams/remarks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/exams/remarks')
  })

  test('Attendance page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/attendance')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/attendance')
  })

  test('Curriculum page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/curriculum')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/curriculum')
  })

  test('Report preview page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/report-preview')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/report-preview')
  })

  test('Timetable page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/timetable')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/timetable')
  })

  test('Events page loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await page.goto('/teacher/events')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'teacher/events')
  })

  test('Teacher cannot create or edit students', async ({ page }) => {
    await page.goto('/secretary/students')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
  })

  test('Teacher cannot access fee data', async ({ page }) => {
    for (const route of ['/bursar/fees', '/bursar/salaries']) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
    }
  })

  test('Messages route is MessagingPage', async ({ page }) => {
    await page.goto('/teacher/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    expect(await page.locator('text=/coming in next phase|stub|placeholder/i').first().isVisible().catch(() => false)).toBe(false)
  })
})
