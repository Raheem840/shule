import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useClasses, useStreams, useCreateStream, useMoveStudent, useCreateClass } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { useStudents } from '../../hooks/useStudents'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { printElement, PRINT_INK, PRINT_RULE, PRINT_BRAND } from '../../lib/printElement'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import type { Stream, Student } from '../../types/app'

const portal = () => document.querySelector('.ar') as HTMLElement ?? document.body
const PBtn = ({ children, onClick, disabled, loading, primary, type = 'button' }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; primary?: boolean; type?: 'button'|'submit' }) => (
  <button type={type} onClick={onClick} disabled={disabled || loading}
    style={{ display:'flex', alignItems:'center', gap:6, padding:'12px 18px', borderRadius:10, border: primary ? 'none' : '.5px solid var(--border)', background: primary ? 'linear-gradient(145deg,#0ea5e9,#0284c7)' : 'var(--surface2)', color: primary ? '#fff' : 'var(--txt2)', fontWeight:700, fontSize:13, cursor: disabled||loading ? 'default' : 'pointer', opacity: disabled ? .5 : 1, boxShadow: primary ? '0 3px 10px rgba(14,165,233,.4)' : 'none', transition:'all .15s' }}>
    {loading ? 'Working…' : children}
  </button>
)
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])
  return createPortal(
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.52)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ width:'100%', maxWidth:440, maxHeight:'88dvh', overflowY:'auto', background:'var(--surface)', borderRadius:20, boxShadow:'0 24px 80px rgba(0,0,0,.28)', padding:'22px 24px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:16, color:'var(--txt)' }}>{title}</div>
          <button onClick={onClose} style={{ width:44, height:44, borderRadius:11, border:'none', background:'var(--surface2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt3)', flexShrink:0 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        {children}
      </div>
    </div>,
    portal()
  )
}

// ── Level label helper ────────────────────────────────────────
function levelLabel(level: string | null): string {
  if (!level) return '—'
  const n = parseInt(level, 10)
  if (n <= 4) return `S.${n} (O-Level)`
  if (n === 5) return 'S.5 (A-Level)'
  if (n === 6) return 'S.6 (A-Level)'
  return `Level ${n}`
}

// ── Student chip (initials avatar + name + admission no.) ──────
const CHIP_AVATAR_COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981', '#6366f1']
function chipColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CHIP_AVATAR_COLORS[Math.abs(hash) % CHIP_AVATAR_COLORS.length]!
}
function StudentChip({ firstName, lastName, admissionNumber }: { firstName: string; lastName: string; admissionNumber: string }) {
  const name = `${firstName} ${lastName}`
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 9px 5px 5px', borderRadius: 7, background: 'var(--surface2)', border: '.5px solid var(--border)' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        background: chipColor(name), color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9.5, fontWeight: 800, fontFamily: 'var(--font2)',
      }}>
        {firstName[0]?.toUpperCase()}{lastName[0]?.toUpperCase()}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lastName} {firstName}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginLeft: 'auto', flexShrink: 0 }}>
        {admissionNumber}
      </span>
    </div>
  )
}

const LEVEL_COLORS = [
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fefce8', border: '#fef08a', text: '#a16207' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
]

