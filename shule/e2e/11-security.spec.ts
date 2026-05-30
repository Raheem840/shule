import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'

test.describe('Security & RLS', () => {
  test('Teacher does not see salary band on profile', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const salaryText = page.locator('text=/salary band|salary.*ugx|ugx.*salary/i')
    expect(await salaryText.first().isVisible().catch(() => false), 'Teacher should not see salary band').toBe(false)
  })

  test('Finance data absent from teacher dashboard', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const bodyText = (await page.textContent('body')) ?? ''
    expect(bodyText).not.toMatch(/fee ledger|amount due|amount paid/i)
  })

  test('Finance data absent from DoS dashboard', async ({ page }) => {
    await loginAs(page, 'dos')
    await page.goto('/dos/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const bodyText = (await page.textContent('body')) ?? ''
    expect(bodyText).not.toMatch(/fee ledger|amount due|amount paid/i)
  })

  test('Finance data absent from deputy dashboard', async ({ page }) => {
    await loginAs(page, 'deputy')
    await page.goto('/deputy/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    const bodyText = (await page.textContent('body')) ?? ''
    expect(bodyText).not.toMatch(/fee ledger|amount due|amount paid/i)
  })

  test('Teacher cannot reach exam journal of non-existent ID without crash', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/exams/00000000-0000-0000-0000-000000000999/marks')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const crashed = await page.locator('text=/error boundary|something went wrong|page crashed/i').first().isVisible().catch(() => false)
    expect(crashed, 'Page crashed on invalid journal ID').toBe(false)
  })
})
