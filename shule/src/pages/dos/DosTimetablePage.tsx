import { useState } from 'react'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import {
  useTimetableSlots,
  useCreateTimetableSlot,
  useDeleteTimetableSlot,
  useCheckCollision,
  usePublishTimetable,
} from '../../hooks/useTimetableSlots'
import type { TimetableSlot } from '../../types/week9'

const DAYS: [number, string][] = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri']]
const PERIODS = [1,2,3,4,5,6,7,8]

// ── Drag handle chip for an existing slot ─────────────────────────────────
function SlotChip({ slot, onDelete }: { slot: TimetableSlot; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: slot.id,
    data: { slot },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: 'var(--brand-light)', borderRadius: 8,
        padding: '4px 8px', cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.4 : 1, position: 'relative',
        border: '1px solid rgba(13,148,136,0.3)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--brand)' }}>
        {slot.subjectName ?? slot.subjectId.slice(0, 8)}
      </div>
      <div style={{ fontSize: 10, color: 'var(--txt3)' }}>
        {slot.teacherName ?? 'Unknown'}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        style={{
          position: 'absolute', top: 2, right: 2,
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 10, color: 'var(--txt3)', padding: '0 2px',
        }}
        title="Remove slot"
      >
        ✕
      </button>
    </div>
  )
}

// ── Droppable cell ────────────────────────────────────────────────────────
function TimetableCell({
  day, period, slot, conflict,
  onClickEmpty, onDelete,
}: {
  day: number
  period: number
  slot: TimetableSlot | undefined
  conflict: boolean
  onClickEmpty: () => void
  onDelete: () => void
}) {
  const cellId = `cell-${day}-${period}`
  const { isOver, setNodeRef } = useDroppable({ id: cellId, data: { day, period } })

  return (
    <td
      ref={setNodeRef}
      style={{
        padding: 4, minWidth: 120, height: 60,
        background: conflict
          ? 'rgba(244,63,94,0.08)'
          : isOver
            ? 'rgba(13,148,136,0.08)'
            : 'transparent',
        border: conflict ? '1px solid rgba(244,63,94,0.3)' : '1px solid var(--border)',
        verticalAlign: 'top',
        transition: 'background 0.15s',
      }}
    >
      {slot ? (
        <SlotChip slot={slot} onDelete={onDelete} />
      ) : (
        <div
          onClick={onClickEmpty}
          style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--txt3)', fontSize: 18,
            opacity: 0.3,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.opacity = '0.8')}
          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.opacity = '0.3')}
        >
          +
        </div>
      )}
    </td>
  )
}

