import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'

// ─── Attendance aggregate ──────────────────────────────────────────────────────
type AttendanceAgg = { studentId: string; present: number; total: number }

function useAttendanceAgg() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-attendance-agg', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, AttendanceAgg>> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', user!.schoolId)
      if (error) throw error
      const map = new Map<string, AttendanceAgg>()
      for (const r of (data ?? []) as { student_id: string; status: string }[]) {
        const sid = r.student_id
        if (!map.has(sid)) map.set(sid, { studentId: sid, present: 0, total: 0 })
        const agg = map.get(sid)!
        agg.total++
        if (r.status === 'present') agg.present++
      }
      return map
    },
  })
}

// ─── Exam results aggregate ────────────────────────────────────────────────────
type ResultAgg = { studentId: string; avgScore: number; count: number }
type SubjectClassCell = { classId: string; subjectId: string; avg: number; count: number }

function useExamAgg() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dos-exam-agg', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{
      byStudent: Map<string, ResultAgg>
      byClassSubject: SubjectClassCell[]
    }> => {
      // Only published journals reflect finalised marks — draft entries are a
      // teacher's work-in-progress and would skew averages shown to DOS.
      const [publishedRes, resultsRes] = await Promise.all([
        supabase
          .from('exam_journal')
          .select('id')
          .eq('school_id', user!.schoolId)
          .eq('status', 'published')
          .limit(10000),
        supabase
          .from('exam_results')
          .select('student_id, score, exam_journal_id, exam_journal:exam_journal_id(class_id, subject_id)')
          .eq('school_id', user!.schoolId)
          .not('score', 'is', null)
          .limit(50000),
      ])
      if (publishedRes.error) throw publishedRes.error
      if (resultsRes.error)   throw resultsRes.error

      const publishedIds = new Set((publishedRes.data ?? []).map((j: any) => j.id as string))
      const data = (resultsRes.data ?? []).filter((r: any) => publishedIds.has(r.exam_journal_id))

      const byStudent = new Map<string, ResultAgg>()
      const cellAccum = new Map<string, { total: number; count: number }>()

      for (const r of (data ?? []) as any[]) {
        const sid = r.student_id as string
        const score = Number(r.score)
        if (isNaN(score)) continue

        // per-student
        if (!byStudent.has(sid)) byStudent.set(sid, { studentId: sid, avgScore: 0, count: 0 })
        const sagg = byStudent.get(sid)!
        sagg.avgScore = (sagg.avgScore * sagg.count + score) / (sagg.count + 1)
        sagg.count++

        // per class×subject
        const classId   = r.exam_journal?.class_id   as string | null
        const subjectId = r.exam_journal?.subject_id as string | null
        if (classId && subjectId) {
          const k = `${classId}|${subjectId}`
          if (!cellAccum.has(k)) cellAccum.set(k, { total: 0, count: 0 })
          const ca = cellAccum.get(k)!
          ca.total += score
          ca.count++
        }
      }

      const byClassSubject: SubjectClassCell[] = []
      for (const [k, ca] of cellAccum) {
        const [classId, subjectId] = k.split('|')
        byClassSubject.push({ classId, subjectId, avg: Math.round(ca.total / ca.count), count: ca.count })
      }

      return { byStudent, byClassSubject }
    },
  })
}

// ─── Score colour helper ────────────────────────────────────────────────────────
function scoreColor(avg: number): string {
  if (avg >= 70) return '#10b981'   // success
  if (avg >= 50) return '#f59e0b'   // warning
  return '#f43f5e'                   // danger
}
function scoreBg(avg: number): string {
  if (avg >= 70) return 'rgba(16,185,129,.15)'
  if (avg >= 50) return 'rgba(245,158,11,.15)'
  return 'rgba(244,63,94,.13)'
}

