import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useStudentAttendanceHistory } from '../../hooks/useAttendance'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useMyStream() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-stream', user?.schoolId, user?.staffId ?? user?.id],
    enabled:  !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Look up staff.id then find the stream where this teacher is class_teacher_id
      let staffId = user!.staffId
      if (!staffId) {
        const { data: s } = await supabase
          .from('staff').select('id')
          .eq('auth_user_id', user!.id).eq('school_id', user!.schoolId).maybeSingle()
        staffId = (s as any)?.id
      }
      if (!staffId) return null

      const { data } = await supabase
        .from('streams')
        .select('id, name, class_id, classes(name)')
        .eq('school_id', user!.schoolId)
        .eq('class_teacher_id', staffId)
        .maybeSingle()

      if (!data) return null
      return {
        streamId:   data.id as string,
        streamName: data.name as string,
        classId:    data.class_id as string,
        className:  (data.classes as any)?.name as string ?? '',
      }
    },
  })
}

function useClassStudents(streamId: string | null | undefined, classId: string | null | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['class-teacher-students', user?.schoolId, streamId, classId],
    enabled:  !!streamId && !!classId && !!user,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(
          'id, first_name, last_name, admission_number, photo_url, gender, dob,' +
          ' student_type, status, class_id, stream_id'
        )
        .eq('school_id', user!.schoolId)
        .eq('stream_id', streamId!)
        .eq('status', 'active')
        .order('last_name')

      if (error) throw error
      return ((data ?? []) as any[]).map(r => ({
        id:              r.id as string,
        firstName:       r.first_name as string,
        lastName:        r.last_name as string,
        admissionNumber: r.admission_number as string,
        photoUrl:        r.photo_url as string | null,
        gender: r.gender as "male" | "female" | null,
        dob:             r.dob as string | null,
        studentType: r.student_type as "day" | "boarder",
        status: r.status as "active" | "suspended" | "expelled",
        classId:         r.class_id as string | null,
        streamId:        r.stream_id as string | null,
      } satisfies Partial<Student> & { id: string; firstName: string; lastName: string; admissionNumber: string; photoUrl: string | null; gender: string | null; dob: string | null; studentType: string; status: string; classId: string | null; streamId: string | null }))
    },
  })
}

// ── useClassAnalytics ───────────────────────────────────────────────────────
// Class-wide (not per-student) academic + attendance analytics for "the class
// at large" — overall attendance rate, per-subject class averages (published
// exam results only, same convention as DOS's own analytics), and a
// needs-attention list (low attendance or low average score).
function useClassAnalytics(streamId: string | null | undefined, studentIds: string[]) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['class-teacher-analytics', user?.schoolId, streamId, studentIds.join(',')],
    enabled:  !!streamId && !!user?.schoolId && studentIds.length > 0,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId

      const [attendanceRes, journalRes, resultsRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('student_id, status')
          .eq('school_id', sid)
          .in('student_id', studentIds),
        supabase
          .from('exam_journal')
          .select('id')
          .eq('school_id', sid)
          .eq('status', 'published'),
        supabase
          .from('exam_results')
          .select('student_id, score, subject_id, exam_journal_id, subjects(name)')
          .eq('school_id', sid)
          .in('student_id', studentIds)
          .not('score', 'is', null),
      ])

      // ── Attendance ──────────────────────────────────────────────
      const attendRows = (attendanceRes.data ?? []) as any[]
      const perStudentAttend = new Map<string, { present: number; total: number }>()
      for (const r of attendRows) {
        const sid2 = r.student_id as string
        if (!perStudentAttend.has(sid2)) perStudentAttend.set(sid2, { present: 0, total: 0 })
        const a = perStudentAttend.get(sid2)!
        a.total++
        if (r.status === 'present' || r.status === 'late') a.present++
      }
      const classPresent = attendRows.filter(r => r.status === 'present' || r.status === 'late').length
      const classAttendRate = attendRows.length > 0 ? Math.round((classPresent / attendRows.length) * 100) : null

      // ── Academic — published journals only ───────────────────────
      const publishedIds = new Set((journalRes.data ?? []).map((j: any) => j.id as string))
      const results = ((resultsRes.data ?? []) as any[]).filter(r => publishedIds.has(r.exam_journal_id))

      const perSubject = new Map<string, { name: string; scores: number[] }>()
      const perStudentScores = new Map<string, number[]>()
      for (const r of results) {
        const subjId = r.subject_id as string
        const name   = r.subjects?.name as string ?? subjId
        if (!perSubject.has(subjId)) perSubject.set(subjId, { name, scores: [] })
        perSubject.get(subjId)!.scores.push(Number(r.score))

        const studId = r.student_id as string
        if (!perStudentScores.has(studId)) perStudentScores.set(studId, [])
        perStudentScores.get(studId)!.push(Number(r.score))
      }

      const subjectAverages = Array.from(perSubject.values())
        .map(({ name, scores }) => ({
          subject: name.length > 12 ? name.slice(0, 12) + '…' : name,
          avg:     Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          count:   scores.length,
        }))
        .sort((a, b) => b.avg - a.avg)

      const allScores = results.map(r => Number(r.score))
      const classAvgScore = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : null

      // ── Needs attention: attendance < 80% or average score < 50% ─
      const needsAttention = new Set<string>()
      for (const [studId, a] of perStudentAttend) {
        if (a.total > 0 && Math.round((a.present / a.total) * 100) < 80) needsAttention.add(studId)
      }
      for (const [studId, scores] of perStudentScores) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length
        if (avg < 50) needsAttention.add(studId)
      }

      return {
        classAttendRate,
        classAvgScore,
        subjectAverages,
        needsAttentionIds: needsAttention,
        assessedCount: perSubject.size,
      }
    },
  })
}

