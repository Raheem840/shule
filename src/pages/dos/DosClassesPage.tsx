import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useClasses, useStreams, useCreateClass } from '../../hooks/useClasses'
import { useStudents } from '../../hooks/useStudents'
import { useAssignClassTeacher } from '../../hooks/useDos'
import { useStaff } from '../../hooks/useStaff'
import { useToast } from '../../components/ui/Toast'
import { StudentRosterList } from '../../components/shared/StudentRosterList'
import type { Stream, Class, Student } from '../../types/app'

// ── Add Class Modal ────────────────────────────────────────────────────────────
const DOS_LEVELS = [
  { value: '1', label: 'S.1 — Senior 1 (O-Level)' },
  { value: '2', label: 'S.2 — Senior 2 (O-Level)' },
  { value: '3', label: 'S.3 — Senior 3 (O-Level)' },
  { value: '4', label: 'S.4 — Senior 4 (O-Level)' },
  { value: '5', label: 'S.5 — Senior 5 (A-Level)' },
  { value: '6', label: 'S.6 — Senior 6 (A-Level)' },
]

function AddClassModal({ onClose }: { onClose: () => void }) {
  const [name, setName]   = useState('')
  const [level, setLevel] = useState('')
  const { success: ok, error: err } = useToast()
  const createClass = useCreateClass()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (createClass.isPending) return
    const trimmed = name.trim()
    if (!trimmed) return
    // level is NOT NULL at the DB level — used for CBC/report-card grouping.
    // Previously labeled "(optional)" and submitted as null, which surfaced
    // a raw Postgres constraint error instead of a friendly validation message.
    if (!level) { err('Level is required.'); return }
    createClass.mutate({ name: trimmed, level }, {
      onSuccess: () => { ok(`Class "${trimmed}" created`); onClose() },
      onError:   (e: Error) => err(e.message),
    })
  }

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 18px', background: 'linear-gradient(150deg,rgba(13,148,136,.1),transparent)', borderBottom: '.5px solid rgba(13,148,136,.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><line x1="14" y1="17.5" x2="20" y2="17.5"/><line x1="17" y1="14.5" x2="17" y2="20.5"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.2 }}>Add New Class</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Create a class for the active academic year</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>
              Class Name <span style={{ color: 'var(--danger)' }}>*</span>
            </div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. S.1, Senior 1, Form 1…"
              className="sui-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>
              Level <span style={{ color: 'var(--danger)' }}>*</span>
            </div>
            <select value={level} onChange={e => setLevel(e.target.value)} className="sui-input" style={{ width: '100%' }}>
              <option value="">— Select level —</option>
              {DOS_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
            <button type="submit" disabled={!name.trim() || !level || createClass.isPending}
              style={{ flex: 2, padding: '10px 0', background: (name.trim() && level) ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--border)', color: (name.trim() && level) ? '#fff' : 'var(--txt3)', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: (name.trim() && level) ? 'pointer' : 'default', boxShadow: (name.trim() && level) ? '0 4px 14px rgba(13,148,136,.4)' : 'none', transition: 'all .18s' }}>
              {createClass.isPending ? 'Creating…' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    portal
  )
}

// ─── Assign Teacher Modal ─────────────────────────────────────────────────────
function AssignTeacherModal({ stream, onClose }: { stream: Stream; onClose: () => void }) {
  const { success: ok, error: err } = useToast()
  const { data: staff = [] } = useStaff()
  const assign = useAssignClassTeacher()
  const [selectedId, setSelectedId] = useState('')
  // Excludes deactivated/suspended staff — matches useDosTeacherPerformance's
  // active-only convention for "assignable teachers"; previously a suspended
  // teacher was still selectable and could be confirmed as class teacher.
  const teachers = staff.filter(s => (s.role === 'teacher' || s.role === 'class_teacher') && s.isActive)

  async function handleAssign() {
    if (!selectedId || assign.isPending) return
    try {
      await assign.mutateAsync({ streamId: stream.id, classId: stream.classId, teacherId: selectedId })
      ok('Class teacher assigned.')
      onClose()
    } catch (e: any) { err(e.message) }
  }

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 18px', background: 'linear-gradient(150deg,rgba(139,92,246,.1),transparent)', borderBottom: '.5px solid rgba(139,92,246,.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(139,92,246,.4)', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.2 }}>Assign Class Teacher</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Stream: {stream.name}</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Select Teacher</div>
            <select className="sui-input" value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '10px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 11, fontWeight: 600, fontSize: 13, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
            <button disabled={!selectedId || assign.isPending} onClick={() => { void handleAssign() }}
              style={{ flex: 2, padding: '10px 0', background: selectedId ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'var(--border)', color: selectedId ? '#fff' : 'var(--txt3)', border: 'none', borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: selectedId ? 'pointer' : 'default', boxShadow: selectedId ? '0 4px 14px rgba(139,92,246,.4)' : 'none', transition: 'all .18s' }}>
              {assign.isPending ? 'Assigning…' : 'Assign'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    portal
  )
}

// ─── Streams panel (right panel when a card is selected) ─────────────────────
function StreamsPanel({ cls }: { cls: Class }) {
  const navigate = useNavigate()
  const { data: streams = [], isLoading } = useStreams(cls.id)
  const { data: students = [], isLoading: loadingStudents } = useStudents({ classId: cls.id, status: 'active' })
  const { data: staff = [] } = useStaff()
  const [assignStream, setAssignStream] = useState<Stream | null>(null)
  const [expandedStreamId, setExpandedStreamId] = useState<string | null>(null)

  const staffMap = useMemo(
    () => new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`])),
    [staff]
  )

  // Per-stream student counts
  const streamCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of students) {
      if (s.streamId) map.set(s.streamId, (map.get(s.streamId) ?? 0) + 1)
    }
    return map
  }, [students])

  const noStreamCount = students.filter(s => !s.streamId).length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--surface)', borderRadius: 18,
      border: '.5px solid rgba(13,148,136,.25)',
      boxShadow: '0 4px 32px rgba(13,148,136,.08)',
      overflow: 'hidden',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '20px 22px 18px',
        background: 'linear-gradient(135deg,rgba(13,148,136,.07),rgba(13,148,136,.02))',
        borderBottom: '.5px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(13,148,136,.35)', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--txt)', letterSpacing: -.3 }}>{cls.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 1 }}>
              {loadingStudents ? '…' : students.length} student{students.length !== 1 ? 's' : ''} · {streams.length} stream{streams.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        {cls.level && (
          <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 99, marginTop: 4,
            background: 'rgba(13,148,136,.1)', color: 'var(--brand)',
            border: '.5px solid rgba(13,148,136,.25)', fontSize: 10.5, fontWeight: 700,
          }}>
            Level {cls.level}
          </span>
        )}
      </div>

      {/* Streams list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 16px' }}>
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 72, borderRadius: 12 }} />)}
          </div>
        )}

        {!isLoading && streams.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)', marginBottom: 4 }}>No streams yet</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Streams are created when students are registered.</div>
          </div>
        )}

        {!isLoading && streams.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {streams.map(s => {
              const teacherName = s.classTeacherId ? (staffMap.get(s.classTeacherId) ?? null) : null
              const count = streamCounts.get(s.id) ?? 0
              const expanded = expandedStreamId === s.id
              const streamStudents = students.filter(st => st.streamId === s.id)
              return (
                <div key={s.id} style={{
                  borderRadius: 12, border: '.5px solid var(--border)', background: 'var(--surface2)',
                  overflow: 'hidden', transition: 'all .14s',
                }}>
                  <div
                    onClick={() => setExpandedStreamId(expanded ? null : s.id)}
                    style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: 'linear-gradient(145deg,rgba(13,148,136,.15),rgba(13,148,136,.06))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14, color: 'var(--brand)',
                    }}>
                      {s.name.slice(0, 2)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{s.name}</div>
                      {teacherName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>{teacherName}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>No class teacher</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                        background: 'rgba(14,165,233,.10)', color: 'var(--info)',
                        border: '.5px solid rgba(14,165,233,.2)',
                      }}>
                        {count} stu
                      </span>
                      <button
                        onClick={e => { e.stopPropagation(); setAssignStream(s) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '8px 12px', minHeight: 36, borderRadius: 9,
                          border: '.5px solid rgba(139,92,246,.3)',
                          background: 'rgba(139,92,246,.06)', color: '#8b5cf6',
                          fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .13s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,.14)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(139,92,246,.06)' }}
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        {s.classTeacherId ? 'Reassign' : 'Assign'}
                      </button>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.2" style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {expanded && (
                    <div style={{ borderTop: '.5px solid var(--border)' }}>
                      <StudentRosterList
                        students={streamStudents}
                        onSelect={(st: Student) => navigate(`/dos/students/${st.id}`)}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Students without a stream */}
            {noStreamCount > 0 && (
              <div style={{ padding: '10px 14px', borderRadius: 12, border: '.5px dashed var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--txt3)', flex: 1 }}>Unassigned to stream</span>
                <span style={{
                  padding: '2px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700,
                  background: 'rgba(148,163,184,.12)', color: 'var(--txt3)',
                  border: '.5px solid rgba(148,163,184,.25)',
                }}>
                  {noStreamCount} stu
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {assignStream && <AssignTeacherModal stream={assignStream} onClose={() => setAssignStream(null)} />}
    </div>
  )
}

// ─── Class summary card (grid item) ──────────────────────────────────────────
function ClassCard({
  cls, selected, onClick,
  streamCount, studentCount,
}: {
  cls: Class; selected: boolean; onClick: () => void
  streamCount: number; studentCount: number
}) {
  const [hovered, setHovered] = useState(false)
  const active = selected || hovered

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
        border: selected ? '.5px solid rgba(13,148,136,.45)' : `.5px solid ${hovered ? 'rgba(13,148,136,.25)' : 'var(--border)'}`,
        background: selected
          ? 'linear-gradient(145deg,rgba(13,148,136,.09),rgba(13,148,136,.03))'
          : 'var(--surface)',
        boxShadow: selected
          ? '0 6px 28px rgba(13,148,136,.13)'
          : hovered ? '0 4px 18px rgba(0,0,0,.07)' : '0 1px 6px rgba(0,0,0,.04)',
        transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
        transform: active && !selected ? 'translateY(-2px)' : 'none',
      }}
    >
      {/* Accent top bar */}
      <div style={{
        height: 3, width: '100%',
        background: selected
          ? 'linear-gradient(90deg,var(--brand),var(--brand-dark))'
          : 'transparent',
        transition: 'background .18s',
      }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Class name */}
        <div style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)',
          letterSpacing: -.5, lineHeight: 1, marginBottom: 6,
        }}>
          {cls.name}
        </div>

        {/* Level badge */}
        {cls.level && (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 99, marginBottom: 12,
            background: selected ? 'rgba(13,148,136,.12)' : 'var(--surface2)',
            color: selected ? 'var(--brand)' : 'var(--txt3)',
            border: selected ? '.5px solid rgba(13,148,136,.25)' : '.5px solid var(--border)',
            fontSize: 10.5, fontWeight: 700, transition: 'all .15s',
          }}>
            Level {cls.level}
          </span>
        )}

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, padding: '8px 10px', borderRadius: 10,
            background: 'rgba(14,165,233,.07)', border: '.5px solid rgba(14,165,233,.18)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--info)', lineHeight: 1 }}>
              {studentCount}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--txt3)', marginTop: 3, fontWeight: 600 }}>Students</div>
          </div>
          <div style={{
            flex: 1, padding: '8px 10px', borderRadius: 10,
            background: 'rgba(139,92,246,.07)', border: '.5px solid rgba(139,92,246,.18)',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: '#8b5cf6', lineHeight: 1 }}>
              {streamCount}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--txt3)', marginTop: 3, fontWeight: 600 }}>Streams</div>
          </div>
        </div>
      </div>

      {/* Selected indicator */}
      {selected && (
        <div style={{
          padding: '8px 16px', background: 'rgba(13,148,136,.08)',
          borderTop: '.5px solid rgba(13,148,136,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>Viewing streams</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
export function DosClassesPage() {
  const { data: classes = [], isLoading } = useClasses()
  const [selectedId,    setSelectedId]    = useState<string | null>(null)
  const [addClassOpen,  setAddClassOpen]  = useState(false)

  const selectedClass = classes.find(c => c.id === selectedId) ?? null

  // Auto-select first class when loaded
  useEffect(() => {
    if (!isLoading && classes.length > 0 && !selectedId) {
      setSelectedId(classes[0].id)
    }
  }, [isLoading, classes, selectedId])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {addClassOpen && <AddClassModal onClose={() => setAddClassOpen(false)} />}

      {/* ── Hero Band ──────────────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 55%,#0369a1 100%)',
        padding: '28px 28px 24px', position: 'relative',
      }}>
        {/* decorative orbs */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -24, right: 80, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 20, right: 160, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,.20)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 26, color: '#fff', margin: 0, letterSpacing: -.5 }}>
              Classes &amp; Streams
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 14px', fontWeight: 500 }}>
            Select a class to view its streams, student counts, and assign class teachers.
          </p>

          <button
            onClick={() => setAddClassOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 11, border: 'none', background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 14, transition: 'background .15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.32)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.22)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add Class
          </button>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              {
                label: 'Classes',
                value: isLoading ? '—' : classes.length,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                  </svg>
                ),
              },
            ].map(stat => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(10px)',
                border: '.5px solid rgba(255,255,255,.30)', borderRadius: 13,
                padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 110,
              }}>
                {stat.icon}
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Loading skeletons ─────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="shule-skeleton" style={{ height: 130, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && classes.length === 0 && (
        <div style={{
          padding: '60px 24px', textAlign: 'center',
          background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>No classes yet</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 14 }}>Click "Add Class" above to create your first class.</div>
          <button
            onClick={() => setAddClassOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Add First Class
          </button>
        </div>
      )}

      {/* ── Main two-column layout ────────────────────────────────────────── */}
      {!isLoading && classes.length > 0 && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Left: class cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))',
            gap: 10,
            flex: '0 0 auto',
            width: classes.length <= 4 ? '100%' : undefined,
            maxWidth: 480,
          }}>
            {classes.map(c => (
              <ClassCardWithCounts
                key={c.id}
                cls={c}
                selected={selectedId === c.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>

          {/* Right: streams panel */}
          {selectedClass && (
            <div style={{ flex: 1, minWidth: 0, minHeight: 320, position: 'sticky', top: 12 }}>
              <StreamsPanel key={selectedClass.id} cls={selectedClass} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Wrapper that fetches counts for each card
function ClassCardWithCounts({ cls, selected, onClick }: { cls: Class; selected: boolean; onClick: () => void }) {
  const { data: streams = [] }  = useStreams(cls.id)
  const { data: students = [] } = useStudents({ classId: cls.id, status: 'active' })
  return (
    <ClassCard
      cls={cls}
      selected={selected}
      onClick={onClick}
      streamCount={streams.length}
      studentCount={students.length}
    />
  )
}
