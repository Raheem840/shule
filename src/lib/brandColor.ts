export function applyBrandColor(hex: string): void {
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return

  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)

  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')

  // dark: 85% of original
  const dark  = `#${toHex(r * 0.85)}${toHex(g * 0.85)}${toHex(b * 0.85)}`
  // light: heavily diluted into near-white
  const light = `#${toHex(r * 0.08 + 248 * 0.92)}${toHex(g * 0.08 + 250 * 0.92)}${toHex(b * 0.08 + 252 * 0.92)}`

  // The design tokens (--brand etc.) are declared as the .ar wrapper's own CSS
  // custom properties (index.css), not on :root. An element's own declared
  // custom property always wins over an inherited value, so setting these on
  // document.documentElement (<html>) was silently overridden by .ar's
  // stylesheet rule and never took visible effect anywhere. Target .ar itself,
  // falling back to <html> if it isn't mounted yet.
  const root = (document.querySelector('.ar') as HTMLElement | null) ?? document.documentElement
  root.style.setProperty('--brand',       hex)
  root.style.setProperty('--brand-dark',  dark)
  root.style.setProperty('--brand-light', light)
}
