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

  const root = document.documentElement
  root.style.setProperty('--brand',       hex)
  root.style.setProperty('--brand-dark',  dark)
  root.style.setProperty('--brand-light', light)
}
