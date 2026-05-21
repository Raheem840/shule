import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { useExamJournalById, usePublishJournal } from '../../hooks/useExamJournal'
import { useExamResults, useSaveMarks } from '../../hooks/useExamResults'
import { useStudents } from '../../hooks/useStudents'
import { useSubjects } from '../../hooks/useClasses'
import { calculateCBCGrade } from '../../types/app'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { Student } from '../../types/app'
import type { MarkRow } from '../../hooks/useExamResults'

// ── Grade colours ──────────────────────────────────────────────
const GRADE_VARIANT: Record<string, 'green'|'blue'|'amber'|'red'|'muted'> = {
  A: 'green', B: 'blue', C: 'amber', D: 'amber', E: 'red',
}
const GRADE_LABEL: Record<string, string> = {
  A: 'Exceptional', B: 'Outstanding', C: 'Satisfactory', D: 'Basic', E: 'Elementary',
}

// ── CA Segmented Score Button ──────────────────────────────────
const CA_LABELS: Record<number, string> = { 0: 'None', 1: 'Basic', 2: 'Adequate', 3: 'Exceptional' }

function CAScoreInput({ value, onChange, disabled }: {
  value:    number | null
  onChange: (v: number) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[0, 1, 2, 3].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          title={CA_LABELS[n]}
          onClick={() => onChange(n)}
          style={{
            width: 32, height: 28,
            border: '1px solid',
            borderColor: value === n ? 'var(--brand)' : 'var(--border)',
            background:  value === n ? 'var(--brand)' : 'var(--surface2)',
            color:       value === n ? '#fff' : 'var(--txt2)',
            borderRadius: n === 0 ? '6px 0 0 6px' : n === 3 ? '0 6px 6px 0' : 0,
            fontFamily: 'var(--mono)',
            fontSize: 12, fontWeight: 700,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'background 0.1s, color 0.1s',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

// ── Score distribution chart ───────────────────────────────────
function ScoreDistChart({
  marks,
  totalMarks,
  passMark,
  isCA,
}: {
  marks:      Map<string, { score: number | null; isAbsent: boolean }>
  totalMarks: number
  passMark:   number
  isCA:       boolean
}) {
  const bucketData = useMemo(() => {
    const scores = Array.from(marks.values())
      .filter(m => !m.isAbsent && m.score !== null)
      .map(m => m.score as number)

    if (isCA) {
      const counts = [0, 1, 2, 3].map(v => ({
        range: String(v),
        count: scores.filter(s => s === v).length,
      }))
      return counts
    }

    const step = totalMarks <= 20 ? 5 : totalMarks <= 50 ? 10 : 10
    const buckets: { range: string; min: number; count: number }[] = []
    for (let min = 0; min < totalMarks; min += step) {
      const max = Math.min(min + step - 0.5, totalMarks)
      buckets.push({
        range: `${min}–${Math.floor(max)}`,
        min,
        count: scores.filter(s => s >= min && s <= max).length,
      })
    }
    return buckets
  }, [marks, totalMarks, isCA])

  const refX = isCA ? String(passMark) : bucketData.find(b => {
    if ('min' in b) return (b as { min: number }).min <= passMark && passMark < (b as { min: number }).min + 10
    return false
  })?.range

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 8, fontFamily: 'var(--font2)' }}>
        Score Distribution
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={bucketData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
          <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', fontSize: 12, borderRadius: 8 }} />
          {refX && (
            <ReferenceLine x={refX} stroke="var(--danger)" strokeDasharray="4 2"
              label={{ value: 'Pass', position: 'insideTopLeft', fontSize: 10, fill: 'var(--danger)' }}
            />
          )}
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {bucketData.map((entry, i) => (
              <Cell key={i} fill={
                'min' in entry && (entry as { min: number }).min >= passMark
                  ? 'var(--success)' : 'var(--danger)'
              } />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Grade tabs — spec: 4 buckets matching CBC descriptors ─────
// A = Exceptional, B+C = Passed, D = Needs Improvement, E = Poor
const GRADE_TABS = [
  { key: 'exceptional',       label: 'Exceptional',       grades: ['A'],      variant: 'green' as const },
  { key: 'passed',            label: 'Passed',            grades: ['B', 'C'], variant: 'blue'  as const },
  { key: 'needs_improvement', label: 'Needs Improvement', grades: ['D'],      variant: 'amber' as const },
  { key: 'poor',              label: 'Poor',              grades: ['E'],      variant: 'red'   as const },
]

function GradeTabs({
  marks,
  students,
  totalMarks,
  isCA,
}: {
  marks:      Map<string, { score: number | null; isAbsent: boolean }>
  students:   Student[]
  totalMarks: number
  isCA:       boolean
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

  const tabData    = GRADE_TABS.find(t => t.key === activeTab)!
  const tabStudents = studentsByBucket.get(activeTab) ?? []

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, flexWrap: 'wrap' }}>
        {GRADE_TABS.map(tab => {
          const count  = studentsByBucket.get(tab.key)?.length ?? 0
          const active = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700,
                fontFamily: 'var(--font2)', cursor: 'pointer',
                background: active ? 'var(--brand)' : 'var(--surface2)',
                color: active ? '#fff' : 'var(--txt2)',
                border: '1px solid',
                borderColor: active ? 'var(--brand)' : 'var(--border)',
                borderRadius: 8,
              }}
            >
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
            <div key={student.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '6px 10px', background: 'var(--surface2)', borderRadius: 8, fontSize: 13,
            }}>
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--txt)' }}>
                {student.firstName} {student.lastName}
              </span>
              <span style={{ fontFamily: 'var(--mono)', color: 'var(--txt2)' }}>{score}</span>
              <Badge variant={tabData.variant}>{grade} — {GRADE_LABEL[grade]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export function MarkEntryPage() {
  const { journalId } = useParams<{ journalId: string }>()
  const navigate      = useNavigate()

  const { data: journal, isLoading: journalLoading } = useExamJournalById(journalId)
  const { data: savedResults = [] }                   = useExamResults(journalId)
  const { data: subjects = [] }                       = useSubjects()
  const saveMarks                                     = useSaveMarks()
  const publish                                       = usePublishJournal()

  const { data: students = [], isLoading: studentsLoading } = useStudents({
    classId:  journal?.classId,
    streamId: journal?.streamId ?? undefined,
    status:   'active',
  })

  // Local marks state: studentId → { score, isAbsent }
  const [marks, setMarks] = useState<Map<string, { score: number | null; isAbsent: boolean }>>(new Map())
  const [saved, setSaved]  = useState(false)

  // Initialise marks from saved results when data loads
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

  // Virtualiser for large class lists
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirt   = useVirtualizer({
    count:           students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => 48,
    overscan:        10,
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
        <Button style={{ marginLeft: 12 }} onClick={() => navigate('/teacher/exams')}>Back</Button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      {/* ── Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button onClick={() => navigate('/teacher/exams')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
            ← Back to Journal
          </button>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', letterSpacing: '-0.5px' }}>
            {subjectMap.get(journal.subjectId) ?? journal.subjectId}
            {journal.caLabel && <span style={{ marginLeft: 8, color: 'var(--brand)', fontSize: 16 }}>{journal.caLabel}</span>}
          </div>
          <div style={{ color: 'var(--txt2)', fontSize: 13, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>{journal.assessmentType.replace(/_/g, ' ')}</span>
            <span>·</span>
            <span>Term {journal.term} {journal.year}</span>
            <span>·</span>
            <span>Total: {totalMarks} marks</span>
            <span>·</span>
            <span>Pass: {passMark}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>{enteredCount}</span>/{students.length} entered
            {missingCount > 0 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>· {missingCount} missing</span>}
            {absentCount > 0 && <span style={{ color: 'var(--info)', marginLeft: 8 }}>· {absentCount} absent</span>}
          </div>
          <Button variant="secondary" onClick={handleSaveAll} loading={saveMarks.isPending} disabled={saveMarks.isPending}>
            {saved ? '✓ Saved' : 'Save All'}
          </Button>
          {journal.status === 'draft' && (
            <Button variant="primary" onClick={handlePublish} loading={publish.isPending}>
              Publish
            </Button>
          )}
          {journal.status === 'published' && (
            <Badge variant="green" dot>Published</Badge>
          )}
        </div>
      </div>

      {saveMarks.isError && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>
          {(saveMarks.error as Error).message}
        </div>
      )}

      {/* ── Mark entry table ───────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 24 }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isCA
            ? '140px 1fr 120px 60px'
            : '140px 1fr 160px 80px 60px',
          gap: 0,
          background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
          textTransform: 'uppercase', letterSpacing: 0.5,
          fontFamily: 'var(--font2)',
        }}>
          <div>Adm. No</div>
          <div>Student Name</div>
          <div>{isCA ? 'Score (0–3)' : `Score (/ ${totalMarks})`}</div>
          {!isCA && <div>Grade</div>}
          <div>Absent</div>
        </div>

        {/* Virtualised rows */}
        <div ref={parentRef} style={{ maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
            {rowVirt.getVirtualItems().map(vRow => {
              const student  = students[vRow.index]
              const markData = marks.get(student.id) ?? { score: null, isAbsent: false }
              const { score, isAbsent } = markData

              // Compute display grade
              let displayGrade: string | null = null
              if (!isAbsent && score !== null && !isEndOfTerm) {
                const pct = isCA ? (score / 3) * 100 : (score / totalMarks) * 100
                displayGrade = calculateCBCGrade(pct)
              }

              // Warnings
              const hasWarning = !isAbsent && score !== null && score > totalMarks
              const isMissing  = !isAbsent && score === null

              return (
                <div
                  key={student.id}
                  style={{
                    position: 'absolute',
                    top: vRow.start, left: 0, right: 0,
                    height: vRow.size,
                    display: 'grid',
                    gridTemplateColumns: isCA
                      ? '140px 1fr 120px 60px'
                      : '140px 1fr 160px 80px 60px',
                    alignItems: 'center',
                    padding: '0 16px',
                    borderBottom: '1px solid var(--border)',
                    background: hasWarning ? 'rgba(245,158,11,0.06)' : isMissing ? 'rgba(14,165,233,0.04)' : 'transparent',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--txt3)' }}>
                    {student.admissionNumber}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                    {student.firstName} {student.lastName}
                  </div>

                  {/* Score input */}
                  {isCA ? (
                    <CAScoreInput
                      value={isAbsent ? null : score}
                      onChange={v => setMark(student.id, v, false)}
                      disabled={isAbsent}
                    />
                  ) : (
                    <div>
                      <input
                        type="number"
                        min={0}
                        max={totalMarks}
                        step={0.5}
                        value={isAbsent ? '' : (score ?? '')}
                        disabled={isAbsent}
                        onChange={e => {
                          const v = e.target.value === '' ? null : parseFloat(e.target.value)
                          setMark(student.id, v, false)
                        }}
                        style={{
                          width: 80, padding: '4px 8px',
                          border: `1px solid ${hasWarning ? 'var(--warning)' : 'var(--border)'}`,
                          borderRadius: 6, fontSize: 13,
                          background: isAbsent ? 'var(--surface2)' : 'var(--surface)',
                          color: 'var(--txt)',
                          fontFamily: 'var(--mono)',
                        }}
                      />
                      {hasWarning && (
                        <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--warning)' }}>
                          Exceeds max
                        </span>
                      )}
                    </div>
                  )}

                  {/* Grade */}
                  {!isCA && (
                    <div>
                      {displayGrade ? (
                        <Badge variant={GRADE_VARIANT[displayGrade]} title={GRADE_LABEL[displayGrade]}>
                          {displayGrade}
                        </Badge>
                      ) : isEndOfTerm ? (
                        <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
                      ) : null}
                    </div>
                  )}

                  {/* Absent toggle */}
                  <div>
                    <input
                      type="checkbox"
                      checked={isAbsent}
                      onChange={e => setMark(student.id, null, e.target.checked)}
                      title="Mark absent"
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--brand)' }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Score Distribution + Tabs ──────────────────────────── */}
      {students.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 14,
          border: '1px solid var(--border)', padding: 20,
        }}>
          <ScoreDistChart
            marks={marks}
            totalMarks={totalMarks}
            passMark={passMark}
            isCA={isCA}
          />
          <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <GradeTabs marks={marks} students={students} totalMarks={totalMarks} isCA={isCA} />
          </div>
        </div>
      )}
    </div>
  )
}