// ── Add Class Modal ───────────────────────────────────────────
const LEVELS = [
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
    const trimmed = name.trim()
    if (!trimmed) return
    createClass.mutate({ name: trimmed, level: level || null }, {
      onSuccess: () => { ok(`Class "${trimmed}" created`); onClose() },
      onError:   (e: Error) => err(e.message),
    })
  }

  return (
    <ModalShell title="Add New Class" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Class name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>
              Class Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. S.1, Senior 1, Form 1…"
              className="sui-input"
              style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontSize: 13.5, fontFamily: 'var(--font1)', color: 'var(--txt)', outline: 'none' }}
            />
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Use the short form your school uses (S.1, S2, Form 1…)</span>
          </div>

          {/* Level */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)' }}>
              Level (Optional)
            </label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="sui-input"
              style={{ width: '100%', padding: '0.65rem 0.9rem', background: 'var(--surface2)', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', fontSize: 13.5, color: 'var(--txt)' }}
            >
              <option value="">— Select level —</option>
              {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Used for sorting and curriculum tracking</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 4 }}>
            <PBtn type="button" onClick={onClose}>Cancel</PBtn>
            <PBtn primary type="submit" loading={createClass.isPending} disabled={!name.trim()}>Create Class</PBtn>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Add Stream Modal ──────────────────────────────────────────
function AddStreamModal({
  classId,
  className,
  streams,
  color,
  onClose,
}: {
  classId:   string
  className: string
  streams:   Stream[]
  color:     { bg: string; border: string; text: string }
  onClose:   () => void
}) {
  const [name, setName] = useState('')
  const { success: ok, error: err } = useToast()
  const createStream = useCreateStream()
  const previewFull  = name.trim() ? `${className} ${name.trim()}` : null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createStream.mutate({ classId, name: trimmed }, {
      onSuccess: () => { ok(`Stream "${trimmed}" added to ${className}`); onClose() },
      onError:   e  => err(e.message),
    })
  }

  return (
    <ModalShell title="Add Stream" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Class context banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0.85rem 1rem',
            background: color.bg, borderRadius: 'var(--r)',
            border: `1px solid ${color.border}`,
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11, flexShrink: 0,
              background: color.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth="1.8">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', lineHeight: 1.2 }}>
                {className}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 3 }}>
                {streams.length === 0
                  ? 'No streams yet — add the first one'
                  : `${streams.length} stream${streams.length !== 1 ? 's' : ''} already`}
              </div>
            </div>
          </div>

          {/* Stream name input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 11, fontWeight: 800, color: 'var(--txt2)',
              textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)',
            }}>
              Stream Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. East, West, A, B, Rose, Nile…"
              className="sui-input"
              style={{
                width: '100%', padding: '0.65rem 0.9rem',
                background: 'var(--surface2)',
                border: '1.5px solid var(--border)',
                borderRadius: 'var(--r)', fontSize: 13.5,
                fontFamily: 'var(--font1)', color: 'var(--txt)', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
              Short name — it will be combined with the class above
            </span>
          </div>

          {/* Live preview */}
          {previewFull && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '0.65rem 0.9rem',
              background: 'var(--brand-light)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid rgba(13,148,136,0.2)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span style={{ fontSize: 12.5, color: 'var(--txt2)', fontWeight: 600 }}>
                Will appear as:{' '}
                <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, color: 'var(--txt)' }}>
                  {previewFull}
                </span>
              </span>
            </div>
          )}

          {/* Existing stream chips */}
          {streams.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                fontFamily: 'var(--font2)', marginBottom: 8,
              }}>
                Existing streams
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {streams.map(s => (
                  <span key={s.id} style={{
                    padding: '4px 11px', borderRadius: 20,
                    background: color.bg, border: `1px solid ${color.border}`,
                    fontSize: 12, fontWeight: 700, color: color.text,
                    fontFamily: 'var(--font2)',
                  }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: 4 }}>
            <PBtn type="button" onClick={onClose}>Cancel</PBtn>
            <PBtn primary type="submit" loading={createStream.isPending} disabled={!name.trim()}>Add Stream</PBtn>
          </div>
        </div>
      </form>
    </ModalShell>
  )
}