function useStudentSubjectScores(studentId: string | null | undefined, schoolId: string | undefined) {
  return useQuery({
    queryKey: ['student-subject-scores', schoolId, studentId],
    enabled:  !!studentId && !!schoolId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exam_results')
        .select('score, subject_id, subjects(name), exam_journal_id, exam_journal(assessment_type)')
        .eq('school_id', schoolId!)
        .eq('student_id', studentId!)
        .not('score', 'is', null)

      if (error) throw error

      const subjectMap = new Map<string, { name: string; scores: number[] }>()
      for (const r of (data ?? []) as any[]) {
        const sid  = r.subject_id as string
        const name = r.subjects?.name as string ?? sid
        if (!subjectMap.has(sid)) subjectMap.set(sid, { name, scores: [] })
        if (r.score != null) subjectMap.get(sid)!.scores.push(Number(r.score))
      }

      return Array.from(subjectMap.values()).map(({ name, scores }) => ({
        subject: name.length > 12 ? name.slice(0, 12) + '…' : name,
        avg:     scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
        count:   scores.length,
      })).filter(s => s.count > 0).sort((a, b) => b.avg - a.avg)
    },
  })
}

// ── Student performance modal ─────────────────────────────────────────────────

function StudentProfileModal({ student, streamName, className, onClose }: {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; photoUrl: string | null; gender: string | null; dob: string | null; studentType: string }
  streamName: string
  className: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const scoresQ  = useStudentSubjectScores(student.id, user?.schoolId)
  const attendQ  = useStudentAttendanceHistory(student.id)
  const fullName = `${student.firstName} ${student.lastName}`

  // Compute attendance rate from last 90 days
  const attendRate = (() => {
    const records = attendQ.data ?? []
    if (!records.length) return null
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length
    return Math.round((present / records.length) * 100)
  })()

  const gradeColor = (avg: number) =>
    avg >= 80 ? '#10b981' : avg >= 70 ? '#0ea5e9' : avg >= 60 ? '#f59e0b' : avg >= 50 ? '#f97316' : '#f43f5e'

  const portal = (document.querySelector('.ar') as HTMLElement) ?? document.body

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 560, maxHeight: '92dvh', background: 'var(--surface)', borderRadius: 22, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', background: 'linear-gradient(135deg,#0d9488 0%,#0f766e 100%)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 32, height: 32, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flexShrink: 0 }}>
              <Avatar photoPath={student.photoUrl} bucket="student-photos" name={fullName} size="lg" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: -.3 }}>{fullName}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>{student.admissionNumber}</div>
              <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 11, fontWeight: 700 }}>{className} {streamName}</span>
                <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{student.studentType}</span>
                {student.gender && <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,.18)', color: '#fff', fontSize: 11, fontWeight: 700, textTransform: 'capitalize' }}>{student.gender}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1, padding: '14px 18px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Attendance</div>
              {attendQ.isLoading ? (
                <div className="shule-skeleton" style={{ height: 32, borderRadius: 8 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: attendRate == null ? 'var(--txt3)' : attendRate >= 80 ? 'var(--success)' : attendRate >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                  {attendRate == null ? '—' : `${attendRate}%`}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2 }}>last 90 days · {attendQ.data?.length ?? 0} records</div>
            </div>

            <div style={{ flex: 1, padding: '14px 18px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Subjects Assessed</div>
              {scoresQ.isLoading ? (
                <div className="shule-skeleton" style={{ height: 32, borderRadius: 8 }} />
              ) : (
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--brand)' }}>{scoresQ.data?.length ?? 0}</div>
              )}
              <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2 }}>subjects with marks</div>
            </div>

            <div style={{ flex: 1, padding: '14px 18px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Avg Score</div>
              {scoresQ.isLoading ? (
                <div className="shule-skeleton" style={{ height: 32, borderRadius: 8 }} />
              ) : (() => {
                const avgs = scoresQ.data?.map(s => s.avg) ?? []
                const overall = avgs.length ? Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null
                return (
                  <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: overall == null ? 'var(--txt3)' : gradeColor(overall) }}>
                    {overall == null ? '—' : `${overall}%`}
                  </div>
                )
              })()}
              <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2 }}>across all subjects</div>
            </div>
          </div>

          {/* Subject performance chart */}
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 14 }}>Performance by Subject</div>
            {scoresQ.isLoading && <div className="shule-skeleton" style={{ height: 200, borderRadius: 12 }} />}
            {!scoresQ.isLoading && (!scoresQ.data || scoresQ.data.length === 0) && (
              <div style={{ padding: '28px 20px', textAlign: 'center', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>No marks uploaded for this student yet.</div>
            )}
            {!scoresQ.isLoading && scoresQ.data && scoresQ.data.length > 0 && (
              <div style={{ background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)', padding: '16px 8px' }}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoresQ.data} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                      formatter={(v: any) => [`${v}%`, 'Avg score']}
                    />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                      {scoresQ.data.map((s, i) => (
                        <Cell key={i} fill={gradeColor(s.avg)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Attendance heatmap — last 30 records */}
          {(attendQ.data ?? []).length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Recent Attendance</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...(attendQ.data ?? [])].slice(0, 60).reverse().map((r, i) => {
                  const c = r.status === 'present' ? '#10b981' : r.status === 'late' ? '#f59e0b' : r.status === 'excused' ? '#0ea5e9' : '#f43f5e'
                  return (
                    <div key={i} title={`${r.date} — ${r.status}`}
                      style={{ width: 12, height: 12, borderRadius: 3, background: c, cursor: 'default' }} />
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
                {[['#10b981', 'Present'], ['#f59e0b', 'Late'], ['#0ea5e9', 'Excused'], ['#f43f5e', 'Absent']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
                    <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    portal
  )
}

// ── Student card (same design pattern as secretary page) ──────────────────────

function StudentCard({ student, streamName: _streamName, className, onClick, needsAttention }: {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; photoUrl: string | null; gender: string | null; dob: string | null; studentType: string; status: string }
  streamName: string
  className: string
  onClick: () => void
  needsAttention?: boolean
}) {
  const fullName = `${student.firstName} ${student.lastName}`

  return (
    <div onClick={onClick} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'transform .14s, box-shadow .14s', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,0,0,.1)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 8px rgba(0,0,0,.04)' }}>
      {/* Card top gradient */}
      <div style={{ background: 'linear-gradient(135deg,#0d9488 0%,#0f766e 100%)', padding: '18px 20px 14px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        {needsAttention && (
          <div title="Needs attention — low attendance or average score" style={{ position: 'absolute', top: 10, left: 10, width: 22, height: 22, borderRadius: '50%', background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(244,63,94,.5)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M12 9v4M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <Avatar photoPath={student.photoUrl} bucket="student-photos" name={fullName} size="lg" />
        </div>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: '#fff', letterSpacing: -.2 }}>{fullName}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>{student.admissionNumber}</div>
      </div>

      {/* Card body */}
      <div style={{ padding: '12px 16px 14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'var(--brand-light)', borderRadius: 8, padding: '2px 9px' }}>{className}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'var(--surface2)', borderRadius: 8, padding: '2px 9px', border: '.5px solid var(--border)' }}>{student.studentType}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: 'var(--txt3)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {student.gender && <span style={{ textTransform: 'capitalize' }}>{student.gender}</span>}
          {student.dob && <><span>·</span><span>{new Date(student.dob).getFullYear()}</span></>}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ padding: '6px 14px', borderRadius: 10, background: 'var(--brand-light)', border: '.5px solid var(--brand)', color: 'var(--brand)', fontSize: 11.5, fontWeight: 700 }}>
            View Performance →
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ClassTeacherStudentsPage() {
  const streamQ   = useMyStream()
  const studentsQ = useClassStudents(streamQ.data?.streamId, streamQ.data?.classId)
  const studentIds = (studentsQ.data ?? []).map(s => s.id)
  const analyticsQ = useClassAnalytics(streamQ.data?.streamId, studentIds)
  const [selected, setSelected] = useState<NonNullable<typeof studentsQ.data>[number] | null>(null)
  const [search, setSearch] = useState('')

  const stream = streamQ.data
  const gradeColor = (avg: number) =>
    avg >= 80 ? '#10b981' : avg >= 70 ? '#0ea5e9' : avg >= 60 ? '#f59e0b' : avg >= 50 ? '#f97316' : '#f43f5e'

  const filtered = (studentsQ.data ?? []).filter(s => {
    const q = search.toLowerCase()
    return !q || `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(q)
  })

  if (streamQ.isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="shule-skeleton" style={{ height: 200, borderRadius: 16 }} />)}
      </div>
    )
  }

  if (!stream) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 20, border: '.5px solid var(--border)' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>📋</div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 18, color: 'var(--txt)', marginBottom: 8 }}>No Class Assigned</div>
        <div style={{ fontSize: 13.5, color: 'var(--txt3)', maxWidth: 340, margin: '0 auto' }}>You haven't been assigned as a class teacher yet. Ask the DoS to assign you to a stream.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>My Class</h1>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>{stream.className} {stream.streamName} · {studentsQ.data?.length ?? '…'} students</p>
        </div>
      </div>

      {/* ── Class-wide analytics ("the class at large") ──────────────────── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: 18, boxShadow: '0 2px 14px rgba(0,0,0,.04)' }}>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 14 }}>Class Overview</div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: analyticsQ.data?.subjectAverages.length ? 18 : 0 }}>
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Class Attendance</div>
            {analyticsQ.isLoading ? <div className="shule-skeleton" style={{ height: 26, borderRadius: 8 }} /> : (
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font2)', color: analyticsQ.data?.classAttendRate == null ? 'var(--txt3)' : analyticsQ.data.classAttendRate >= 80 ? 'var(--success)' : analyticsQ.data.classAttendRate >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                {analyticsQ.data?.classAttendRate == null ? '—' : `${analyticsQ.data.classAttendRate}%`}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Class Avg Score</div>
            {analyticsQ.isLoading ? <div className="shule-skeleton" style={{ height: 26, borderRadius: 8 }} /> : (
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font2)', color: analyticsQ.data?.classAvgScore == null ? 'var(--txt3)' : gradeColor(analyticsQ.data.classAvgScore) }}>
                {analyticsQ.data?.classAvgScore == null ? '—' : `${analyticsQ.data.classAvgScore}%`}
              </div>
            )}
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Needs Attention</div>
            {analyticsQ.isLoading ? <div className="shule-skeleton" style={{ height: 26, borderRadius: 8 }} /> : (
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font2)', color: (analyticsQ.data?.needsAttentionIds.size ?? 0) > 0 ? 'var(--danger)' : 'var(--success)' }}>
                {analyticsQ.data?.needsAttentionIds.size ?? 0}
              </div>
            )}
          </div>
        </div>

        {/* Per-subject class average chart */}
        {!analyticsQ.isLoading && (analyticsQ.data?.subjectAverages.length ?? 0) > 0 && (
          <div style={{ background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)', padding: '16px 8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analyticsQ.data!.subjectAverages} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                  formatter={(v: any) => [`${v}%`, 'Class avg']}
                />
                <Bar dataKey="avg" radius={[6, 6, 0, 0]}>
                  {analyticsQ.data!.subjectAverages.map((s, i) => (
                    <Cell key={i} fill={gradeColor(s.avg)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {!analyticsQ.isLoading && (analyticsQ.data?.subjectAverages.length ?? 0) === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', background: 'var(--surface2)', borderRadius: 14, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 12.5 }}>
            No published exam marks for this class yet.
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or admission number…"
          className="sui-input"
          style={{ width: '100%', paddingLeft: 36 }}
        />
      </div>

      {/* Grid */}
      {studentsQ.isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="shule-skeleton" style={{ height: 220, borderRadius: 16 }} />)}
        </div>
      )}

      {!studentsQ.isLoading && filtered.length === 0 && (
        <div style={{ padding: '36px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>
          {search ? `No students match "${search}".` : 'No active students in your class.'}
        </div>
      )}

      {!studentsQ.isLoading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 14 }}>
          {filtered.map(s => (
            <StudentCard
              key={s.id}
              student={s}
              streamName={stream.streamName}
              className={stream.className}
              onClick={() => setSelected(s)}
              needsAttention={analyticsQ.data?.needsAttentionIds.has(s.id)}
            />
          ))}
        </div>
      )}

      {selected && (
        <StudentProfileModal
          student={selected}
          streamName={stream.streamName}
          className={stream.className}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
