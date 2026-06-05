import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useMyAssignedClasses, useMyAssignedSubjects, useStreams } from '../../hooks/useClasses'
import {
  useTeacherEvents,
  useAllSchoolEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from '../../hooks/useTeacherEvents'
import type { SchoolEvent } from '../../types/week9'

const EVENT_TYPES = [
  { value: 'exam',       label: 'Exam',       color: '#f43f5e' },
  { value: 'test',       label: 'Test',       color: '#f59e0b' },
  { value: 'ca',         label: 'CA',         color: '#f59e0b' },
  { value: 'aoi',        label: 'AoI',        color: '#0ea5e9' },
  { value: 'dit',        label: 'DIT',        color: '#8b5cf6' },
  { value: 'practical',  label: 'Practical',  color: '#0d9488' },
  { value: 'assignment', label: 'Assignment', color: '#64748b' },
  { value: 'general',    label: 'General',    color: '#10b981' },
]

function typeColor(t: string) { return EVENT_TYPES.find(e => e.value === t)?.color ?? '#64748b' }
function isPast(d: string) { return new Date(d) < new Date() }
const portal = () => (document.querySelector('.ar') as HTMLElement) ?? document.body

const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .6 }}>
    {children}{req && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
  </label>
)

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel, danger = true }: {
  message: string; onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 13, background: danger ? 'rgba(244,63,94,.12)' : 'rgba(245,158,11,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={danger ? 'var(--danger)' : 'var(--warning)'} strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>Are you sure?</div>
            <div style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.55 }}>{message}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
          <button onClick={onConfirm}
            style={{ flex: 1, padding: '11px 0', background: danger ? 'var(--danger)' : 'var(--warning)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
            {danger ? 'Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    portal()
  )
}

// ── Event Form (shared by create + edit) ──────────────────────────────────
type EventFormState = {
  title: string; eventType: string; subjectId: string; classId: string
  streamId: string; eventDate: string; totalMarks: string; passMark: string
  description: string; term: string; year: string; visibleToParents: boolean
}

function EventFormModal({ initial, onSave, onClose, saving, showParentsToggle }: {
  initial?: Partial<EventFormState>
  onSave: (f: EventFormState) => Promise<void>
  onClose: () => void
  saving: boolean
  showParentsToggle?: boolean
}) {
  const classes  = useMyAssignedClasses()
  const subjects = useMyAssignedSubjects()
  const [form, setForm] = useState<EventFormState>({
    title:            initial?.title            ?? '',
    eventType:        initial?.eventType        ?? 'exam',
    subjectId:        initial?.subjectId        ?? '',
    classId:          initial?.classId          ?? '',
    streamId:         initial?.streamId         ?? '',
    eventDate:        initial?.eventDate        ?? new Date().toISOString().slice(0, 10),
    totalMarks:       initial?.totalMarks       ?? '',
    passMark:         initial?.passMark         ?? '',
    description:      initial?.description      ?? '',
    term:             initial?.term             ?? 'Term 1',
    year:             initial?.year             ?? String(new Date().getFullYear()),
    visibleToParents: initial?.visibleToParents ?? false,
  })
  const { data: streams = [] } = useStreams(form.classId || null)
  const [error, setError] = useState('')
  const color = typeColor(form.eventType)

  const f = (k: keyof Omit<EventFormState, 'visibleToParents'>) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.eventDate) { setError('Title and date are required.'); return }
    setError('')
    try { await onSave(form) } catch (err: any) { setError(err.message ?? 'Failed to save event') }
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92dvh', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 18px', background: `linear-gradient(150deg,${color}14,${color}05,transparent)`, borderBottom: `.5px solid ${color}20`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(145deg,${color},${color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${color}44`, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>{initial?.title ? 'Edit Event' : 'Create Event'}</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Plan an upcoming event or assessment</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 12.5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>{error}
            </div>
          )}

          <form onSubmit={e => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><Lbl req>Title</Lbl><input {...f('title')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. Mathematics End of Term Exam" /></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl req>Type</Lbl>
                <select value={form.eventType} onChange={e => setForm(p => ({ ...p, eventType: e.target.value }))} className="sui-input" style={{ width: '100%' }}>
                  {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><Lbl req>Date</Lbl><input type="date" {...f('eventDate')} className="sui-input" style={{ width: '100%' }} /></div>
            </div>

            <div><Lbl>Subject</Lbl>
              <select {...f('subjectId')} className="sui-input" style={{ width: '100%' }}>
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: streams.length > 0 ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div><Lbl>Class</Lbl>
                <select value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value, streamId: '' }))} className="sui-input" style={{ width: '100%' }}>
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {streams.length > 0 && (
                <div><Lbl>Stream</Lbl>
                  <select {...f('streamId')} className="sui-input" style={{ width: '100%' }}>
                    <option value="">All streams</option>
                    {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl>Total Marks</Lbl><input type="number" {...f('totalMarks')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. 100" /></div>
              <div><Lbl>Pass Mark</Lbl><input type="number" {...f('passMark')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. 50" /></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl>Term</Lbl><select {...f('term')} className="sui-input" style={{ width: '100%' }}>{['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><Lbl>Year</Lbl><input type="number" {...f('year')} className="sui-input" style={{ width: '100%' }} /></div>
            </div>

            <div><Lbl>Notes</Lbl><textarea {...f('description')} className="sui-input" rows={2} style={{ width: '100%', resize: 'vertical' }} placeholder="Any additional context…" /></div>

            {showParentsToggle && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: form.visibleToParents ? 'rgba(13,148,136,.06)' : 'var(--surface2)', border: `.5px solid ${form.visibleToParents ? 'rgba(13,148,136,.25)' : 'var(--border)'}`, cursor: 'pointer', transition: 'all .18s' }}
                onClick={() => setForm(p => ({ ...p, visibleToParents: !p.visibleToParents }))}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Parents can view this event</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>Shows in the parent portal Notices tab</div>
                </div>
                <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 99, background: form.visibleToParents ? 'var(--brand)' : 'var(--border)', flexShrink: 0, transition: 'background .2s', boxShadow: form.visibleToParents ? '0 2px 8px rgba(13,148,136,.35)' : 'none' }}>
                  <div style={{ position: 'absolute', top: 3, left: form.visibleToParents ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button type="submit" disabled={saving}
                style={{ flex: 2, padding: '11px 0', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 4px 14px ${color}44`, opacity: saving ? .7 : 1 }}>
                {saving ? 'Saving…' : initial?.title ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    portal()
  )
}

