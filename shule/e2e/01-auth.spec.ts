import { test, expect } from '@playwright/test'
import { loginAs, CREDENTIALS } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

const ROLE_URLS: Record<string, RegExp> = {
  principal: /principal\/dashboard/,
  deputy:    /deputy\/dashboard/,
  dos:       /dos\/dashboard/,
  secretary: /secretary\/dashboard/,
  bursar:    /bursar\/dashboard/,
  teacher:   /teacher\/dashboard/,
  it_admin:  /admin\/dashboard/,
}

for (const [role, urlPattern] of Object.entries(ROLE_URLS)) {
  test(`${role} logs in and lands on correct dashboard`, async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await loginAs(page, role as any)
    expect(page.url()).toMatch(urlPattern)
    await page.waitForTimeout(3000)
    assertNoErrors(errors, `${role} login`)
  })
}

test('Wrong credentials show an error message', async ({ page }) => {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill('wrong@shule.ug')
  await page.locator('input[type="password"]').fill('wrongpassword')
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(2500)
  expect(page.url()).toContain('/login')
  const errorText = page.locator('text=/invalid|incorrect|wrong|error/i')
  await expect(errorText.first()).toBeVisible({ timeout: 5000 })
})

for (const role of ['teacher', 'deputy', 'dos']) {
  test(`${role} is hard-blocked from /bursar/fees`, async ({ page }) => {
    await loginAs(page, role as any)
    await page.goto('/bursar/fees')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/access denied|not authorized|forbidden|not allowed/i').first())
      .toBeVisible({ timeout: 5000 })
  })

  test(`${role} is hard-blocked from /bursar/salaries`, async ({ page }) => {
    await loginAs(page, role as any)
    await page.goto('/bursar/salaries')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=/access denied|not authorized|forbidden|not allowed/i').first()).toBeVisible()
  })
}

test('Teacher cannot reach secretary student registration', async ({ page }) => {
  await loginAs(page, 'teacher')
  await page.goto('/secretary/students')
  await page.waitForLoadState('networkidle')
  await expect(page.locator('text=/access denied|not authorized|forbidden/i').first()).toBeVisible()
})

test('Principal can access all major routes without AccessDenied', async ({ page }) => {
  await loginAs(page, 'principal')
  const routes = [
    '/principal/dashboard',
    '/principal/students',
    '/principal/staff',
    '/principal/report-cards',
    '/principal/audit',
  ]
  for (const route of routes) {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    const blocked = await page.locator('text=/access denied/i').isVisible().catch(() => false)
    expect(blocked, `Principal was blocked from ${route}`).toBe(false)
  }
})
