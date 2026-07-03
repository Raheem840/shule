import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../store/AuthContext'

export interface BriefingStudentSummary {
  total:       number
  active:      number
  suspended:   number
  expelled:    number
  newThisTerm: number
}

export interface BriefingStaffSummary {
  total:  number
  byRole: { role: string; count: number }[]
}

export interface BriefingAcademicOverview {
  passRate:            number
  subjectsBelowSixty:  number
  topSubjects:         { name: string; passRate: number }[]
  bottomSubjects:      { name: string; passRate: number }[]
}

export interface BriefingFeeStatusCounts {
  paid:    number
  partial: number
  unpaid:  number
}

export interface BriefingAttendanceAlert {
  className: string
  classId:   string
  rate:      number
}

export interface BriefingReportCardStatus {
  draft:    number
  ready:    number
  approved: number
  released: number
}

export interface SecretaryBriefingData {
  studentSummary:    BriefingStudentSummary
  staffSummary:      BriefingStaffSummary
  academicOverview:  BriefingAcademicOverview
  feeStatusCounts:   BriefingFeeStatusCounts
  attendanceAlerts:  BriefingAttendanceAlert[]
  reportCardStatus:  BriefingReportCardStatus
}

function getTermDates(
  year: { term1_start?: string | null; term1_end?: string | null; term2_start?: string | null; term2_end?: string | null; term3_start?: string | null; term3_end?: string | null } | null,
  term: number
): { start: string | null; end: string | null } {
  if (!year) return { start: null, end: null }
  if (term === 1) return { start: year.term1_start ?? null, end: year.term1_end ?? null }
  if (term === 2) return { start: year.term2_start ?? null, end: year.term2_end ?? null }
  return { start: year.term3_start ?? null, end: year.term3_end ?? null }
}

