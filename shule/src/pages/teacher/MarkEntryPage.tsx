import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQueryClient } from '@tanstack/react-query'
import { useExamJournalById, usePublishJournal } from '../../hooks/useExamJournal'
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
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import type { Student } from '../../types/app'
import type { MarkRow } from '../../hooks/useExamResults'

// ── Mark import field specs ────────────────────────────────────
const MARK_REQUIRED_FIELDS: ColumnSpec[] = [
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
    required: true,
    hint:     'Numeric score within the total marks range',
    example:  '72',
    validate: (v: string) => {
      const n = Number(v)
      if (isNaN(n) || n < 0) return 'Score must be a positive number'
      return null
    },
  },
]

const MARK_OPTIONAL_FIELDS: ColumnSpec[] = [
  {
    key:      'is_absent',
    label:    'Absent',
    required: false,
    hint:     'TRUE or FALSE — leave blank for present',
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

const CA_LABELS: Record<number, string> = { 0: 'None', 1: 'Basic', 2: 'Adequate', 3: 'Exceptional' }

function CAScoreInput({ value, onChange, disabled }: {
  value:    number | null
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[0, 1, 2, 3].map(n => (
        <button key={n} type="button" disabled={disabled} title={CA_LABELS[n]} onClick={() => onChange(n)}
          style={{
            width: 32, height: 28, border: '.5px solid',
            borderColor: value === n ? 'var(--brand)' : 'var(--border)',
            background:  value === n ? 'var(--brand)' : 'var(--surface2)',
            color:       value === n ? '#fff' : 'var(--txt2)',
            borderRadius: n === 0 ? '6px 0 0 6px' : n === 3 ? '0 6px 6px 0' : 0,
            fontFamily: 'var(--font3)', fontSize: 12, fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1, transition: 'background 0.1s, color 0.1s',
          }}>{n}</button>
      ))}
    </div>
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

// ── Main page ──────────────────────────────────────────────────
export function MarkEntryPage() {
  const { journalId }   = useParams<{ journalId: string }>()
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()
  const qc              = useQueryClient()
  const { user }        = useAuth()

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
  // Open import modal automatically when ?import=1 is present
  const [importOpen, setImportOpen] = useState(() => searchParams.get('import') === '1')

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

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirt   = useVirtualizer({
    count:            students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 48,
    overscan:         10,
  })

  const subjectMap = new Map(subjects.map(s => [s.id, s.name]))

  const enteredCount  = Array.from(marks.values()).filter(m => m.score !== null || m.isAbsent).length
  const missingCount  = students.length - enteredCount
  const absentCount   = Array.from(marks.values()).filter(m => m.isAbsent).length

  async function handleSaveAll() {
    if (!journal) return
    const rows: MarkRow[] = students.map(s => {
      const m = marks.get(s.id) ?? { score: null, isAbsent: false }
      return { studentId: s.id, score: m.score, isAbsent: m.isAbsent }
    })
    await saveMarks.mutateAsync({
      journalId:      journal.id,
      subjectId:      journal.subjectId,
      assessmentType: journal.assessmentType,
      totalMarks:     journal.totalMarks,
      term:           journal.term,
      year:           journal.year,
      marks:          rows,
    })
    setSaved(true)
  }

  async function handlePublish() {
    if (!journal) return
    await handleSaveAll()
    await publish.mutateAsync(journal.id)
  }

  // ── Bulk mark import via ImportWizard ──────────────────────
  async function handleMarkImport(
    rows: ParsedRow[],
    _strategy: ConflictStrategy,
  ): Promise<ImportResult> {
    const result: ImportResult = { imported: 0, updated: 0, skipped: 0, failed: [] }
    if (!journal || !user || rows.length === 0) return result

    // Build admission_number → student_id map
    const admMap = new Map(students.map(s => [s.admissionNumber.trim().toLowerCase(), s.id]))

    const validRows: Array<{ studentId: string; score: number; isAbsent: boolean }> = []

    rows.forEach((row, idx) => {
      const adm = (row.admission_number ?? '').trim().toLowerCase()
      const studentId = admMap.get(adm)
      if (!studentId) {
        result.failed.push({ row: idx + 1, reason: `Student not found: "${row.admission_number}"` })
        return
      }
      const scoreNum = Number(row.score)
      if (isNaN(scoreNum) || scoreNum < 0) {
        result.failed.push({ row: idx + 1, reason: `Invalid score: "${row.score}"` })
        return
      }
      const absent = (row.is_absent ?? '').toLowerCase() === 'true'
      validRows.push({ studentId, score: scoreNum, isAbsent: absent })
    })

    if (validRows.length === 0) return result

    const { error } = await supabase.from('exam_results').upsert(
      validRows.map(r => ({
        school_id:       user.schoolId,
        exam_journal_id: journal.id,
        student_id:      r.studentId,
        teacher_id:      user.id,
        subject_id:      journal.subjectId,
        score:           r.isAbsent ? null : r.score,
        is_absent:       r.isAbsent,
        term:            journal.term,
        year:            journal.year,
      })),
      { onConflict: 'exam_journal_id,student_id' },
    )

    if (error) {
      validRows.forEach((_, i) => result.failed.push({ row: i + 1, reason: error.message }))
      return result
    }

    result.imported = validRows.length
    // Invalidate so the grid refreshes
    qc.invalidateQueries({ queryKey: ['exam-results', journal.id] })
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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{enteredCount}</span>/{students.length} entered
            {missingCount > 0 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>· {missingCount} missing</span>}
            {absentCount  > 0 && <span style={{ color: 'var(--info)',    marginLeft: 8 }}>· {absentCount} absent</span>}
          </div>

          {/* Import Marks button */}
          <button
            onClick={() => setImportOpen(true)}
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
            Import Marks
          </button>

          <button onClick={() => void handleSaveAll()} disabled={saveMarks.isPending}
            style={{ padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: saved ? 'rgba(16,185,129,.1)' : 'var(--surface2)', color: saved ? '#065f46' : 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {saveMarks.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save All'}
          </button>
          {journal.status === 'draft' && (
            <button onClick={() => void handlePublish()} disabled={publish.isPending}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.35)' }}>
              {publish.isPending ? 'Publishing…' : 'Publish'}
            </button>
          )}
          {journal.status === 'published' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: '#065f46' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} /> Published
            </span>
          )}
        </div>
      </div>

      {saveMarks.isError && (
        <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', borderRadius: 10, fontSize: 13 }}>
          {(saveMarks.error as Error).message}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCA ? '140px 1fr 120px 60px' : '140px 1fr 160px 80px 60px',
          background: 'var(--surface2)', borderBottom: '.5px solid var(--border)',
          padding: '11px 16px',
          fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
          textTransform: 'uppercase', letterSpacing: .7, fontFamily: 'var(--font2)',
        }}>
          <div>Adm. No</div>
          <div>Student Name</div>
          <div>{isCA ? 'Score (0–3)' : `Score (/ ${totalMarks})`}</div>
          {!isCA && <div>Grade</div>}
          <div>Absent</div>
        </div>

        <div ref={parentRef} style={{ maxHeight: 420, overflowY: 'auto' }}>
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

              return (
                <div key={student.id} style={{
                  position: 'absolute', top: vRow.start, left: 0, right: 0, height: vRow.size,
                  display: 'grid',
                  gridTemplateColumns: isCA ? '140px 1fr 120px 60px' : '140px 1fr 160px 80px 60px',
                  alignItems: 'center', padding: '0 16px',
                  borderBottom: '.5px solid var(--border)',
                  background: hasWarning ? 'rgba(245,158,11,.05)' : isMissing ? 'rgba(14,165,233,.03)' : 'transparent',
                }}>
                  <div style={{ fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>{student.admissionNumber}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{student.firstName} {student.lastName}</div>

                  {isCA ? (
                    <CAScoreInput value={isAbsent ? null : score} onChange={v => setMark(student.id, v, false)} disabled={isAbsent} />
                  ) : (
                    <div>
                      <input type="number" min={0} max={totalMarks} step={0.5}
                        value={isAbsent ? '' : (score ?? '')}
                        disabled={isAbsent}
                        onChange={e => {
                          const v = e.target.value === '' ? null : parseFloat(e.target.value)
                          setMark(student.id, v, false)
                        }}
                        style={{ width: 80, padding: '5px 8px', border: `.5px solid ${hasWarning ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 8, fontSize: 13, background: isAbsent ? 'var(--surface2)' : 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font3)' }}
                      />
                      {hasWarning && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warning)' }}>Exceeds max</span>}
                    </div>
                  )}

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

                  <div>
                    <input type="checkbox" checked={isAbsent} onChange={e => setMark(student.id, null, e.target.checked)}
                      title="Mark absent" style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {students.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)', padding: 20, boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <ScoreDistChart marks={marks} totalMarks={totalMarks} passMark={passMark} isCA={isCA} />
          <div style={{ marginTop: 20, borderTop: '.5px solid var(--border)', paddingTop: 16 }}>
            <GradeTabs marks={marks} students={students} totalMarks={totalMarks} isCA={isCA} />
          </div>
        </div>
      )}

      {/* ── Import Marks Modal ─────────────────────────────── */}
      {importOpen && (
        <Modal
          title="Import Marks from Excel / CSV"
          size="lg"
          onClose={() => setImportOpen(false)}
        >
          <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(14,165,233,.07)', border: '.5px solid rgba(14,165,233,.25)', borderRadius: 10, fontSize: 12.5, color: '#0369a1' }}>
            <strong>Template columns:</strong> Admission No. · Score · Absent (optional) · Remarks (optional).
            Scores must be between 0 and {totalMarks}.
          </div>
          <ImportWizard
            context="marks"
            requiredFields={MARK_REQUIRED_FIELDS}
            optionalFields={MARK_OPTIONAL_FIELDS}
            onComplete={handleMarkImport}
            onClose={() => setImportOpen(false)}
          />
        </Modal>
      )}
    </div>
  )
}
