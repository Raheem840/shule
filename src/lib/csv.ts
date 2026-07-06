// Shared CSV field escaper — several pages hand-rolled `"${field}"` quoting
// with no escaping, so a name/remark containing a literal `"` character
// silently corrupts the column boundaries of the exported file. Wraps a
// field in quotes and doubles any embedded quote, per RFC 4180.
export function csvField(v: unknown): string {
  const s = v == null ? '' : String(v)
  return `"${s.replace(/"/g, '""')}"`
}
