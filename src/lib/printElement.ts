// Shared brand colors for plain-table printouts (class rosters, fee status,
// etc.) — keeps every printed list looking like the same document family.
export const PRINT_INK   = '#1e293b'
export const PRINT_RULE  = '#cbd5e1'
export const PRINT_BRAND = '#0f766e'

// Clones a hidden `.print-only` element into a `#print-root` node appended
// to <body>, then triggers window.print() — the `.printing-report` CSS rule
// (src/index.css) hides everything else so only the clone shows up on the
// printed page. Used for pages that render a plain, print-specific version
// of their data (roster tables, filtered lists) separate from an
// interactive on-screen view that isn't meant to be printed as-is.
export function printElement(elementId: string): void {
  const el = document.getElementById(elementId)
  if (!el) return
  const clone = el.cloneNode(true) as HTMLElement
  clone.id = 'print-root'
  document.body.appendChild(clone)
  document.body.classList.add('printing-report')
  const cleanup = () => {
    document.body.classList.remove('printing-report')
    clone.remove()
  }
  window.addEventListener('afterprint', cleanup, { once: true })
  window.print()
}
