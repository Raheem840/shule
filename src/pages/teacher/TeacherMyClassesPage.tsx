import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'

// ── useMyTeachingClasses ─────────────────────────────────────────────────────
export function useMyTeachingClasses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-teaching-classes', user?.schoolId, user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // Get staff record with classes + check if class teacher of any stream
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, classes, subjects')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()

      if (!staffRow) return { staffId: null, classIds: [], classTeacherStreamId: null, classTeacherClassId: null }

      const staffId = (staffRow as any).id as string
      const classIds = ((staffRow as any).classes ?? []) as string[]

      // Find if this teacher is class teacher of any stream
      const { data: myStream } = await supabase
        .from('streams')
        .select('id, class_id')
        .eq('school_id', user!.schoolId)
        .eq('class_teacher_id', staffId)
        .maybeSingle()

      return {
        staffId,
        classIds,
        classTeacherStreamId: myStream ? (myStream as any).id as string : null,
        classTeacherClassId:  myStream ? (myStream as any).class_id as string : null,
      }
    },
  })
}

// ── useClassDetail ────────────────────────────────────────────────────────────
function useClassDetail(classId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['class-detail', classId, user?.schoolId],
    enabled: !!classId && !!user,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const [classRes, streamsRes] = await Promise.all([
        supabase.from('classes').select('id, name, level').eq('id', classId!).eq('school_id', user!.schoolId).single(),
        supabase.from('streams').select('id, name, class_teacher_id, staff!class_teacher_id(first_name, last_name)').eq('class_id', classId!).eq('school_id', user!.schoolId),
      ])
      return {
        cls:     classRes.data as any,
        streams: (streamsRes.data ?? []) as any[],
      }
    },
  })
}