// ─── KPI chip ─────────────────────────────────────────────────────────────────
function KpiChip({ label, value, color = '#fff' }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 22px', borderRadius: 14,
      background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,.2)',
    }}>
      <span style={{ fontSize: 22, fontWeight: 900, color, fontFamily: 'var(--font2)', letterSpacing: -1 }}>{value}</span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', fontWeight: 600, marginTop: 2 }}>{label}</span>
    </div>
  )
}

// ─── Class×Subject heatmap ─────────────────────────────────────────────────────
function ScoreHeatmap({ cells, classes, subjects }: {
  cells: SubjectClassCell[]
  classes: { id: string; name: string }[]
  subjects: { id: string; name: string }[]
}) {
  // Only include subjects that actually appear in cells
  const activeSubjectIds = new Set(cells.map(c => c.subjectId))
  const activeSubs = subjects.filter(s => activeSubjectIds.has(s.id))
  const cellMap = new Map(cells.map(c => [`${c.classId}|${c.subjectId}`, c]))

  if (!activeSubs.length || !classes.length) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        No exam data available yet.
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 400, fontSize: 11.5 }}>
        <thead>
          <tr>
            <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--txt3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: .6, borderBottom: '.5px solid var(--border)', whiteSpace: 'nowrap' }}>Subject</th>
            {classes.map(c => (
              <th key={c.id} style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--txt3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: .6, borderBottom: '.5px solid var(--border)', whiteSpace: 'nowrap' }}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeSubs.map(sub => (
            <tr key={sub.id}>
              <td style={{ padding: '7px 12px', fontWeight: 700, color: 'var(--txt2)', whiteSpace: 'nowrap', borderBottom: '.5px solid var(--border)' }}>{sub.name}</td>
              {classes.map(cls => {
                const cell = cellMap.get(`${cls.id}|${sub.id}`)
                return (
                  <td key={cls.id} style={{ padding: '4px', borderBottom: '.5px solid var(--border)', textAlign: 'center' }}>
                    {cell ? (
                      <div title={`${cell.count} results`} style={{
                        margin: '0 auto', width: 44, height: 30, borderRadius: 8,
                        background: scoreBg(cell.avg),
                        border: `.5px solid ${scoreColor(cell.avg)}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: 11.5, color: scoreColor(cell.avg),
                        fontFamily: 'var(--font3)',
                      }}>{cell.avg}%</div>
                    ) : (
                      <div style={{ width: 44, height: 30, margin: '0 auto', borderRadius: 8, background: 'var(--surface2)', border: '.5px dashed var(--border)' }} />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ width: 110, fontSize: 12, fontWeight: 700, color: 'var(--txt2)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 22, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: color, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <div style={{ width: 32, fontSize: 12, fontWeight: 800, color, fontFamily: 'var(--font3)', flexShrink: 0 }}>{value}</div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────
export function DosStudentsPage() {
  const navigate = useNavigate()
  const { data: allStudents = [], isLoading: studentsLoading } = useStudents({ status: 'active' })
  const { data: classes = [] }  = useClasses()
  const { data: streams = [] }  = useStreams()
  const { data: subjects = [] } = useSubjects()
  const { data: attendanceMap = new Map() } = useAttendanceAgg()
  const { data: examData } = useExamAgg()

  const byStudent = examData?.byStudent ?? new Map()
  const heatmapCells = examData?.byClassSubject ?? []

  // ── Filters ──────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [filterClass, setFilterClass] = useState('')
  const [filterStream, setFilterStream] = useState('')
  const [filterGender, setFilterGender] = useState('')
  const [filterType,  setFilterType]  = useState('')

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalActive   = allStudents.length
  const boarders      = allStudents.filter(s => s.studentType === 'boarder').length
  const dayScholars   = allStudents.filter(s => s.studentType === 'day').length
  const males         = allStudents.filter(s => s.gender === 'male').length
  const females       = allStudents.filter(s => s.gender === 'female').length

  // New this term: enrolled in current calendar year
  const currentYear = new Date().getFullYear()
  const newThisTerm = allStudents.filter(s => s.enrolledAt && new Date(s.enrolledAt).getFullYear() === currentYear).length

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    let list = allStudents
    if (filterClass)  list = list.filter(s => s.classId === filterClass)
    if (filterStream) list = list.filter(s => s.streamId === filterStream)
    if (filterGender) list = list.filter(s => s.gender === filterGender)
    if (filterType)   list = list.filter(s => s.studentType === filterType)
    if (search) {
      const t = search.toLowerCase()
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(t) ||
        s.lastName.toLowerCase().includes(t) ||
        s.admissionNumber.toLowerCase().includes(t)
      )
    }
    return list
  }, [allStudents, filterClass, filterStream, filterGender, filterType, search])

  // ── Enrolment by class (for bar chart) ───────────────────────────────────
  const unassignedCount = useMemo(() => allStudents.filter(s => !s.classId).length, [allStudents])

  const enrolByClass = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of allStudents) {
      if (s.classId) m.set(s.classId, (m.get(s.classId) ?? 0) + 1)
    }
    return classes
      .map(c => ({ cls: c, count: m.get(c.id) ?? 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [allStudents, classes])

  const maxEnrolment = Math.max(enrolByClass[0]?.count ?? 1, unassignedCount)

  // ── Attendance by class ───────────────────────────────────────────────────
  const attendByClass = useMemo(() => {
    const m = new Map<string, { present: number; total: number }>()
    for (const s of allStudents) {
      if (!s.classId) continue
      const agg = attendanceMap.get(s.id)
      if (!m.has(s.classId)) m.set(s.classId, { present: 0, total: 0 })
      const ca = m.get(s.classId)!
      ca.present += agg?.present ?? 0
      ca.total   += agg?.total   ?? 0
    }
    return classes.map(c => {
      const ca = m.get(c.id) ?? { present: 0, total: 0 }
      const pct = ca.total > 0 ? Math.round((ca.present / ca.total) * 100) : null
      return { cls: c, pct }
    }).filter(x => x.pct !== null)
  }, [allStudents, classes, attendanceMap])

  // ── Helpers ───────────────────────────────────────────────────────────────
  const className  = (id: string | null) => classes.find(c => c.id === id)?.name ?? '—'
  const streamName = (id: string | null) => streams.find(s => s.id === id)?.name ?? null
  const attendPct  = (sid: string): number | null => {
    const a = attendanceMap.get(sid)
    return a && a.total > 0 ? Math.round((a.present / a.total) * 100) : null
  }
  const avgScore = (sid: string): number | null => {
    const e = byStudent.get(sid)
    return e ? Math.round(e.avgScore) : null
  }

  // ── Available streams for filter ──────────────────────────────────────────
  const filteredStreamsForDropdown = filterClass
    ? streams.filter(s => s.classId === filterClass)
    : streams

  if (studentsLoading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 14 }} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="sui-page-enter" style={{ padding: '0 0 80px' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 60%, #134e4a 100%)',
        padding: '36px 32px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -60, left: '40%', width: 260, height: 260, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', letterSpacing: -.5 }}>Student Analytics</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,.75)' }}>Enrolment, performance and attendance overview</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiChip label="Active Students" value={totalActive} />
            <KpiChip label="Boarders"        value={boarders} />
            <KpiChip label="Day Scholars"    value={dayScholars} />
            <KpiChip label="New This Year"   value={newThisTerm} />
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── Row 1: Gender split + Enrolment by class ──────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>

          {/* Gender distribution */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Gender Distribution</h3>
            {totalActive > 0 ? (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  {/* Donut SVG */}
                  {(() => {
                    const r = 42, cx = 52, cy = 52, circ = 2 * Math.PI * r
                    const malePct  = totalActive > 0 ? males / totalActive : 0
                    const maleDash = malePct * circ
                    return (
                      <svg width="104" height="104" style={{ flexShrink: 0 }}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface2)" strokeWidth="14" />
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0ea5e9" strokeWidth="14"
                          strokeDasharray={`${maleDash} ${circ}`} strokeLinecap="round"
                          transform={`rotate(-90 ${cx} ${cy})`} />
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ec4899" strokeWidth="14"
                          strokeDasharray={`${circ - maleDash} ${circ}`}
                          strokeDashoffset={-(maleDash)}
                          strokeLinecap="round"
                          transform={`rotate(-90 ${cx} ${cy})`} />
                        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="15" fontWeight="900" fill="var(--txt)" fontFamily="var(--font2)">{totalActive}</text>
                        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="var(--txt3)" fontFamily="var(--font2)">Students</text>
                      </svg>
                    )
                  })()}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0ea5e9' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>Male</span>
                      </div>
                      <div style={{ height: 8, width: 160, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalActive > 0 ? (males/totalActive)*100 : 0}%`, background: '#0ea5e9', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3, display: 'block' }}>{males} ({totalActive > 0 ? Math.round((males/totalActive)*100) : 0}%)</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ec4899' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>Female</span>
                      </div>
                      <div style={{ height: 8, width: 160, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${totalActive > 0 ? (females/totalActive)*100 : 0}%`, background: '#ec4899', borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3, display: 'block' }}>{females} ({totalActive > 0 ? Math.round((females/totalActive)*100) : 0}%)</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '20px 0' }}>No data.</div>
            )}
          </div>

          {/* Enrolment by class */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Enrolment by Class</h3>
            {enrolByClass.length > 0 || unassignedCount > 0 ? (
              <>
                {enrolByClass.slice(0, 8).map(({ cls, count }) => (
                  <HBar key={cls.id} label={cls.name} value={count} max={maxEnrolment} color="var(--brand)" />
                ))}
                {unassignedCount > 0 && (
                  <HBar label="Unassigned" value={unassignedCount} max={maxEnrolment} color="var(--danger)" />
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', padding: '20px 0' }}>No class data.</div>
            )}
            {unassignedCount > 0 && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
                </svg>
                {unassignedCount} active student{unassignedCount !== 1 ? 's have' : ' has'} no class assigned — ask Secretary to assign {unassignedCount !== 1 ? 'them' : 'a class'}.
              </div>
            )}
          </div>
        </div>

        {/* ── Attendance by class ─────────────────────────────────────────────── */}
        {attendByClass.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Attendance Rate by Class</h3>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {attendByClass.map(({ cls, pct }) => (
                <div key={cls.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '14px 18px', borderRadius: 14,
                  background: pct! >= 80 ? 'rgba(16,185,129,.08)' : pct! >= 60 ? 'rgba(245,158,11,.08)' : 'rgba(244,63,94,.08)',
                  border: `.5px solid ${pct! >= 80 ? 'rgba(16,185,129,.25)' : pct! >= 60 ? 'rgba(245,158,11,.25)' : 'rgba(244,63,94,.25)'}`,
                  minWidth: 80,
                }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: pct! >= 80 ? 'var(--success)' : pct! >= 60 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font2)' }}>{pct}%</span>
                  <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginTop: 3 }}>{cls.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Class × Subject performance heatmap ─────────────────────────────── */}
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Class × Subject Avg Score</h3>
            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {[['>=70% Good', '#10b981'], ['50-69% Average', '#f59e0b'], ['<50% Needs Attention', '#f43f5e']].map(([lbl, col]) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--txt3)' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: col as string }} />
                  {lbl}
                </div>
              ))}
            </div>
          </div>
          <ScoreHeatmap cells={heatmapCells} classes={classes} subjects={subjects} />
        </div>

        {/* ── Student list ────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
          {/* Filters */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '.5px solid var(--border)', background: 'linear-gradient(135deg,rgba(13,148,136,.04),transparent)' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
              Student List
              <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 99, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', fontSize: 11, fontWeight: 700 }}>{filteredStudents.length}</span>
            </h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search name or admission no…"
                className="sui-input"
                style={{ flex: '1 1 200px', minWidth: 160 }}
              />
              <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterStream('') }} className="sui-input" style={{ flex: '0 0 auto' }}>
                <option value="">All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {filterClass && filteredStreamsForDropdown.length > 0 && (
                <select value={filterStream} onChange={e => setFilterStream(e.target.value)} className="sui-input" style={{ flex: '0 0 auto' }}>
                  <option value="">All Streams</option>
                  {filteredStreamsForDropdown.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)} className="sui-input" style={{ flex: '0 0 auto' }}>
                <option value="">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="sui-input" style={{ flex: '0 0 auto' }}>
                <option value="">All Types</option>
                <option value="boarder">Boarders</option>
                <option value="day">Day Scholars</option>
              </select>
            </div>
          </div>

          {/* Cards */}
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
              No students match the selected filters.
            </div>
          ) : (
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
              {filteredStudents.slice(0, 100).map(s => {
                const ap  = attendPct(s.id)
                const avg = avgScore(s.id)
                const sn  = streamName(s.streamId)
                return (
                  <div key={s.id} onClick={() => navigate(`/dos/students/${s.id}`)} style={{
                    background: 'var(--surface2)', borderRadius: 14, padding: '14px 16px',
                    border: '.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8,
                    cursor: 'pointer', transition: 'border-color .15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    {/* Name row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                        background: s.gender === 'female' ? 'rgba(236,72,153,.15)' : 'rgba(14,165,233,.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 900, fontFamily: 'var(--font2)',
                        color: s.gender === 'female' ? '#ec4899' : '#0ea5e9',
                      }}>
                        {s.firstName[0]}{s.lastName[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.firstName} {s.lastName}</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{s.admissionNumber}</div>
                      </div>
                    </div>

                    {/* Class + badges */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-light)', padding: '2px 9px', borderRadius: 99 }}>
                        {className(s.classId)}{sn ? ` · ${sn}` : ''}
                      </span>
                      {s.gender && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: s.gender === 'female' ? 'rgba(236,72,153,.12)' : 'rgba(14,165,233,.12)', color: s.gender === 'female' ? '#ec4899' : '#0ea5e9' }}>
                          {s.gender.charAt(0).toUpperCase() + s.gender.slice(1)}
                        </span>
                      )}
                      {s.studentType && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: s.studentType === 'boarder' ? 'rgba(139,92,246,.12)' : 'rgba(16,185,129,.1)', color: s.studentType === 'boarder' ? '#8b5cf6' : 'var(--success)' }}>
                          {s.studentType === 'boarder' ? 'Boarder' : 'Day'}
                        </span>
                      )}
                    </div>

                    {/* Attendance + Score metrics */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      {ap !== null && (
                        <div style={{ flex: 1, background: ap >= 80 ? 'rgba(16,185,129,.08)' : ap >= 60 ? 'rgba(245,158,11,.08)' : 'rgba(244,63,94,.08)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: ap >= 80 ? 'var(--success)' : ap >= 60 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font2)' }}>{ap}%</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, marginTop: 1 }}>Attendance</div>
                        </div>
                      )}
                      {avg !== null && (
                        <div style={{ flex: 1, background: scoreBg(avg), borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 15, fontWeight: 900, color: scoreColor(avg), fontFamily: 'var(--font2)' }}>{avg}%</div>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700, marginTop: 1 }}>Avg Score</div>
                        </div>
                      )}
                      {ap === null && avg === null && (
                        <div style={{ flex: 1, fontSize: 11, color: 'var(--txt3)', textAlign: 'center', padding: '8px 0' }}>No performance data</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {filteredStudents.length > 100 && (
            <div style={{ padding: '12px 20px 16px', textAlign: 'center', fontSize: 12, color: 'var(--txt3)' }}>
              Showing first 100 of {filteredStudents.length} students. Refine filters to narrow results.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
