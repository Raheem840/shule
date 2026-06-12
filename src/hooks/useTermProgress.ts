import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'
import type { TermProgress, TermEvent, TermEventType } from '../types/week9'

const TERM_EVENT_COLOR: Record<TermEventType, string> = {
  exam:    'var(--danger)',
  ca:      'var(--warning)',
  aoi:     'var(--info)',
  general: 'var(--success)',
}

// Maps exam_journal assessment_type → TermEventType
function journalTypeToEventType(assessmentType: string): TermEventType {
  if (assessmentType === 'end_of_term') return 'exam'
  if (assessmentType === 'ca')          return 'ca'
  if (assessmentType === 'aoi')         return 'aoi'
  return 'general'
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function weeksBetween(a: Date, b: Date): number {
  return Math.max(1, Math.ceil(diffDays(a, b) / 7))
}


// Detect which term is active based on term_N_start / term_N_end columns
function detectActiveTerm(row: Record<string, string | null>): {
  termLabel: string
  termStart: string
  termEnd: string
} | null {
  const today = new Date().toISOString().slice(0, 10)
  for (const n of [1, 2, 3] as const) {
    const s = row[`term${n}_start`]
    const e = row[`term${n}_end`]
    if (s && e && today >= s && today <= e) {
      return { termLabel: `Term ${n}`, termStart: s, termEnd: e }
    }
  }
  // Fall back to the first term with dates
  for (const n of [1, 2, 3] as const) {
    const s = row[`term${n}_start`]
    const e = row[`term${n}_end`]
    if (s && e) return { termLabel: `Term ${n}`, termStart: s, termEnd: e }
  }
  return null
}

export function useTermProgress() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['term-progress', user?.schoolId],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TermProgress | null> => {
      const sid = user!.schoolId

      // Fetch active academic year
      const { data: yearData, error: yearErr } = await supabase
        .from('academic_years')
        .select(
          'id, label, start_date, end_date, is_active,' +
          ' term1_start, term1_end, term2_start, term2_end, term3_start, term3_end'
        )
        .eq('school_id', sid)
        .eq('is_active', true)
        .maybeSingle()

      if (yearErr) throw new Error(yearErr.message)

      // Safe defaults when no active academic year is configured yet
      if (!yearData) {
        const today = new Date()
        return {
          termStart:      today.toISOString().slice(0, 10),
          termEnd:        today.toISOString().slice(0, 10),
          currentTerm:    'Term 2',
          percentElapsed: 0,
          weekNumber:     1,
          totalWeeks:     13,
          daysRemaining:  0,
          events:         [],
        }
      }

      const row = yearData as unknown as Record<string, string | null>
      const termInfo = detectActiveTerm(row)

      if (!termInfo) {
        // Term dates may not be set, or today falls between terms.
        // Fall back to the academic year's overall start_date/end_date so the
        // bar shows real progress rather than a flat invisible line.
        const yearStart = row['start_date']
        const yearEnd   = row['end_date']

        if (yearStart && yearEnd) {
          const today2   = new Date()
          const tStart2  = new Date(yearStart)
          const tEnd2    = new Date(yearEnd)
          const elapsed2 = Math.max(0, diffDays(tStart2, today2))
          const total2   = Math.max(1,  diffDays(tStart2, tEnd2))
          const pct2     = Math.min(100, Math.round((elapsed2 / total2) * 100))
          const daysRem2 = Math.max(0, diffDays(today2, tEnd2))
          const totW2    = weeksBetween(tStart2, tEnd2)
          const curW2    = Math.min(totW2, Math.floor(elapsed2 / 7) + 1)
          return {
            termStart:      yearStart,
            termEnd:        yearEnd,
            currentTerm:    (row['label'] as string | null) ?? 'Academic Year',
            percentElapsed: pct2,
            weekNumber:     curW2,
            totalWeeks:     totW2,
            daysRemaining:  daysRem2,
            events:         [],
          }
        }

        // Truly no dates at all — show a neutral placeholder
        const today2 = new Date().toISOString().slice(0, 10)
        return {
          termStart:      today2,
          termEnd:        today2,
          currentTerm:    'Term dates not configured',
          percentElapsed: 0,
          weekNumber:     1,
          totalWeeks:     13,
          daysRemaining:  0,
          events:         [],
        }
      }

      const { termLabel, termStart, termEnd } = termInfo

      const today   = new Date()
      const tStart  = new Date(termStart)
      const tEnd    = new Date(termEnd)
      const elapsed = Math.max(0, diffDays(tStart, today))
      const total   = Math.max(1, diffDays(tStart, tEnd))
      const pct     = Math.min(100, Math.round((elapsed / total) * 100))
      const daysRem = Math.max(0, diffDays(today, tEnd))
      const totWeeks = weeksBetween(tStart, tEnd)
      const curWeek  = Math.min(totWeeks, Math.floor(elapsed / 7) + 1)

      // Fetch exam journal events for this term
      const currentYear = new Date().getFullYear()
      const [journalsRes, schoolEventsRes] = await Promise.all([
        supabase
          .from('exam_journal')
          .select('id, name, assessment_type, date_given, subject_id, class_id, term, year')
          .eq('school_id', sid)
          .eq('year', currentYear),
        supabase
          .from('school_events')
          .select('id, title, event_date, event_type, subject_id, class_id')
          .eq('school_id', sid)
          .gte('event_date', `${currentYear}-01-01`),
      ])

      const events: TermEvent[] = []

      // Journal events (date is always set for exam_journal rows)
      for (const j of (journalsRes.data ?? [])) {
        if (!j.date_given) continue
        events.push({
          id:    j.id,
          title: j.name ?? 'Exam',
          date:  j.date_given as string,
          type:  journalTypeToEventType(j.assessment_type as string),
        })
      }

      // School events (if table exists — 42P01 → data will be null → empty array)
      if (!schoolEventsRes.error || schoolEventsRes.error.code === '42P01') {
      for (const e of (schoolEventsRes.data ?? [])) {
        events.push({
          id:    e.id,
          title: e.title as string,
          date:  e.event_date as string,
          type:  (e.event_type === 'exam' ? 'exam'
               : e.event_type === 'ca'   ? 'ca'
               : e.event_type === 'aoi'  ? 'aoi'
               : 'general') as TermEventType,
        })
      }
      }

      // Sort events by date
      events.sort((a, b) => a.date.localeCompare(b.date))

      return {
        termStart,
        termEnd,
        currentTerm: termLabel,
        percentElapsed: pct,
        weekNumber:     curWeek,
        totalWeeks:     totWeeks,
        daysRemaining:  daysRem,
        events,
      }
    },
  })
}

export { TERM_EVENT_COLOR }
