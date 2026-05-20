import { useState } from 'react'
import { useClasses, useStreams, useCreateStream, useMoveStudent } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { useStudents } from '../../hooks/useStudents'
import { Badge } from '../../components/ui/Badge'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Modal } from '../../components/ui/Modal'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import type { Stream } from '../../types/app'

// ── Level label helper ────────────────────────────────────────
function levelLabel(level: string | null): string {
  if (!level) return '—'
  const n = parseInt(level, 10)
  if (n <= 4) return `S.${n} (O-Level)`
  if (n === 5) return 'S.5 (A-Level)'
  if (n === 6) return 'S.6 (A-Level)'
  return `Level ${n}`
}

const LEVEL_COLORS = [
  { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  { bg: '#fefce8', border: '#fef08a', text: '#a16207' },
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
]

// ── Add Stream Modal ──────────────────────────────────────────
function AddStreamModal({
  classId,
  className,
  onClose,
}: {
  classId:   string
  className: string
  onClose:   () => void
}) {
  const [name, setName] = useState('')
  const { success: ok, error: err } = useToast()
  const createStream = useCreateStream()

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
    <Modal open onClose={onClose} title={`Add Stream to ${className}`} size="sm">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <Input
          label="Stream Name *"
          placeholder="e.g. East, West, A, B"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            loading={createStream.isPending}
            disabled={!name.trim()}
          >
            Add Stream
          </Button>
        </div>
      </form>
    </Modal>
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
    <Modal open onClose={onClose} title={`Move Student from ${fromStream?.name ?? '—'}`} size="sm">
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
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!selectedStudentId || !targetStreamId}
            loading={moveStudent.isPending}
            onClick={handleMove}
          >
            Move Student
          </Button>
        </div>
      </div>
    </Modal>
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
  const { data: students = [] } = useStudents({ classId, streamId })
  const count = students.length

  // Use the specific teacher assigned to this stream (by ID), not just any class_teacher
  const teacher = classTeacherId
    ? staffList.find(s => s.id === classTeacherId)
    : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.55rem 0.85rem', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <Badge variant="amber">No teacher assigned</Badge>
        )}

        <button
          onClick={onMoveStudent}
          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', fontFamily: 'var(--font2)', display: 'flex', alignItems: 'center', gap: 5, transition: 'border-color 0.15s, color 0.15s', whiteSpace: 'nowrap' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          Move Student
        </button>
      </div>
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

  const color = LEVEL_COLORS[colorIdx % LEVEL_COLORS.length]!

  return (
    <>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

        {/* Card header */}
        <div style={{ padding: '1rem 1.25rem', background: color.bg, borderBottom: `1px solid ${color.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
            onClick={() => setExpanded(e => !e)}
          >
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color.border, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14, color: color.text }}>
                {cls.name}
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
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', border: `1.5px solid ${color.border}`, borderRadius: 7, background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: color.text, fontFamily: 'var(--font2)', transition: 'all 0.15s' }}
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
          </div>
        )}
      </div>

      {/* Modals — rendered outside the card div so they're not clipped */}
      {addStreamOpen && (
        <AddStreamModal
          classId={cls.id}
          className={cls.name}
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

// ── Page ──────────────────────────────────────────────────────
export function ClassListPage() {
  const { data: classes = [], isLoading } = useClasses()
  const { data: staffList = [] }          = useStaff({ isActive: true })

  const sortedClasses = [...classes].sort((a, b) => {
    const la = parseInt(a.level ?? '0', 10)
    const lb = parseInt(b.level ?? '0', 10)
    return la - lb
  })

  return (
    <div>
      <PageHeader
        title="Class List"
        subtitle={`${classes.length} class${classes.length !== 1 ? 'es' : ''} · ${new Date().getFullYear()}`}
      />

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner />
        </div>
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
            Classes are managed by the Director of Studies or Principal.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedClasses.map((cls, i) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              colorIdx={i}
              staffList={staffList.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, role: s.role }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
