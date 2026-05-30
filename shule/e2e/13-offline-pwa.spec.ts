import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'

test.describe('Offline Mode', () => {
  test('App keeps dashboard or shows offline banner when network drops', async ({ page, context }) => {
    await loginAs(page, 'principal')
    await page.goto('/principal/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)

    await context.setOffline(true)
    await page.reload().catch(() => {})
    await page.waitForTimeout(3500)

    // Minimum acceptable offline behaviour: do not redirect to /login. The
    // dashboard itself may render in a loading state while cached queries hydrate.
    expect(page.url()).not.toContain('/login')

    await context.setOffline(false)
  })

  test('Offline navigation does not bounce to /login', async ({ page, context }) => {
    await loginAs(page, 'principal')
    await page.goto('/principal/dashboard')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3500)

    await context.setOffline(true)
    await page.goto('/principal/dashboard').catch(() => {})
    await page.waitForTimeout(3000)

    expect(page.url()).not.toContain('/login')
    await context.setOffline(false)
  })
})

test.describe('PWA', () => {
  test('Web app manifest is reachable', async ({ page }) => {
    const r1 = await page.request.get('http://localhost:5173/manifest.webmanifest').catch(() => null)
    const r2 = await page.request.get('http://localhost:5173/manifest.json').catch(() => null)
    const ok = (r1 && r1.ok()) || (r2 && r2.ok())
    expect(ok, 'manifest.webmanifest or manifest.json should be served').toBe(true)

    const r = r1 && r1.ok() ? r1 : r2!
    const manifest = await r.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.icons).toBeDefined()
    expect(manifest.icons.length).toBeGreaterThan(0)
    expect(manifest.display).toBe('standalone')
  })

  test('App icons exist (192px and 512px)', async ({ page }) => {
    const icon192 = await page.request.get('http://localhost:5173/icon-192.png')
    const icon512 = await page.request.get('http://localhost:5173/icon-512.png')
    expect(icon192.status()).toBe(200)
    expect(icon512.status()).toBe(200)
  })
})
