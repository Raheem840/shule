import { Page } from '@playwright/test'

export const CREDENTIALS: Record<string, { email: string; password: string }> = {
  principal: { email: 'principal@shule.ug', password: 'Shule2025!' },
  deputy:    { email: 'deputy@shule.ug',    password: 'Shule@2025' },
  dos:       { email: 'dos@shule.ug',       password: 'Shule@2025' },
  secretary: { email: 'secretary@shule.ug', password: 'Shule@2025' },
  bursar:    { email: 'bursar@shule.ug',    password: 'Shule@2025' },
  teacher:   { email: 'teacher@shule.ug',   password: 'Shule@2025' },
  it_admin:  { email: 'it@shule.ug',        password: 'Shule@2025' },
}

export type Role = keyof typeof CREDENTIALS

export async function loginAs(page: Page, role: Role): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  const creds = CREDENTIALS[role]

  const emailInput = page.locator(
    '[data-testid="email-input"], input[type="email"], input[name="email"], input[placeholder*="email" i]'
  ).first()
  const passwordInput = page.locator(
    '[data-testid="password-input"], input[type="password"], input[name="password"]'
  ).first()
  const submitButton = page.locator(
    '[data-testid="login-button"], button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in"), button:has-text("Login"), button:has-text("Log In")'
  ).first()

  await emailInput.fill(creds.email)
  await passwordInput.fill(creds.password)
  await submitButton.click()

  await page.waitForURL(
    (url) => !url.toString().includes('/login'),
    { timeout: 15000 }
  )
  await page.waitForLoadState('networkidle')
}

export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.locator(
    'button:has-text("Logout"), button:has-text("Sign Out"), button:has-text("Sign out"), [data-testid="logout-button"]'
  ).first()
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click()
    await page.waitForURL(/\/login/, { timeout: 5000 }).catch(() => {})
  } else {
    await page.goto('/login')
  }
}