// ── ClassCard ─────────────────────────────────────────────────────────────────
function ClassCard({
  classId: _classId, className, level, isClassTeacherClass, isSelected, onClick,
}: {
  classId: string; className: string; level: string | null
  isClassTeacherClass: boolean; isSelected: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const accent = isClassTeacherClass ? '#10b981' : '#0ea5e9'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, border: `1.5px solid ${isSelected ? accent : hovered ? accent + '55' : 'var(--border)'}`,
        background: isSelected ? `${accent}08` : 'var(--surface)',
        padding: '18px 20px', cursor: 'pointer',
        transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
        transform: hovered && !isSelected ? 'translateY(-2px)' : 'none',
        boxShadow: isSelected ? `0 0 0 3px ${accent}20, 0 8px 24px ${accent}15` : hovered ? '0 4px 16px rgba(0,0,0,.07)' : '0 1px 4px rgba(0,0,0,.04)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Top strip */}
      <div style={{ height: 3, borderRadius: 99, background: `linear-gradient(90deg, ${accent}, ${accent}88)`, marginBottom: 2 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: `linear-gradient(135deg, ${accent}22, ${accent}11)`,
          border: `1px solid ${accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>
            {className}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            {level && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,.1)', padding: '2px 8px', borderRadius: 99 }}>
                Level {level}
              </span>
            )}
            {isClassTeacherClass && (
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,.1)', padding: '2px 8px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                My Homeroom Class
              </span>
            )}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ flexShrink: 0, transition: 'transform .15s', transform: isSelected ? 'rotate(90deg)' : 'none' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  )
}

// ── ClassDetailPanel ──────────────────────────────────────────────────────────
function ClassDetailPanel({ classId, className, isMyHomeroom, navigate }: {
  classId: string; className: string; isMyHomeroom: boolean; navigate: ReturnType<typeof useNavigate>
}) {
  const { data, isLoading } = useClassDetail(classId)
  const { data: students = [], isLoading: studsLoading } = useStudents({ classId })

  if (isLoading || studsLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', color: 'var(--txt3)', fontSize: 13 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(13,148,136,.3)', borderTopColor: 'var(--brand)', animation: 'spin .7s linear infinite', marginRight: 10 }} />
      Loading class data…
    </div>
  )

  const streams = data?.streams ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{
        borderRadius: 16, padding: '20px 22px',
        background: isMyHomeroom
          ? 'linear-gradient(135deg, rgba(16,185,129,.12), rgba(13,148,136,.06))'
          : 'linear-gradient(135deg, rgba(14,165,233,.1), rgba(13,148,136,.06))',
        border: `.5px solid ${isMyHomeroom ? 'rgba(16,185,129,.2)' : 'rgba(14,165,233,.2)'}`,
      }}>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', letterSpacing: -.3, marginBottom: 6 }}>{className}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Students',  value: students.length },
            { label: 'Streams',   value: streams.length },
          ].map(k => (
            <div key={k.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', background: 'rgba(255,255,255,.6)', borderRadius: 10 }}>
              <span style={{ fontFamily: 'var(--font2)', fontSize: 22, fontWeight: 900, color: 'var(--txt)', lineHeight: 1 }}>{k.value}</span>
              <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 600, marginTop: 2 }}>{k.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Streams */}
      {streams.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', borderBottom: '.5px solid var(--border)' }}>Streams</div>
          {streams.map((s: any, i: number) => {
            const ct = s.staff ? `${s.staff.first_name} ${s.staff.last_name}` : null
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < streams.length - 1 ? '.5px solid var(--border)' : 'none' }}>
                <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 13.5 }}>{s.name}</div>
                {ct && <div style={{ fontSize: 11.5, color: 'var(--txt3)' }}>CT: {ct}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Students */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Students ({students.length})</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {students.slice(0, 50).map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < students.length - 1 ? '.5px solid var(--border)' : 'none' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, color: '#fff', flexShrink: 0 }}>
                {s.firstName[0]}{s.lastName[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{s.firstName} {s.lastName}</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{s.admissionNumber}</div>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--txt3)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 6 }}>{s.gender}</span>
            </div>
          ))}
          {students.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No students enrolled yet.</div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Exam Journal',  path: '/teacher/exams',       color: '#8b5cf6' },
          { label: 'Attendance',    path: '/teacher/attendance',   color: '#0ea5e9' },
          { label: 'Events',        path: '/teacher/events',       color: '#f59e0b' },
          { label: 'Curriculum',    path: '/teacher/curriculum',   color: '#10b981' },
        ].map(a => (
          <button key={a.label} onClick={() => navigate(a.path)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: `${a.color}15`, color: a.color, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', transition: 'background .13s' }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function TeacherMyClassesPage() {
  const { user } = useAuth()
  const { data: myData, isLoading } = useMyTeachingClasses()
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const navigate = useNavigate()

  // Fetch the class names for the assigned class IDs
  const { data: allClassesResult } = useQuery({
    queryKey: ['classes-for-ids', myData?.classIds],
    enabled: !!myData?.classIds?.length,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!myData?.classIds?.length) return []
      const { data } = await supabase
        .from('classes')
        .select('id, name, level')
        .in('id', myData.classIds)
        .eq('school_id', user!.schoolId)
        .order('name')
      return (data ?? []) as { id: string; name: string; level: string | null }[]
    },
  })

  const classes = allClassesResult ?? []

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: 'var(--txt3)', fontSize: 14, gap: 10 }}>
      <LoadingSpinner size={20} />
      Loading your classes…
    </div>
  )

  if (!myData?.classIds?.length) return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, minHeight: 400, textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(13,148,136,.08)', border: '1px dashed rgba(13,148,136,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 18, color: 'var(--txt)', marginBottom: 8 }}>No Classes Assigned Yet</div>
        <div style={{ fontSize: 13.5, color: 'var(--txt3)', lineHeight: 1.6 }}>The DoS hasn't assigned you to any classes. Contact your Director of Studies.</div>
      </div>
    </div>
  )

  const selectedClass = selectedClassId ? classes.find(c => c.id === selectedClassId) : null

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg, #0ea5e9 0%, #0d9488 100%)', padding: '24px 28px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', marginBottom: 4, letterSpacing: -.4 }}>My Classes</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''} assigned to teach
            {myData.classTeacherClassId && ' · Homeroom class highlighted'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 16, alignItems: 'start' }}>
        {/* Left: class list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {classes.map(c => (
            <ClassCard
              key={c.id}
              classId={c.id}
              className={c.name}
              level={c.level}
              isClassTeacherClass={c.id === myData.classTeacherClassId}
              isSelected={selectedClassId === c.id}
              onClick={() => setSelectedClassId(c.id === selectedClassId ? null : c.id)}
            />
          ))}
        </div>

        {/* Right: detail panel */}
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '24px', minHeight: 200 }}>
          {selectedClass ? (
            <ClassDetailPanel
              classId={selectedClass.id}
              className={selectedClass.name}
              isMyHomeroom={selectedClass.id === myData.classTeacherClassId}
              navigate={navigate}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, minHeight: 260, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(14,165,233,.08)', border: '1px solid rgba(14,165,233,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5">
                  <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 4 }}>Select a class</div>
                <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6 }}>Click a class card on the left to see its students, streams, and quick actions.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
