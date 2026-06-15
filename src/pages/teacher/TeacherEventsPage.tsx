import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../store/AuthContext'
import { useMyAssignedClasses, useMyAssignedSubjects, useStreams } from '../../hooks/useClasses'
import {
  useAllSchoolEvents,
  useCreateEvent, useUpdateEvent, useDeleteEvent,
} from '../../hooks/useTeacherEvents'
import {
  EventTimeline,
  typeColor,
  ALL_EVENT_TYPES, TEACHER_EVENT_TYPES,
  daysUntil,
} from '../../components/shared/EventTimeline'
import type { SchoolEvent } from '../../types/week9'

const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .6 }}>
    {children}{req && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
  </label>
)

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
    term:             initial?.term             ?? '1',
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
          {error && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 12.5 }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>{error}</div>}

          <form onSubmit={e => { void handleSubmit(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><Lbl req>Title</Lbl><input {...f('title')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. Mathematics End of Term Exam" /></div>

            <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl req>Type</Lbl>
                <select value={form.eventType} onChange={e => setForm(p => ({ ...p, eventType: e.target.value }))} className="sui-input" style={{ width: '100%' }}>
                  {TEACHER_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div><Lbl req>Date</Lbl><input type="date" {...f('eventDate')} className="sui-input" style={{ width: '100%' }} /></div>
            </div>

            <div><Lbl>Subject</Lbl><select {...f('subjectId')} className="sui-input" style={{ width: '100%' }}><option value="">Select subject…</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>

            <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: streams.length > 0 ? '1fr 1fr' : '1fr', gap: 12 }}>
              <div><Lbl>Class</Lbl><select value={form.classId} onChange={e => setForm(p => ({ ...p, classId: e.target.value, streamId: '' }))} className="sui-input" style={{ width: '100%' }}><option value="">Select class…</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              {streams.length > 0 && <div><Lbl>Stream</Lbl><select {...f('streamId')} className="sui-input" style={{ width: '100%' }}><option value="">All streams</option>{streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            </div>

            <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl>Total Marks</Lbl><input type="number" {...f('totalMarks')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. 100" /></div>
              <div><Lbl>Pass Mark</Lbl><input type="number" {...f('passMark')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. 50" /></div>
            </div>

            <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Lbl>Term</Lbl><select {...f('term')} className="sui-input" style={{ width: '100%' }}>{['1','2','3'].map(t => <option key={t} value={t}>Term {t}</option>)}</select></div>
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
                <div style={{ position: 'relative', width: 44, height: 24, borderRadius: 99, background: form.visibleToParents ? 'var(--brand)' : 'var(--border)', flexShrink: 0, transition: 'background .2s' }}>
                  <div style={{ position: 'absolute', top: 3, left: form.visibleToParents ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left .2s' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button type="submit" disabled={saving} style={{ flex: 2, padding: '11px 0', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 4px 14px ${color}44`, opacity: saving ? .7 : 1 }}>
                {saving ? 'Saving…' : initial?.title ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    (document.querySelector('.ar') as HTMLElement) ?? document.body
  )
}

// ── Delete confirm ────────────────────────────────────────────────────────────
function ConfirmDelete({ event, onConfirm, onCancel, busy }: { event: SchoolEvent; onConfirm: () => void; onCancel: () => void; busy: boolean }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onCancel()}>
      <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 8 }}>Delete event?</div>
          <div style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.55 }}>"{event.title}" will be permanently deleted.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ flex: 1, padding: '11px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: busy ? .7 : 1 }}>
            {busy ? '…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    (document.querySelector('.ar') as HTMLElement) ?? document.body
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function TeacherEventsPage() {
  const { user } = useAuth()
  const isDos = user?.role === 'dos' || user?.role === 'principal'
  const canToggleParents = isDos || user?.role === 'deputy'

  const allQ      = useAllSchoolEvents()
  const events    = allQ.data ?? []
  const isLoading = allQ.isLoading

  const createMut = useCreateEvent()
  const updateMut = useUpdateEvent()
  const deleteMut = useDeleteEvent()

  const [showCreate,   setShowCreate]   = useState(false)
  const [editEvent,    setEditEvent]    = useState<SchoolEvent | null>(null)
  const [deleteEvent,  setDeleteEvent]  = useState<SchoolEvent | null>(null)
  const [timeFilter,   setTimeFilter]   = useState<'upcoming' | 'all' | 'past'>('upcoming')
  const [typeFilter,   setTypeFilter]   = useState('all')

  const today = new Date().toISOString().slice(0, 10)

  const filtered = (() => {
    let list = [...events]
    if (typeFilter !== 'all') list = list.filter(e => e.eventType === typeFilter)
    if (timeFilter === 'upcoming') list = list.filter(e => e.eventDate >= today)
    if (timeFilter === 'past')     list = list.filter(e => e.eventDate < today)
    return list.sort((a, b) =>
      timeFilter === 'past'
        ? b.eventDate.localeCompare(a.eventDate)
        : a.eventDate.localeCompare(b.eventDate)
    )
  })()

  const upcoming     = events.filter(e => e.eventDate >= today)
  const past         = events.filter(e => e.eventDate <  today)
  const inNext7      = upcoming.filter(e => daysUntil(e.eventDate) <= 7)
  const pendingJrnl  = past.filter(e => !e.journaled).length

  function canEdit(ev: SchoolEvent) { return isDos || ev.createdBy === user?.staffId }

  const presentTypes = (() => {
    const s = new Set(events.map(e => e.eventType))
    return ALL_EVENT_TYPES.filter(t => s.has(t.value))
  })()

  async function handleCreate(f: EventFormState) {
    await createMut.mutateAsync({
      title: f.title, eventType: f.eventType,
      subjectId: f.subjectId || null, classId: f.classId || null,
      streamId: f.streamId || null, eventDate: f.eventDate,
      totalMarks: f.totalMarks ? parseFloat(f.totalMarks) : null,
      passMark: f.passMark ? parseFloat(f.passMark) : null,
      description: f.description || null,
      term: f.term || null, year: f.year ? parseInt(f.year) : null,
      visibleToParents: f.visibleToParents,
    })
    setShowCreate(false)
  }

  async function handleUpdate(f: EventFormState) {
    if (!editEvent) return
    await updateMut.mutateAsync({
      id: editEvent.id, title: f.title, eventType: f.eventType,
      subjectId: f.subjectId || null, classId: f.classId || null,
      streamId: f.streamId || null, eventDate: f.eventDate,
      totalMarks: f.totalMarks ? parseFloat(f.totalMarks) : null,
      passMark: f.passMark ? parseFloat(f.passMark) : null,
      description: f.description || null,
      term: f.term || null, year: f.year ? parseInt(f.year) : null,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Header ── */}
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
        <button onClick={() => setShowCreate(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Event
        </button>
      </div>

      {/* ── KPIs ── */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10 }}>
          {[
            { label: 'Upcoming',       value: upcoming.length,   color: '#0d9488' },
            { label: 'This Week',      value: inNext7.length,    color: '#f59e0b' },
            { label: 'Past',           value: past.length,       color: '#64748b' },
            { label: 'Need Journaling',value: pendingJrnl,       color: pendingJrnl > 0 ? '#f43f5e' : '#10b981' },
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 14px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font3)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Time filter ── */}
      <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 4, border: '.5px solid var(--border)', display: 'flex', gap: 2 }}>
        {(['upcoming','all','past'] as const).map(v => {
          const on  = timeFilter === v
          const lbl = v === 'upcoming' ? 'Upcoming' : v === 'all' ? 'All Events' : 'Past'
          return (
            <button key={v} onClick={() => setTimeFilter(v)}
              style={{ flex: 1, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: on ? 800 : 600, fontSize: 12.5, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--txt)' : 'var(--txt3)', boxShadow: on ? '0 2px 10px rgba(0,0,0,.09)' : 'none', transition: 'all .18s' }}>
              {lbl}
            </button>
          )
        })}
      </div>

      {/* ── Type filter pills ── */}
      {presentTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
          <button onClick={() => setTypeFilter('all')}
            style={{ flexShrink: 0, padding: '5px 14px', borderRadius: 99, cursor: 'pointer', fontWeight: typeFilter === 'all' ? 800 : 600, fontSize: 12, background: typeFilter === 'all' ? 'var(--txt)' : 'var(--surface2)', color: typeFilter === 'all' ? 'var(--surface)' : 'var(--txt3)', border: `.5px solid ${typeFilter === 'all' ? 'var(--txt)' : 'var(--border)'}`, transition: 'all .16s', whiteSpace: 'nowrap' }}>
            All types
          </button>
          {presentTypes.map(t => {
            const on = typeFilter === t.value
            return (
              <button key={t.value} onClick={() => setTypeFilter(on ? 'all' : t.value)}
                style={{ flexShrink: 0, padding: '5px 14px', borderRadius: 99, cursor: 'pointer', fontWeight: on ? 800 : 600, fontSize: 12, background: on ? t.color : 'var(--surface2)', color: on ? '#fff' : 'var(--txt3)', border: `.5px solid ${on ? t.color : 'var(--border)'}`, transition: 'all .16s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: on ? 'rgba(255,255,255,.8)' : t.color, flexShrink: 0 }} />
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Timeline ── */}
      <EventTimeline
        events={filtered}
        isLoading={isLoading}
        canDelete={ev => !!(canEdit(ev))}
        canEdit={ev => canEdit(ev)}
        canJournal={!isDos}
        onEdit={setEditEvent}
        onDelete={setDeleteEvent}
        emptyTitle={timeFilter === 'upcoming' ? 'No upcoming events' : timeFilter === 'past' ? 'No past events' : 'No events yet'}
        emptyBody={isDos ? 'No events match these filters.' : 'Create an event to track upcoming assessments.'}
      />

      {/* Modals */}
      {showCreate && <EventFormModal onSave={handleCreate} onClose={() => setShowCreate(false)} saving={createMut.isPending} showParentsToggle={canToggleParents} />}
      {editEvent   && (
        <EventFormModal
          initial={{ title: editEvent.title, eventType: editEvent.eventType, subjectId: editEvent.subjectId ?? '', classId: editEvent.classId ?? '', streamId: editEvent.streamId ?? '', eventDate: editEvent.eventDate, totalMarks: editEvent.totalMarks?.toString() ?? '', passMark: editEvent.passMark?.toString() ?? '', description: editEvent.description ?? '', term: editEvent.term ?? '1', year: editEvent.year?.toString() ?? String(new Date().getFullYear()), visibleToParents: editEvent.visibleToParents }}
          onSave={handleUpdate} onClose={() => setEditEvent(null)} saving={updateMut.isPending} showParentsToggle={canToggleParents}
        />
      )}
      {deleteEvent && <ConfirmDelete event={deleteEvent} onConfirm={() => void handleDelete()} onCancel={() => setDeleteEvent(null)} busy={deleteMut.isPending} />}
    </div>
  )
}
