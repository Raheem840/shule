import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import {
  useTimetableSlots,
  useCreateTimetableSlot,
  useDeleteTimetableSlot,
  useCheckCollision,
  usePublishTimetable,
} from '../../hooks/useTimetableSlots'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TimetableSlot } from '../../types/week9'

const DAYS: [number, string][] = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri']]
const PERIODS = [1,2,3,4,5,6,7,8]

const SUBJECT_PALETTE: [string, string][] = [
  ['#6366f1','rgba(99,102,241,.13)'],
  ['#0ea5e9','rgba(14,165,233,.13)'],
  ['#10b981','rgba(16,185,129,.13)'],
  ['#f59e0b','rgba(245,158,11,.13)'],
  ['#f43f5e','rgba(244,63,94,.13)'],
  ['#8b5cf6','rgba(139,92,246,.13)'],
  ['#ec4899','rgba(236,72,153,.13)'],
  ['#0d9488','rgba(13,148,136,.13)'],
]

function slotColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJECT_PALETTE[Math.abs(h) % SUBJECT_PALETTE.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

type TeacherRow = {
  id: string; name: string; firstName: string; lastName: string
  subjects: string[]; classes: string[]
}

// ─── Fetch teachers with their subject assignments ────────────────────────────────
function useTeachersForTimetable() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['teachers-for-timetable', user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async (): Promise<TeacherRow[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, subjects, classes')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .in('role', ['teacher', 'class_teacher'])
        .order('last_name')
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id:        r.id as string,
        firstName: r.first_name as string,
        lastName:  r.last_name as string,
        name:      `${r.first_name} ${r.last_name}`,
        subjects:  (r.subjects as string[]) ?? [],
        classes:   (r.classes as string[]) ?? [],
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ─── Draggable slot chip ───────────────────────────────────────────────────────────
function SlotChip({ slot, onDelete }: { slot: TimetableSlot; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id, data: { slot } })
  const [color, bg] = slotColor(slot.subjectId)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: bg,
        border: `.5px solid ${color}40`,
        borderRadius: 10, padding: '6px 8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.35 : 1,
        position: 'relative', userSelect: 'none', WebkitUserSelect: 'none',
        transition: 'opacity .15s',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 11.5, color, marginBottom: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 14 }}>
        {slot.subjectName ?? '—'}
      </div>
      <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 900, color, flexShrink: 0, fontFamily: 'var(--font2)' }}>
          {initials(slot.teacherName ?? '?')}
        </div>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.teacherName?.split(' ')[0] ?? '—'}
        </span>
      </div>
      {slot.startTime && (
        <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 1, fontFamily: 'var(--font3)' }}>
          {slot.startTime}–{slot.endTime}
        </div>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{
          position: 'absolute', top: 4, right: 4, width: 16, height: 16,
          borderRadius: 5, border: 'none', background: 'rgba(0,0,0,.1)',
          cursor: 'pointer', fontSize: 8, color: 'var(--txt3)', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          lineHeight: 1, WebkitTapHighlightColor: 'transparent',
        }}
      >✕</button>
    </div>
  )
}

// ─── Droppable grid cell ───────────────────────────────────────────────────────────
function TimetableCell({
  day, period, slot, conflict, onClickEmpty, onDelete,
}: {
  day: number; period: number
  slot: TimetableSlot | undefined; conflict: boolean
  onClickEmpty: () => void; onDelete: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `cell-${day}-${period}`, data: { day, period } })
  return (
    <td
      ref={setNodeRef}
      style={{
        padding: 5, width: '18%', height: 76,
        background: conflict ? 'rgba(244,63,94,.05)' : isOver ? 'rgba(13,148,136,.07)' : 'transparent',
        border: conflict ? '.5px solid rgba(244,63,94,.28)' : '.5px solid var(--border)',
        verticalAlign: 'top', transition: 'background .14s',
      }}
    >
      {slot ? (
        <SlotChip slot={slot} onDelete={onDelete} />
      ) : (
        <div
          onClick={onClickEmpty}
          className="timetable-empty-cell"
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 7, background: 'transparent', border: '.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .14s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
        </div>
      )}
    </td>
  )
}

// ─── Field label ──────────────────────────────────────────────────────────────────
const Lbl = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>
    {children}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
  </label>
)

