// Tests for applyBrandColor — the design tokens (--brand etc.) are declared as
// .ar's own CSS custom properties (index.css), not on :root. Setting them on
// document.documentElement is silently overridden by .ar's stylesheet rule
// (an element's own declared custom property always wins over an inherited
// one), so the color never visibly changed anywhere. applyBrandColor must
// target .ar itself.
import { describe, it, expect, afterEach } from 'vitest'
import { applyBrandColor } from '../../lib/brandColor'

describe('applyBrandColor', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.removeProperty('--brand')
    document.documentElement.style.removeProperty('--brand-dark')
    document.documentElement.style.removeProperty('--brand-light')
  })

  it('sets --brand on the .ar wrapper (not documentElement) when .ar is mounted', () => {
    const ar = document.createElement('div')
    ar.className = 'ar'
    document.body.appendChild(ar)

    applyBrandColor('#3366ff')

    expect(ar.style.getPropertyValue('--brand')).toBe('#3366ff')
    // documentElement must NOT be the one carrying it — that was the bug:
    // .ar's own stylesheet declaration always wins over an inherited value
    // set on <html>, so the color change never appeared anywhere.
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe('')
  })

  it('derives a darker --brand-dark and a near-white --brand-light variant', () => {
    const ar = document.createElement('div')
    ar.className = 'ar'
    document.body.appendChild(ar)

    applyBrandColor('#0d9488')

    expect(ar.style.getPropertyValue('--brand')).toBe('#0d9488')
    expect(ar.style.getPropertyValue('--brand-dark')).toMatch(/^#[0-9a-f]{6}$/)
    expect(ar.style.getPropertyValue('--brand-light')).toMatch(/^#[0-9a-f]{6}$/)
    // Dark variant should be strictly darker (lower channel values) than the base.
    expect(ar.style.getPropertyValue('--brand-dark')).not.toBe('#0d9488')
  })

  it('falls back to documentElement when .ar is not mounted (e.g. pre-auth screens)', () => {
    applyBrandColor('#ff0000')
    expect(document.documentElement.style.getPropertyValue('--brand')).toBe('#ff0000')
  })

  it('ignores invalid hex input without throwing', () => {
    const ar = document.createElement('div')
    ar.className = 'ar'
    document.body.appendChild(ar)

    expect(() => applyBrandColor('not-a-color')).not.toThrow()
    expect(ar.style.getPropertyValue('--brand')).toBe('')
  })
})
