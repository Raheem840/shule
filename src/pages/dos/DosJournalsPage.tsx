import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useClasses, useSubjects } from '../../hooks/useClasses'
import { localToday } from '../../lib/dates'
import { calculateCBCGrade } from '../../types/app'

// ─── Local types ──────────────────────────────────────────────────────────────
type JournalRow = {
  id: string; assessmentType: string; subjectId: string | null; classId: string | null
  term: string; year: number; totalMarks: number; passMark: number; status: string
  dateGiven: string | null; teacherName: string; teacherId: string
}

type ResultRow = {
  id: string; examJournalId: string; studentId: string; subjectId: string
  score: number | null; isAbsent: boolean; term: string; year: number
  studentName: string; admissionNumber: string; grade: string | null
}

type AnalyticsFilter = 'all' | 'top10' | 'proficient' | 'can_improve' | 'needs_help' | 'absent'

// ─── Pill button ──────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background:   active ? 'var(--brand)'   : 'var(--surface)',
        color:        active ? '#fff'            : 'var(--txt2)',
        border:       active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
        borderRadius: 99,
        padding:      '6px 18px',
        fontWeight:   800,
        fontSize:     12,
        fontFamily:   'var(--font2)',
        cursor:       'pointer',
        whiteSpace:   'nowrap' as const,
        transition:   'all .15s',
      }}
    >
      {label}
    </button>
  )
}

function useSchoolName() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['school-name', user?.schoolId],
    enabled: !!user,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string> => {
      const { data } = await supabase
        .from('school_profile')
        .select('school_name')
        .eq('id', user!.schoolId)
        .maybeSingle()
      return (data?.school_name as string | undefined) ?? 'School'
    },
  })
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useAllJournals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-all-journals-v2', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<JournalRow[]> => {
      const sid = user!.schoolId
      const [journalsRes, staffRes] = await Promise.all([
        supabase.from('exam_journal')
          .select('id, assessment_type, subject_id, class_id, term, year, total_marks, pass_mark, status, date_given, teacher_id')
          .eq('school_id', sid).order('date_given', { ascending: false }).limit(500),
        supabase.from('staff').select('id, first_name, last_name').eq('school_id', sid).limit(500),
      ])
      if (journalsRes.error) throw new Error(journalsRes.error.message)
      const staffMap = new Map<string, string>(
        (staffRes.data ?? []).map((s: any) => [s.id as string, `${s.first_name} ${s.last_name}`])
      )
      return (journalsRes.data ?? []).map((r: any): JournalRow => ({
        id: r.id, assessmentType: r.assessment_type, subjectId: r.subject_id ?? null,
        classId: r.class_id ?? null, term: r.term, year: r.year,
        totalMarks: r.total_marks, passMark: r.pass_mark, status: r.status ?? 'draft',
        dateGiven: r.date_given ?? null, teacherName: staffMap.get(r.teacher_id) ?? '—',
        teacherId: r.teacher_id as string,
      }))
    },
    staleTime: 2 * 60_000,
  })
}

function useAllResults() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-all-results', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<ResultRow[]> => {
      const sid = user!.schoolId
      const [resultsRes, studentsRes] = await Promise.all([
        supabase.from('exam_results')
          .select('id, exam_journal_id, student_id, subject_id, score, is_absent, term, year, grade')
          .eq('school_id', sid).limit(5000),
        supabase.from('students')
          .select('id, first_name, last_name, admission_number')
          .eq('school_id', sid).eq('status', 'active'),
      ])
      if (resultsRes.error) throw new Error(resultsRes.error.message)
      const studMap = new Map<string, { name: string; admNo: string }>(
        (studentsRes.data ?? []).map((s: any) => [
          s.id as string,
          { name: `${s.first_name} ${s.last_name}`, admNo: s.admission_number ?? '—' },
        ])
      )
      return (resultsRes.data ?? []).map((r: any): ResultRow => {
        const stu   = studMap.get(r.student_id as string)
        const score = r.score as number | null
        // useSaveMarks deliberately leaves grade null for end_of_term rows
        // (needs the CA mark combined at report-card time) — a fallback
        // here would feed a raw out-of-80 exam score into a formula that
        // expects an already-computed 0-100 percentage. Use the DB grade
        // as-is; a null grade for an end_of_term row is correct, not missing.
        const gradeVal = r.grade as string | null
        return {
          id: r.id as string, examJournalId: r.exam_journal_id as string,
          studentId: r.student_id as string, subjectId: r.subject_id as string,
          score, isAbsent: (r.is_absent as boolean) ?? false,
          term: r.term as string, year: r.year as number,
          studentName: stu?.name ?? '—', admissionNumber: stu?.admNo ?? '—',
          grade: gradeVal,
        }
      })
    },
    staleTime: 2 * 60_000,
  })
}

