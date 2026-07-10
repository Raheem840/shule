import { useState, useEffect } from 'react'

type YearWithTermDates = {
  term1Start: string | null; term1End: string | null
  term2Start: string | null; term2End: string | null
  term3Start: string | null; term3End: string | null
} | null | undefined

// Shared by every Bursar page that needs a "which term" selector — all of
// them previously defaulted to a hardcoded Term 1, so any page a bursar
// hadn't manually re-filtered silently showed Term 1 data (or, worse,
// wrote NEW records stamped with Term 1) even when the school was actually
// mid-Term-2/3. Auto-corrects once to whichever term today's date falls in
// (or, between terms, the most recently-ended one) as soon as the active
// academic year's real term dates load — never overrides a term the
// bursar deliberately picked afterward.
export function useCurrentTermDefault(activeYear: YearWithTermDates): [1 | 2 | 3, (t: 1 | 2 | 3) => void] {
  const [term, setTerm] = useState<1 | 2 | 3>(1)
  const [autoSet, setAutoSet] = useState(false)

  useEffect(() => {
    if (autoSet || !activeYear) return
    const now = Date.now()
    const termDates: Record<1 | 2 | 3, { start: string | null; end: string | null }> = {
      1: { start: activeYear.term1Start, end: activeYear.term1End },
      2: { start: activeYear.term2Start, end: activeYear.term2End },
      3: { start: activeYear.term3Start, end: activeYear.term3End },
    }
    const ranges = ([1, 2, 3] as const).map(n => ({
      term:  n,
      start: termDates[n].start ? new Date(termDates[n].start!).getTime() : null,
      end:   termDates[n].end   ? new Date(termDates[n].end!).getTime()   : null,
    }))
    const current = ranges.find(r => r.start !== null && r.end !== null && now >= r.start && now <= r.end)
    if (current) {
      setTerm(current.term)
    } else {
      const withEnd = ranges.filter((r): r is { term: 1 | 2 | 3; start: number | null; end: number } => r.end !== null)
      const mostRecentlyEnded = withEnd.filter(r => r.end < now).sort((a, b) => b.end - a.end)[0]
      const nextUpcoming      = withEnd.filter(r => r.end >= now).sort((a, b) => a.end - b.end)[0]
      const pick = mostRecentlyEnded ?? nextUpcoming
      if (pick) setTerm(pick.term)
    }
    setAutoSet(true)
  }, [activeYear, autoSet])

  return [term, setTerm]
}

// String-keyed variant for pages whose term state/TermPicker uses the
// '1'/'2'/'3' string format instead of numeric 1|2|3 — same auto-detect
// logic, just returning/accepting strings so callers don't need to convert.
export function useCurrentTermDefaultString(activeYear: YearWithTermDates): [string, (t: string) => void] {
  const [term, setNumericTerm] = useCurrentTermDefault(activeYear)
  return [String(term), (t: string) => setNumericTerm((Number(t) || 1) as 1 | 2 | 3)]
}
