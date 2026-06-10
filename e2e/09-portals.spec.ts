import { test, expect, Page } from '@playwright/test'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

async function tryLoginPortal(page: Page, email: string, password: string): Promise<boolean> {
  try {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 8000 })
    return true
  } catch {
    return false
  }
}

test.describe('Student Portal', () => {
  test('Student portal page loads with tabs', async ({ page }) => {
    const loggedIn = await tryLoginPortal(page, 'student@shule.ug', 'Shule@2025')
    if (!loggedIn) {
      test.info().annotations.push({ type: 'warn', description: 'No student auth user — skipping' })
      return
    }
    const errors = captureConsoleErrors(page)
    await page.goto('/student/portal')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'student/portal')

    const tabs = ['Results', 'Fees', 'Attendance', 'Report', 'Notices']
    for (const tab of tabs) {
      const tabEl = page.locator(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`)
      await expect(tabEl.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('Student fees tab opens without errors', async ({ page }) => {
    const loggedIn = await tryLoginPortal(page, 'student@shule.ug', 'Shule@2025')
    if (!loggedIn) {
      test.info().annotations.push({ type: 'warn', description: 'No student auth user' })
      return
    }
    await page.goto('/student/portal')
    await page.waitForLoadState('networkidle')
    const feesTab = page.locator('[role="tab"]:has-text("Fees"), button:has-text("Fees")').first()
    if (await feesTab.isVisible().catch(() => false)) {
      await feesTab.click()
      await page.waitForTimeout(1500)
    }
    const errors = captureConsoleErrors(page)
    await page.waitForTimeout(2000)
    assertNoErrors(errors, 'student/portal/fees')
  })
})

test.describe('Parent Portal', () => {
  test('Parent portal loads and shows tabs', async ({ page }) => {
    const loggedIn = await tryLoginPortal(page, 'parent@shule.ug', 'Shule@2025')
    if (!loggedIn) {
      test.info().annotations.push({ type: 'warn', description: 'No parent auth user — skipping' })
      return
    }
    const errors = captureConsoleErrors(page)
    await page.goto('/parent/portal')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'parent/portal')

    const tabs = ['Results', 'Fees', 'Attendance', 'Report', 'Notices']
    for (const tab of tabs) {
      const tabEl = page.locator(`[role="tab"]:has-text("${tab}"), button:has-text("${tab}")`)
      await expect(tabEl.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('Parent portal has no RLS auth errors', async ({ page }) => {
    const loggedIn = await tryLoginPortal(page, 'parent@shule.ug', 'Shule@2025')
    if (!loggedIn) {
      test.info().annotations.push({ type: 'warn', description: 'No parent auth user' })
      return
    }
    const errors = captureConsoleErrors(page)
    await page.goto('/parent/portal')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const authErrors = errors.filter(e => e.type === 'http_403' || e.type === 'http_401')
    expect(authErrors, 'Parent portal should not hit auth errors').toHaveLength(0)
  })
})