// ─── Grade colour map ─────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
  A: '#10b981', B: '#0d9488', C: '#0ea5e9', D: '#f59e0b', E: '#f43f5e',
}

// ─── Heatmap cell colour ──────────────────────────────────────────────────────
function heatColor(avg: number | null): { bg: string; color: string } {
  if (avg == null) return { bg: 'var(--surface2)', color: 'var(--txt3)' }
  if (avg >= 80)   return { bg: 'rgba(16,185,129,.15)',  color: '#065f46' }
  if (avg >= 70)   return { bg: 'rgba(13,148,136,.15)',  color: '#0f766e' }
  if (avg >= 60)   return { bg: 'rgba(14,165,233,.15)',  color: '#0369a1' }
  if (avg >= 50)   return { bg: 'rgba(245,158,11,.15)',  color: '#92400e' }
  return             { bg: 'rgba(244,63,94,.15)',   color: '#be123c' }
}

// ─── Recharts tooltip ─────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.fill || p.color }}>
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── STATUS / TYPE meta ───────────────────────────────────────────────────────
const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  draft:     { color: '#64748b', bg: 'var(--surface2)',      label: 'Draft'     },
  published: { color: '#10b981', bg: 'rgba(16,185,129,.1)',  label: 'Published' },
  locked:    { color: '#f59e0b', bg: 'rgba(245,158,11,.1)',  label: 'Locked'    },
}

