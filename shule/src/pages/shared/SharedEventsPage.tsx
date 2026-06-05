import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { useAllSchoolEvents, useCreateEvent, useDeleteEvent } from '../../hooks/useTeacherEvents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import type { SchoolEvent } from '../../types/week9'

// ─── Event type registry ───────────────────────────────────────────────────────
const TEACHER_EVENT_TYPES = [
  { value: 'exam',       label: 'Exam',       color: '#f43f5e' },
  { value: 'test',       label: 'Test',       color: '#f59e0b' },
  { value: 'ca',         label: 'CA',         color: '#f59e0b' },
  { value: 'aoi',        label: 'AoI',        color: '#0ea5e9' },
  { value: 'dit',        label: 'DIT',        color: '#8b5cf6' },
  { value: 'practical',  label: 'Practical',  color: '#0d9488' },
  { value: 'assignment', label: 'Assignment', color: '#64748b' },
  { value: 'general',    label: 'General',    color: '#10b981' },
]

const DOS_EXTRA_TYPES = [
  { value: 'term_start',   label: 'Term Begins',   color: '#10b981' },
  { value: 'term_end',     label: 'Term Ends',     color: '#f43f5e' },
  { value: 'exam_week',    label: 'Exam Week',     color: '#f59e0b' },
  { value: 'holiday',      label: 'Holiday',       color: '#0ea5e9' },
  { value: 'pta',          label: 'PTA Meeting',   color: '#8b5cf6' },
  { value: 'sport',        label: 'Sports Day',    color: '#ec4899' },
  { value: 'graduation',   label: 'Prize Giving',  color: '#0d9488' },
]

const ALL_EVENT_TYPES = [...DOS_EXTRA_TYPES, ...TEACHER_EVENT_TYPES]

function typeColor(t: string): string {
  return ALL_EVENT_TYPES.find(e => e.value === t)?.color ?? '#64748b'
}
function typeLabel(t: string): string {
  return ALL_EVENT_TYPES.find(e => e.value === t)?.label ?? t
}