export function useSecretaryBriefing(term: number, year: number) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['secretary-briefing', user?.schoolId, term, year],
    enabled: !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SecretaryBriefingData> => {
      const sid = user!.schoolId

      // Step 1: get academic year for term date range
      // Matched to the selected `year` (not just "whichever is active") so that
      // choosing a past/future year in the toolbar actually changes term dates,
      // attendance range, and fee/exam/report-card scoping below.
      const { data: ayRows } = await supabase
        .from('academic_years')
        .select('id, label, start_date, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end, is_active')
        .eq('school_id', sid)
        .order('start_date', { ascending: false })

      const activeYear =
        (ayRows ?? []).find((r: any) => r.start_date && new Date(r.start_date).getFullYear() === year) ??
        (ayRows ?? []).find((r: any) => r.is_active) ??
        (ayRows ?? [])[0] ??
        null
      const termDates = getTermDates(activeYear, term)

      // Step 2: parallel queries
      const [
        studentsRes,
        staffRes,
        examResultsRes,
        examJournalRes,
        subjectsRes,
        paymentsRes,
        attendanceRes,
        classesRes,
        reportCardsRes,
      ] = await Promise.all([
        supabase.from('students')
          .select('id, status, enrolled_at')
          .eq('school_id', sid),
        supabase.from('staff')
          .select('id, role, is_active')
          .eq('school_id', sid),
        supabase.from('exam_results')
          .select('student_id, score, exam_journal_id, subject_id, term, year')
          .eq('school_id', sid)
          .eq('term', String(term))
          .eq('year', year),
        supabase.from('exam_journal')
          .select('id, pass_mark, term, year')
          .eq('school_id', sid)
          .eq('term', String(term))
          .eq('year', year),
        supabase.from('subjects')
          .select('id, name')
          .eq('school_id', sid),
        supabase.from('fee_payments')
          .select('student_id, amount_paid, amount_due')
          .eq('school_id', sid)
          .eq('term', term)
          .eq('academic_year_id', (activeYear as any)?.id ?? ''),
        supabase.from('attendance')
          .select('student_id, class_id, status, date')
          .eq('school_id', sid)
          .gte('date', termDates.start ?? '1970-01-01')
          .lte('date', termDates.end ?? '9999-12-31'),
        supabase.from('classes')
          .select('id, name')
          .eq('school_id', sid),
        supabase.from('report_cards')
          .select('id, status')
          .eq('school_id', sid)
          .eq('term', String(term))
          .eq('year', year),
      ])

      // ── Student summary ──────────────────────────────────────
      // Scope to students enrolled by the selected term's end date, so picking
      // a past/future term doesn't just show today's raw enrollment count.
      // Status (active/suspended/expelled) itself has no historical record in
      // the schema, so it always reflects current status.
      const allStudents = studentsRes.data ?? []
      const students = termDates.end
        ? allStudents.filter((s: any) => !s.enrolled_at || new Date(s.enrolled_at).getTime() <= new Date(termDates.end!).getTime())
        : allStudents
      const total     = students.length
      const active    = students.filter((s: any) => s.status === 'active').length
      const suspended = students.filter((s: any) => s.status === 'suspended').length
      const expelled  = students.filter((s: any) => s.status === 'expelled').length
      let newThisTerm = 0
      if (termDates.start && termDates.end) {
        const s = new Date(termDates.start).getTime()
        const e = new Date(termDates.end).getTime()
        newThisTerm = students.filter((st: any) => {
          const ea = new Date(st.enrolled_at).getTime()
          return ea >= s && ea <= e
        }).length
      }

      // ── Staff summary ────────────────────────────────────────
      const staffRows = (staffRes.data ?? []).filter((s: any) => s.is_active)
      const roleMap = new Map<string, number>()
      for (const s of staffRows) {
        const r = (s as any).role as string
        roleMap.set(r, (roleMap.get(r) ?? 0) + 1)
      }
      const byRole = Array.from(roleMap.entries()).map(([role, count]) => ({ role, count }))

      // ── Academic overview ────────────────────────────────────
      const results  = examResultsRes.data ?? []
      const journals = examJournalRes.data ?? []
      const subjectsList = subjectsRes.data ?? []

      const journalMap = new Map<string, number>()
      for (const j of journals) journalMap.set((j as any).id, (j as any).pass_mark ?? 50)

      const subjectNameMap = new Map<string, string>()
      for (const s of subjectsList) subjectNameMap.set((s as any).id, (s as any).name)

      // Per-subject: pass/total
      const subjectStats = new Map<string, { pass: number; total: number; name: string }>()
      let totalPass = 0
      let totalCount = 0
      for (const r of results) {
        const row = r as any
        const passMark = journalMap.get(row.exam_journal_id) ?? 50
        const sid2 = row.subject_id as string
        if (!subjectStats.has(sid2)) {
          subjectStats.set(sid2, { pass: 0, total: 0, name: subjectNameMap.get(sid2) ?? sid2 })
        }
        const entry = subjectStats.get(sid2)!
        entry.total++
        totalCount++
        if ((row.score ?? 0) >= passMark) {
          entry.pass++
          totalPass++
        }
      }

      const passRate = totalCount > 0 ? Math.round((totalPass / totalCount) * 100) : 0

      const subjectArr = Array.from(subjectStats.values()).map(s => ({
        name: s.name,
        passRate: s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0,
      }))
      subjectArr.sort((a, b) => b.passRate - a.passRate)
      const subjectsBelowSixty = subjectArr.filter(s => s.passRate < 60).length
      const topSubjects    = subjectArr.slice(0, 5)
      const bottomSubjects = [...subjectArr].reverse().slice(0, 5)

      // ── Fee status counts ────────────────────────────────────
      const payments = paymentsRes.data ?? []
      const statusMap = new Map<string, 'paid' | 'partial' | 'unpaid'>()
      for (const p of payments) {
        const row = p as any
        const stId = row.student_id as string
        const due  = Number(row.amount_due ?? 0)
        const paid2 = Number(row.amount_paid ?? 0)
        let st: 'paid' | 'partial' | 'unpaid'
        if (due <= 0) st = 'paid'
        else if (paid2 >= due) st = 'paid'
        else if (paid2 > 0) st = 'partial'
        else st = 'unpaid'
        const cur = statusMap.get(stId)
        // Downgrade: paid→partial if another record is partial; etc.
        if (!cur) { statusMap.set(stId, st); continue }
        if (cur === 'paid' && st !== 'paid') statusMap.set(stId, st)
        else if (cur === 'partial' && st === 'unpaid') statusMap.set(stId, st)
      }
      let paidCount = 0, partialCount = 0, unpaidCount = 0
      for (const v of statusMap.values()) {
        if (v === 'paid') paidCount++
        else if (v === 'partial') partialCount++
        else unpaidCount++
      }

      // ── Attendance alerts (classes below 80%) ────────────────
      const attendanceRows = attendanceRes.data ?? []
      const classesData    = classesRes.data ?? []
      const classNameMap   = new Map<string, string>()
      for (const c of classesData) classNameMap.set((c as any).id, (c as any).name)

      const classAttendMap = new Map<string, { present: number; total: number }>()
      for (const a of attendanceRows) {
        const row = a as any
        const cid = row.class_id as string
        if (!classAttendMap.has(cid)) classAttendMap.set(cid, { present: 0, total: 0 })
        const entry = classAttendMap.get(cid)!
        entry.total++
        if (row.status === 'present') entry.present++
      }
      const attendanceAlerts: BriefingAttendanceAlert[] = []
      for (const [cid, stats] of classAttendMap.entries()) {
        if (stats.total === 0) continue
        const rate = Math.round((stats.present / stats.total) * 100)
        if (rate < 80) {
          attendanceAlerts.push({
            classId:   cid,
            className: classNameMap.get(cid) ?? cid,
            rate,
          })
        }
      }
      attendanceAlerts.sort((a, b) => a.rate - b.rate)

      // ── Report card status ───────────────────────────────────
      const rcs = reportCardsRes.data ?? []
      const rcStatus = { draft: 0, ready: 0, approved: 0, released: 0 }
      for (const rc of rcs) {
        const s = (rc as any).status as string
        if (s === 'draft')    rcStatus.draft++
        else if (s === 'ready')    rcStatus.ready++
        else if (s === 'approved') rcStatus.approved++
        else if (s === 'released') rcStatus.released++
      }

      return {
        studentSummary: { total, active, suspended, expelled, newThisTerm },
        staffSummary:   { total: staffRows.length, byRole },
        academicOverview: { passRate, subjectsBelowSixty, topSubjects, bottomSubjects },
        feeStatusCounts:  { paid: paidCount, partial: partialCount, unpaid: unpaidCount },
        attendanceAlerts,
        reportCardStatus: rcStatus,
      }
    },
  })
}