const TYPE_COLOR: Record<string, string> = {
  ca: '#0d9488', mid_term: '#8b5cf6', end_of_term: '#f43f5e', beginning_of_term: '#0ea5e9',
  aoi: '#10b981', dit: '#f59e0b', practical: '#ec4899', class_test: '#6366f1', assignment: '#64748b',
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function DosJournalsPage() {
  const navigate = useNavigate()
  const { data: journals = [], isLoading: jLoading, isError: jError } = useAllJournals()
  const { data: results  = [], isLoading: rLoading }                  = useAllResults()
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const { data: schoolName = 'School' } = useSchoolName()

  // Journal table filters
  const [classFilter,   setClassFilter]   = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [termFilter,    setTermFilter]    = useState('')
  const [search,        setSearch]        = useState('')

  // Analytics filters
  const [analyticsFilter,  setAnalyticsFilter]  = useState<AnalyticsFilter>('all')
  const [analyticsSubject, setAnalyticsSubject] = useState('')
  const [analyticsClass,   setAnalyticsClass]   = useState('')
  const [analyticsTerm,    setAnalyticsTerm]    = useState('')
  const [analyticsTeacher, setAnalyticsTeacher] = useState('')

  // Active tab
  const [tab, setTab] = useState<'journals' | 'analytics'>('journals')

  const classMap   = useMemo(() => new Map(classes.map(c  => [c.id, c.name])),  [classes])
  const subjectMap = useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects])

  // Unique teachers extracted from journals
  const teacherList = useMemo(() => {
    const seen = new Map<string, string>()
    for (const j of journals) {
      if (j.teacherId && j.teacherName !== '—') seen.set(j.teacherId, j.teacherName)
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [journals])

  // Journal table (filtered)
  const journalRows = useMemo(() => {
    let r = journals
    if (classFilter)   r = r.filter(j => j.classId   === classFilter)
    if (subjectFilter) r = r.filter(j => j.subjectId === subjectFilter)
    if (statusFilter)  r = r.filter(j => j.status    === statusFilter)
    if (termFilter)    r = r.filter(j => String(j.term) === termFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(j =>
        j.teacherName.toLowerCase().includes(q) ||
        (subjectMap.get(j.subjectId ?? '') ?? '').toLowerCase().includes(q)
      )
    }
    return r
  }, [journals, classFilter, subjectFilter, statusFilter, termFilter, search, subjectMap])

  // Journal lookup for analytics joins
  const journalMeta = useMemo(() => {
    const m = new Map<string, JournalRow>()
    for (const j of journals) m.set(j.id, j)
    return m
  }, [journals])

  // CA journals score 0-3 per competency, not out of total_marks — every
  // average/grade computed below must convert to a percentage first using
  // the right denominator, or a CA score of 2.5 reads as "2.5%" next to an
  // 80/100-scale result. Falls back to the raw score (already 0-100-ish) if
  // the journal can't be found for some reason.
  const toPct = useCallback((r: ResultRow): number => {
    const j = journalMeta.get(r.examJournalId)
    if (!j) return r.score as number
    const denom = j.assessmentType === 'ca' ? 3 : (j.totalMarks || 100)
    return ((r.score as number) / denom) * 100
  }, [journalMeta])

  // Base analytics results (subject/class/term/teacher secondary filters)
  const baseResults = useMemo(() => {
    return results.filter(res => {
      const j = journalMeta.get(res.examJournalId)
      if (!j) return false
      if (analyticsSubject && j.subjectId !== analyticsSubject) return false
      if (analyticsClass   && j.classId   !== analyticsClass)   return false
      if (analyticsTerm    && String(j.term) !== analyticsTerm)  return false
      if (analyticsTeacher && j.teacherId  !== analyticsTeacher) return false
      return true
    })
  }, [results, journalMeta, analyticsSubject, analyticsClass, analyticsTerm, analyticsTeacher])

  // Apply performance band (pill filter) — this is what drives exports/print
  const filteredResults = useMemo(() => {
    if (analyticsFilter === 'all') return baseResults

    if (analyticsFilter === 'absent') return baseResults.filter(r => r.isAbsent)

    if (analyticsFilter === 'top10') {
      const scoreMap = new Map<string, number[]>()
      for (const r of baseResults) {
        if (r.score == null) continue
        const arr = scoreMap.get(r.studentId) ?? []
        arr.push(toPct(r))
        scoreMap.set(r.studentId, arr)
      }
      const topIds = new Set(
        [...scoreMap.entries()]
          .map(([id, scores]) => ({ id, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 10)
          .map(a => a.id)
      )
      return baseResults.filter(r => topIds.has(r.studentId))
    }

    return baseResults.filter(r => {
      if (r.score == null) return false
      const g = calculateCBCGrade(toPct(r))
      if (analyticsFilter === 'proficient')  return g === 'A' || g === 'B'
      if (analyticsFilter === 'can_improve') return g === 'C' || g === 'D'
      if (analyticsFilter === 'needs_help')  return g === 'E'
      return true
    })
  }, [baseResults, analyticsFilter, toPct])

  // KPIs computed from filteredResults
  const kpis = useMemo(() => {
    const scored    = filteredResults.filter(r => r.score != null && !r.isAbsent)
    const allScores = scored.map(toPct)
    const avg       = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0
    const passRate  = scored.length > 0
      ? (scored.filter(r => {
          const j = journalMeta.get(r.examJournalId)
          return (r.score as number) >= (j?.passMark ?? 50)
        }).length / scored.length) * 100
      : 0

    const classBucket   = new Map<string, number[]>()
    const subjectBucket = new Map<string, number[]>()
    for (const r of scored) {
      const j = journalMeta.get(r.examJournalId)
      const pct = toPct(r)
      if (j?.classId)   { const a = classBucket.get(j.classId)     ?? []; a.push(pct); classBucket.set(j.classId, a) }
      if (j?.subjectId) { const a = subjectBucket.get(j.subjectId) ?? []; a.push(pct); subjectBucket.set(j.subjectId, a) }
    }

    let topClass = '—'; let topClassAvg = 0
    for (const [cid, sc] of classBucket.entries()) {
      const a = sc.reduce((x, y) => x + y, 0) / sc.length
      if (a > topClassAvg) { topClassAvg = a; topClass = classMap.get(cid) ?? cid }
    }

    let topSubject = '—'; let topSubjectAvg = 0
    for (const [sid, sc] of subjectBucket.entries()) {
      const a = sc.reduce((x, y) => x + y, 0) / sc.length
      if (a > topSubjectAvg) { topSubjectAvg = a; topSubject = subjectMap.get(sid) ?? sid }
    }

    return {
      avg:           avg.toFixed(1),
      passRate:      passRate.toFixed(1),
      topClass,
      topSubject,
      totalStudents: new Set(scored.map(r => r.studentId)).size,
    }
  }, [filteredResults, journalMeta, classMap, subjectMap, toPct])

  // Grade distribution chart data
  const gradeDistData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 }
    for (const r of filteredResults) {
      if (r.isAbsent || r.score == null) continue
      counts[calculateCBCGrade(toPct(r))]++
    }
    return Object.entries(counts).map(([grade, count]) => ({ grade, count, fill: GRADE_COLOR[grade] }))
  }, [filteredResults, toPct])

  // Teacher comparison data
  const teacherChartData = useMemo(() => {
    const buckets = new Map<string, { scores: number[]; name: string; subject: string }>()
    for (const r of filteredResults) {
      if (r.score == null || r.isAbsent) continue
      const j = journalMeta.get(r.examJournalId)
      if (!j) continue
      const pct = toPct(r)
      const existing = buckets.get(j.teacherId)
      if (!existing) {
        buckets.set(j.teacherId, { scores: [pct], name: j.teacherName, subject: subjectMap.get(j.subjectId ?? '') ?? '—' })
      } else {
        existing.scores.push(pct)
      }
    }
    return [...buckets.values()]
      .map(v => ({ name: v.name, subject: v.subject, avg: +(v.scores.reduce((a, b) => a + b, 0) / v.scores.length).toFixed(1) }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 15)
  }, [filteredResults, journalMeta, subjectMap, toPct])

  // Class × subject heatmap
  const heatmapData = useMemo(() => {
    const classIds   = [...new Set(journals.map(j => j.classId).filter((x): x is string => !!x))]
    const subjectIds = [...new Set(journals.map(j => j.subjectId).filter((x): x is string => !!x))]
    const matrix     = new Map<string, number[]>()
    for (const r of filteredResults) {
      if (r.score == null || r.isAbsent) continue
      const j = journalMeta.get(r.examJournalId)
      if (!j?.classId || !j.subjectId) continue
      const key = `${j.classId}__${j.subjectId}`
      const arr = matrix.get(key) ?? []
      arr.push(toPct(r))
      matrix.set(key, arr)
    }
    const cellMap = new Map<string, number | null>()
    for (const [key, sc] of matrix.entries()) {
      cellMap.set(key, +(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1))
    }
    const activeClasses  = classIds.filter(cid  => subjectIds.some(sid => cellMap.has(`${cid}__${sid}`)))
    const activeSubjects = subjectIds.filter(sid => classIds.some(cid  => cellMap.has(`${cid}__${sid}`)))
    return { classIds: activeClasses, subjectIds: activeSubjects, cellMap }
  }, [filteredResults, journalMeta, journals, toPct])

  // Excel export (respects filteredResults)
  const exportExcel = useCallback(async () => {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('DoS Analytics')
    ws.columns = [
      { header: 'Student Name',   key: 'studentName',     width: 22 },
      { header: 'Admission No',   key: 'admissionNumber', width: 14 },
      { header: 'Class',          key: 'className',       width: 12 },
      { header: 'Subject',        key: 'subject',         width: 18 },
      { header: 'Assessment',     key: 'assessment',      width: 18 },
      { header: 'Term',           key: 'term',            width: 8  },
      { header: 'Year',           key: 'year',            width: 8  },
      { header: 'Score',          key: 'score',           width: 8  },
      { header: 'Grade',          key: 'grade',           width: 8  },
      { header: 'Teacher',        key: 'teacher',         width: 22 },
    ]
    const headerRow = ws.getRow(1)
    headerRow.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
    headerRow.height    = 20
    for (const r of filteredResults) {
      const j = journalMeta.get(r.examJournalId)
      ws.addRow({
        studentName:     r.studentName,
        admissionNumber: r.admissionNumber,
        className:       classMap.get(j?.classId ?? '') ?? '—',
        subject:         subjectMap.get(j?.subjectId ?? r.subjectId) ?? '—',
        assessment:      j?.assessmentType.replace(/_/g, ' ') ?? '—',
        term:            `T${r.term}`,
        year:            r.year,
        score:           r.isAbsent ? 'ABS' : (r.score ?? '—'),
        grade:           r.isAbsent ? 'ABS' : (r.grade ?? '—'),
        teacher:         j?.teacherName ?? '—',
      })
    }
    ws.autoFilter = { from: 'A1', to: 'J1' }
    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `dos-analytics-${analyticsFilter}-${localToday()}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [filteredResults, journalMeta, classMap, subjectMap, analyticsFilter])

  const handlePrint = useCallback(() => window.print(), [])

  const isLoading = jLoading || rLoading
  const published = journals.filter(j => j.status === 'published').length
  const draft     = journals.filter(j => j.status === 'draft').length

  return (
    <>
      {/* Print isolation: only .dos-analytics-print (and its non-.no-print
          descendants) renders when printing. `display:none` on an ancestor
          can never be undone by a descendant's own `display` — the old rule
          here hid the whole app root (`body > *`) and then tried to
          re-display a node buried inside it, which produced a blank page
          every time regardless of data. `visibility` is inheritable but,
          unlike `display`, can be overridden per-descendant, so this hides
          everything by default and explicitly re-reveals the report. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .dos-analytics-print, .dos-analytics-print * { visibility: visible; }
          .dos-analytics-print .no-print, .dos-analytics-print .no-print * { visibility: hidden; display: none !important; }
          .dos-analytics-print { position: absolute; top: 0; left: 0; width: 100%; }
          .dos-print-header { display: block !important; }
          @page { size: A4 portrait; margin: 14mm 16mm; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Header */}
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Journals & Analytics</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Exam journals · Performance analytics · Export & print</p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="no-print" style={{ display: 'flex', gap: 6, background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: 6, maxWidth: 'fit-content', width: '100%' }}>
          {(['journals', 'analytics'] as const).map(v => (
            <button key={v} onClick={() => setTab(v)} style={{
              padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: 800, fontSize: 13, fontFamily: 'var(--font2)',
              background: tab === v ? 'var(--brand)' : 'transparent',
              color:      tab === v ? '#fff'         : 'var(--txt2)',
              transition: 'all .15s',
              textTransform: 'capitalize' as const,
            }}>{v}</button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* JOURNALS TAB                                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        {tab === 'journals' && (
          <>
            {!isLoading && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Journals', value: journals.length, color: '#8b5cf6', glow: 'rgba(139,92,246,.18)' },
                  { label: 'Published',      value: published,       color: '#10b981', glow: 'rgba(16,185,129,.18)' },
                  { label: 'Drafts',         value: draft,           color: '#f59e0b', glow: 'rgba(245,158,11,.18)' },
                ].map(k => (
                  <div key={k.label} style={{ flex: '1 1 120px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
                    <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: k.glow, filter: 'blur(18px)', pointerEvents: 'none' }} />
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filters bar */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 180px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 5 }}>Search</div>
                <input className="sui-input" placeholder="Teacher, subject…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
              </div>
              {([
                { label: 'Class',   val: classFilter,   set: setClassFilter,   opts: [['','All Classes'],  ...classes.map(c  => [c.id,  c.name])] as [string,string][] },
                { label: 'Subject', val: subjectFilter, set: setSubjectFilter, opts: [['','All Subjects'], ...subjects.map(s => [s.id,  s.name])] as [string,string][] },
                { label: 'Term',    val: termFilter,    set: setTermFilter,    opts: [['','All Terms'],['1','T1'],['2','T2'],['3','T3']]            as [string,string][] },
                { label: 'Status',  val: statusFilter,  set: setStatusFilter,  opts: [['','All'],['draft','Draft'],['published','Published'],['locked','Locked']] as [string,string][] },
              ]).map(({ label, val, set, opts }) => (
                <div key={label} style={{ flex: '0 1 120px', minWidth: 100 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 5 }}>{label}</div>
                  <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
              {(search || classFilter || subjectFilter || termFilter || statusFilter) && (
                <button
                  onClick={() => { setSearch(''); setClassFilter(''); setSubjectFilter(''); setTermFilter(''); setStatusFilter('') }}
                  style={{ alignSelf: 'flex-end', padding: '9px 14px', border: 'none', background: 'none', color: 'var(--brand)', fontWeight: 700, fontSize: 12, cursor: 'pointer', borderRadius: 8, flexShrink: 0 }}
                >
                  Clear all
                </button>
              )}
            </div>

            {isLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 52, borderRadius: 10 }} />)}
              </div>
            )}
            {jError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13 }}>
                Failed to load journals.
              </div>
            )}

            {!isLoading && !jError && (
              <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
                <div className="hscroll">
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
                    <thead>
                      <tr>
                        {['Subject','Class','Type','Term','Teacher','Marks','Status'].map(h => (
                          <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {journalRows.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: '36px 24px', textAlign: 'center' as const, color: 'var(--txt3)', fontSize: 13 }}>No journals match the current filters.</td></tr>
                      ) : journalRows.map(j => {
                        const cfg  = STATUS_META[j.status] ?? STATUS_META['draft']
                        const tCol = TYPE_COLOR[j.assessmentType] ?? '#64748b'
                        return (
                          <tr key={j.id}
                            onClick={() => navigate(`/teacher/exams/${j.id}/marks?view=1`)}
                            title="View this journal in detail"
                            style={{ borderBottom: '.5px solid var(--border)', transition: 'background .12s', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '13px 16px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{subjectMap.get(j.subjectId ?? '') ?? '—'}</td>
                            <td style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--txt2)' }}>{classMap.get(j.classId ?? '') ?? '—'}</td>
                            <td style={{ padding: '13px 16px' }}>
                              <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: `${tCol}18`, color: tCol, border: `.5px solid ${tCol}30`, whiteSpace: 'nowrap' as const }}>{j.assessmentType.replace(/_/g,' ')}</span>
                            </td>
                            <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)', whiteSpace: 'nowrap' as const }}>T{j.term} {j.year}</td>
                            <td style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--txt2)' }}>{j.teacherName}</td>
                            <td style={{ padding: '13px 16px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)', whiteSpace: 'nowrap' as const }}>{j.totalMarks} / {j.passMark}</td>
                            <td style={{ padding: '13px 16px' }}>
                              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, border: `.5px solid ${cfg.color}30` }}>{cfg.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {journalRows.length > 0 && (
                  <div style={{ padding: '8px 16px', borderTop: '.5px solid var(--border)', fontSize: 11.5, color: 'var(--txt3)' }}>
                    Showing {journalRows.length} of {journals.length} journals
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════ */}
        {/* ANALYTICS TAB                                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        {tab === 'analytics' && (
          <div className="dos-analytics-print" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

            {/* Print-only branded header — hidden on screen, shown on paper */}
            <div className="dos-print-header" style={{ display: 'none', marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: '#0f172a' }}>{schoolName}</div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 14, color: '#334155', marginTop: 2 }}>Exam Performance Report</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                Generated {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' · '}Band: {analyticsFilter.replace(/_/g, ' ')}
                {analyticsSubject && ` · ${subjectMap.get(analyticsSubject) ?? ''}`}
                {analyticsClass   && ` · ${classMap.get(analyticsClass) ?? ''}`}
                {analyticsTerm    && ` · Term ${analyticsTerm}`}
                {analyticsTeacher && ` · ${teacherList.find(t => t.id === analyticsTeacher)?.name ?? ''}`}
              </div>
              <div style={{ borderBottom: '2px solid #0d9488', marginTop: 10 }} />
            </div>

            {/* Performance band pills */}
            <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, whiteSpace: 'nowrap' as const, marginRight: 4 }}>Band</span>
              {([
                ['all',         'All'],
                ['top10',       'Top 10'],
                ['proficient',  'Proficient (A/B ≥70)'],
                ['can_improve', 'Can Improve (C/D)'],
                ['needs_help',  'Needs Help (E <50)'],
                ['absent',      'Absent'],
              ] as [AnalyticsFilter, string][]).map(([v, l]) => (
                <Pill key={v} label={l} active={analyticsFilter === v} onClick={() => setAnalyticsFilter(v)} />
              ))}
            </div>

            {/* Secondary filters + action buttons */}
            <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
              {([
                { label: 'Subject', val: analyticsSubject, set: setAnalyticsSubject, opts: [['','All Subjects'], ...subjects.map(s  => [s.id,  s.name])]    as [string,string][] },
                { label: 'Class',   val: analyticsClass,   set: setAnalyticsClass,   opts: [['','All Classes'],  ...classes.map(c  => [c.id,  c.name])]     as [string,string][] },
                { label: 'Term',    val: analyticsTerm,    set: setAnalyticsTerm,    opts: [['','All Terms'],['1','T1'],['2','T2'],['3','T3']]                as [string,string][] },
                { label: 'Teacher', val: analyticsTeacher, set: setAnalyticsTeacher, opts: [['','All Teachers'], ...teacherList.map(t => [t.id, t.name])]    as [string,string][] },
              ]).map(({ label, val, set, opts }) => (
                <div key={label} style={{ flex: '0 1 150px', minWidth: 120 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 5 }}>{label}</div>
                  <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
              <div style={{ width: '100%', display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button
                  onClick={() => void exportExcel()}
                  disabled={isLoading || filteredResults.length === 0}
                  title={filteredResults.length === 0 && !isLoading ? 'No results match the current filters' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 10, border: 'none',
                    background: (isLoading || filteredResults.length === 0) ? 'var(--surface2)' : 'linear-gradient(135deg,#10b981,#059669)',
                    color: (isLoading || filteredResults.length === 0) ? 'var(--txt3)' : '#fff',
                    fontWeight: 700, fontSize: 12.5,
                    cursor: (isLoading || filteredResults.length === 0) ? 'not-allowed' : 'pointer',
                    boxShadow: (isLoading || filteredResults.length === 0) ? 'none' : '0 3px 10px rgba(16,185,129,.3)',
                    fontFamily: 'var(--font2)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export Excel
                </button>
                <button
                  onClick={handlePrint}
                  disabled={isLoading || filteredResults.length === 0}
                  title={filteredResults.length === 0 && !isLoading ? 'No results match the current filters' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 10,
                    border: '.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: (isLoading || filteredResults.length === 0) ? 'var(--txt3)' : 'var(--txt2)',
                    fontWeight: 700, fontSize: 12.5,
                    cursor: (isLoading || filteredResults.length === 0) ? 'not-allowed' : 'pointer',
                    opacity: (isLoading || filteredResults.length === 0) ? 0.6 : 1,
                    fontFamily: 'var(--font2)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9"/>
                    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                    <rect x="6" y="14" width="12" height="8"/>
                  </svg>
                  Print Report
                </button>
              </div>
            </div>

            {isLoading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
                {[1,2,3,4,5].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 14 }} />)}
              </div>
            )}

            {!isLoading && (
              <>
                {/* KPI row */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {[
                    { label: 'School Average',    value: kpis.avg,                   unit: '/100', color: '#8b5cf6', glow: 'rgba(139,92,246,.18)' },
                    { label: 'Pass Rate',         value: `${kpis.passRate}%`,         unit: '≥50',  color: '#10b981', glow: 'rgba(16,185,129,.18)' },
                    { label: 'Top Class',         value: kpis.topClass,              unit: '',     color: '#0d9488', glow: 'rgba(13,148,136,.18)' },
                    { label: 'Top Subject',       value: kpis.topSubject,            unit: '',     color: '#0ea5e9', glow: 'rgba(14,165,233,.18)' },
                    { label: 'Students Assessed', value: String(kpis.totalStudents), unit: '',     color: '#f59e0b', glow: 'rgba(245,158,11,.18)' },
                  ].map(k => (
                    <div key={k.label} style={{ flex: '1 1 140px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
                      <div style={{ position: 'absolute', top: -14, right: -14, width: 60, height: 60, borderRadius: '50%', background: k.glow, filter: 'blur(18px)', pointerEvents: 'none' }} />
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontSize: k.value.length > 10 ? 14 : 22, fontWeight: 900, fontFamily: 'var(--font2)', color: k.color, letterSpacing: -1, lineHeight: 1.1 }}>{k.value}</span>
                        {k.unit && <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 600 }}>{k.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 16 }}>

                  {/* Grade distribution */}
                  <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>Grade Distribution</div>
                    {gradeDistData.every(d => d.count === 0) ? (
                      <div style={{ padding: '40px 0', textAlign: 'center' as const, color: 'var(--txt3)', fontSize: 13 }}>No scored results in current filter.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={gradeDistData} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="grade" tick={{ fontSize: 12, fontWeight: 700, fill: 'var(--txt2)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,.04)' }} />
                          <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                            {gradeDistData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Teacher comparison (horizontal bar) */}
                  <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>Teacher Class Average</div>
                    {teacherChartData.length === 0 ? (
                      <div style={{ padding: '40px 0', textAlign: 'center' as const, color: 'var(--txt3)', fontSize: 13 }}>No data for current filters.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={Math.max(220, teacherChartData.length * 32)}>
                        <BarChart data={teacherChartData} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: 'var(--txt2)' }} axisLine={false} tickLine={false} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const d = payload[0].payload as typeof teacherChartData[0]
                              return (
                                <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                                  <div style={{ fontWeight: 800, marginBottom: 3 }}>{d.name}</div>
                                  <div style={{ color: 'var(--txt3)' }}>Subject: {d.subject}</div>
                                  <div style={{ color: 'var(--brand)', fontWeight: 700 }}>Avg: {d.avg}/100</div>
                                </div>
                              )
                            }}
                            cursor={{ fill: 'rgba(0,0,0,.04)' }}
                          />
                          <Bar dataKey="avg" name="Avg Score" fill="var(--brand)" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Class × subject heatmap */}
                {heatmapData.classIds.length > 0 && heatmapData.subjectIds.length > 0 && (
                  <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 22px', boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
                    <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>Class × Subject Performance Heatmap</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '6px 10px', textAlign: 'left' as const, fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .5 }}>Class</th>
                            {heatmapData.subjectIds.map(sid => (
                              <th key={sid} style={{ padding: '6px 8px', textAlign: 'center' as const, fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' as const, letterSpacing: .5, whiteSpace: 'nowrap' as const, minWidth: 80 }}>
                                {subjectMap.get(sid) ?? sid}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heatmapData.classIds.map(cid => (
                            <tr key={cid}>
                              <td style={{ padding: '6px 10px', fontWeight: 700, fontSize: 12, color: 'var(--txt)', whiteSpace: 'nowrap' as const }}>
                                {classMap.get(cid) ?? cid}
                              </td>
                              {heatmapData.subjectIds.map(sid => {
                                const avg = heatmapData.cellMap.get(`${cid}__${sid}`) ?? null
                                const { bg, color } = heatColor(avg)
                                return (
                                  <td key={sid} style={{ padding: '7px 10px', textAlign: 'center' as const, borderRadius: 8, background: bg, color, fontWeight: 700, fontSize: 12.5, fontFamily: 'var(--font3)', minWidth: 60 }}>
                                    {avg != null ? avg : '—'}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                      {[
                        { label: '≥80 (A)',   bg: 'rgba(16,185,129,.15)', color: '#065f46' },
                        { label: '70–79 (B)', bg: 'rgba(13,148,136,.15)', color: '#0f766e' },
                        { label: '60–69 (C)', bg: 'rgba(14,165,233,.15)', color: '#0369a1' },
                        { label: '50–59 (D)', bg: 'rgba(245,158,11,.15)', color: '#92400e' },
                        { label: '<50 (E)',   bg: 'rgba(244,63,94,.15)',  color: '#be123c' },
                      ].map(l => (
                        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: l.bg }} />
                          <span style={{ color: l.color, fontWeight: 700 }}>{l.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'right' as const }}>
                  Showing <strong style={{ color: 'var(--txt)' }}>{filteredResults.length}</strong> result records ·{' '}
                  Band: <strong style={{ color: 'var(--brand)' }}>{analyticsFilter.replace(/_/g, ' ')}</strong>
                  {analyticsSubject && ` · ${subjectMap.get(analyticsSubject) ?? ''}`}
                  {analyticsClass   && ` · ${classMap.get(analyticsClass) ?? ''}`}
                  {analyticsTerm    && ` · T${analyticsTerm}`}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
