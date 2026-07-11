// Shared date helpers. Uganda is UTC+3 — new Date().toISOString() gives the
// UTC date, which is wrong for anything meant to represent "today" in the
// school's own local calendar (it's the previous day for the first ~3 hours
// of every local day). Use localToday() instead of toISOString().slice(0,10)
// for any "today" default or comparison.
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