// ── Move Student Modal ────────────────────────────────────────
function MoveStudentModal({
  classId,
  fromStreamId,
  streams,
  onClose,
}: {
  classId:      string
  fromStreamId: string
  streams:      Stream[]
  onClose:      () => void
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [targetStreamId,    setTargetStreamId]    = useState('')
  const { success: ok, error: err } = useToast()
  const moveStudent  = useMoveStudent()
  const { data: students = [], isLoading } = useStudents({ classId, streamId: fromStreamId })

  const fromStream   = streams.find(s => s.id === fromStreamId)
  const targetStreams = streams.filter(s => s.id !== fromStreamId)

  function handleMove() {
    if (!selectedStudentId || !targetStreamId) return
    moveStudent.mutate({ studentId: selectedStudentId, toStreamId: targetStreamId }, {
      onSuccess: () => { ok('Student moved successfully'); onClose() },
      onError:   e  => err(e.message),
    })
  }

  return (
    <ModalShell title={`Move Student from ${fromStream?.name ?? '—'}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        {/* Student list */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
            Select Student
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
            {isLoading ? (
              <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
                <LoadingSpinner size="sm" />
              </div>
            ) : students.length === 0 ? (
              <div style={{ padding: '1rem', fontSize: 12, color: 'var(--txt3)', textAlign: 'center' }}>
                No students in this stream
              </div>
            ) : (
              students.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  style={{
                    padding: '0.55rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                    background: selectedStudentId === s.id ? 'var(--brand-light)' : 'transparent',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'background 0.1s',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                      {s.firstName} {s.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                      {s.admissionNumber}
                    </div>
                  </div>
                  {selectedStudentId === s.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Target stream */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font2)', marginBottom: 8 }}>
            Move To Stream
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {targetStreams.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '0.5rem 0' }}>
                No other streams in this class
              </div>
            ) : (
              targetStreams.map(stream => {
                const active = targetStreamId === stream.id
                return (
                  <label
                    key={stream.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0.5rem 0.75rem', border: `1.5px solid ${active ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 'var(--r)', background: active ? 'var(--brand-light)' : 'var(--surface2)', cursor: 'pointer', transition: 'all 0.12s' }}
                  >
                    <input
                      type="radio"
                      name="targetStream"
                      style={{ accentColor: 'var(--brand)' }}
                      checked={active}
                      onChange={() => setTargetStreamId(stream.id)}
                    />
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--txt2)' }}>
                      {stream.name}
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <PBtn onClick={onClose}>Cancel</PBtn>
          <PBtn primary disabled={!selectedStudentId || !targetStreamId} loading={moveStudent.isPending} onClick={handleMove}>Move Student</PBtn>
        </div>
      </div>
    </ModalShell>
  )
}

