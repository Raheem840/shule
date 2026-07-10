import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useExamJournalById, usePublishJournal, isJournalLocked, MARKS_GRACE_PERIOD_DAYS } from '../../hooks/useExamJournal'
import { useExamResults, useSaveMarks } from '../../hooks/useExamResults'
import { useStudents } from '../../hooks/useStudents'
import { useSubjects } from '../../hooks/useClasses'
import { calculateCBCGrade } from '../../types/app'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Modal } from '../../components/ui/Modal'
import {
  ImportWizard,
  type ColumnSpec,
  type ParsedRow,
  type ImportResult,
  type ConflictStrategy,
} from '../../components/shared/ImportWizard'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ReportCardCalcExplainer } from '../../components/shared/ReportCardCalcExplainer'
import type { Student } from '../../types/app'
import type { MarkRow } from '../../hooks/useExamResults'

// Supabase throws its raw PostgrestError (a plain { message, details, hint,
// code } object) rather than a real Error instance, so `e instanceof Error`
// is false for the most common failure case and masked the actual reason
// behind a generic fallback in every catch block below.
function getErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message
  }
  return fallback
}

// ── Mark import field specs ────────────────────────────────────
// A function of totalMarks so the Score validator can flag an out-of-range
// value in the preview step itself, matching handleMarkImport's own check —
// otherwise a score exceeding the journal's total would show "valid" in the
// editable preview and only fail later, at the actual import call.
function buildMarkRequiredFields(totalMarks: number): ColumnSpec[] {
  return [
    {
      key:      'admission_number',
      label:    'Admission No.',
      required: true,
      hint:     'Must match the student admission number exactly',
      example:  'KJA/2025/001',
    },
    {
      key:      'score',
      label:    'Score',
      required: false,
      hint:     `Numeric score between 0 and ${totalMarks} — leave blank if the student has no mark yet (didn't sit it, or hasn't been graded), or mark them Absent instead`,
      example:  '72',
      validate: (v: string) => {
        // Blank is a valid, meaningful value here (see handleMarkImport) —
        // only validate when something was actually entered.
        if (v.trim() === '') return null
        const n = Number(v)
        if (isNaN(n) || n < 0) return 'Score must be a positive number'
        if (n > totalMarks) return `Score must not exceed ${totalMarks}`
        return null
      },
    },
  ]
}

const MARK_OPTIONAL_FIELDS: ColumnSpec[] = [
  {
    key:      'is_absent',
    label:    'Absent',
    required: false,
    hint:     'TRUE if the student missed the paper — leave blank/FALSE otherwise. A blank Score with this left blank just means no mark yet, and that student is skipped rather than recorded as 0.',
    example:  'FALSE',
  },
  {
    key:      'remarks',
    label:    'Remarks',
    required: false,
    example:  'Excellent performance',
  },
]

// ── Grade helpers ──────────────────────────────────────────────
const GRADE_COLORS: Record<string, string> = {
  A: '#10b981', B: '#0ea5e9', C: '#f59e0b', D: '#f59e0b', E: '#f43f5e',
}
const GRADE_LABEL: Record<string, string> = {
  A: 'Exceptional', B: 'Outstanding', C: 'Satisfactory', D: 'Basic', E: 'Elementary',
}

function CAScoreInput({ value, onChange, disabled, fullWidth }: {
  value:      number | null
  onChange:   (v: number) => void
  disabled:   boolean
  fullWidth?: boolean
}) {
  return (
    <input
      type="number" min={0} max={3} step={0.1}
      value={value ?? ''}
      disabled={disabled}
      placeholder="0–3"
      onChange={e => {
        if (e.target.value.endsWith('.')) return
        const v = e.target.value === '' ? null : parseFloat(e.target.value)
        if (v === null) return
        if (isNaN(v)) return
        onChange(v)
      }}
      style={{
        width: fullWidth ? '100%' : 80, maxWidth: fullWidth ? undefined : 80,
        padding: '10px 8px', border: '.5px solid var(--border)', borderRadius: 8,
        fontSize: 16, fontFamily: 'var(--font3)',
        background: disabled ? 'var(--surface2)' : 'var(--surface)', color: 'var(--txt)',
        boxSizing: 'border-box',
      }}
    />
  )
}

