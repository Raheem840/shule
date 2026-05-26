import { useState } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import {
  useDosOverview,
  useDosClassPerformance,
  useDosTeacherPerformance,
  useDosCurriculumPlan,
  useAssignClassTeacher,
} from '../../hooks/useDos'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import type { SubjectRanking } from '../../types/week9'

// ─── Shared UI primitives ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, danger }: {
  label: string
  value: string | number
  sub?: string
  danger?: boolean
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 14, padding: '16px 20px',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 28, fontWeight: 900,
        color: danger ? 'var(--danger)' : 'var(--txt)',
        fontFamily: 'var(--font2)',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function SortHeader({ label, field, sort, onSort }: {
  label: string
  field: string
  sort: { field: string; dir: 'asc' | 'desc' }
  onSort: (f: string) => void
}) {
  const active = sort.field === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none', padding: '8px 12px',
        background: 'var(--surface2)', fontWeight: 700, fontSize: 12,
        color: active ? 'var(--brand)' : 'var(--txt2)',
        whiteSpace: 'nowrap',
      }}
    >
      {label} {active ? (sort.dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )
}

// ─── Student detail modal (read-only academic profile, NO fees) ────────────
function StudentDetailModal({
  studentId,
  name,
  onClose,
}: {
  studentId: string
  name: string
  onClose: () => void
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>
            {name} — Academic Profile
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none',
            fontSize: 20, cursor: 'pointer', color: 'var(--txt3)' }}>✕</button>
        </div>
        <p style={{ color: 'var(--txt2)', fontSize: 13 }}>
          Read-only academic profile. Finance, discipline, and personal contact data are
          not accessible from this view.
        </p>
        <div style={{ color: 'var(--txt3)', fontSize: 12, marginTop: 12 }}>
          Student ID: {studentId}
        </div>
      </div>
    </div>
  )
}

// ─── TAB 1 — Overview ─────────────────────────────────────────────────────
function OverviewTab() {
  const { data: overview, isLoading, isError } = useDosOverview()
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({
    field: 'classAverage', dir: 'desc',
  })

  function toggleSort(field: string) {
    setSort(s => ({
      field,
      dir: s.field === field && s.dir === 'desc' ? 'asc' : 'desc',
    }))
  }

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading overview…</div>
  if (isError || !overview) return <div style={{ color: 'var(--danger)', padding: 32 }}>Failed to load data.</div>

  const sortedRankings = [...overview.subjectRankings].sort((a, b) => {
    const av = a[sort.field as keyof SubjectRanking] as number
    const bv = b[sort.field as keyof SubjectRanking] as number
    return sort.dir === 'asc' ? av - bv : bv - av
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Subject Performance — HorizontalBarChart */}
      {overview.subjectRankings.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--txt)' }}>
            Subject Performance (Average Score)
          </div>
          <ResponsiveContainer width="100%" height={Math.max(160, overview.subjectRankings.length * 36)}>
            <BarChart
              data={[...overview.subjectRankings].sort((a, b) => b.classAverage - a.classAverage)}
              layout="vertical"
              margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="subjectName" tick={{ fontSize: 11 }} width={110} />
              <Tooltip formatter={(v) => [`${Number(v)}`, 'Avg Score']} />
              <Bar dataKey="classAverage" radius={[0, 4, 4, 0]}>
                {overview.subjectRankings.map((_, i) => (
                  <Cell key={i} fill="var(--brand)" fillOpacity={0.75 - i * 0.05 > 0.3 ? 0.75 - i * 0.05 : 0.3} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Pass Rate Trend */}
      {overview.passRateTrend.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--txt)' }}>
            School-wide Pass Rate Trend
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={overview.passRateTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => [`${Number(v)}%`, 'Pass Rate']} />
              <ReferenceLine y={50} stroke="var(--danger)" strokeDasharray="4 4" label="50%" />
              <Line
                type="monotone" dataKey="rate"
                stroke="var(--brand)" strokeWidth={2}
                dot={{ r: 4, fill: 'var(--brand)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Subject Rankings Table */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>
          Subject Rankings
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <SortHeader label="Subject"       field="subjectName"   sort={sort} onSort={toggleSort} />
              <SortHeader label="Class Avg"     field="classAverage"  sort={sort} onSort={toggleSort} />
              <SortHeader label="Pass Rate"     field="passRate"      sort={sort} onSort={toggleSort} />
              <SortHeader label="Highest"       field="highest"       sort={sort} onSort={toggleSort} />
              <SortHeader label="Lowest"        field="lowest"        sort={sort} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedRankings.map(r => (
              <tr key={r.subjectId} className="sui-tr">
                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--txt)' }}>{r.subjectName}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{r.classAverage}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: r.passRate < 50 ? 'var(--danger-bg)' : 'var(--success-bg)',
                    color: r.passRate < 50 ? 'var(--danger)' : 'var(--success)',
                  }}>
                    {r.passRate}%
                  </span>
                </td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)' }}>{r.highest}</td>
                <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)' }}>{r.lowest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── TAB 2 — Class Performance ────────────────────────────────────────────
function ClassPerformanceTab() {
  const { data: classes = [] } = useClasses()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [detailStudent, setDetailStudent] = useState<{ id: string; name: string } | null>(null)
  const { data: perf, isLoading } = useDosClassPerformance(selectedClass)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 6 }}>
          Select Class
        </label>
        <select
          value={selectedClass ?? ''}
          onChange={e => setSelectedClass(e.target.value || null)}
          className="sui-input"
          style={{ width: 200 }}
        >
          <option value="">Choose a class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {!selectedClass && (
        <div style={{ color: 'var(--txt3)', fontSize: 14, padding: 24, textAlign: 'center' }}>
          Select a class to view performance breakdown.
        </div>
      )}

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading class data…</div>}

      {perf && (
        <>
          {/* Subject Breakdown */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14 }}>
              Subject Breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Subject', 'Average', 'Pass Rate', 'Students'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                      fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perf.subjectBreakdown.map(s => (
                  <tr key={s.subjectId} className="sui-tr">
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.subjectName}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)' }}>{s.average}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: s.passRate < 50 ? 'var(--danger-bg)' : 'var(--success-bg)',
                        color: s.passRate < 50 ? 'var(--danger)' : 'var(--success)',
                      }}>
                        {s.passRate}%
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--txt2)' }}>{s.studentCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top 5 / Bottom 5 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Top 5 Students', data: perf.topStudents, color: 'var(--success)' },
              { label: 'Bottom 5 Students', data: perf.bottomStudents, color: 'var(--danger)' },
            ].map(({ label, data, color }) => (
              <div key={label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color }}>{label}</div>
                {data.map((s, i) => (
                  <div
                    key={s.studentId}
                    onClick={() => setDetailStudent({ id: s.studentId, name: s.name })}
                    style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '6px 0', borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13, color: 'var(--txt)' }}>{s.name}</span>
                    <span style={{ fontFamily: 'var(--font3)', fontSize: 13, color }}>
                      {s.average}%
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {detailStudent && (
        <StudentDetailModal
          studentId={detailStudent.id}
          name={detailStudent.name}
          onClose={() => setDetailStudent(null)}
        />
      )}
    </div>
  )
}

