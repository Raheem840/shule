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
import { useToast } from '../../components/ui/Toast'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import type { SubjectRanking } from '../../types/week9'

// ─── Shared UI primitives ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = 'brand', icon }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'brand' | 'danger' | 'warning' | 'info' | 'success' | 'violet'
  icon?: React.ReactNode
}) {
  return (
    <div className={`sui-kpi-v2 sui-kpi-accent-${accent}`} style={{ flex: 1, minWidth: 160 }}>
      {icon && <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>{icon}</div>}
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num sui-count-reveal">{value}</div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
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
      className="sui-th sui-th-sortable"
      style={{
        color: active ? 'var(--brand)' : undefined,
        background: 'var(--surface2)',
      }}
    >
      {label}{active && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 4, verticalAlign: 'middle', transform: sort.dir === 'asc' ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }}>
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      )}
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
    <div
      className="sui-overlay"
      style={{
        position: 'fixed', inset: 0, background: 'var(--modal-overlay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="sui-modal-dialog"
        style={{
          background: 'var(--modal-bg)', borderRadius: 20, padding: 28,
          width: 480, maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto',
          border: '1px solid var(--modal-border)',
          borderTop: '1px solid var(--modal-border-t)',
          backdropFilter: 'blur(24px)',
          boxShadow: 'var(--modal-shadow)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>
            {name} — Academic Profile
          </h3>
          <button onClick={onClose} className="sui-modal-close">
            <svg width={14} height={14} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
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
        <div className="sui-glass-panel" style={{ padding: 20 }}>
          <div className="sui-section-head">
            <span className="sui-section-title">Subject Performance (Average Score)</span>
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
        <div className="sui-glass-panel" style={{ padding: 20 }}>
          <div className="sui-section-head">
            <span className="sui-section-title">School-wide Pass Rate Trend</span>
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
      <div className="sui-glass-panel sui-table-head-sticky mob-cards">
        <div className="sui-glass-panel-header">
          <span className="sui-section-title" style={{ fontFamily: 'var(--font2)', fontSize: 14, fontWeight: 800 }}>Subject Rankings</span>
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
          <div className="mob-cards" style={{
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
  const { success: toastOk, error: toastErr } = useToast()
  const [assignModal, setAssignModal] = useState<{
    staffId: string; name: string; isClassTeacher: boolean
  } | null>(null)
  const [targetClassId, setTargetClassId] = useState('')
  const [targetStreamId, setTargetStreamId] = useState('')
  const [done, setDone] = useState(false)

  const streamsForClass = targetClassId
    ? streams.filter(s => s.classId === targetClassId && (!s.classTeacherId || s.classTeacherId === assignModal?.staffId))
    : []

  function openModal(t: { staffId: string; name: string; isClassTeacher: boolean }) {
    setAssignModal(t)
    setTargetClassId('')
    setTargetStreamId('')
    setDone(false)
  }

  function closeModal() {
    setAssignModal(null)
    setTargetClassId('')
    setTargetStreamId('')
    setDone(false)
  }

  async function handleAssign() {
    if (!assignModal || !targetStreamId) return
    const stream = streams.find(s => s.id === targetStreamId)
    if (!stream) return
    try {
      await assignMut.mutateAsync({
        streamId:  stream.id,
        classId:   stream.classId,
        teacherId: assignModal.staffId,
      })
      setDone(true)
      toastOk(`${assignModal.name} assigned as class teacher`)
    } catch (err: any) {
      toastErr(err.message ?? 'Assignment failed')
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
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                    {t.name}
                    {t.isClassTeacher && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,.1)', padding: '1px 6px', borderRadius: 99 }}>CT</span>
                    )}
                  </td>
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
                      onClick={() => openModal({ staffId: t.staffId, name: t.name, isClassTeacher: t.isClassTeacher })}
                      className="sui-btn-outline"
                      style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                    >
                      {t.isClassTeacher ? 'Change Class' : 'Assign Class'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Class Teacher Modal — matches DosTeachersPage modal */}
      {assignModal && (
        <div
          className="sui-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20,
          }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            width: '100%', maxWidth: 440, borderRadius: 24, overflow: 'hidden',
            background: 'var(--surface)', boxShadow: '0 24px 80px rgba(0,0,0,.24)',
            animation: 'discCenterIn .26s cubic-bezier(.32,.72,0,1) both',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', background: 'linear-gradient(135deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)' }}>
                {assignModal.isClassTeacher ? 'Change Class Assignment' : 'Assign as Class Teacher'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>
                Assigning <strong style={{ color: 'var(--txt)' }}>{assignModal.name}</strong> to a class stream
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {done ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px', borderRadius: 14, background: 'rgba(16,185,129,.08)', border: '.5px solid rgba(16,185,129,.25)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{assignModal.name} has been assigned as class teacher.</div>
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 6 }}>Class</label>
                    <select className="sui-input" value={targetClassId} onChange={e => { setTargetClassId(e.target.value); setTargetStreamId('') }} style={{ width: '100%' }}>
                      <option value="">Choose class…</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {targetClassId && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, display: 'block', marginBottom: 6 }}>Stream</label>
                      {streamsForClass.length === 0
                        ? <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10 }}>No available streams for this class.</div>
                        : <select className="sui-input" value={targetStreamId} onChange={e => setTargetStreamId(e.target.value)} style={{ width: '100%' }}>
                            <option value="">Choose stream…</option>
                            {streamsForClass.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                      }
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ padding: '14px 24px 18px', borderTop: '.5px solid var(--border)', display: 'flex', gap: 10 }}>
              <button onClick={closeModal} style={{ flex: 1, height: 44, borderRadius: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>
                {done ? 'Close' : 'Cancel'}
              </button>
              {!done && (
                <button
                  onClick={() => { void handleAssign() }}
                  disabled={!targetStreamId || assignMut.isPending}
                  style={{ flex: 2, height: 44, borderRadius: 12, background: targetStreamId ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--border)', color: targetStreamId ? '#fff' : 'var(--txt3)', border: 'none', fontWeight: 800, fontSize: 13.5, cursor: targetStreamId ? 'pointer' : 'default', boxShadow: targetStreamId ? '0 4px 14px rgba(13,148,136,.38)' : 'none', transition: 'all .18s' }}
                >
                  {assignMut.isPending ? 'Assigning…' : 'Confirm Assignment'}
                </button>
              )}
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
          <div className="mob-cards" style={{
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

  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero band ── */}
      <div className="sui-hero-band mob-hero mob-hero-dos">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 className="mob-hero-title" style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: '0 0 4px', lineHeight: 1.2 }}>
              <span className="gradient-text">Director of Studies</span>
            </h1>
            <p className="mob-hero-sub" style={{ fontSize: 13, color: 'var(--txt3)', margin: 0 }}>
              Academic performance, curriculum tracking & teacher oversight.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 99,
            background: 'var(--brand-light)', color: 'var(--brand)',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
          }}>
            <svg width={12} height={12} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M12 2l-2 6H4l5 4-2 6 5-4 5 4-2-6 5-4h-6z"/>
            </svg>
            Academic
          </div>
        </div>
        {/* Mobile-only hero metric */}
        <div className="mob-only mob-hero-stat">
          <div className="mob-hero-stat-num">{kpiLoading ? '—' : `${overview?.overallPassRate ?? 0}%`}</div>
          <div className="mob-hero-stat-label">School Pass Rate</div>
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* KPI Cards */}
      <div className="stagger-cards mob-kpi-grid" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          label="School Pass Rate"
          value={kpiLoading ? '—' : `${overview?.overallPassRate ?? 0}%`}
          accent="brand"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4"/></svg>}
        />
        <KpiCard
          label="Exam Journals"
          value={kpiLoading ? '—' : (overview?.examJournalsThisTerm ?? 0)}
          sub="This academic year"
          accent="info"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><rect x="4" y="2" width="12" height="16" rx="2"/><path d="M8 6h4M8 10h4M8 14h2"/></svg>}
        />
        <KpiCard
          label="Curriculum Topics"
          value={kpiLoading ? '—' : (overview?.curriculumTopicsCovered ?? 0)}
          sub="Covered this term"
          accent="success"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 5h14M3 10h14M3 15h8"/></svg>}
        />
        <KpiCard
          label="Active Teachers"
          value={kpiLoading ? '—' : (overview?.activeTeachers ?? 0)}
          sub="Teaching staff"
          accent="violet"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="7" r="3"/><path d="M3 18a7 7 0 0114 0"/></svg>}
        />
      </div>

      <Tabs.Root defaultValue="overview">
        <Tabs.List asChild>
          <div className="sui-tab-list-pill mob-tab-scroll" style={{ marginBottom: 24 }}>
            {[
              { value: 'overview',     label: 'Overview' },
              { value: 'class-perf',   label: 'Class Performance' },
              { value: 'teacher-perf', label: 'Teacher Performance' },
              { value: 'curriculum',   label: 'Curriculum Plan' },
            ].map(tab => (
              <Tabs.Trigger key={tab.value} value={tab.value} asChild>
                <button className="sui-tab-pill">{tab.label}</button>
              </Tabs.Trigger>
            ))}
          </div>
        </Tabs.List>

        <Tabs.Content value="overview">     <OverviewTab />          </Tabs.Content>
        <Tabs.Content value="class-perf">   <ClassPerformanceTab />  </Tabs.Content>
        <Tabs.Content value="teacher-perf"> <TeacherPerformanceTab /></Tabs.Content>
        <Tabs.Content value="curriculum">   <CurriculumPlanTab />    </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