function ScoreDistChart({ marks, totalMarks, passMark, isCA }: {
  marks:      Map<string, { score: number | null; isAbsent: boolean }>
  totalMarks: number; passMark: number; isCA: boolean
}) {
  const { bucketData, refX } = useMemo(() => {
    const scores = Array.from(marks.values())
      .filter(m => !m.isAbsent && m.score !== null)
      .map(m => m.score as number)

    if (isCA) {
      const counts = [0, 1, 2, 3].map(v => ({ range: String(v), count: scores.filter(s => s === v).length }))
      return { bucketData: counts, refX: String(passMark) }
    }

    const step = totalMarks <= 20 ? 5 : 10
    const buckets: { range: string; min: number; count: number }[] = []
    for (let min = 0; min < totalMarks; min += step) {
      const max = Math.min(min + step - 0.5, totalMarks)
      buckets.push({ range: `${min}–${Math.floor(max)}`, min, count: scores.filter(s => s >= min && s <= max).length })
    }
    const refBucket = buckets.find((b, idx) => {
      const nextMin = buckets[idx + 1]?.min ?? Infinity
      return b.min <= passMark && passMark < nextMin
    })
    return { bucketData: buckets, refX: refBucket?.range }
  }, [marks, totalMarks, isCA, passMark])

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 8, fontFamily: 'var(--font2)' }}>Score Distribution</div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={bucketData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '.5px solid var(--border)', fontSize: 12, borderRadius: 8 }} />
          {refX && (
            <ReferenceLine x={refX} stroke="var(--danger)" strokeDasharray="4 2"
              label={{ value: 'Pass', position: 'insideTopLeft', fontSize: 10, fill: 'var(--danger)' }} />
          )}
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {bucketData.map((entry, i) => {
              const passes = isCA ? Number(entry.range) >= passMark : 'min' in entry && (entry as { min: number }).min >= passMark
              return <Cell key={i} fill={passes ? '#10b981' : '#f43f5e'} />
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

const GRADE_TABS = [
  { key: 'exceptional',       label: 'Exceptional', grades: ['A'],      color: '#10b981', bg: 'rgba(16,185,129,.1)'  },
  { key: 'passed',            label: 'Passed',      grades: ['B', 'C'], color: '#0ea5e9', bg: 'rgba(14,165,233,.1)'  },
  { key: 'needs_improvement', label: 'Needs Impr.', grades: ['D'],      color: '#f59e0b', bg: 'rgba(245,158,11,.1)'  },
  { key: 'poor',              label: 'Poor',        grades: ['E'],      color: '#f43f5e', bg: 'rgba(244,63,94,.1)'   },
]

function GradeTabs({ marks, students, totalMarks, isCA }: {
  marks:      Map<string, { score: number | null; isAbsent: boolean }>
  students:   Student[]; totalMarks: number; isCA: boolean
}) {
  const [activeTab, setActiveTab] = useState<string>('exceptional')

  const studentsByBucket = useMemo(() => {
    const buckets = new Map<string, Array<{ student: Student; score: number; grade: string }>>()
    for (const tab of GRADE_TABS) buckets.set(tab.key, [])
    for (const student of students) {
      const m = marks.get(student.id)
      if (!m || m.isAbsent || m.score === null) continue
      const pct   = isCA ? (m.score / 3) * 100 : (m.score / totalMarks) * 100
      const grade = calculateCBCGrade(pct)
      for (const tab of GRADE_TABS) {
        if (tab.grades.includes(grade)) {
          const list = buckets.get(tab.key) ?? []
          list.push({ student, score: m.score, grade })
          buckets.set(tab.key, list)
          break
        }
      }
    }
    return buckets
  }, [marks, students, totalMarks, isCA])

  const tabData     = GRADE_TABS.find(t => t.key === activeTab)!
  const tabStudents = studentsByBucket.get(activeTab) ?? []

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {GRADE_TABS.map(tab => {
          const count  = studentsByBucket.get(tab.key)?.length ?? 0
          const active = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '6px 13px', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font2)', cursor: 'pointer',
                background: active ? tab.bg : 'transparent',
                color: active ? tab.color : 'var(--txt3)',
                border: `.5px solid ${active ? tab.color + '60' : 'var(--border)'}`,
                borderRadius: 8 }}>
              {tab.label} ({count})
            </button>
          )
        })}
      </div>
      {tabStudents.length === 0 ? (
        <div style={{ color: 'var(--txt3)', fontSize: 13, padding: '8px 0' }}>No students in this category.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabStudents.map(({ student, score, grade }) => (
            <div key={student.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 12px', background: 'var(--surface2)', borderRadius: 9, fontSize: 13 }}>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--txt)' }}>{student.firstName} {student.lastName}</span>
              <span style={{ fontFamily: 'var(--font3)', color: 'var(--txt2)', fontWeight: 700 }}>{score}</span>
              <span style={{ padding: '2px 9px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: tabData.bg, color: tabData.color }}>{grade} — {GRADE_LABEL[grade]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Analytics filter types ─────────────────────────────────────
type AnalyticsFilter = 'all' | 'top10' | 'proficient' | 'needs_help' | 'can_improve' | 'absent'

const ANALYTICS_FILTERS: { key: AnalyticsFilter; label: string }[] = [
  { key: 'all',         label: 'All'         },
  { key: 'top10',       label: 'Top 10'      },
  { key: 'proficient',  label: 'Proficient'  },
  { key: 'needs_help',  label: 'Needs Help'  },
  { key: 'can_improve', label: 'Can Improve' },
  { key: 'absent',      label: 'Absent'      },
]

// Chart colours per grade — kept outside design tokens intentionally (grade semantics)
const DIST_GRADE_COLORS: Record<string, string> = {
  A: '#10b981',
  B: '#0d9488',
  C: '#0ea5e9',
  D: '#f59e0b',
  E: '#f43f5e',
  Absent: '#94a3b8',
}

const RANGE_COLOR: Record<string, string> = {
  '80–100': '#10b981',
  '70–79':  '#0d9488',
  '60–69':  '#0ea5e9',
  '50–59':  '#f59e0b',
  '0–49':   '#f43f5e',
}

type StudentResult = {
  student:  Student
  score:    number | null
  isAbsent: boolean
  grade:    string | null  // null for absent / not entered
  pct:      number | null  // percentage (0–100), null if absent
}

// Custom tooltip for grade bar chart
function GradeTooltip({ active, payload, totalCount }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { grade: string } }>
  totalCount: number
}) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const pct   = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 4 }}>
        Grade {payload[0].payload.grade}
      </div>
      <div style={{ color: 'var(--txt2)' }}>{count} student{count !== 1 ? 's' : ''}</div>
      <div style={{ color: 'var(--txt3)', fontSize: 11 }}>{pct}% of filtered group</div>
    </div>
  )
}