// ─── Assign slot modal ─────────────────────────────────────────────────────────────
function AssignModal({
  classId, streamId, term, year, day, period, onClose, onSaved,
}: {
  classId: string; streamId: string | null; term: string; year: number
  day: number; period: number; onClose: () => void; onSaved: () => void
}) {
  const { data: allSubjects = [] } = useSubjects()
  const { data: teachers = [] }    = useTeachersForTimetable()
  const createSlot     = useCreateTimetableSlot()
  const checkCollision = useCheckCollision()

  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime,   setEndTime]   = useState('')
  const [error,     setError]     = useState('')

  const dayName         = DAYS.find(d => d[0] === day)?.[1] ?? ''
  const selectedTeacher = teachers.find(t => t.id === teacherId)

  // Filter subjects to only those assigned to the selected teacher
  const filteredSubjects = selectedTeacher && selectedTeacher.subjects.length > 0
    ? allSubjects.filter(s => selectedTeacher.subjects.includes(s.id))
    : allSubjects

  const noSubjectsAssigned = !!selectedTeacher && selectedTeacher.subjects.length === 0

  function handleTeacherChange(id: string) {
    setTeacherId(id)
    setSubjectId('')
    setError('')
  }

  async function handleSave() {
    if (!teacherId || !subjectId) { setError('Please select a teacher and subject.'); return }
    setError('')
    try {
      const { classConflict, teacherConflict } = await checkCollision.mutateAsync({
        classId, streamId, teacherId, dayOfWeek: day, periodNumber: period, term, year,
      })
      if (classConflict)   { setError('This class already has a slot at this period.'); return }
      if (teacherConflict) { setError(`${selectedTeacher?.name ?? 'This teacher'} is already booked for period ${period} on ${dayName}.`); return }

      await createSlot.mutateAsync({
        classId, streamId, subjectId, teacherId,
        dayOfWeek: day as 1|2|3|4|5, periodNumber: period,
        startTime: startTime || null, endTime: endTime || null, term, year,
      })
      onSaved()
    } catch (ex: any) {
      setError(ex.message ?? 'Failed to save slot')
    }
  }

  const isPending    = createSlot.isPending || checkCollision.isPending
  const canSave      = !!teacherId && !!subjectId && !isPending

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto',
        background: 'var(--surface)', padding: '28px 24px 32px',
        borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 48px rgba(0,0,0,.18)',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Handle bar */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '-8px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(139,92,246,.38)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--txt)', fontFamily: 'var(--font2)', letterSpacing: -.3 }}>
              Assign Period
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>
              {dayName} · Period {period}
            </div>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Step 1: Teacher picker ── */}
        <div>
          <Lbl required>Select Teacher</Lbl>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', paddingRight: 2 }}>
            {teachers.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--txt3)', padding: '14px 12px', background: 'var(--surface2)', borderRadius: 12, textAlign: 'center' }}>
                No teachers found.
              </div>
            )}
            {teachers.map(t => {
              const active      = teacherId === t.id
              const [color, bg] = slotColor(t.id)
              return (
                <div
                  key={t.id}
                  onClick={() => handleTeacherChange(t.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 12, border: `.5px solid ${active ? color : 'var(--border)'}`,
                    background: active ? bg : 'var(--surface2)',
                    cursor: 'pointer', transition: 'all .14s', WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: active ? `${color}25` : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: active ? color : 'var(--txt3)', flexShrink: 0, fontFamily: 'var(--font2)', letterSpacing: -.3 }}>
                    {initials(t.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.2 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                      {t.subjects.length > 0 ? `${t.subjects.length} subject${t.subjects.length !== 1 ? 's' : ''}` : 'No subjects assigned'}
                    </div>
                  </div>
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Step 2: Subject chips ── */}
        {teacherId && (
          <div>
            <Lbl required>Subject</Lbl>
            {noSubjectsAssigned ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '.5px solid rgba(245,158,11,.25)', color: 'var(--warning)', fontSize: 12.5, fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                No subjects assigned to this teacher. Update via Staff Management.
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {filteredSubjects.map(s => {
                  const [color, bg] = slotColor(s.id)
                  const active      = subjectId === s.id
                  return (
                    <button
                      key={s.id} type="button" onClick={() => setSubjectId(s.id)}
                      style={{
                        padding: '7px 15px', borderRadius: 99,
                        border: `.5px solid ${active ? color : 'var(--border)'}`,
                        background: active ? bg : 'var(--surface2)',
                        color: active ? color : 'var(--txt3)',
                        fontSize: 13, fontWeight: active ? 700 : 600,
                        cursor: 'pointer', transition: 'all .14s', WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {s.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Optional time range ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <Lbl>Start Time</Lbl>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="sui-input" style={{ width: '100%' }} />
          </div>
          <div>
            <Lbl>End Time</Lbl>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="sui-input" style={{ width: '100%' }} />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 600 }}>
            <svg width="14" height="14" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <button
            type="button" onClick={onClose}
            style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}
          >
            Cancel
          </button>
          <button
            type="button" disabled={!canSave} onClick={() => { void handleSave() }}
            style={{
              flex: 2, padding: '11px 0',
              background: canSave ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'var(--border)',
              color: canSave ? '#fff' : 'var(--txt3)',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5,
              cursor: canSave ? 'pointer' : 'default', transition: 'all .18s',
              boxShadow: canSave ? '0 4px 14px rgba(139,92,246,.4)' : 'none',
            }}
          >
            {isPending ? 'Checking…' : 'Assign Slot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DOS TIMETABLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════════
export function DosTimetablePage() {
  const isMobile = useIsMobile()
  const { data: classes = [] } = useClasses()

  const [selectedClass,  setSelectedClass]  = useState<string | null>(null)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [term,  setTerm]  = useState('Term 1')
  const [year,  setYear]  = useState(new Date().getFullYear())
  const [published, setPublished] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [assignModal, setAssignModal] = useState<{ day: number; period: number } | null>(null)

  const { data: streams = [] } = useStreams(selectedClass)

  const { data: slots = [], isLoading } = useTimetableSlots({
    classId: selectedClass, streamId: selectedStream, term, year,
  })

  const deleteSlot = useDeleteTimetableSlot()
  const createSlot = useCreateTimetableSlot()
  const publishMut = usePublishTimetable()

  // day-period → slot lookup
  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  // Detect teacher-double-booked conflicts (same teacher, same day-period, multiple slots)
  const conflictKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of slots) {
      const k = `${s.teacherId}-${s.dayOfWeek}-${s.periodNumber}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const keys = new Set<string>()
    for (const s of slots) {
      if ((counts.get(`${s.teacherId}-${s.dayOfWeek}-${s.periodNumber}`) ?? 0) > 1) {
        keys.add(`${s.dayOfWeek}-${s.periodNumber}`)
      }
    }
    return keys
  }, [slots])

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name ?? ''
  const publishedCount    = slots.filter(s => s.isPublished).length
  const today             = new Date().getDay() // 1=Mon…5=Fri
  const todayCol          = today >= 1 && today <= 5 ? today : null

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActive(false)
    if (!over || !selectedClass) return
    const parts     = (over.id as string).split('-')
    const newDay    = parseInt(parts[1]) as 1|2|3|4|5
    const newPeriod = parseInt(parts[2])
    const slot      = active.data.current?.slot as TimetableSlot | undefined
    if (!slot) return
    if (slot.dayOfWeek === newDay && slot.periodNumber === newPeriod) return
    if (slotMap.has(`${newDay}-${newPeriod}`)) return
    try {
      await deleteSlot.mutateAsync(slot.id)
      await createSlot.mutateAsync({
        classId: slot.classId, streamId: slot.streamId,
        subjectId: slot.subjectId, teacherId: slot.teacherId,
        dayOfWeek: newDay, periodNumber: newPeriod,
        startTime: slot.startTime, endTime: slot.endTime, term, year,
      })
    } catch { /* silent */ }
  }

  async function handlePublish() {
    if (!selectedClass) return
    await publishMut.mutateAsync({ classId: selectedClass, term, year })
    setPublished(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(139,92,246,.4)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 18 : 22, color: 'var(--txt)', margin: 0, letterSpacing: -.3 }}>
              Timetable Builder
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: 0 }}>
              Click a cell to assign · Drag slots to rearrange
            </p>
          </div>
        </div>

        {selectedClass && (
          <button
            onClick={() => { void handlePublish() }}
            disabled={publishMut.isPending || published || slots.length === 0}
            style={{
              padding: '10px 22px', borderRadius: 12, border: published ? '.5px solid rgba(16,185,129,.3)' : 'none',
              background: published ? 'rgba(16,185,129,.12)' : slots.length === 0 ? 'var(--surface2)' : 'linear-gradient(145deg,#10b981,#059669)',
              color: published ? 'var(--success)' : slots.length === 0 ? 'var(--txt3)' : '#fff',
              fontWeight: 700, fontSize: 13.5, cursor: published || slots.length === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              boxShadow: published || slots.length === 0 ? 'none' : '0 4px 14px rgba(16,185,129,.4)',
            }}
          >
            {published ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Published
              </>
            ) : publishMut.isPending ? 'Publishing…' : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                Publish Timetable
              </>
            )}
          </button>
        )}
      </div>

      {/* ── Filters row ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px', minWidth: 150 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Class</label>
          <select
            value={selectedClass ?? ''}
            onChange={e => { setSelectedClass(e.target.value || null); setSelectedStream(null); setPublished(false) }}
            className="sui-input" style={{ width: '100%' }}
          >
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedClass && streams.length > 0 && (
          <div style={{ flex: '1 1 140px', minWidth: 130 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Stream</label>
            <select value={selectedStream ?? ''} onChange={e => setSelectedStream(e.target.value || null)} className="sui-input" style={{ width: '100%' }}>
              <option value="">All streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: '0 0 120px', minWidth: 110 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ flex: '0 0 92px', minWidth: 82 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: '100%' }} />
        </div>

        {selectedClass && slots.length > 0 && (
          <div style={{ padding: '7px 14px', borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap',
            background: publishedCount === slots.length ? 'rgba(16,185,129,.1)' : 'rgba(139,92,246,.1)',
            color: publishedCount === slots.length ? 'var(--success)' : '#8b5cf6',
            border: publishedCount === slots.length ? '.5px solid rgba(16,185,129,.25)' : '.5px solid rgba(139,92,246,.25)',
            fontSize: 12, fontWeight: 700,
          }}>
            {slots.length} slot{slots.length !== 1 ? 's' : ''} · {publishedCount} published
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!selectedClass && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'linear-gradient(145deg,rgba(139,92,246,.15),rgba(139,92,246,.05))', border: '.5px solid rgba(139,92,246,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>Select a class to start</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 340, margin: '0 auto' }}>
            Choose a class above to build or review its timetable for the selected term.
          </div>
        </div>
      )}

      {selectedClass && isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 76, borderRadius: 12 }} />)}
        </div>
      )}

      {/* ── Timetable grid ── */}
      {selectedClass && !isLoading && (
        <DndContext
          onDragStart={() => setDragActive(true)}
          onDragEnd={event => { void handleDragEnd(event) }}
          onDragCancel={() => setDragActive(false)}
        >
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
            {/* Grid header bar */}
            <div style={{ padding: '14px 20px 12px', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{selectedClassName}</span>
                {selectedStream && (
                  <span style={{ padding: '2px 10px', borderRadius: 99, background: 'rgba(139,92,246,.1)', color: '#8b5cf6', fontSize: 11, fontWeight: 700, border: '.5px solid rgba(139,92,246,.2)' }}>
                    {streams.find(s => s.id === selectedStream)?.name}
                  </span>
                )}
                <span style={{ padding: '2px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--txt3)', fontSize: 11, fontWeight: 600, border: '.5px solid var(--border)' }}>
                  {term} · {year}
                </span>
              </div>
              {conflictKeys.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 11.5, fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  {conflictKeys.size} teacher conflict{conflictKeys.size !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="hscroll">
              <table style={{ borderCollapse: 'collapse', minWidth: 580, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 12px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 56, textAlign: 'center' }}>
                      P
                    </th>
                    {DAYS.map(([d, label]) => (
                      <th key={d} style={{
                        padding: '12px 8px',
                        background: d === todayCol ? 'rgba(139,92,246,.07)' : 'var(--surface2)',
                        fontWeight: 800, fontSize: 11,
                        color: d === todayCol ? '#8b5cf6' : 'var(--txt2)',
                        textTransform: 'uppercase', letterSpacing: .8,
                        borderBottom: '.5px solid var(--border)', textAlign: 'center',
                        position: 'relative',
                      }}>
                        {label}
                        {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2, background: '#8b5cf6' }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map(period => (
                    <tr key={period}>
                      <td style={{ padding: '8px', fontWeight: 800, fontSize: 12, color: 'var(--txt3)', textAlign: 'center', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', width: 52 }}>
                        {period}
                      </td>
                      {DAYS.map(([day]) => {
                        const key      = `${day}-${period}`
                        const slot     = slotMap.get(key)
                        const isConflict = conflictKeys.has(key)
                        return (
                          <TimetableCell
                            key={key} day={day} period={period}
                            slot={slot} conflict={isConflict}
                            onClickEmpty={() => setAssignModal({ day, period })}
                            onDelete={() => slot && void deleteSlot.mutateAsync(slot.id)}
                          />
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DragOverlay>
            {dragActive && (
              <div style={{ background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', color: '#fff', borderRadius: 10, padding: '8px 14px', fontSize: 12, fontWeight: 700, boxShadow: '0 6px 20px rgba(139,92,246,.5)', cursor: 'grabbing' }}>
                Moving slot…
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Legend ── */}
      {selectedClass && !isLoading && (
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--txt3)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(99,102,241,.15)', border: '.5px solid rgba(99,102,241,.3)' }} />
            Assigned (drag to move)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.25)' }} />
            Teacher conflict
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(139,92,246,.07)', border: '.5px dashed rgba(139,92,246,.2)' }} />
            Empty — click to assign
          </span>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && selectedClass && (
        <AssignModal
          classId={selectedClass} streamId={selectedStream}
          term={term} year={year}
          day={assignModal.day} period={assignModal.period}
          onClose={() => setAssignModal(null)}
          onSaved={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}
