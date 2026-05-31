import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'
import { useAttendance, useClassTermAttendance, useSaveAttendance } from '../../hooks/useAttendance'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { Avatar } from '../../components/shared/Avatar'
import type { AttendanceStatus, Student } from '../../types/app'

// ── Status colours ─────────────────────────────────────────────
const STATUS_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string; border: string }> = {
  present: { label: 'Present', color: '#065f46',        bg: 'var(--success-bg)',  border: 'var(--success)' },
  absent:  { label: 'Absent',  color: 'var(--danger)',  bg: 'var(--danger-bg)',   border: 'var(--danger)'  },
  late:    { label: 'Late',    color: '#92400e',        bg: 'var(--warning-bg)',  border: 'var(--warning)' },
  excused: { label: 'Excused', color: '#1e40af',        bg: 'var(--info-bg)',     border: 'var(--info)'    },
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

// ── Status toggle ─────────────────────────────────────────────
function StatusToggle({ value, onChange }: { value: AttendanceStatus; onChange: (s: AttendanceStatus) => void }) {
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      {STATUSES.map(s => {
        const active = value === s
        const cfg    = STATUS_CFG[s]
        return (
          <button key={s} type="button" onClick={() => onChange(s)}
            style={{
              padding: '3px 10px', borderRadius: 6,
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
              cursor: 'pointer', transition: 'all 0.12s',
              border:      `1.5px solid ${active ? cfg.border : 'var(--border)'}`,
              background:  active ? cfg.bg : 'transparent',
              color:       active ? cfg.color : 'var(--txt3)',
              whiteSpace: 'nowrap',
            }}>
            {cfg.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Attendance row (inside virtualiser) ───────────────────────
const ROW_HEIGHT = 60

function AttendanceRow({
  student, status, onStatusChange, style,
}: {
  student: Student
  status: AttendanceStatus
  onStatusChange: (id: string, s: AttendanceStatus) => void
  style: React.CSSProperties
}) {
  return (
    <tr style={{ ...style, display: 'table' }}>
      <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', width: '45%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar
            photoPath={student.photoUrl}
            bucket="student-photos"
            name={`${student.firstName} ${student.lastName}`}
            size="sm"
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.3 }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
              {student.admissionNumber}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
        <StatusToggle value={status} onChange={s => onStatusChange(student.id, s)} />
      </td>
    </tr>
  )
}

// ── AttendancePage ─────────────────────────────────────────────
export function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10)

  const [date,     setDate]     = useState(today)
  const [classId,  setClassId]  = useState('')
  const [streamId, setStreamId] = useState('')
  const [marks,    setMarks]    = useState<Map<string, AttendanceStatus>>(new Map())
  const [saved,    setSaved]    = useState(false)

  const { success: ok, error: err } = useToast()

  const { data: classes  = [] }                = useClasses()
  const { data: streams  = [] }                = useStreams(classId || null)
  const { data: students = [], isLoading: studentsLoading } = useStudents(
    streamId ? { streamId } : classId ? { classId } : {},
    !!(classId)
  )
  const { data: attendanceMap }                = useAttendance(classId || null, date)
  const { data: termRates = [] }               = useClassTermAttendance(classId || null)
  const saveMutation                           = useSaveAttendance()

  // Stable string key derived from Map content — React Query returns a new Map
  // reference on every refetch even when data is unchanged. Using the key as the
  // dependency means the effect only re-runs when data actually changes.
  const attendanceKey = useMemo(() => {
    if (!attendanceMap) return ''
    return Array.from(attendanceMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|')
  }, [attendanceMap])

  // Derive a stable key from students. `students` from useQuery defaults to a
  // fresh [] each render when data is undefined, which would re-fire the effect
  // every render and trigger an infinite setMarks loop.
  const studentsKey = students.map(s => s.id).join('|')

  useEffect(() => {
    if (students.length === 0) { setMarks(new Map()); return }
    const init = new Map<string, AttendanceStatus>()
    for (const s of students) init.set(s.id, attendanceMap?.get(s.id) ?? 'present')
    setMarks(init)
    setSaved(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsKey, attendanceKey])

  function handleClassChange(cid: string) {
    setClassId(cid)
    setStreamId('')
  }

  const handleStatusChange = useCallback((studentId: string, status: AttendanceStatus) => {
    setMarks(prev => {
      const next = new Map(prev)
      next.set(studentId, status)
      return next
    })
    setSaved(false)
  }, [])

  const summary = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0, excused: 0 }
    for (const s of marks.values()) c[s]++
    return c
  }, [marks])

  const belowThreshold = useMemo(
    () => termRates.filter(r => r.isBelowThreshold),
    [termRates]
  )

  function handleSave() {
    if (!classId) return
    saveMutation.mutate(
      { classId, date, records: students.map(s => ({ studentId: s.id, status: marks.get(s.id) ?? 'present' })) },
      {
        onSuccess: () => { ok('Attendance saved successfully'); setSaved(true) },
        onError:   e  => err(e.message),
      }
    )
  }

  // Virtualiser
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count:            students.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => ROW_HEIGHT,
    overscan:         8,
  })

  const hasClass    = !!classId
  const studentCount = students.length

  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ padding: '1.4rem 1.5rem' }}>
      <PageHeader
        title="Attendance"
        subtitle="Mark and track daily student attendance"
        action={
          hasClass && studentCount > 0 ? (
            <Button
              variant="primary"
              loading={saveMutation.isPending}
              onClick={handleSave}
              leftIcon={
                saved ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                )
              }
            >
              {saved ? 'Saved' : 'Save Attendance'}
            </Button>
          ) : null
        }
      />

      {/* ── Controls ──────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', padding: '1rem 1.25rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
        {/* Date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>Date</label>
          <input type="date" value={date} max={today}
            onChange={e => { setDate(e.target.value); setSaved(false) }}
            style={{ padding: '0.48rem 0.75rem', fontSize: 12.5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'var(--font1)', width: 160 }} />
        </div>

        {/* Class */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>Class</label>
          <div style={{ position: 'relative' }}>
            <select value={classId} onChange={e => handleClassChange(e.target.value)}
              style={{ padding: '0.48rem 1.8rem 0.48rem 0.75rem', fontSize: 12.5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: 'var(--txt)', fontFamily: 'var(--font2)', appearance: 'none', width: 130 }}>
              <option value="">All classes</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        {/* Stream */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>Stream</label>
          <div style={{ position: 'relative' }}>
            <select value={streamId} onChange={e => { setStreamId(e.target.value); setSaved(false) }}
              disabled={!classId}
              style={{ padding: '0.48rem 1.8rem 0.48rem 0.75rem', fontSize: 12.5, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', color: classId ? 'var(--txt)' : 'var(--txt3)', fontFamily: 'var(--font2)', appearance: 'none', width: 130, opacity: classId ? 1 : 0.5, cursor: classId ? 'default' : 'not-allowed' }}>
              <option value="">All streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)', alignSelf: 'center' }}>
          {dateLabel}
        </div>
      </div>

      {/* ── Empty prompt ──────────────────────────────────── */}
      {!hasClass && (
        <div style={{ padding: '4rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--brand-light)', border: '1.5px solid rgba(13,148,136,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
            Select a class to take attendance
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            Choose a date, class, and stream from the controls above.
          </div>
        </div>
      )}

      {/* ── Summary cards ─────────────────────────────────── */}
      {hasClass && studentCount > 0 && (
        <div className="sui-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
          {STATUSES.map(s => {
            const cfg   = STATUS_CFG[s]
            const count = summary[s]
            return (
              <div key={s} style={{ padding: '0.9rem 1.1rem', background: 'var(--surface)', border: `1px solid ${count > 0 ? cfg.border : 'var(--border)'}`, borderRadius: 'var(--r-lg)' }}>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 4 }}>{cfg.label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: count > 0 ? cfg.color : 'var(--txt3)', lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>
                  {studentCount > 0 ? `${Math.round((count / studentCount) * 100)}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Student list ──────────────────────────────────── */}
      {hasClass && (
        studentsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            <LoadingSpinner />
          </div>
        ) : studentCount === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', color: 'var(--txt3)', fontSize: 13 }}>
            No students found in the selected class / stream.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', marginBottom: '1.25rem' }}>
            {/* Sticky header */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontFamily: 'var(--font2)', width: '45%' }}>
                    Student ({studentCount})
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.55rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', fontFamily: 'var(--font2)' }}>
                    Status
                  </th>
                </tr>
              </thead>
            </table>

            {/* Virtualised rows */}
            <div ref={parentRef} style={{ height: Math.min(studentCount * ROW_HEIGHT, 520), overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '45%' }} />
                  <col />
                </colgroup>
                <tbody style={{ display: 'block', height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(vRow => {
                    const student = students[vRow.index]!
                    return (
                      <AttendanceRow
                        key={student.id}
                        student={student}
                        status={marks.get(student.id) ?? 'present'}
                        onStatusChange={handleStatusChange}
                        style={{
                          position: 'absolute',
                          top:    vRow.start,
                          left:   0,
                          width:  '100%',
                          height: ROW_HEIGHT,
                          tableLayout: 'fixed',
                        }}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{studentCount} students</span>
              <span>{date === today ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )
      )}

      {/* ── Below 80% warning panel ────────────────────────── */}
      {hasClass && belowThreshold.length > 0 && (
        <div style={{ padding: '1rem 1.25rem', background: 'var(--warning-bg)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12.5, color: '#92400e' }}>
              {belowThreshold.length} student{belowThreshold.length !== 1 ? 's' : ''} below 80% attendance this year
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {belowThreshold.map(r => {
              const student = students.find(s => s.id === r.studentId)
              if (!student) return null
              return (
                <span key={r.studentId} style={{ padding: '3px 10px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: '#92400e', fontFamily: 'var(--font2)' }}>
                  {student.firstName} {student.lastName} — {r.rate}%
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