// ── Stream row inside a class card ────────────────────────────
function StreamRow({
  streamId,
  streamName,
  classTeacherId,
  staffList,
  classId,
  onMoveStudent,
}: {
  streamId:       string
  streamName:     string
  classTeacherId: string | null
  staffList:      { id: string; firstName: string; lastName: string }[]
  classId:        string
  onMoveStudent:  () => void
}) {
  const [expanded, setExpanded] = useState(true)
  const { data: students = [] } = useStudents({ classId, streamId })
  const count = students.length
  const sortedStudents = [...students].sort(sortByName)

  // Use the specific teacher assigned to this stream (by ID), not just any class_teacher
  const teacher = classTeacherId
    ? staffList.find(s => s.id === classTeacherId)
    : null

  return (
    <div style={{ borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.85rem', cursor: 'pointer', gap: 10, flexWrap: 'wrap' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.3"
            style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
            {streamName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600 }}>
            {count} student{count !== 1 ? 's' : ''}
          </span>

          {teacher ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', fontFamily: 'var(--font2)', flexShrink: 0 }}>
                {teacher.firstName[0]}{teacher.lastName[0]}
              </div>
              <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>
                {teacher.firstName} {teacher.lastName}
              </span>
            </div>
          ) : (
            <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,.1)', color: 'var(--warning)', border: '.5px solid rgba(245,158,11,.25)' }}>No teacher assigned</span>
          )}

          <button
            onClick={e => { e.stopPropagation(); onMoveStudent() }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', minHeight: 36, fontSize: 11, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', gap: 5, transition: 'border-color 0.15s, color 0.15s', whiteSpace: 'nowrap' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            Move Student
          </button>
        </div>
      </div>

      {/* Actual students in this stream — the whole point of a class list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.6rem 0.85rem' }}>
          {sortedStudents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic', textAlign: 'center', padding: '0.4rem 0' }}>
              No students in this stream yet
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {sortedStudents.map(s => (
                <StudentChip key={s.id} firstName={s.firstName} lastName={s.lastName} admissionNumber={s.admissionNumber} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Class card ────────────────────────────────────────────────
function ClassCard({
  cls,
  colorIdx,
  staffList,
}: {
  cls:       { id: string; name: string; level: string | null; academicYearId: string | null }
  colorIdx:  number
  staffList: { id: string; firstName: string; lastName: string; role: string }[]
}) {
  const [expanded,      setExpanded]      = useState(true)
  const [addStreamOpen, setAddStreamOpen] = useState(false)
  const [moveContext,   setMoveContext]   = useState<{ streamId: string } | null>(null)

  const { data: streams = [] }  = useStreams(cls.id)
  const { data: students = [] } = useStudents({ classId: cls.id })

  const color     = LEVEL_COLORS[colorIdx % LEVEL_COLORS.length]!
  const levelNum  = cls.level ? parseInt(cls.level, 10) : null
  const iconLabel = levelNum ? `S${levelNum}` : cls.name.slice(0, 3).toUpperCase()

  return (
    <>
      <div className="class-card-premium" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

        {/* Card header */}
        <div style={{ padding: '1rem 1.25rem', background: color.bg, borderBottom: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
            onClick={() => setExpanded(e => !e)}
          >
            <div style={{ width: 46, height: 46, borderRadius: 12, background: color.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14, color: color.text, letterSpacing: '-0.5px' }}>
                {iconLabel}
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', letterSpacing: '-0.2px' }}>
                {cls.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                {levelLabel(cls.level)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: color.text }}>{students.length}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>students</div>
              </div>
              <div style={{ width: 1, background: color.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: color.text }}>{streams.length}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>streams</div>
              </div>
            </div>

            <button
              onClick={() => setAddStreamOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', minHeight: 36, border: `1.5px solid ${color.border}`, borderRadius: 9, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: color.text, fontFamily: 'var(--font2)', transition: 'all 0.15s' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add Stream
            </button>

            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', cursor: 'pointer' }}
              onClick={() => setExpanded(e => !e)}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        {/* Streams list */}
        {expanded && (
          <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {streams.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No streams yet — click "Add Stream" to create one</div>
              </div>
            ) : (
              streams.map(stream => (
                <StreamRow
                  key={stream.id}
                  streamId={stream.id}
                  streamName={stream.name}
                  classTeacherId={stream.classTeacherId}
                  staffList={staffList}
                  classId={cls.id}
                  onMoveStudent={() => setMoveContext({ streamId: stream.id })}
                />
              ))
            )}

            {/* Students in this class but not assigned to any stream — still
                part of "all the classes and streams", so surface them too
                instead of leaving them invisible. */}
            {students.some(s => !s.streamId) && (
              <div style={{ borderRadius: 8, background: 'var(--surface)', border: '1px dashed var(--border)', padding: '0.6rem 0.85rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', marginBottom: 6 }}>
                  Not yet assigned to a stream ({students.filter(s => !s.streamId).length})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                  {students.filter(s => !s.streamId).sort(sortByName).map(s => (
                    <StudentChip key={s.id} firstName={s.firstName} lastName={s.lastName} admissionNumber={s.admissionNumber} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals — rendered outside the card div so they're not clipped */}
      {addStreamOpen && (
        <AddStreamModal
          classId={cls.id}
          className={cls.name}
          streams={streams}
          color={color}
          onClose={() => setAddStreamOpen(false)}
        />
      )}

      {moveContext && (
        <MoveStudentModal
          classId={cls.id}
          fromStreamId={moveContext.streamId}
          streams={streams}
          onClose={() => setMoveContext(null)}
        />
      )}
    </>
  )
}

// ── Printable roster ──────────────────────────────────────────
// The on-screen ClassCard is an interactive widget (buttons, chevrons,
// colored icon tiles) — printing it directly (the previous behaviour)
// produced a printout still showing "Add Stream"/"Move Student" buttons and
// UI chrome, not a usable roster. This renders a separate, plain table-only
// version — hidden on screen (.print-only), shown only inside #print-root
// when printing — grouped by stream with each student's admission number.
const rosterThTd: React.CSSProperties = {
  border: 'none', borderBottom: `1px solid ${PRINT_RULE}`, padding: '5px 8px', textAlign: 'left', fontSize: 10.5, color: PRINT_INK,
}
const rosterTh: React.CSSProperties = {
  ...rosterThTd, fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: 0.5,
  color: '#fff', background: PRINT_BRAND, borderBottom: 'none',
}

function sortByName(a: Student, b: Student): number {
  return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
}

function RosterTable({ students }: { students: Student[] }) {
  if (students.length === 0) {
    return <div style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', margin: '2px 0 12px' }}>No students</div>
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
      <thead>
        <tr>
          <th style={{ ...rosterTh, width: 28, borderRadius: '5px 0 0 5px' }}>#</th>
          <th style={rosterTh}>Name</th>
          <th style={rosterTh}>Admission No.</th>
          <th style={{ ...rosterTh, width: 60, borderRadius: '0 5px 5px 0' }}>Gender</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s, i) => (
          <tr key={s.id} style={{ background: i % 2 === 1 ? '#f8fafc' : 'transparent' }}>
            <td style={{ ...rosterThTd, color: '#94a3b8', fontWeight: 700 }}>{i + 1}</td>
            <td style={{ ...rosterThTd, fontWeight: 600 }}>{s.lastName} {s.firstName}</td>
            <td style={{ ...rosterThTd, fontFamily: 'var(--font3)', color: '#475569' }}>{s.admissionNumber}</td>
            <td style={{ ...rosterThTd, textTransform: 'capitalize', color: '#475569' }}>{s.gender ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PrintableClassRoster({ cls, colorIdx }: { cls: { id: string; name: string; level: string | null }; colorIdx: number }) {
  const { data: streams  = [] } = useStreams(cls.id)
  const { data: students = [] } = useStudents({ classId: cls.id })
  const accent = LEVEL_COLORS[colorIdx % LEVEL_COLORS.length]!.text

  const byStream = new Map<string, Student[]>()
  for (const s of students) {
    const key = s.streamId ?? '__none__'
    byStream.set(key, [...(byStream.get(key) ?? []), s])
  }

  return (
    <div style={{ marginBottom: 26, pageBreakInside: 'avoid' as const }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: `2px solid ${accent}`, paddingBottom: 5, marginBottom: 10 }}>
        <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, fontFamily: 'var(--font2)', color: accent, letterSpacing: -0.2 }}>
          {cls.name}
        </h2>
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{levelLabel(cls.level)}</span>
        <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
          {students.length} student{students.length !== 1 ? 's' : ''}
        </span>
      </div>
      {streams.length === 0 ? (
        <RosterTable students={[...students].sort(sortByName)} />
      ) : (
        streams.map(stream => (
          <div key={stream.id}>
            <h3 style={{ fontSize: 11.5, fontWeight: 700, margin: '8px 0 4px', color: PRINT_INK }}>
              {cls.name} {stream.name} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({(byStream.get(stream.id) ?? []).length})</span>
            </h3>
            <RosterTable students={[...(byStream.get(stream.id) ?? [])].sort(sortByName)} />
          </div>
        ))
      )}
      {(byStream.get('__none__') ?? []).length > 0 && (
        <div>
          <h3 style={{ fontSize: 11.5, fontWeight: 700, margin: '8px 0 4px', color: PRINT_INK }}>Unassigned to a stream</h3>
          <RosterTable students={[...(byStream.get('__none__') ?? [])].sort(sortByName)} />
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────
export function ClassListPage() {
  const { data: classes = [], isLoading } = useClasses()
  const { data: staffList = [] }          = useStaff({ isActive: true })
  const { data: school }                  = useSchoolSettings()
  const [addClassOpen, setAddClassOpen]   = useState(false)
  const [levelFilter,  setLevelFilter]    = useState<string | null>(null)

  const sortedClasses = [...classes].sort((a, b) => {
    const la = parseInt(a.level ?? '0', 10)
    const lb = parseInt(b.level ?? '0', 10)
    return la - lb
  })

  // Level filter pills — for maneuverability once a school has many classes
  // (O-Level S.1-4 + A-Level S.5-6 can be 10+ streams deep). "All" plus one
  // pill per level actually present in the data, in level order.
  const availableLevels = useMemo(() => {
    const levels = new Set(sortedClasses.map(c => c.level).filter((l): l is string => !!l))
    return [...levels].sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
  }, [sortedClasses])

  const filteredClasses = levelFilter
    ? sortedClasses.filter(c => c.level === levelFilter)
    : sortedClasses

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {addClassOpen && <AddClassModal onClose={() => setAddClassOpen(false)} />}

      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Class List</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>{classes.length} class{classes.length !== 1 ? 'es' : ''} · {new Date().getFullYear()}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setAddClassOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 3px 12px rgba(13,148,136,.3)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Class
            </button>
            {!isLoading && classes.length > 0 && (
              <button
                onClick={() => printElement('class-list-printable')}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print Class List
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Level filter pills — click to narrow the list down to one level */}
      {!isLoading && availableLevels.length > 1 && (
        <div className="print-hide" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setLevelFilter(null)}
            style={{
              padding: '7px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: levelFilter === null ? 'none' : '.5px solid var(--border)',
              background: levelFilter === null ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--surface)',
              color: levelFilter === null ? '#fff' : 'var(--txt2)',
              boxShadow: levelFilter === null ? '0 3px 10px rgba(13,148,136,.3)' : 'none',
            }}
          >
            All
          </button>
          {availableLevels.map(level => {
            const active = levelFilter === level
            return (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                style={{
                  padding: '7px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  border: active ? 'none' : '.5px solid var(--border)',
                  background: active ? 'linear-gradient(145deg,var(--brand),var(--brand-dark))' : 'var(--surface)',
                  color: active ? '#fff' : 'var(--txt2)',
                  boxShadow: active ? '0 3px 10px rgba(13,148,136,.3)' : 'none',
                }}
              >
                {levelLabel(level).split(' (')[0].replace('.', '')}
              </button>
            )
          })}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 14 }} />)}</div>
      ) : classes.length === 0 ? (
        <div style={{ padding: '4rem', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
            No classes yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            Click "Add Class" above to create your first class.
          </div>
        </div>
      ) : filteredClasses.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', fontSize: 13, color: 'var(--txt3)' }}>
          No classes at this level.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredClasses.map((cls, i) => (
              <ClassCard
                key={cls.id}
                cls={cls}
                colorIdx={i}
                staffList={staffList.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, role: s.role }))}
              />
            ))}
          </div>

          {/* Hidden on screen, rendered only inside #print-root when printing
              (see printClassList/the .printing-report CSS) — a proper
              letterhead + plain roster tables instead of the interactive
              cards above. */}
          <div id="class-list-printable" className="print-only">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: `3px solid ${PRINT_BRAND}`, paddingBottom: 12, marginBottom: 18 }}>
              {school?.logoUrl ? (
                <img src={school.logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, background: PRINT_BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                  {(school?.shortName || school?.schoolName || 'S').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: PRINT_INK, letterSpacing: -0.3 }}>
                  {school?.schoolName ?? 'School'}
                </div>
                {school?.motto && (
                  <div style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic', marginTop: 1 }}>{school.motto}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: PRINT_BRAND }}>Class List</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {levelFilter ? ` · ${levelLabel(levelFilter)}` : ''}
                </div>
              </div>
            </div>
            {filteredClasses.map((cls, i) => (
              <PrintableClassRoster key={cls.id} cls={cls} colorIdx={i} />
            ))}
            <div style={{ borderTop: `1px solid ${PRINT_RULE}`, marginTop: 8, paddingTop: 8, fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>
              Generated by Shule — {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
