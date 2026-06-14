import { useMyAssignedClasses, useStreams } from '../../hooks/useClasses'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents } from '../../hooks/useStudents'
import { useAttendance, useClassTermAttendance, useSaveAttendance } from '../../hooks/useAttendance'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { Avatar } from '../../components/shared/Avatar'
import type { AttendanceStatus, Student } from '../../types/app'

const STATUS_CFG: Record<AttendanceStatus, { label: string; color: string; bg: string; border: string }> = {
  present: { label: 'Present', color: '#065f46',        bg: 'rgba(16,185,129,.12)',  border: 'var(--success)' },
  absent:  { label: 'Absent',  color: 'var(--danger)',  bg: 'rgba(244,63,94,.12)',   border: 'var(--danger)'  },
  late:    { label: 'Late',    color: '#92400e',        bg: 'rgba(245,158,11,.12)',  border: 'var(--warning)' },
  excused: { label: 'Excused', color: '#1e40af',        bg: 'rgba(14,165,233,.12)',  border: 'var(--info)'    },
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused']

function StatusToggle({ value, onChange, readOnly }: { value: AttendanceStatus; onChange: (s: AttendanceStatus) => void; readOnly?: boolean }) {
  return (
    <div className="mob-att-toggle" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', opacity: readOnly ? 0.6 : 1 }}>
      {STATUSES.map(s => {
        const active = value === s
        const cfg    = STATUS_CFG[s]
        return (
          <button key={s} type="button" onClick={() => !readOnly && onChange(s)}
            className={`mob-att-pill${active ? ' is-active' : ''}`}
            data-short={cfg.label.charAt(0)}
            style={{
              padding: '11px 12px', borderRadius: 7,
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
              cursor: readOnly ? 'default' : 'pointer', transition: 'all 0.12s',
              border:     `.5px solid ${active ? cfg.border : 'var(--border)'}`,
              background: active ? cfg.bg : 'transparent',
              color:      active ? cfg.color : 'var(--txt3)',
              whiteSpace: 'nowrap',
            }}>
            <span className="mob-att-pill-full">{cfg.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const ROW_HEIGHT = 60

function AttendanceRow({
  student, status, onStatusChange, style, readOnly,
}: {
  student: Student
  status: AttendanceStatus
  onStatusChange: (id: string, s: AttendanceStatus) => void
  style: React.CSSProperties
  readOnly?: boolean
}) {
  return (
    <tr style={{ ...style, display: 'table' }}>
      <td style={{ padding: '0.65rem 1rem', borderBottom: '.5px solid var(--border)', verticalAlign: 'middle', width: '45%' }}>
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
      <td style={{ padding: '0.65rem 1rem', borderBottom: '.5px solid var(--border)', verticalAlign: 'middle' }}>
        <StatusToggle value={status} onChange={s => onStatusChange(student.id, s)} readOnly={readOnly} />
      </td>
    </tr>
  )
}

export function AttendancePage() {
  const today = new Date().toISOString().slice(0, 10)

  const [date,       setDate]       = useState(today)
  const [classId,    setClassId]    = useState('')
  const [streamId,   setStreamId]   = useState('')
  const [marks,      setMarks]      = useState<Map<string, AttendanceStatus>>(new Map())
  const [saved,      setSaved]      = useState(false)
  const [isReadOnly, setIsReadOnly] = useState(false)

  const { success: ok, error: err } = useToast()

  const classes                                = useMyAssignedClasses()
  const { data: streams  = [] }                = useStreams(classId || null)
  const { data: students = [], isLoading: studentsLoading } = useStudents(
    streamId ? { streamId } : classId ? { classId } : {},
    !!(classId)
  )
  const { data: attendanceMap }                = useAttendance(classId || null, date)
  const selectedClassName                      = classes.find(c => c.id === classId)?.name ?? ''
  const { data: termRates = [] }               = useClassTermAttendance(classId || null, selectedClassName)
  const saveMutation                           = useSaveAttendance()


  const attendanceKey = useMemo(() => {
    if (!attendanceMap) return ''
    return Array.from(attendanceMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|')
  }, [attendanceMap])

  const studentsKey = students.map(s => s.id).join('|')

  useEffect(() => {
    if (students.length === 0) { setMarks(new Map()); return }
    const init = new Map<string, AttendanceStatus>()
    for (const s of students) init.set(s.id, attendanceMap?.get(s.id) ?? 'present')
    setMarks(init)
    setSaved(false)
    setIsReadOnly(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentsKey, attendanceKey])

  function handleClassChange(cid: string) {
    setClassId(cid)
    setStreamId('')
    setIsReadOnly(false)
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
        onSuccess: () => { ok('Attendance saved successfully'); setSaved(true); setIsReadOnly(true) },
        onError:   e  => err(e.message),
      }
    )
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Premium page header ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Attendance</h1>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Mark and track daily student attendance</p>
        </div>
        {hasClass && studentCount > 0 && (
          <button
            onClick={() => {
              const className = classes?.find((c: any) => c.id === classId)?.name ?? ''
              const header = 'Name,Admission No,Status,Date\n'
              const rows = students.map(s => {
                const status = marks.get(s.id) ?? 'present'
                return `"${s.firstName} ${s.lastName}","${s.admissionNumber}","${status}","${date}"`
              }).join('\n')
              const blob = new Blob([header + rows], { type: 'text/csv' })
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `attendance-${className.replace(/\s+/g,'-')}-${date}.csv`
              a.click()
              URL.revokeObjectURL(a.href)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
        {hasClass && studentCount > 0 && isReadOnly && (
          <button
            onClick={() => setIsReadOnly(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: '1px solid var(--brand)', background: 'transparent', color: 'var(--brand)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', transition: 'all .18s', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Attendance
          </button>
        )}
        {hasClass && studentCount > 0 && !isReadOnly && (
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: saved ? 'linear-gradient(145deg,#10b981,#059669)' : 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: saved ? '0 4px 14px rgba(16,185,129,.4)' : '0 4px 14px rgba(13,148,136,.4)', transition: 'all .18s', flexShrink: 0 }}
          >
            {saved ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            )}
            {saveMutation.isPending ? 'Saving…' : saved ? 'Saved' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────── */}
      <div className="mob-att-filters" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'var(--font2)' }}>Date</label>
          <input type="date" value={date} max={today}
            onChange={e => { setDate(e.target.value); setSaved(false) }}
            style={{ padding: '8px 12px', fontSize: 12.5, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: 'var(--txt)', fontFamily: 'var(--font1)', width: '100%', minWidth: 140 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'var(--font2)' }}>Class</label>
          <div style={{ position: 'relative' }}>
            <select value={classId} onChange={e => handleClassChange(e.target.value)}
              style={{ padding: '8px 32px 8px 12px', fontSize: 12.5, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: 'var(--txt)', fontFamily: 'var(--font2)', appearance: 'none', width: 140 }}>
              <option value="">All classes</option>
              {classes.map((c: {id:string;name:string}) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '.5px', fontFamily: 'var(--font2)' }}>Stream</label>
          <div style={{ position: 'relative' }}>
            <select value={streamId} onChange={e => { setStreamId(e.target.value); setSaved(false) }}
              disabled={!classId}
              style={{ padding: '8px 32px 8px 12px', fontSize: 12.5, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: classId ? 'var(--txt)' : 'var(--txt3)', fontFamily: 'var(--font2)', appearance: 'none', width: 140, opacity: classId ? 1 : 0.5, cursor: classId ? 'default' : 'not-allowed' }}>
              <option value="">All streams</option>
              {streams.map((s: {id:string;name:string}) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)', alignSelf: 'center', fontStyle: 'italic' }}>
          {dateLabel}
        </div>
      </div>

      {/* ── Empty prompt ──────────────────────────────── */}
      {!hasClass && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(145deg,rgba(13,148,136,.12),rgba(13,148,136,.04))', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>Select a class to take attendance</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 320, margin: '0 auto' }}>Choose a date, class, and stream from the controls above.</div>
        </div>
      )}

      {/* ── Summary KPI cards ─────────────────────────── */}
      {hasClass && studentCount > 0 && (
        <div className="mob-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          {STATUSES.map(s => {
            const cfg   = STATUS_CFG[s]
            const count = summary[s]
            return (
              <div key={s} style={{ flex: '1 1 130px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -14, right: -14, width: 64, height: 64, borderRadius: '50%', background: count > 0 ? cfg.bg : 'transparent', filter: 'blur(20px)', pointerEvents: 'none' }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{cfg.label}</div>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: count > 0 ? cfg.color : 'var(--txt3)', letterSpacing: -1 }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                  {studentCount > 0 ? `${Math.round((count / studentCount) * 100)}%` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Student list ──────────────────────────────── */}
      {hasClass && (
        studentsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18 }}>
            <LoadingSpinner />
          </div>
        ) : studentCount === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, color: 'var(--txt3)', fontSize: 13 }}>
            No students found in the selected class / stream.
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .7, padding: '11px 14px', borderBottom: '.5px solid var(--border)', background: 'var(--surface2)', width: '45%' }}>
                    Student ({studentCount})
                  </th>
                  <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .7, padding: '11px 14px', borderBottom: '.5px solid var(--border)', background: 'var(--surface2)' }}>
                    Status
                  </th>
                </tr>
              </thead>
            </table>
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
                        readOnly={isReadOnly}
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
            <div style={{ padding: '10px 14px', borderTop: '.5px solid var(--border)', background: 'var(--surface2)', fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{studentCount} students</span>
              <span>{date === today ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        )
      )}

      {/* ── Below 80% alert ───────────────────────────── */}
      {hasClass && belowThreshold.length > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(245,158,11,.08)', border: '.5px solid rgba(245,158,11,.3)', borderRadius: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12.5, color: '#92400e' }}>
              {belowThreshold.length} student{belowThreshold.length !== 1 ? 's' : ''} below 80% attendance this year
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {belowThreshold.map(r => {
              const student = students.find(s => s.id === r.studentId)
              if (!student) return null
              return (
                <span key={r.studentId} style={{ padding: '3px 10px', background: 'rgba(245,158,11,.1)', border: '.5px solid rgba(245,158,11,.35)', borderRadius: 20, fontSize: 11.5, fontWeight: 700, color: '#92400e', fontFamily: 'var(--font2)' }}>
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