function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Date(d).toLocaleDateString('en-GB', opts)
}
function monthKey(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2,'0')}`
}
function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function isToday(d: string) {
  const t = new Date().toISOString().slice(0,10)
  return d.slice(0,10) === t
}
function isPast(d: string) { return new Date(d) < new Date() }
function daysUntil(d: string): number {
  return Math.round((new Date(d).getTime() - Date.now()) / 86_400_000)
}

// ─── Create event modal ────────────────────────────────────────────────────────
function CreateEventModal({ onClose, isDos }: { onClose: () => void; isDos: boolean }) {
  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const [selectedClass, setSelectedClass] = useState('')
  const { data: streams = [] } = useStreams(selectedClass || null)
  const createMut = useCreateEvent()
  const [form, setForm] = useState({
    title: '', eventType: isDos ? 'term_start' : 'exam',
    subjectId: '', classId: '', streamId: '',
    eventDate: new Date().toISOString().slice(0, 10),
    totalMarks: '', passMark: '', description: '',
    term: 'Term 1', year: new Date().getFullYear().toString(),
    visibleToParents: false,
  })
  const [err, setErr] = useState('')

  const f = (k: keyof Omit<typeof form, 'visibleToParents'>) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  })

  async function submit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.title || !form.eventDate) { setErr('Title and date are required.'); return }
    setErr('')
    try {
      await createMut.mutateAsync({
        title: form.title, eventType: form.eventType,
        subjectId: form.subjectId || null, classId: form.classId || null,
        streamId: form.streamId || null, eventDate: form.eventDate,
        totalMarks: form.totalMarks ? parseFloat(form.totalMarks) : null,
        passMark: form.passMark ? parseFloat(form.passMark) : null,
        description: form.description || null,
        term: form.term, year: parseInt(form.year),
        visibleToParents: form.visibleToParents,
      })
      onClose()
    } catch (e: any) { setErr(e.message ?? 'Failed to create event') }
  }

  const color  = typeColor(form.eventType)
  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  const isAdminType = DOS_EXTRA_TYPES.some(t => t.value === form.eventType)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.54)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20, animation: 'evFadeIn .18s ease both' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '92dvh', background: 'var(--surface)', borderRadius: 24, boxShadow: '0 28px 80px rgba(0,0,0,.26)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 18px', background: `linear-gradient(150deg,${color}12,${color}04,transparent)`, borderBottom: `.5px solid ${color}20`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(145deg,${color},${color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${color}44`, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Create Event</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Visible to all roles across the school</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 20px' }}>
          {err && (
            <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.2)', color: 'var(--danger)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>{err}
            </div>
          )}
          <form onSubmit={ev => { void submit(ev) }} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input {...f('title')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. End of Term 1 Examinations" />
            </div>

            {/* Type + Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select {...f('eventType')} className="sui-input" style={{ width: '100%' }}>
                  {isDos && <optgroup label="School-wide">
                    {DOS_EXTRA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>}
                  <optgroup label={isDos ? 'Assessments' : 'Type'}>
                    {TEACHER_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" {...f('eventDate')} className="sui-input" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Subject — hidden for admin types */}
            {!isAdminType && (
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Subject</label>
                <select {...f('subjectId')} className="sui-input" style={{ width: '100%' }}>
                  <option value="">All subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}

            {/* Class + Stream — hidden for admin types */}
            {!isAdminType && (
              <div style={{ display: 'grid', gridTemplateColumns: streams.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Class</label>
                  <select value={form.classId} onChange={e => { setSelectedClass(e.target.value); setForm(p => ({ ...p, classId: e.target.value, streamId: '' })) }} className="sui-input" style={{ width: '100%' }}>
                    <option value="">All classes</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {streams.length > 0 && (
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Stream</label>
                    <select {...f('streamId')} className="sui-input" style={{ width: '100%' }}>
                      <option value="">All streams</option>
                      {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Marks — hidden for admin types */}
            {!isAdminType && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Total Marks</label>
                  <input type="number" {...f('totalMarks')} className="sui-input" style={{ width: '100%' }} placeholder="100" />
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Pass Mark</label>
                  <input type="number" {...f('passMark')} className="sui-input" style={{ width: '100%' }} placeholder="50" />
                </div>
              </div>
            )}

            {/* Term + Year */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Term</label>
                <select {...f('term')} className="sui-input" style={{ width: '100%' }}>
                  {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Year</label>
                <input type="number" {...f('year')} className="sui-input" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Notes</label>
              <textarea {...f('description')} className="sui-input" rows={2} style={{ width: '100%', resize: 'vertical' }} placeholder="Any additional details…" />
            </div>

            {/* Parents visibility toggle — principal/deputy/dos only */}
            {isDos && (
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
              <button type="button" onClick={onClose} style={{ flex: 1, height: 46, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 13, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button type="submit" disabled={createMut.isPending}
                style={{ flex: 2, height: 46, background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', border: 'none', borderRadius: 13, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 4px 14px ${color}44`, transition: 'all .18s' }}>
                {createMut.isPending ? 'Creating…' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    portal
  )
}

// ─── Event card ────────────────────────────────────────────────────────────────
function EventCard({ event, canDelete, canJournal }: { event: SchoolEvent; canDelete: boolean; canJournal: boolean }) {
  const navigate = useNavigate()
  const deleteMut = useDeleteEvent()
  const { success: ok, error: err } = useToast()
  const [confirmDel, setConfirmDel] = useState(false)
  const color = typeColor(event.eventType)
  const past  = isPast(event.eventDate)
  const today = isToday(event.eventDate)
  const days  = daysUntil(event.eventDate)

  async function doDelete() {
    try { await deleteMut.mutateAsync(event.id); ok('Event removed') }
    catch (e: any) { err(e.message) }
    setConfirmDel(false)
  }

  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 16,
      border: `.5px solid ${today ? color + '40' : past ? 'var(--border)' : color + '28'}`,
      borderLeft: `3.5px solid ${color}`,
      padding: '14px 16px',
      opacity: past && !today ? 0.75 : 1,
      boxShadow: today ? `0 4px 20px ${color}22` : '0 1px 6px rgba(0,0,0,.05)',
      transition: 'box-shadow .14s',
      animation: 'evSlideIn .22s cubic-bezier(.32,.72,0,1) both',
    }}
      onMouseEnter={e => { if (!today) e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.09)' }}
      onMouseLeave={e => { if (!today) e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,.05)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Date block */}
        <div style={{ flexShrink: 0, width: 46, height: 50, borderRadius: 12, background: today ? `linear-gradient(145deg,${color},${color}cc)` : `${color}12`, border: `.5px solid ${color}28`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
          <span style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font3)', color: today ? '#fff' : color, lineHeight: 1 }}>
            {new Date(event.eventDate).getDate()}
          </span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: today ? 'rgba(255,255,255,.8)' : color, textTransform: 'uppercase', letterSpacing: .3 }}>
            {new Date(event.eventDate).toLocaleDateString('en-GB', { month: 'short' })}
          </span>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: `${color}15`, color, textTransform: 'uppercase', letterSpacing: .4, border: `.5px solid ${color}28` }}>{typeLabel(event.eventType)}</span>
            {today && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', border: '.5px solid rgba(13,148,136,.22)' }}>Today</span>}
            {event.journaled && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.22)' }}>Journaled</span>}
            {!past && days >= 0 && days <= 7 && !today && <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(245,158,11,.1)', color: 'var(--warning)', border: '.5px solid rgba(245,158,11,.22)' }}>In {days}d</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--txt)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--txt3)', flexWrap: 'wrap' }}>
            <span>{formatDate(event.eventDate, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            {event.totalMarks && <><span>·</span><span>{event.totalMarks} marks</span></>}
            {event.passMark && <><span>·</span><span>Pass: {event.passMark}</span></>}
          </div>
          {event.description && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 5, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.description}</div>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
          {canJournal && past && !event.journaled && (
            <button onClick={() => navigate('/teacher/exams', { state: { prefill: event } })}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: 'none', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', boxShadow: `0 3px 10px ${color}44`, whiteSpace: 'nowrap' }}>
              Journal
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}
          {canDelete && (
            confirmDel ? (
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => void doDelete()} disabled={deleteMut.isPending}
                  style={{ padding: '5px 10px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}>
                  {deleteMut.isPending ? '…' : 'Delete'}
                </button>
                <button onClick={() => setConfirmDel(false)}
                  style={{ width: 28, height: 28, borderRadius: 8, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} title="Remove event"
                style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', opacity: 0.35, transition: 'all .14s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(244,63,94,.09)'; e.currentTarget.style.color = 'var(--danger)' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt3)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED EVENTS PAGE — all roles
// ═══════════════════════════════════════════════════════════════════════════════
export function SharedEventsPage() {
  const { user }  = useAuth()
  const role      = user?.role ?? ''
  const isDos     = ['dos', 'principal', 'deputy'].includes(role)
  const canCreate = ['dos', 'principal', 'deputy', 'teacher', 'class_teacher'].includes(role)
  const canDelete = ['dos', 'principal'].includes(role)

  const { data: allEvents = [], isLoading } = useAllSchoolEvents()
  const [showCreate,  setShowCreate]  = useState(false)
  const [typeFilter,  setTypeFilter]  = useState<string>('all')
  const [timeFilter,  setTimeFilter]  = useState<'upcoming' | 'all' | 'past'>('upcoming')

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    let list = allEvents
    if (typeFilter !== 'all') list = list.filter(e => e.eventType === typeFilter)
    if (timeFilter === 'upcoming') list = list.filter(e => e.eventDate >= today)
    if (timeFilter === 'past')     list = list.filter(e => e.eventDate < today)
    return list.sort((a, b) =>
      timeFilter === 'past'
        ? b.eventDate.localeCompare(a.eventDate)
        : a.eventDate.localeCompare(b.eventDate)
    )
  }, [allEvents, typeFilter, timeFilter, today])

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, SchoolEvent[]>()
    for (const ev of filtered) {
      const k = monthKey(ev.eventDate)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(ev)
    }
    return [...map.entries()]
  }, [filtered])

  // Stats
  const upcoming  = allEvents.filter(e => e.eventDate >= today)
  const past      = allEvents.filter(e => e.eventDate < today)
  const needJrnl  = past.filter(e => !e.journaled && ['exam','test','ca','aoi','dit','practical'].includes(e.eventType))
  const inNext7   = upcoming.filter(e => daysUntil(e.eventDate) <= 7)

  // Active type filters present in data
  const presentTypes = useMemo(() => {
    const s = new Set(allEvents.map(e => e.eventType))
    return ALL_EVENT_TYPES.filter(t => s.has(t.value))
  }, [allEvents])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        @keyframes evFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes evSlideIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes evOrb     { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
      `}</style>

      {/* ── Hero header ── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: 20 }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,.18),transparent 68%)', filter: 'blur(40px)', pointerEvents: 'none', animation: 'evOrb 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 5, left: -40, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.14),transparent 70%)', filter: 'blur(30px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(145deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(245,158,11,.42)', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: -.5, background: 'linear-gradient(135deg,var(--txt) 30%,#f59e0b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                School Events
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '3px 0 0' }}>
                All exams, assessments & school events · shared across every role
              </p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(145deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,.42)', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {isDos ? 'Create Event' : 'Add Event'}
            </button>
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10 }}>
          {[
            { label: 'Upcoming', value: upcoming.length, color: '#0d9488' },
            { label: 'This Week', value: inNext7.length, color: '#f59e0b' },
            { label: 'Past', value: past.length, color: '#64748b' },
            ...(canCreate ? [{ label: 'Need Journaling', value: needJrnl.length, color: needJrnl.length > 0 ? '#f43f5e' : '#10b981' }] : []),
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 14px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 5px rgba(0,0,0,.04)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font3)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Time filter tabs ── */}
      <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 4, border: '.5px solid var(--border)', display: 'flex', gap: 2 }}>
        {([['upcoming', 'Upcoming'], ['all', 'All Events'], ['past', 'Past']] as const).map(([v, lbl]) => {
          const on = timeFilter === v
          return (
            <button key={v} onClick={() => setTimeFilter(v)}
              style={{ flex: 1, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: on ? 800 : 600, fontSize: 12.5, background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--txt)' : 'var(--txt3)', boxShadow: on ? '0 2px 10px rgba(0,0,0,.09)' : 'none', transition: 'all .18s cubic-bezier(.32,.72,0,1)' }}>
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

      {/* ── Event list ── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 84, borderRadius: 14 }} />)}
        </div>
      )}

      {!isLoading && grouped.length === 0 && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)', animation: 'evFadeIn .3s ease both' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(245,158,11,.08)', border: '.5px solid rgba(245,158,11,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.9"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
            {timeFilter === 'upcoming' ? 'No upcoming events' : timeFilter === 'past' ? 'No past events' : 'No events yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
            {canCreate ? 'Create the first event to get started.' : 'Events will appear here when created by teachers or the DoS.'}
          </div>
        </div>
      )}

      {!isLoading && grouped.map(([month, events], gi) => (
        <div key={month} style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: `evSlideIn .2s ${gi * 0.04}s ease both` }}>
          {/* Month separator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <div style={{ flex: 1, height: .5, background: 'var(--border)' }} />
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: .6, whiteSpace: 'nowrap' }}>{monthLabel(month)}</span>
            <div style={{ flex: 1, height: .5, background: 'var(--border)' }} />
          </div>
          {events.map(ev => (
            <EventCard key={ev.id} event={ev} canDelete={canDelete} canJournal={canCreate && role !== 'dos'} />
          ))}
        </div>
      ))}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} isDos={isDos} />}
    </div>
  )
}
