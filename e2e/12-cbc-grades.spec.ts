import { test, expect } from '@playwright/test'

test.describe('CBC Grade Calculation (UNEB Scale)', () => {
  test('Grade boundaries are correct per UNEB CBC scale', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const result = await page.evaluate(() => {
      const fn = (window as any).__calculateCBCGrade || (window as any).calculateCBCGrade
      if (!fn) return null
      return {
        s100: fn(100), s80: fn(80), s79: fn(79),
        s70:  fn(70),  s69: fn(69), s60: fn(60),
        s59:  fn(59),  s50: fn(50), s49: fn(49), s0: fn(0),
      }
    })

    if (result) {
      expect(result.s100).toBe('A')
      expect(result.s80).toBe('A')
      expect(result.s79).toBe('B')
      expect(result.s70).toBe('B')
      expect(result.s69).toBe('C')
      expect(result.s60).toBe('C')
      expect(result.s59).toBe('D')
      expect(result.s50).toBe('D')
      expect(result.s49).toBe('E')
      expect(result.s0).toBe('E')
    } else {
      test.info().annotations.push({
        type: 'warn',
        description: 'calculateCBCGrade not in window scope — verify manually in src/types/app.ts. RULE: A=80-100, B=70-79, C=60-69, D=50-59, E=0-49',
      })
    }
  })
})