// ── Event Card ──────────────────────────────────────────────────────────────
function EventCard({ event, canEdit, onEdit, onDelete }: {
  event: SchoolEvent
  canEdit: boolean
  onEdit: (e: SchoolEvent) => void
  onDelete: (e: SchoolEvent) => void
}) {
  const navigate = useNavigate()
  const color = typeColor(event.eventType)
  const past  = isPast(event.eventDate)

  const meta: string[] = []
  if (event.className)   meta.push(event.className + (event.streamName ? ` ${event.streamName}` : ''))
  if (event.subjectName) meta.push(event.subjectName)
  if (event.term)        meta.push(event.term)
  if (event.totalMarks)  meta.push(`${event.totalMarks} marks`)
  if (event.passMark)    meta.push(`Pass: ${event.passMark}`)

  return (
    <div style={{
      background: 'var(--surface)', border: `.5px solid ${past && event.journaled ? 'var(--border)' : color + '30'}`,
      borderRadius: 16, padding: '16px 20px', borderLeft: `3px solid ${color}`,
      opacity: past && event.journaled ? 0.65 : 1, boxShadow: '0 1px 8px rgba(0,0,0,.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        {/* Left: content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: `${color}18`, color, textTransform: 'uppercase', letterSpacing: .5, border: `.5px solid ${color}30`, flexShrink: 0 }}>
              {event.eventType}
            </span>
            {event.journaled && (
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.25)', flexShrink: 0 }}>
                ✓ Journaled
              </span>
            )}
          </div>

          {/* Title — allow wrapping so long titles aren't clipped */}
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 6, lineHeight: 1.3 }}>
            {event.title}
          </div>

          {/* Date */}
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {new Date(event.eventDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Meta chips — class, subject, marks */}
          {meta.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: event.description ? 7 : 0 }}>
              {meta.map(m => (
                <span key={m} style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt2)', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 7, padding: '2px 8px' }}>{m}</span>
              ))}
            </div>
          )}

          {event.description && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.5 }}>{event.description}</div>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
          {past && !event.journaled && (
            <button onClick={() => navigate('/teacher/exams', { state: { prefill: event } })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: `0 3px 10px ${color}44`, whiteSpace: 'nowrap' }}>
              Journal It
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {canEdit && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => onEdit(event)} title="Edit event"
                style={{ width: 32, height: 32, borderRadius: 9, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button onClick={() => onDelete(event)} title="Delete event"
                style={{ width: 32, height: 32, borderRadius: 9, border: '.5px solid rgba(244,63,94,.25)', background: 'rgba(244,63,94,.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function TeacherEventsPage() {
  const { user } = useAuth()
  const isDos = user?.role === 'dos' || user?.role === 'principal'
  const canToggleParents = isDos || user?.role === 'deputy'

  // Dos/principal see all school events; teacher sees only their own
  const teacherQ = useTeacherEvents()
  const allQ     = useAllSchoolEvents()
  const events   = isDos ? (allQ.data ?? []) : (teacherQ.data ?? [])
  const isLoading = isDos ? allQ.isLoading : teacherQ.isLoading

  const createMut = useCreateEvent()
  const updateMut = useUpdateEvent()
  const deleteMut = useDeleteEvent()

  const [showCreate, setShowCreate] = useState(false)
  const [editEvent,  setEditEvent]  = useState<SchoolEvent | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<SchoolEvent | null>(null)
  const [showPast,   setShowPast]   = useState(false)

  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  const past     = events.filter(e => e.eventDate < today).sort((a, b) => b.eventDate.localeCompare(a.eventDate))
  const pendingJournal = past.filter(e => !e.journaled).length

  // Teacher can edit/delete their own; DoS can edit/delete all
  function canEdit(event: SchoolEvent) {
    if (isDos) return true
    return event.createdBy === user?.staffId
  }

  async function handleCreate(f: EventFormState) {
    await createMut.mutateAsync({
      title:            f.title,
      eventType:        f.eventType,
      subjectId:        f.subjectId || null,
      classId:          f.classId || null,
      streamId:         f.streamId || null,
      eventDate:        f.eventDate,
      totalMarks:       f.totalMarks ? parseFloat(f.totalMarks) : null,
      passMark:         f.passMark ? parseFloat(f.passMark) : null,
      description:      f.description || null,
      term:             f.term || null,
      year:             f.year ? parseInt(f.year) : null,
      visibleToParents: f.visibleToParents,
    })
    setShowCreate(false)
  }

  async function handleUpdate(f: EventFormState) {
    if (!editEvent) return
    await updateMut.mutateAsync({
      id:               editEvent.id,
      title:            f.title,
      eventType:        f.eventType,
      subjectId:        f.subjectId || null,
      classId:          f.classId || null,
      streamId:         f.streamId || null,
      eventDate:        f.eventDate,
      totalMarks:       f.totalMarks ? parseFloat(f.totalMarks) : null,
      passMark:         f.passMark ? parseFloat(f.passMark) : null,
      description:      f.description || null,
      term:             f.term || null,
      year:             f.year ? parseInt(f.year) : null,
      visibleToParents: f.visibleToParents,
    })
    setEditEvent(null)
  }

  async function handleDelete() {
    if (!deleteEvent) return
    await deleteMut.mutateAsync(deleteEvent.id)
    setDeleteEvent(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>{isDos ? 'All School Events' : 'My Events'}</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>{isDos ? 'View and manage all events across all classes.' : 'Plan events and journal them after marking.'}</p>
          </div>
        </div>
        {!isDos && (
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Event
          </button>
        )}
      </div>

      {/* KPIs */}
      {!isLoading && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Upcoming', value: upcoming.length, color: '#0d9488' },
            { label: 'Past', value: past.length, color: '#64748b' },
            { label: 'Need Journaling', value: pendingJournal, color: pendingJournal > 0 ? '#f59e0b' : '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ flex: 1, padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 14 }} />)}</div>}

      {/* Upcoming */}
      {!isLoading && (
        <div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Upcoming · {upcoming.length}</div>
          {upcoming.length === 0 ? (
            <div style={{ padding: '36px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>No upcoming events.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map(e => (
                <EventCard key={e.id} event={e} canEdit={canEdit(e)} onEdit={setEditEvent} onDelete={setDeleteEvent} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Past */}
      {!isLoading && past.length > 0 && (
        <div>
          <button onClick={() => setShowPast(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt2)', padding: '0 0 12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform .2s', transform: showPast ? 'rotate(90deg)' : 'none' }}><polyline points="9 18 15 12 9 6"/></svg>
            Past Events · {past.length}
            {pendingJournal > 0 && <span style={{ padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(245,158,11,.12)', color: 'var(--warning)', border: '.5px solid rgba(245,158,11,.25)' }}>{pendingJournal} need journaling</span>}
          </button>
          {showPast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {past.map(e => (
                <EventCard key={e.id} event={e} canEdit={canEdit(e)} onEdit={setEditEvent} onDelete={setDeleteEvent} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <EventFormModal onSave={handleCreate} onClose={() => setShowCreate(false)} saving={createMut.isPending} showParentsToggle={canToggleParents} />
      )}
      {editEvent && (
        <EventFormModal
          initial={{ title: editEvent.title, eventType: editEvent.eventType, subjectId: editEvent.subjectId ?? '', classId: editEvent.classId ?? '', streamId: editEvent.streamId ?? '', eventDate: editEvent.eventDate, totalMarks: editEvent.totalMarks?.toString() ?? '', passMark: editEvent.passMark?.toString() ?? '', description: editEvent.description ?? '', term: editEvent.term ?? 'Term 1', year: editEvent.year?.toString() ?? String(new Date().getFullYear()), visibleToParents: editEvent.visibleToParents }}
          onSave={handleUpdate}
          onClose={() => setEditEvent(null)}
          saving={updateMut.isPending}
          showParentsToggle={canToggleParents}
        />
      )}
      {deleteEvent && (
        <ConfirmModal
          message={`Delete "${deleteEvent.title}"? This cannot be undone.`}
          onConfirm={() => { void handleDelete() }}
          onCancel={() => setDeleteEvent(null)}
        />
      )}
    </div>
  )
}