// ─── TAB 3 — Teacher Performance ─────────────────────────────────────────
function TeacherPerformanceTab() {
  const { data: teachers = [], isLoading } = useDosTeacherPerformance()
  const { data: classes = [] } = useClasses()
  const { data: streams = [] } = useStreams(null)
  const assignMut = useAssignClassTeacher()
  const [assignModal, setAssignModal] = useState<{
    staffId: string; name: string
  } | null>(null)
  const [targetStreamId, setTargetStreamId] = useState('')
  const [assignError, setAssignError] = useState('')

  async function handleAssign() {
    if (!assignModal || !targetStreamId) return
    const stream = streams.find(s => s.id === targetStreamId)
    if (!stream) return
    setAssignError('')
    try {
      await assignMut.mutateAsync({
        streamId:  stream.id,
        classId:   stream.classId,
        teacherId: assignModal.staffId,
      })
      setAssignModal(null)
      setTargetStreamId('')
    } catch (err: any) {
      setAssignError(err.message ?? 'Assignment failed')
    }
  }

  const listRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count:           teachers.length,
    getScrollElement: () => listRef.current,
    estimateSize:    () => 52,
    overscan:        5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading teacher data…</div>}

      {/* Table */}
      <div
        ref={listRef}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'auto', maxHeight: 500,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {['Teacher', 'Subjects', 'Pass Rate', 'Assessments', 'Curriculum', 'Action'].map(h => (
                <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                  whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map(vr => {
              const t = teachers[vr.index]
              return (
                <tr
                  key={t.staffId}
                  className="sui-tr"
                  style={{ height: vr.size, transform: `translateY(${vr.start}px)` }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 12 }}>
                    {t.subjects.length} subject{t.subjects.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: t.passRate < 50 ? 'var(--danger-bg)' : 'var(--success-bg)',
                      color: t.passRate < 50 ? 'var(--danger)' : 'var(--success)',
                    }}>
                      {t.passRate}%
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>
                    {t.assessmentsThisTerm}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      background: t.curriculumCoverage < 60 ? 'var(--warning-bg)' : 'var(--success-bg)',
                      color: t.curriculumCoverage < 60 ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {t.curriculumCoverage}%
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button
                      onClick={() => setAssignModal({ staffId: t.staffId, name: t.name })}
                      className="sui-btn-outline"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                    >
                      Assign Class Teacher
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Class Teacher Modal */}
      {assignModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 28, width: 400,
          }}>
            <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, marginTop: 0 }}>
              Assign Class Teacher
            </h3>
            <p style={{ color: 'var(--txt2)', fontSize: 13, marginBottom: 16 }}>
              Assigning <strong>{assignModal.name}</strong> as class teacher.
              Select the stream:
            </p>

            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>Stream</label>
            <select
              value={targetStreamId}
              onChange={e => setTargetStreamId(e.target.value)}
              className="sui-input"
              style={{ width: '100%', marginTop: 4, marginBottom: 12 }}
            >
              <option value="">Select stream…</option>
              {streams.map(s => (
                <option key={s.id} value={s.id}>
                  {classes.find(c => c.id === s.classId)?.name ?? s.classId} — {s.name}
                </option>
              ))}
            </select>

            {assignError && (
              <div style={{
                background: 'var(--danger-bg)', color: 'var(--danger)',
                padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12,
              }}>
                {assignError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setAssignModal(null); setAssignError('') }}
                className="sui-btn-outline"
              >
                Cancel
              </button>
              <button
                onClick={() => { void handleAssign() }}
                disabled={!targetStreamId || assignMut.isPending}
                className="sui-btn-primary"
              >
                {assignMut.isPending ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TAB 4 — Curriculum Plan ──────────────────────────────────────────────
function CurriculumPlanTab() {
  const { data: classes = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const { data: topics = [], isLoading } = useDosCurriculumPlan(selectedSubject, selectedClass)

  const covered = topics.filter(t => t.coveredAt != null).length
  const pct = topics.length > 0 ? Math.round((covered / topics.length) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
            Class
          </label>
          <select
            value={selectedClass ?? ''}
            onChange={e => setSelectedClass(e.target.value || null)}
            className="sui-input"
            style={{ width: 160 }}
          >
            <option value="">Select…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
            Subject
          </label>
          <select
            value={selectedSubject ?? ''}
            onChange={e => setSelectedSubject(e.target.value || null)}
            className="sui-input"
            style={{ width: 200 }}
          >
            <option value="">Select…</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {!selectedClass || !selectedSubject ? (
        <div style={{ color: 'var(--txt3)', fontSize: 14, padding: 24, textAlign: 'center' }}>
          Select a class and subject to view the curriculum plan.
        </div>
      ) : isLoading ? (
        <div style={{ color: 'var(--txt3)' }}>Loading topics…</div>
      ) : (
        <>
          {/* Coverage bar */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Curriculum Coverage</span>
              <span style={{ fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--brand)' }}>
                {covered}/{topics.length} topics ({pct}%)
              </span>
            </div>
            <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 99 }}>
              <div style={{
                height: 8, borderRadius: 99, background: 'var(--brand)',
                width: `${pct}%`, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Topics timeline */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['#', 'Topic', 'NCDC Code', 'Planned Date', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                      fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topics.map(t => (
                  <tr key={t.id} className="sui-tr">
                    <td style={{ padding: '8px 12px', color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                      {t.sequenceOrder}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--txt)' }}>
                      {t.topicName}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', color: 'var(--txt3)', fontSize: 12 }}>
                      {t.ncdcCode ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 12 }}>
                      {t.plannedDate ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                        background: t.coveredAt ? 'var(--success-bg)' : 'var(--surface2)',
                        color: t.coveredAt ? 'var(--success)' : 'var(--txt3)',
                      }}>
                        {t.coveredAt ? 'Covered' : 'Not covered'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DOS DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function DosDashboard() {
  const { data: overview, isLoading: kpiLoading } = useDosOverview()

  const kpis = [
    {
      label: 'School Pass Rate',
      value: kpiLoading ? '—' : `${overview?.overallPassRate ?? 0}%`,
      accent: 'brand',
    },
    {
      label: 'Exam Journals (This Year)',
      value: kpiLoading ? '—' : (overview?.examJournalsThisTerm ?? 0),
      accent: 'info',
    },
    {
      label: 'Curriculum Topics Covered',
      value: kpiLoading ? '—' : (overview?.curriculumTopicsCovered ?? 0),
      accent: 'success',
    },
    {
      label: 'Teachers Active',
      value: kpiLoading ? '—' : (overview?.activeTeachers ?? 0),
      accent: 'violet',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
          color: 'var(--txt)', margin: 0,
        }}>
          Academic Overview
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          School-wide academic performance, teacher stats, and curriculum tracking.
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* KPI Cards — spec: School Pass Rate, Journals, Curriculum, Teachers */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {kpis.map(k => (
          <KpiCard key={k.label} label={k.label} value={k.value} />
        ))}
      </div>

      <Tabs.Root defaultValue="overview">
        <Tabs.List
          style={{
            display: 'flex', gap: 4, borderBottom: '2px solid var(--border)',
            marginBottom: 24,
          }}
        >
          {[
            { value: 'overview',     label: 'Overview' },
            { value: 'class-perf',   label: 'Class Performance' },
            { value: 'teacher-perf', label: 'Teacher Performance' },
            { value: 'curriculum',   label: 'Curriculum Plan' },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 13,
                color: 'var(--txt2)', borderRadius: '8px 8px 0 0',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview">     <OverviewTab />          </Tabs.Content>
        <Tabs.Content value="class-perf">   <ClassPerformanceTab />  </Tabs.Content>
        <Tabs.Content value="teacher-perf"> <TeacherPerformanceTab /></Tabs.Content>
        <Tabs.Content value="curriculum">   <CurriculumPlanTab />    </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
