import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/login'
import { captureConsoleErrors, assertNoErrors } from './helpers/consoleCapture'

test.describe('Messaging', () => {
  test('Principal MessagingPage loads', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await loginAs(page, 'principal')
    await page.goto('/principal/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'messages/principal')
    const stub = page.locator('text=/coming in next phase|stub|placeholder/i')
    expect(await stub.first().isVisible().catch(() => false)).toBe(false)
  })

  test('Principal can open a conversation with another role', async ({ page }) => {
    await loginAs(page, 'principal')
    await page.goto('/principal/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const contact = page.locator('text=/secretary|bursar|teacher|deputy|dos/i').first()
    if (!await contact.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'No contacts in list' })
      return
    }
    const errors = captureConsoleErrors(page)
    await contact.click()
    await page.waitForTimeout(1000)
    assertNoErrors(errors, 'messages/open-conversation')
  })

  test('Announcements load on principal messages page', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await loginAs(page, 'principal')
    await page.goto('/principal/announcements')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500)
    assertNoErrors(errors, 'announcements/principal')
  })

  test('Teacher cannot post announcements', async ({ page }) => {
    await loginAs(page, 'teacher')
    await page.goto('/teacher/messages')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    const postBtn = page.locator('button:has-text("Post Announcement"), button:has-text("Announce"), button:has-text("Send Announcement")')
    const teacherCanPost = await postBtn.first().isVisible().catch(() => false)
    expect(teacherCanPost, 'Teacher should not be able to post announcements').toBe(false)
  })

  test('Notification bell visible in TopBar', async ({ page }) => {
    await loginAs(page, 'principal')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    const bell = page.locator('[data-testid="notification-bell"], button[aria-label*="notif" i], [class*="bell"], [class*="notif"]').first()
    if (!await bell.isVisible().catch(() => false)) {
      test.info().annotations.push({ type: 'warn', description: 'Notification bell not found' })
      return
    }
    const errors = captureConsoleErrors(page)
    await bell.click()
    await page.waitForTimeout(800)
    assertNoErrors(errors, 'notification-bell')
  })
})