// Custom tooltip for score range chart
function RangeTooltip({ active, payload, totalCount }: {
  active?: boolean
  payload?: Array<{ value: number; payload: { range: string } }>
  totalCount: number
}) {
  if (!active || !payload?.length) return null
  const count = payload[0].value
  const pct   = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
      <div style={{ fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 4 }}>
        {payload[0].payload.range}
      </div>
      <div style={{ color: 'var(--txt2)' }}>{count} student{count !== 1 ? 's' : ''}</div>
      <div style={{ color: 'var(--txt3)', fontSize: 11 }}>{pct}% of filtered group</div>
    </div>
  )
}

function PerformanceAnalytics({ marks, students, totalMarks, isCA }: {
  marks:      Map<string, { score: number | null; isAbsent: boolean }>
  students:   Student[]
  totalMarks: number
  isCA:       boolean
}) {
  const [activeFilter, setActiveFilter] = useState<AnalyticsFilter>('all')

  // Build full result list from marks + students
  const allResults = useMemo<StudentResult[]>(() => {
    return students.map(student => {
      const m = marks.get(student.id)
      if (!m) return { student, score: null, isAbsent: false, grade: null, pct: null }
      if (m.isAbsent) return { student, score: null, isAbsent: true, grade: null, pct: null }
      if (m.score === null) return { student, score: null, isAbsent: false, grade: null, pct: null }
      const pct   = isCA ? (m.score / 3) * 100 : (m.score / totalMarks) * 100
      const grade = calculateCBCGrade(pct)
      return { student, score: m.score, isAbsent: false, grade, pct }
    })
  }, [marks, students, totalMarks, isCA])

  // Check if there is any data worth showing — computed here but the early
  // return happens after every hook below has run (Rules of Hooks): this
  // component previously `return`ed null right here, before the useMemo
  // calls for filtered/kpis/gradeDistData/rangeDistData further down, so the
  // very first score entered on an empty journal (hasData flips false->true)
  // changed the hook count between renders and crashed with "Rendered more
  // hooks than during the previous render."
  const hasData = allResults.some(r => r.score !== null || r.isAbsent)

  // Apply filter
  const filtered = useMemo<StudentResult[]>(() => {
    switch (activeFilter) {
      case 'all':
        return allResults
      case 'top10': {
        const withScores = allResults
          .filter(r => r.score !== null && !r.isAbsent)
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        return withScores.slice(0, 10)
      }
      case 'proficient':
        return allResults.filter(r => r.grade === 'A' || r.grade === 'B')
      case 'needs_help':
        return allResults.filter(r => r.grade === 'E')
      case 'can_improve':
        return allResults.filter(r => r.grade === 'C' || r.grade === 'D')
      case 'absent':
        return allResults.filter(r => r.isAbsent)
      default:
        return allResults
    }
  }, [allResults, activeFilter])

  // KPI calculations over filtered set
  const kpis = useMemo(() => {
    const scoredRows  = filtered.filter(r => r.score !== null && !r.isAbsent)
    const scores      = scoredRows.map(r => r.score as number)
    const absentCount = filtered.filter(r => r.isAbsent).length
    const passCount   = scoredRows.filter(r => (r.pct ?? 0) >= 50).length

    if (scores.length === 0) {
      return { avg: null, highest: null, lowest: null, passRate: null, absentCount }
    }

    const avg      = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    const highest  = Math.max(...scores)
    const lowest   = Math.min(...scores)
    const passRate = Math.round((passCount / scores.length) * 100)
    return { avg, highest, lowest, passRate, absentCount }
  }, [filtered])

  // Grade distribution bar chart data
  const gradeDistData = useMemo(() => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, E: 0, Absent: 0 }
    for (const r of filtered) {
      if (r.isAbsent) { counts['Absent']++; continue }
      if (r.grade) counts[r.grade] = (counts[r.grade] ?? 0) + 1
    }
    return Object.entries(counts).map(([grade, count]) => ({ grade, count }))
  }, [filtered])

  // Score range distribution data (percentage-based buckets, works for CA too)
  const rangeDistData = useMemo(() => {
    const buckets = [
      { range: '80–100', min: 80, max: 100, count: 0 },
      { range: '70–79',  min: 70, max: 79,  count: 0 },
      { range: '60–69',  min: 60, max: 69,  count: 0 },
      { range: '50–59',  min: 50, max: 59,  count: 0 },
      { range: '0–49',   min: 0,  max: 49,  count: 0 },
    ]
    for (const r of filtered) {
      if (r.isAbsent || r.pct === null) continue
      const bucket = buckets.find(b => r.pct! >= b.min && r.pct! <= b.max)
      if (bucket) bucket.count++
    }
    return buckets
  }, [filtered])

  // CSV export of filtered data
  function exportCSV() {
    const rows: string[] = ['Name,Admission No.,Score,Grade,Absent']
    for (const r of filtered) {
      const name  = `"${r.student.firstName} ${r.student.lastName}"`
      const adm   = r.student.admissionNumber
      const score = r.isAbsent ? '' : (r.score ?? '')
      const grade = r.isAbsent ? 'Absent' : (r.grade ?? '')
      const abs   = r.isAbsent ? 'Yes' : 'No'
      rows.push(`${name},${adm},${score},${grade},${abs}`)
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `performance_${activeFilter}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredScoredCount = filtered.filter(r => r.score !== null && !r.isAbsent).length

  if (!hasData) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: 24,
      marginTop: 4,
    }}>
      {/* Header ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'var(--brand-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 17, color: 'var(--txt)', margin: 0, letterSpacing: -.3 }}>
              Performance Analytics
            </h2>
            <p style={{ fontSize: 12, color: 'var(--txt3)', margin: 0, marginTop: 1 }}>
              {filtered.length} student{filtered.length !== 1 ? 's' : ''} · filtered view
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ANALYTICS_FILTERS.map(f => {
              const active = activeFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  style={{
                    background:   active ? 'var(--brand)' : 'var(--surface)',
                    color:        active ? '#fff' : 'var(--txt2)',
                    border:       active ? '1.5px solid var(--brand)' : '1.5px solid var(--border)',
                    borderRadius: 99,
                    padding:      '6px 16px',
                    fontWeight:   700,
                    fontSize:     12,
                    fontFamily:   'var(--font2)',
                    cursor:       'pointer',
                    transition:   'background .15s, color .15s, border-color .15s',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>

          {/* Export button */}
          <button
            onClick={exportCSV}
            title="Export filtered data as CSV"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 13px', borderRadius: 99,
              border: '1.5px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--txt2)', fontWeight: 700, fontSize: 12,
              fontFamily: 'var(--font2)', cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'border-color .15s, color .15s',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI chips ───────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {[
          {
            label: 'Class Average',
            value: kpis.avg !== null ? kpis.avg.toString() : '—',
            sub:   `out of ${totalMarks}`,
            accent: 'var(--brand)',
          },
          {
            label: 'Highest Score',
            value: kpis.highest !== null ? kpis.highest.toString() : '—',
            sub:   'top performer',
            accent: '#10b981',
          },
          {
            label: 'Lowest Score',
            value: kpis.lowest !== null ? kpis.lowest.toString() : '—',
            sub:   'needs attention',
            accent: '#f43f5e',
          },
          {
            label: 'Pass Rate',
            value: kpis.passRate !== null ? `${kpis.passRate}%` : '—',
            sub:   `${filteredScoredCount > 0 ? Math.round(((kpis.passRate ?? 0) / 100) * filteredScoredCount) : 0} of ${filteredScoredCount}`,
            accent: kpis.passRate !== null && kpis.passRate >= 70 ? '#10b981' : '#f59e0b',
          },
          {
            label: 'Absent',
            value: kpis.absentCount.toString(),
            sub:   kpis.absentCount === 1 ? 'student' : 'students',
            accent: '#94a3b8',
          },
        ].map(chip => (
          <div
            key={chip.label}
            style={{
              flex: '1 1 120px',
              background:   'var(--surface2)',
              border:       '1px solid var(--border)',
              borderRadius: 14,
              padding:      '16px 20px',
              minWidth:     110,
            }}
          >
            <div style={{
              fontSize:    28,
              fontWeight:  800,
              fontFamily:  'var(--font2)',
              color:       chip.accent,
              lineHeight:  1,
              marginBottom: 6,
              letterSpacing: -.5,
            }}>
              {chip.value}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)', marginBottom: 2 }}>
              {chip.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{chip.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

        {/* Grade distribution */}
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 16px',
        }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, color: 'var(--txt)', marginBottom: 4 }}>
            Grade Distribution
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 14 }}>
            Count per grade band
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={gradeDistData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="grade"
                tick={{ fontSize: 11, fill: 'var(--txt2)', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={props => (
                  <GradeTooltip
                    active={props.active}
                    payload={props.payload as unknown as Array<{ value: number; payload: { grade: string } }> | undefined}
                    totalCount={filtered.length}
                  />
                )}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {gradeDistData.map((entry, i) => (
                  <Cell key={i} fill={DIST_GRADE_COLORS[entry.grade] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Score range distribution */}
        <div style={{
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '18px 16px',
        }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, color: 'var(--txt)', marginBottom: 4 }}>
            Score Spread
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 14 }}>
            Percentage-based bands (present only)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rangeDistData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 10, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 10, fill: 'var(--txt3)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={props => (
                  <RangeTooltip
                    active={props.active}
                    payload={props.payload as unknown as Array<{ value: number; payload: { range: string } }> | undefined}
                    totalCount={filteredScoredCount}
                  />
                )}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={44}>
                {rangeDistData.map((entry, i) => (
                  <Cell key={i} fill={RANGE_COLOR[entry.range] ?? '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Mini grade legend */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {Object.entries(RANGE_COLOR).map(([range, color]) => (
              <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--txt3)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                {range}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Empty state for active filter */}
      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--txt3)', fontSize: 13, fontFamily: 'var(--font2)',
        }}>
          No students match the <strong style={{ color: 'var(--txt2)' }}>{ANALYTICS_FILTERS.find(f => f.key === activeFilter)?.label}</strong> filter.
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export function MarkEntryPage() {
  const { journalId }   = useParams<{ journalId: string }>()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const isMobile        = useIsMobile()
  const { user }        = useAuth()
  const { error: toastErr } = useToast()

  const { data: journal, isLoading: journalLoading } = useExamJournalById(journalId)
  const { data: savedResults = [] }                   = useExamResults(journalId)
  const { data: subjects = [] }                       = useSubjects()
  const saveMarks                                     = useSaveMarks()
  const publish                                       = usePublishJournal()

  const { data: students = [], isLoading: studentsLoading } = useStudents(
    { classId: journal?.classId, streamId: journal?.streamId ?? undefined, status: 'active' },
    !!journal,
  )

  const [marks, setMarks]       = useState<Map<string, { score: number | null; isAbsent: boolean }>>(new Map())
  const [saved, setSaved]       = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const deepLinkImportHandled = useRef(false)

  // Clicking a journal card (rather than its "Enter/Edit Marks" button)
  // lands here in a read-only browsing view — inputs disabled, Save/
  // Publish/Import hidden, with a single "Edit" button to switch into the
  // normal editable view. Purely a UI-level view/edit toggle, independent
  // of the separate lock/grace-period mechanism below.
  const [browsingReadOnly, setBrowsingReadOnly] = useState(searchParams.get('view') === '1')

  // DOS/principal reach this page purely to inspect a journal — they never
  // own the marks, so they get no escape hatch out of read-only, unlike the
  // owning teacher who can toggle Edit back on.
  const canEditMarks = user?.role === 'teacher' || user?.role === 'class_teacher'

  // ── Provisional / locked results ────────────────────────────
  // A published journal stays freely editable for MARKS_GRACE_PERIOD_DAYS —
  // after that, saving or importing a correction requires a reason (audited).
  const locked = journal ? isJournalLocked(journal) : false
  const [showReasonModal, setShowReasonModal] = useState<'save' | 'import' | null>(null)
  const [overrideReason, setOverrideReason]   = useState('')
  const [overrideError, setOverrideError]     = useState<string | null>(null)

  useEffect(() => {
    if (savedResults.length === 0) return
    setMarks(prev => {
      const next = new Map(prev)
      for (const r of savedResults) {
        next.set(r.studentId, { score: r.score, isAbsent: r.isAbsent })
      }
      return next
    })
  }, [savedResults])

  const setMark = useCallback((studentId: string, score: number | null, isAbsent: boolean) => {
    setMarks(prev => new Map(prev).set(studentId, { score, isAbsent }))
    setSaved(false)
  }, [])

  const isCA        = journal?.assessmentType === 'ca'
  const isEndOfTerm = journal?.assessmentType === 'end_of_term'
  const totalMarks  = journal?.totalMarks ?? 100
  const passMark    = journal?.passMark ?? 50
  const markRequiredFields = useMemo(() => buildMarkRequiredFields(totalMarks), [totalMarks])

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirt   = useVirtualizer({
    count:            students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => isMobile ? 100 : 48,
    overscan:         8,
  })

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))

  const enteredCount  = Array.from(marks.values()).filter(m => m.score !== null || m.isAbsent).length
  const missingCount  = students.length - enteredCount
  const absentCount   = Array.from(marks.values()).filter(m => m.isAbsent).length

  async function handleSaveAll(reason?: string) {
    if (!journal) return
    if (locked && !reason) { setOverrideError(null); setShowReasonModal('save'); return }
    const rows: MarkRow[] = students.map(s => {
      const m = marks.get(s.id) ?? { score: null, isAbsent: false }
      return { studentId: s.id, score: m.score, isAbsent: m.isAbsent }
    })
    try {
      await saveMarks.mutateAsync({
        journalId:      journal.id,
        subjectId:      journal.subjectId,
        assessmentType: journal.assessmentType,
        totalMarks:     journal.totalMarks,
        term:           journal.term,
        year:           journal.year,
        marks:          rows,
        overrideReason: reason,
      })
      setSaved(true)
      setShowReasonModal(null)
      setOverrideReason('')
    } catch (e) {
      const msg = getErrorMessage(e, 'Save failed')
      // The client's `locked` flag is computed from a possibly-stale cached
      // journal — if the journal actually crossed the grace-period boundary
      // between page load and this click, `locked` was still false, no
      // reason modal was shown, and useSaveMarks's live re-check is the one
      // that just rejected it. Recover by opening the reason modal now
      // (branching on the error itself, not on whether the modal happened to
      // already be open) rather than leaving the teacher stuck with a
      // generic error banner and no way to provide a reason short of a
      // page refresh.
      if (msg.toLowerCase().includes('locked')) {
        setOverrideError(reason ? msg : null)
        setShowReasonModal('save')
        return
      }
      if (reason) setOverrideError(msg)
      else throw e
    }
  }

  async function handlePublish() {
    if (!journal) return
    // handleSaveAll can throw for reasons unrelated to the lock/reason gate
    // (e.g. a genuine save failure) — previously that exception propagated
    // straight out through `void handlePublish()` at the call site and was
    // silently swallowed, so a failed publish looked identical to a
    // successful one: no error, no status change, no visible feedback.
    try {
      await handleSaveAll()
      await publish.mutateAsync(journal.id)
    } catch (e) {
      const msg = getErrorMessage(e, 'Failed to publish this journal')
      toastErr(msg)
    }
  }

  function handleImportClick() {
    if (locked) { setOverrideError(null); setShowReasonModal('import'); return }
    setImportOpen(true)
  }

  // ExamJournalPage links here with ?import=1 to jump straight into the
  // import wizard. That must go through the same lock gate as the in-page
  // button — routing it through handleImportClick (rather than opening the
  // wizard directly from useState's initializer, which ran before `journal`
  // had loaded and so couldn't know whether the journal was locked) closes
  // a gap where a locked journal's import wizard opened with no reason prompt.
  useEffect(() => {
    if (deepLinkImportHandled.current) return
    if (searchParams.get('import') !== '1' || !journal) return
    deepLinkImportHandled.current = true
    handleImportClick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal, searchParams])

  function confirmOverrideReason() {
    const reason = overrideReason.trim()
    if (!reason) { setOverrideError('A reason is required to edit locked results.'); return }
    setOverrideError(null)
    if (showReasonModal === 'save') {
      setShowReasonModal(null)
      void handleSaveAll(reason)
    } else if (showReasonModal === 'import') {
      setShowReasonModal(null)
      setImportOpen(true)
    }
  }

  // ── Bulk mark import via ImportWizard ──────────────────────
  // Routes through useSaveMarks rather than its own upsert — that hook
  // already owns the live lock re-check, 100-row batching, grade calc, and
  // audited override write. An earlier version reimplemented all of that
  // here by hand, and the two copies had already drifted (a stricter
  // teacher_id fallback in one, no batching in the other, slightly
  // different audit_log payload shapes) — one code path for both entry
  // methods keeps them impossible to disagree.
  const ABSENT_TRUE_VALUES = new Set(['true', 'yes', 'y', '1'])

  async function handleMarkImport(
    rows: ParsedRow[],
    _strategy: ConflictStrategy,
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: [] }
    if (!journal || !user || rows.length === 0) return result

    const admMap = new Map(students.map(s => [s.admissionNumber.trim().toLowerCase(), s.id]))
    const validRows: MarkRow[] = []

    rows.forEach((row, idx) => {
      const adm = (row.admission_number ?? '').trim().toLowerCase()
      const studentId = admMap.get(adm)
      // Student not found in this class/stream — tell the teacher via
      // result.failed (surfaced in the wizard's results step) but keep
      // processing every other row rather than aborting the whole import.
      if (!studentId) {
        result.failed.push({ row: idx + 1, reason: `Student not found: "${row.admission_number}"` })
        return
      }

      const absent    = ABSENT_TRUE_VALUES.has((row.is_absent ?? '').trim().toLowerCase())
      const rawScore  = (row.score ?? '').trim()

      if (absent) {
        validRows.push({ studentId, score: null, isAbsent: true })
        return
      }

      // A blank score (and no Absent flag) means "no mark for this student
      // yet" — not a score of 0, and not an error. Skip the row so it
      // doesn't overwrite anything already saved for them; Number('') === 0
      // would otherwise silently record a real zero score here.
      if (rawScore === '') {
        result.skipped++
        return
      }

      const scoreNum = Number(rawScore)
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > journal.totalMarks) {
        result.failed.push({ row: idx + 1, reason: `Invalid score: "${row.score}" (max ${journal.totalMarks})` })
        return
      }
      validRows.push({ studentId, score: scoreNum, isAbsent: false })
    })

    if (validRows.length === 0) return result

    try {
      await saveMarks.mutateAsync({
        journalId:      journal.id,
        subjectId:      journal.subjectId,
        assessmentType: journal.assessmentType,
        totalMarks:     journal.totalMarks,
        term:           journal.term,
        year:           journal.year,
        marks:          validRows,
        overrideReason,
      })
      result.imported = validRows.length
    } catch (e) {
      const reason = getErrorMessage(e, 'Import failed')
      validRows.forEach((_, i) => result.failed.push({ row: i + 1, reason }))
    }

    return result
  }

  if (journalLoading || studentsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <LoadingSpinner size={32} />
      </div>
    )
  }

  if (!journal) {
    return (
      <div style={{ padding: 24, color: 'var(--danger)' }}>
        Journal not found.
        <button onClick={() => navigate('/teacher/exams')} style={{ marginLeft: 12, padding: '6px 14px', borderRadius: 8, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 13 }}>Back</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button onClick={() => navigate('/teacher/exams')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 12.5, padding: 0, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, fontFamily: 'var(--font2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Journal
          </button>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', letterSpacing: -.4 }}>
            {subjectMap.get(journal.subjectId) ?? journal.subjectId}
            {journal.caLabel && <span style={{ marginLeft: 8, color: 'var(--brand)', fontSize: 16 }}>{journal.caLabel}</span>}
          </div>
          <div style={{ color: 'var(--txt3)', fontSize: 12.5, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: 'var(--surface2)', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>{journal.assessmentType.replace(/_/g, ' ')}</span>
            <span>Term {journal.term} {journal.year}</span>
            <span>Total: <strong>{totalMarks}</strong></span>
            <span>Pass: <strong>{passMark}</strong></span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)', minWidth: 0, flexShrink: 1 }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{enteredCount}</span>/{students.length} entered
            {missingCount > 0 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>· {missingCount} missing</span>}
            {absentCount  > 0 && <span style={{ color: 'var(--info)',    marginLeft: 8 }}>· {absentCount} absent</span>}
          </div>

          {browsingReadOnly && !canEditMarks && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'var(--surface2)', border: '.5px solid var(--border)', color: 'var(--txt3)', fontWeight: 700, fontSize: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Read-only view
            </span>
          )}
          {browsingReadOnly && canEditMarks ? (
            <button onClick={() => setBrowsingReadOnly(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.35)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Edit
            </button>
          ) : (
            <>
              {/* Import Marks button */}
              <button
                onClick={handleImportClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 14px', borderRadius: 10,
                  border: '.5px solid rgba(13,148,136,.35)',
                  background: 'rgba(13,148,136,.06)',
                  color: 'var(--brand)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
                </svg>
                {enteredCount > 0 ? 'Edit Marks' : 'Import Marks'}
              </button>

              <button onClick={() => void handleSaveAll()} disabled={saveMarks.isPending}
                style={{ padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: saved ? 'rgba(16,185,129,.1)' : 'var(--surface2)', color: saved ? '#065f46' : 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saveMarks.isPending ? 'Saving…' : saved ? '✓ Saved' : locked ? 'Save (locked)' : 'Save All'}
              </button>
              {journal.status === 'draft' && (
                <button onClick={() => void handlePublish()} disabled={publish.isPending || saveMarks.isPending}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.35)' }}>
                  {publish.isPending ? 'Publishing…' : 'Publish'}
                </button>
              )}
            </>
          )}
          {journal.status === 'published' && !locked && (
            <span title={`Editable without a reason for ${MARKS_GRACE_PERIOD_DAYS} days after publishing`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(14,165,233,.1)', color: '#0369a1' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)' }} /> Provisional
            </span>
          )}
          {journal.status === 'published' && locked && (
            <span title="Past the grace period — edits now require a reason, logged to the audit trail"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(244,63,94,.1)', color: 'var(--danger)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Locked
            </span>
          )}
        </div>
      </div>

      {locked && (
        <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.2)', borderRadius: 10, fontSize: 12.5, color: 'var(--danger)' }}>
          These results have been final for over {MARKS_GRACE_PERIOD_DAYS} days. Any further correction needs a reason, which is recorded in the school's audit log.
        </div>
      )}

      {saveMarks.isError && (
        <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', borderRadius: 10, fontSize: 13 }}>
          {(saveMarks.error as Error).message}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
        {/* Desktop column headers */}
        {!isMobile && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isCA ? '140px 1fr 120px 60px' : '140px 1fr 160px 60px 80px',
            background: 'var(--surface2)', borderBottom: '.5px solid var(--border)',
            padding: '11px 16px',
            fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
            textTransform: 'uppercase', letterSpacing: .7, fontFamily: 'var(--font2)',
          }}>
            <div>Adm. No</div>
            <div>Student Name</div>
            <div>{isCA ? 'Score (0–3)' : `Score (/ ${totalMarks})`}</div>
            <div>Absent</div>
            {!isCA && <div>Grade</div>}
          </div>
        )}

        <div ref={parentRef} style={{ maxHeight: isMobile ? 'calc(100dvh - 360px)' : 420, overflowY: 'auto' }}>
          <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
            {rowVirt.getVirtualItems().map(vRow => {
              const student  = students[vRow.index]
              const markData = marks.get(student.id) ?? { score: null, isAbsent: false }
              const { score, isAbsent } = markData

              let displayGrade: string | null = null
              if (!isAbsent && score !== null && !isEndOfTerm) {
                const pct = isCA ? (score / 3) * 100 : (score / totalMarks) * 100
                displayGrade = calculateCBCGrade(pct)
              }

              const hasWarning = !isAbsent && score !== null && score > totalMarks
              const isMissing  = !isAbsent && score === null

              if (isMobile) {
                /* ── Mobile: one card per student ── */
                return (
                  <div key={student.id} style={{
                    position: 'absolute', top: vRow.start, left: 0, right: 0, height: vRow.size,
                    padding: '8px 16px', borderBottom: '.5px solid var(--border)',
                    background: isAbsent ? 'rgba(14,165,233,.04)' : hasWarning ? 'rgba(245,158,11,.05)' : 'transparent',
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6,
                  }}>
                    {/* Row 1: name */}
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {student.firstName} {student.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                      {student.admissionNumber}
                      {displayGrade && (
                        <span style={{ marginLeft: 8, padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, background: GRADE_COLORS[displayGrade] + '20', color: GRADE_COLORS[displayGrade] }}>
                          {displayGrade}
                        </span>
                      )}
                    </div>
                    {/* Row 2: mark entry + missed-exam toggle, side by side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isAbsent && (
                        isCA ? (
                          <CAScoreInput value={score} onChange={v => setMark(student.id, v, false)} disabled={browsingReadOnly} fullWidth />
                        ) : (
                          <input
                            type="number" min={0} max={totalMarks} step={0.5}
                            value={score ?? ''}
                            disabled={browsingReadOnly}
                            onChange={e => {
                              if (e.target.value.endsWith('.')) return
                              const v = e.target.value === '' ? null : parseFloat(e.target.value)
                              if (v !== null && isNaN(v)) return
                              setMark(student.id, v, false)
                            }}
                            placeholder={`Score / ${totalMarks}`}
                            style={{
                              flex: 1, padding: '10px 14px', border: `.5px solid ${hasWarning ? 'var(--warning)' : 'var(--border)'}`,
                              borderRadius: 10, fontSize: 16, fontFamily: 'var(--font3)',
                              background: browsingReadOnly ? 'var(--surface2)' : 'var(--surface)', color: 'var(--txt)', boxSizing: 'border-box',
                            }}
                          />
                        )
                      )}
                      <button
                        type="button"
                        disabled={browsingReadOnly}
                        onClick={() => setMark(student.id, null, !isAbsent)}
                        title="Mark absent — if they redo the paper later, tap again and enter the real score"
                        style={{
                          flex: isAbsent ? 1 : undefined, flexShrink: 0, padding: '10px 14px', borderRadius: 10, border: '.5px solid',
                          borderColor: isAbsent ? 'var(--info)' : 'var(--border)',
                          background: isAbsent ? 'rgba(14,165,233,.1)' : 'var(--surface2)',
                          color: isAbsent ? 'var(--info)' : 'var(--txt3)',
                          fontSize: 12, fontWeight: 700, cursor: browsingReadOnly ? 'default' : 'pointer',
                          opacity: browsingReadOnly ? 0.6 : 1,
                        }}
                      >
                        {isAbsent ? 'ABSENT — tap to undo' : 'Missed exam?'}
                      </button>
                    </div>
                    {hasWarning && <span style={{ fontSize: 11, color: 'var(--warning)' }}>Score exceeds max ({totalMarks})</span>}
                  </div>
                )
              }

              /* ── Desktop: grid row ── */
              return (
                <div key={student.id} style={{
                  position: 'absolute', top: vRow.start, left: 0, right: 0, height: vRow.size,
                  display: 'grid',
                  gridTemplateColumns: isCA ? '140px 1fr 120px 60px' : '140px 1fr 160px 60px 80px',
                  alignItems: 'center', padding: '0 16px',
                  borderBottom: '.5px solid var(--border)',
                  background: hasWarning ? 'rgba(245,158,11,.05)' : isMissing ? 'rgba(14,165,233,.03)' : 'transparent',
                }}>
                  <div style={{ fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>{student.admissionNumber}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{student.firstName} {student.lastName}</div>

                  {isCA ? (
                    <CAScoreInput value={isAbsent ? null : score} onChange={v => setMark(student.id, v, false)} disabled={isAbsent || browsingReadOnly} />
                  ) : (
                    <div>
                      <input type="number" min={0} max={totalMarks} step={0.5}
                        value={isAbsent ? '' : (score ?? '')}
                        disabled={isAbsent || browsingReadOnly}
                        onChange={e => {
                          if (e.target.value.endsWith('.')) return
                          const v = e.target.value === '' ? null : parseFloat(e.target.value)
                          if (v !== null && isNaN(v)) return
                          setMark(student.id, v, false)
                        }}
                        style={{ width: '100%', maxWidth: 80, padding: '10px 8px', border: `.5px solid ${hasWarning ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 8, fontSize: 16, background: (isAbsent || browsingReadOnly) ? 'var(--surface2)' : 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font3)' }}
                      />
                      {hasWarning && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warning)' }}>Exceeds max</span>}
                    </div>
                  )}

                  <div>
                    <input type="checkbox" checked={isAbsent} disabled={browsingReadOnly} onChange={e => setMark(student.id, null, e.target.checked)}
                      title="Mark absent — if they redo the paper later, just uncheck this and enter the real score" style={{ width: 20, height: 20, cursor: browsingReadOnly ? 'default' : 'pointer', accentColor: 'var(--brand)' }} />
                  </div>

                  {!isCA && (
                    <div>
                      {displayGrade ? (
                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, background: GRADE_COLORS[displayGrade] + '20', color: GRADE_COLORS[displayGrade] }} title={GRADE_LABEL[displayGrade]}>
                          {displayGrade}
                        </span>
                      ) : isEndOfTerm ? (
                        <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile sticky action bar ── */}
      {isMobile && (
        browsingReadOnly ? (
          canEditMarks && (
            <div className="mob-action-bar">
              <button onClick={() => setBrowsingReadOnly(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.35)' }}>
                Edit
              </button>
            </div>
          )
        ) : (
          <div className="mob-action-bar">
            <button onClick={() => void handleSaveAll()} disabled={saveMarks.isPending}
              style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '.5px solid var(--border)', background: saved ? 'rgba(16,185,129,.1)' : 'var(--surface2)', color: saved ? '#065f46' : 'var(--txt2)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {saveMarks.isPending ? 'Saving…' : saved ? '✓ Saved' : locked ? 'Save (locked)' : 'Save All'}
            </button>
            {journal?.status === 'draft' && (
              <button onClick={() => void handlePublish()} disabled={saveMarks.isPending || publish.isPending}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.35)' }}>
                {publish.isPending ? 'Publishing…' : 'Publish'}
              </button>
            )}
          </div>
        )
      )}

      {/* ── Performance Analytics ──────────────────────────── */}
      {students.length > 0 && (
        <PerformanceAnalytics
          marks={marks}
          students={students}
          totalMarks={totalMarks}
          isCA={isCA}
        />
      )}

      {students.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <div style={{ padding: 20 }}>
            <ScoreDistChart marks={marks} totalMarks={totalMarks} passMark={passMark} isCA={isCA} />
            <div style={{ marginTop: 20, borderTop: '.5px solid var(--border)', paddingTop: 16 }}>
              <GradeTabs marks={marks} students={students} totalMarks={totalMarks} isCA={isCA} />
            </div>
          </div>
          {/* Only A/C (or whichever grades happen to occur in the marks
              entered so far) may show above — this is the full A-E scale
              reference, tucked away collapsed since it's a "why this grade"
              lookup, not something that needs to compete with the marks
              themselves. */}
          <ReportCardCalcExplainer />
        </div>
      )}

      {/* ── Import Marks Modal ─────────────────────────────── */}
      {importOpen && (
        <Modal
          title="Import Marks from Excel / CSV"
          size="lg"
          onClose={() => { setImportOpen(false); setOverrideReason('') }}
        >
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(14,165,233,.07)', border: '.5px solid rgba(14,165,233,.25)', borderRadius: 10, fontSize: 12.5, color: '#0369a1' }}>
            <strong>Template columns:</strong> Admission No. · Score · Absent (optional) · Remarks (optional).
            Scores must be between 0 and {totalMarks}. A blank Score row is skipped (no mark yet) unless Absent is TRUE.
            Any admission number not found in this class is skipped and listed after import — everyone else still gets saved.
          </div>
          <ImportWizard
            context="marks"
            requiredFields={markRequiredFields}
            optionalFields={MARK_OPTIONAL_FIELDS}
            editableFields={['score', 'is_absent']}
            onComplete={handleMarkImport}
            onClose={() => { setImportOpen(false); setOverrideReason('') }}
          />
        </Modal>
      )}

      {/* ── Locked-results override reason prompt ──────────── */}
      {showReasonModal && (
        <Modal
          title="Locked Results — Reason Required"
          size="sm"
          onClose={() => { setShowReasonModal(null); setOverrideReason(''); setOverrideError(null) }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0 }}>
              These results have been final for over {MARKS_GRACE_PERIOD_DAYS} days. Explain why this correction
              is needed — this reason is recorded in the school's audit log.
            </p>
            <textarea
              value={overrideReason}
              onChange={e => setOverrideReason(e.target.value)}
              placeholder="e.g. Student raised a marks complaint, re-checked script and found a tallying error"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '.5px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'var(--font1)', color: 'var(--txt)', background: 'var(--surface2)', boxSizing: 'border-box', resize: 'vertical' }}
            />
            {overrideError && (
              <div style={{ fontSize: 12.5, color: 'var(--danger)' }}>{overrideError}</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => { setShowReasonModal(null); setOverrideReason(''); setOverrideError(null) }}
                style={{ padding: '8px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={confirmOverrideReason} disabled={saveMarks.isPending}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {saveMarks.isPending ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
