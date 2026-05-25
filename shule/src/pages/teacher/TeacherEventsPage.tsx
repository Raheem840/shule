import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTeacherEvents, useCreateEvent } from '../../hooks/useTeacherEvents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import type { SchoolEvent } from '../../types/week9'

const EVENT_TYPES = [
  { value: 'exam',       label: 'Exam' },
  { value: 'test',       label: 'Test' },
  { value: 'ca',         label: 'CA' },
  { value: 'aoi',        label: 'AoI' },
  { value: 'dit',        label: 'DIT' },
  { value: 'practical',  label: 'Practical' },
  { value: 'assignment', label: 'Assignment' },
]

const TYPE_COLOR: Record<string, string> = {
  exam:       'var(--danger)',
  test:       'var(--warning)',
  ca:         'var(--warning)',
  aoi:        'var(--info)',
  dit:        'var(--violet)',
  practical:  'var(--brand)',
  assignment: 'var(--txt2)',
  general:    'var(--success)',
}

function isPast(dateStr: string) {
  return new Date(dateStr) < new Date()
}

// ── Create Event Modal ─────────────────────────────────────────────────────
function CreateEventModal({ onClose }: { onClose: () => void }) {
  const { data: classes = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const [selectedClass, setSelectedClass] = useState('')
  const { data: streams = [] } = useStreams(selectedClass || null)
  const createMut = useCreateEvent()

  const [form, setForm] = useState({
    title:      '',
    eventType:  'exam',
    subjectId:  '',
    classId:    '',
    streamId:   '',
    eventDate:  new Date().toISOString().slice(0, 10),
    totalMarks: '',
    passMark:   '',
    description: '',
    term:       'Term 1',
    year:       new Date().getFullYear().toString(),
  })
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.eventDate) { setError('Title and date are required.'); return }
    setError('')
    try {
      await createMut.mutateAsync({
        title:      form.title,
        eventType:  form.eventType,
        subjectId:  form.subjectId || null,
        classId:    form.classId || null,
        streamId:   form.streamId || null,
        eventDate:  form.eventDate,
        totalMarks: form.totalMarks ? parseFloat(form.totalMarks) : null,
        passMark:   form.passMark   ? parseFloat(form.passMark)   : null,
        description: form.description || null,
        term:       form.term,
        year:       parseInt(form.year),
      })
      onClose()
    } catch (err: any) {
      setError(err.message ?? 'Failed to create event')
    }
  }

  const f = (k: keyof typeof form) => ({
    value: form[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value })),
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 500, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, margin: 0 }}>Create Event</h3>
          <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer', fontSize:20, color:'var(--txt3)' }}>✕</button>
        </div>

        {error && (
          <div style={{ background:'var(--danger-bg)', color:'var(--danger)', padding:'8px 12px', borderRadius:8, fontSize:13, marginBottom:16 }}>{error}</div>
        )}

        <form onSubmit={e => { void handleSubmit(e) }} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Title ★</label>
            <input {...f('title')} className="sui-input" style={{ width:'100%' }} placeholder="e.g. Mathematics End of Term Exam" required />
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Type ★</label>
              <select {...f('eventType')} className="sui-input" style={{ width:'100%' }}>
                {EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Date ★</label>
              <input type="date" {...f('eventDate')} className="sui-input" style={{ width:'100%' }} required />
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Subject</label>
            <select {...f('subjectId')} className="sui-input" style={{ width:'100%' }}>
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Class</label>
              <select
                value={form.classId}
                onChange={e => { setSelectedClass(e.target.value); setForm(p => ({ ...p, classId: e.target.value, streamId:'' })) }}
                className="sui-input" style={{ width:'100%' }}
              >
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {streams.length > 0 && (
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Stream</label>
                <select {...f('streamId')} className="sui-input" style={{ width:'100%' }}>
                  <option value="">All streams</option>
                  {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Total Marks</label>
              <input type="number" {...f('totalMarks')} className="sui-input" style={{ width:'100%' }} placeholder="e.g. 100" />
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Pass Mark</label>
              <input type="number" {...f('passMark')} className="sui-input" style={{ width:'100%' }} placeholder="e.g. 50" />
            </div>
          </div>

          <div style={{ display:'flex', gap:8 }}>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Term</label>
              <select {...f('term')} className="sui-input" style={{ width:'100%' }}>
                {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ flex:1 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Year</label>
              <input type="number" {...f('year')} className="sui-input" style={{ width:'100%' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize:12, fontWeight:700, color:'var(--txt2)', display:'block', marginBottom:4 }}>Notes</label>
            <textarea {...f('description')} className="sui-input" rows={2} style={{ width:'100%', resize:'vertical' }} placeholder="Any additional context…" />
          </div>

          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
            <button type="button" onClick={onClose} className="sui-btn-outline">Cancel</button>
            <button type="submit" disabled={createMut.isPending} className="sui-btn-primary">
              {createMut.isPending ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Event Card ─────────────────────────────────────────────────────────────
function EventCard({ event }: { event: SchoolEvent }) {
  const navigate = useNavigate()
  const color = TYPE_COLOR[event.eventType] ?? 'var(--txt2)'
  const past  = isPast(event.eventDate)

  function handleJournalIt() {
    // Navigate to exam journal page pre-filled with event details
    navigate('/teacher/exams', { state: { prefill: event } })
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 20px',
      borderLeft: `4px solid ${color}`,
      opacity: past && event.journaled ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
              background: `${color}20`, color,
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {event.eventType}
            </span>
            {event.journaled && (
              <span style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: 'var(--success-bg)', color: 'var(--success)',
              }}>
                Journaled ✓
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>{event.title}</div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4 }}>
            {new Date(event.eventDate).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
            })}
            {event.totalMarks && ` · ${event.totalMarks} marks`}
            {event.passMark   && ` · Pass: ${event.passMark}`}
          </div>
          {event.description && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>{event.description}</div>
          )}
        </div>

        {past && !event.journaled && (
          <button
            onClick={handleJournalIt}
            className="sui-btn-primary"
            style={{ fontSize: 12, padding: '6px 14px', marginLeft: 12, flexShrink: 0 }}
          >
            Journal It →
          </button>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER EVENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function TeacherEventsPage() {
  const { data: events = [], isLoading } = useTeacherEvents()
  const [showCreate, setShowCreate] = useState(false)
  const [showPast, setShowPast]     = useState(false)

  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate))
  const past     = events.filter(e => e.eventDate < today).sort((a, b) => b.eventDate.localeCompare(a.eventDate))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            My Events
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            Plan events, then journal them after marking.
          </div>
        </div>
        <button onClick={() => setShowCreate(true)} className="sui-btn-primary" style={{ fontSize: 13 }}>
          + Create Event
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading events…</div>}

      {/* Upcoming */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
          Upcoming ({upcoming.length})
        </div>
        {upcoming.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13, padding: 20,
            background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
            textAlign: 'center' }}>
            No upcoming events. Create one to get started.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </div>

      {/* Past — collapsible */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(p => !p)}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 14, color: 'var(--txt2)',
              display: 'flex', alignItems: 'center', gap: 8, padding: 0,
            }}
          >
            Past Events ({past.length}) {showPast ? '▲' : '▼'}
          </button>
          {showPast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {past.map(e => <EventCard key={e.id} event={e} />)}
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