// ── Assign Slot Modal ─────────────────────────────────────────────────────
function AssignModal({
  classId, streamId, term, year,
  day, period,
  onClose, onSaved,
}: {
  classId: string; streamId: string | null; term: string; year: number
  day: number; period: number
  onClose: () => void; onSaved: () => void
}) {
  const { data: subjects = [] } = useSubjects()
  const { data: staff = [] } = useStaff()
  const createSlot   = useCreateTimetableSlot()
  const checkCollision = useCheckCollision()

  const [subjectId, setSubjectId] = useState('')
  const [teacherId, setTeacherId]  = useState('')
  const [startTime, setStartTime]  = useState('')
  const [endTime, setEndTime]      = useState('')
  const [error, setError]          = useState('')

  const teachers = staff.filter(s => s.role === 'teacher' || s.role === 'class_teacher')

  async function handleSave() {
    if (!subjectId || !teacherId) { setError('Subject and teacher are required.'); return }
    setError('')
    try {
      const { classConflict, teacherConflict } = await checkCollision.mutateAsync({
        classId, streamId, teacherId, dayOfWeek: day, periodNumber: period, term, year,
      })
      if (classConflict) { setError('This class already has a slot at this period.'); return }
      if (teacherConflict) { setError('This teacher is already booked at this period.'); return }

      await createSlot.mutateAsync({
        classId, streamId, subjectId, teacherId,
        dayOfWeek: day as 1|2|3|4|5, periodNumber: period,
        startTime: startTime || null, endTime: endTime || null,
        term, year,
      })
      onSaved()
    } catch (err: any) {
      setError(err.message ?? 'Failed to save slot')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 400, maxWidth: '90vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>
            Assign Slot — {DAYS.find(d => d[0] === day)?.[1]} Period {period}
          </h3>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'var(--txt3)' }}>✕</button>
        </div>

        {error && (
          <div style={{ background:'var(--danger-bg)', color:'var(--danger)', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Subject ★</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="sui-input" style={{ width:'100%' }}>
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Teacher ★</label>
            <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="sui-input" style={{ width:'100%' }}>
              <option value="">Select teacher…</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="sui-input" style={{ width:'100%' }} />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="sui-input" style={{ width:'100%' }} />
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:20 }}>
          <button onClick={onClose} className="sui-btn-outline">Cancel</button>
          <button
            onClick={() => { void handleSave() }}
            disabled={createSlot.isPending || checkCollision.isPending}
            className="sui-btn-primary"
          >
            {createSlot.isPending ? 'Saving…' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DOS TIMETABLE PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function DosTimetablePage() {
  const { data: classes = [] } = useClasses()
  const [selectedClass, setSelectedClass] = useState<string | null>(null)
  const [term, setTerm]   = useState('Term 1')
  const [year, setYear]   = useState(new Date().getFullYear())
  const { data: streams = [] } = useStreams(selectedClass)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [conflicts, _setConflicts] = useState<Set<string>>(new Set())

  const { data: slots = [], isLoading } = useTimetableSlots({
    classId:  selectedClass,
    streamId: selectedStream,
    term, year,
  })

  const deleteSlot   = useDeleteTimetableSlot()
  const publishMut   = usePublishTimetable()
  const createSlot   = useCreateTimetableSlot()

  const [assignModal, setAssignModal] = useState<{ day: number; period: number } | null>(null)
  const [published, setPublished] = useState(false)

  // Build lookup: `day-period` → slot
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) {
    slotMap.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || !selectedClass) return

    const [, dayStr, periodStr] = (over.id as string).split('-')
    const newDay    = parseInt(dayStr)    as 1|2|3|4|5
    const newPeriod = parseInt(periodStr)
    const slot = active.data.current?.slot as TimetableSlot | undefined
    if (!slot) return

    // Don't move to same cell
    if (slot.dayOfWeek === newDay && slot.periodNumber === newPeriod) return

    // Don't overwrite an existing slot
    if (slotMap.has(`${newDay}-${newPeriod}`)) return

    // Delete old, create new
    try {
      await deleteSlot.mutateAsync(slot.id)
      await createSlot.mutateAsync({
        classId:      slot.classId,
        streamId:     slot.streamId,
        subjectId:    slot.subjectId,
        teacherId:    slot.teacherId,
        dayOfWeek:    newDay,
        periodNumber: newPeriod,
        startTime:    slot.startTime,
        endTime:      slot.endTime,
        term, year,
      })
    } catch {}
  }

  async function handlePublish() {
    if (!selectedClass) return
    await publishMut.mutateAsync({ classId: selectedClass, term, year })
    setPublished(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            Timetable Builder
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            Drag slots between cells. Click an empty cell to assign a new slot.
          </div>
        </div>
        {selectedClass && (
          <button
            onClick={() => { void handlePublish() }}
            disabled={publishMut.isPending || published}
            className="sui-btn-primary"
          >
            {publishMut.isPending ? 'Publishing…' : published ? 'Published ✓' : 'Publish Timetable'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Class ★</label>
          <select
            value={selectedClass ?? ''}
            onChange={e => { setSelectedClass(e.target.value || null); setSelectedStream(null); setPublished(false) }}
            className="sui-input" style={{ width: 180 }}
          >
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedClass && streams.length > 0 && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Stream</label>
            <select
              value={selectedStream ?? ''}
              onChange={e => setSelectedStream(e.target.value || null)}
              className="sui-input" style={{ width: 160 }}
            >
              <option value="">All streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: 120 }}>
            {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Year</label>
          <input
            type="number" value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="sui-input" style={{ width: 100 }}
          />
        </div>
      </div>

      {!selectedClass && (
        <div style={{ color: 'var(--txt3)', fontSize: 14, padding: 32, textAlign: 'center',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          Select a class to start building the timetable.
        </div>
      )}

      {selectedClass && isLoading && <div style={{ color: 'var(--txt3)' }}>Loading timetable…</div>}

      {selectedClass && !isLoading && (
        <DndContext onDragEnd={event => { void handleDragEnd(event) }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              borderCollapse: 'collapse', minWidth: 700,
              background: 'var(--surface)', borderRadius: 14, overflow: 'hidden',
            }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 70 }}>
                    Period
                  </th>
                  {DAYS.map(([d, label]) => (
                    <th key={d} style={{ padding: '10px 16px', background: 'var(--surface2)',
                      fontWeight: 700, fontSize: 12, color: 'var(--txt2)', minWidth: 130 }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period}>
                    <td style={{ padding: '8px 16px', fontWeight: 700, fontSize: 12,
                      color: 'var(--txt3)', textAlign: 'center',
                      background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>
                      P{period}
                    </td>
                    {DAYS.map(([day]) => {
                      const key  = `${day}-${period}`
                      const slot = slotMap.get(key)
                      const isConflict = conflicts.has(key)
                      return (
                        <TimetableCell
                          key={key}
                          day={day}
                          period={period}
                          slot={slot}
                          conflict={isConflict}
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

          {/* Drag overlay — shows the chip being dragged */}
          <DragOverlay>
            <div style={{
              background: 'var(--brand)', color: '#fff', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, fontWeight: 700,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)', cursor: 'grabbing',
            }}>
              Moving slot…
            </div>
          </DragOverlay>
        </DndContext>
      )}

      {/* Legend */}
      {selectedClass && (
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--txt3)' }}>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:'var(--brand-light)', border:'1px solid rgba(13,148,136,0.3)' }} />
            Assigned slot
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.3)' }} />
            Conflict
          </span>
        </div>
      )}

      {/* Assign Modal */}
      {assignModal && selectedClass && (
        <AssignModal
          classId={selectedClass}
          streamId={selectedStream}
          term={term}
          year={year}
          day={assignModal.day}
          period={assignModal.period}
          onClose={() => setAssignModal(null)}
          onSaved={() => setAssignModal(null)}
        />
      )}
    </div>
  )
}
