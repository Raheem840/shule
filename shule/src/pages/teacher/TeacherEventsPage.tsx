import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTeacherEvents, useCreateEvent } from '../../hooks/useTeacherEvents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
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

const Lbl = ({ children, req }: { children: React.ReactNode; req?: boolean }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .6 }}>
    {children}{req && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
  </label>
)

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const { data: classes = [] }  = useClasses()
  const { data: subjects = [] } = useSubjects()
  const [selectedClass, setSelectedClass] = useState('')
  const { data: streams = [] } = useStreams(selectedClass || null)
  const createMut = useCreateEvent()
  const [form, setForm] = useState({ title: '', eventType: 'exam', subjectId: '', classId: '', streamId: '', eventDate: new Date().toISOString().slice(0, 10), totalMarks: '', passMark: '', description: '', term: 'Term 1', year: new Date().getFullYear().toString() })
  const [error, setError] = useState('')

  const f = (k: keyof typeof form) => ({ value: form[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [k]: e.target.value })) })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.eventDate) { setError('Title and date are required.'); return }
    setError('')
    try {
      await createMut.mutateAsync({ title: form.title, eventType: form.eventType, subjectId: form.subjectId || null, classId: form.classId || null, streamId: form.streamId || null, eventDate: form.eventDate, totalMarks: form.totalMarks ? parseFloat(form.totalMarks) : null, passMark: form.passMark ? parseFloat(form.passMark) : null, description: form.description || null, term: form.term, year: parseInt(form.year) })
      onClose()
    } catch (err: any) { setError(err.message ?? 'Failed to create event') }
  }

  const color = typeColor(form.eventType)
  const portal = document.querySelector('.ar') as HTMLElement ?? document.body

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, maxHeight: '90dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Modal header */}
        <div style={{ padding: '20px 24px 18px', background: `linear-gradient(150deg,${color}14,${color}05,transparent)`, borderBottom: `.5px solid ${color}20`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(145deg,${color},${color}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${color}44`, flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Create Event</div>
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
              <div>
                <Lbl req>Type</Lbl>
                <select {...f('eventType')} className="sui-input" style={{ width: '100%' }}>
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
              <div>
                <Lbl>Class</Lbl>
                <select value={form.classId} onChange={e => { setSelectedClass(e.target.value); setForm(p => ({ ...p, classId: e.target.value, streamId: '' })) }} className="sui-input" style={{ width: '100%' }}>
                  <option value="">Select class…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {streams.length > 0 && <div><Lbl>Stream</Lbl><select {...f('streamId')} className="sui-input" style={{ width: '100%' }}><option value="">All streams</option>{streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
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

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button type="submit" disabled={createMut.isPending}
                style={{ flex: 2, padding: '11px 0', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 4px 14px ${color}44`, transition: 'all .18s' }}>
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

function EventCard({ event }: { event: SchoolEvent }) {
  const navigate = useNavigate()
  const color = typeColor(event.eventType)
  const past  = isPast(event.eventDate)

  return (
    <div style={{ background: 'var(--surface)', border: `.5px solid ${past && event.journaled ? 'var(--border)' : color + '30'}`, borderRadius: 16, padding: '16px 20px', borderLeft: `3px solid ${color}`, opacity: past && event.journaled ? 0.6 : 1, transition: 'box-shadow .14s', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,.09)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,.04)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, background: `${color}18`, color, textTransform: 'uppercase', letterSpacing: .5, border: `.5px solid ${color}30` }}>{event.eventType}</span>
            {event.journaled && <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.25)' }}>✓ Journaled</span>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            {new Date(event.eventDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
            {event.totalMarks && <><span>·</span><span>{event.totalMarks} marks</span></>}
            {event.passMark && <><span>·</span><span>Pass: {event.passMark}</span></>}
          </div>
          {event.description && <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 6, fontStyle: 'italic' }}>{event.description}</div>}
        </div>
        {past && !event.journaled && (
          <button onClick={() => navigate('/teacher/exams', { state: { prefill: event } })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', flexShrink: 0, boxShadow: `0 3px 10px ${color}44` }}>
            Journal It
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
      </div>
    </div>
  )
}

export function TeacherEventsPage() {
  const { data: events = [], isLoading } = useTeacherEvents()
  const [showCreate, setShowCreate] = useState(false)
  const [showPast,   setShowPast]   = useState(false)

  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  const past     = events.filter(e => e.eventDate < today).sort((a, b) => b.eventDate.localeCompare(a.eventDate))
  const pendingJournal = past.filter(e => !e.journaled).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>My Events</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Plan events and journal them after marking.</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Event
          </button>
        </div>
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
            <div style={{ padding: '36px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>No upcoming events. Create one to get started.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcoming.map(e => <EventCard key={e.id} event={e} />)}
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
              {past.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
