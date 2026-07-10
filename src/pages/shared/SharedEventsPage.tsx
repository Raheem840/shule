import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../store/AuthContext'
import { useAllSchoolEvents, useCreateEvent, useDeleteEvent } from '../../hooks/useTeacherEvents'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import {
  EventTimeline,
  ALL_EVENT_TYPES, DOS_EXTRA_TYPES, TEACHER_EVENT_TYPES,
  typeColor, daysUntil, localToday,
} from '../../components/shared/EventTimeline'
import type { SchoolEvent } from '../../types/week9'

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
    eventDate: localToday(),
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

  const color    = typeColor(form.eventType)
  const portal   = document.querySelector('.ar') as HTMLElement ?? document.body
  const isAdminT = DOS_EXTRA_TYPES.some(t => t.value === form.eventType)

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.54)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 20px' }}>
          {err && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.2)', color: 'var(--danger)', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>{err}</div>}
          <form onSubmit={ev => { void submit(ev) }} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input {...f('title')} className="sui-input" style={{ width: '100%' }} placeholder="e.g. End of Term 1 Examinations" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Type <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select {...f('eventType')} className="sui-input" style={{ width: '100%' }}>
                  {isDos && <optgroup label="School-wide">{DOS_EXTRA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>}
                  <optgroup label={isDos ? 'Assessments' : 'Type'}>{TEACHER_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input type="date" {...f('eventDate')} className="sui-input" style={{ width: '100%' }} />
              </div>
            </div>

            {!isAdminT && (
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Subject</label>
                <select {...f('subjectId')} className="sui-input" style={{ width: '100%' }}><option value="">All subjects</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </div>
            )}

            {!isAdminT && (
              <div style={{ display: 'grid', gridTemplateColumns: streams.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Class</label>
                  <select value={form.classId} onChange={e => { setSelectedClass(e.target.value); setForm(p => ({ ...p, classId: e.target.value, streamId: '' })) }} className="sui-input" style={{ width: '100%' }}>
                    <option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {streams.length > 0 && (
                  <div>
                    <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Stream</label>
                    <select {...f('streamId')} className="sui-input" style={{ width: '100%' }}><option value="">All streams</option>{streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                  </div>
                )}
              </div>
            )}

            {!isAdminT && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Total Marks</label><input type="number" {...f('totalMarks')} className="sui-input" style={{ width: '100%' }} placeholder="100" /></div>
                <div><label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Pass Mark</label><input type="number" {...f('passMark')} className="sui-input" style={{ width: '100%' }} placeholder="50" /></div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div><label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Term</label><select {...f('term')} className="sui-input" style={{ width: '100%' }}>{['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Year</label><input type="number" {...f('year')} className="sui-input" style={{ width: '100%' }} /></div>
            </div>

            <div><label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Notes</label><textarea {...f('description')} className="sui-input" rows={2} style={{ width: '100%', resize: 'vertical' }} placeholder="Any additional details…" /></div>

            {isDos && (
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
              <button type="button" onClick={onClose} style={{ flex: 1, height: 46, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 13, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button type="submit" disabled={createMut.isPending} style={{ flex: 2, height: 46, background: `linear-gradient(145deg,${color},${color}cc)`, color: '#fff', border: 'none', borderRadius: 13, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: `0 4px 14px ${color}44`, opacity: createMut.isPending ? .7 : 1 }}>
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

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function SharedEventsPage() {
  const { user }  = useAuth()
  const role      = user?.role ?? ''
  const isDos     = ['dos', 'principal', 'deputy'].includes(role)
  const canCreate = ['dos', 'principal', 'deputy', 'teacher', 'class_teacher'].includes(role)
  const canDel    = (ev: SchoolEvent) => ['dos', 'principal'].includes(role) || ev.createdBy === user?.staffId

  const { data: rawEvents = [], isLoading } = useAllSchoolEvents()
  const isGuardianView = role === 'parent' || role === 'student'
  const allEvents = useMemo(
    () => isGuardianView ? rawEvents.filter(e => e.visibleToParents) : rawEvents,
    [rawEvents, isGuardianView]
  )
  const deleteMut = useDeleteEvent()
  const { success: ok, error: err } = useToast()

  const [showCreate, setShowCreate] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState<'upcoming' | 'all' | 'past'>('upcoming')
  const [deletePending, setDeletePending] = useState<SchoolEvent | null>(null)

  const today = localToday()

  const filtered = useMemo(() => {
    let list = [...allEvents]
    if (typeFilter !== 'all') list = list.filter(e => e.eventType === typeFilter)
    if (timeFilter === 'upcoming') list = list.filter(e => e.eventDate >= today)
    if (timeFilter === 'past')     list = list.filter(e => e.eventDate < today)
    return list.sort((a, b) =>
      timeFilter === 'past'
        ? b.eventDate.localeCompare(a.eventDate)
        : a.eventDate.localeCompare(b.eventDate)
    )
  }, [allEvents, typeFilter, timeFilter, today])

  const upcoming = allEvents.filter(e => e.eventDate >= today)
  const past     = allEvents.filter(e => e.eventDate < today)
  const inNext7  = upcoming.filter(e => daysUntil(e.eventDate) <= 7)
  const needJrnl = past.filter(e => !e.journaled && ['exam','test','ca','aoi','dit','practical'].includes(e.eventType))

  const presentTypes = useMemo(() => {
    const s = new Set(allEvents.map(e => e.eventType))
    return ALL_EVENT_TYPES.filter(t => s.has(t.value))
  }, [allEvents])

  async function doDelete(ev: SchoolEvent) {
    try { await deleteMut.mutateAsync(ev.id); ok('Event removed') }
    catch (e: any) { err(e.message) }
    setDeletePending(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Hero ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -20, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(245,158,11,.18),transparent 68%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, position: 'relative', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(145deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(245,158,11,.42)', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><line x1="8" y1="14" x2="16" y2="14"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: -.5, color: 'var(--txt)' }}>
                School Events
              </h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '3px 0 0' }}>
                All exams, assessments &amp; events · shared across every role
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

      {/* ── Stats ── */}
      {!isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(100px,1fr))', gap: 10 }}>
          {[
            { label: 'Upcoming',  value: upcoming.length,  color: '#0d9488' },
            { label: 'This Week', value: inNext7.length,   color: '#f59e0b' },
            { label: 'Past',      value: past.length,      color: '#64748b' },
            ...(canCreate ? [{ label: 'Need Journaling', value: needJrnl.length, color: needJrnl.length > 0 ? '#f43f5e' : '#10b981' }] : []),
          ].map(k => (
            <div key={k.label} style={{ padding: '12px 14px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font3)', color: k.color, letterSpacing: -1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Time filter ── */}
      <div style={{ background: 'var(--surface2)', borderRadius: 14, padding: 4, border: '.5px solid var(--border)', display: 'flex', gap: 2 }}>
        {(['upcoming','all','past'] as const).map(v => {
          const on = timeFilter === v
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
        canDelete={canDel}
        canEdit={() => false}
        canJournal={canCreate && role !== 'dos' && role !== 'student' && role !== 'parent'}
        onDelete={setDeletePending}
        emptyTitle={timeFilter === 'upcoming' ? 'No upcoming events' : timeFilter === 'past' ? 'No past events' : 'No events yet'}
        emptyBody={canCreate ? 'Create the first event to get started.' : 'Events will appear here when created by teachers or the DoS.'}
      />

      {/* ── Delete confirm ── */}
      {deletePending && createPortal(
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setDeletePending(null)}>
          <div style={{ width: '100%', maxWidth: 400, background: 'var(--surface)', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 24px 80px rgba(0,0,0,.3)', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 8 }}>Remove event?</div>
              <div style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.55 }}>"{deletePending.title}" will be permanently deleted.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeletePending(null)} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)' }}>Cancel</button>
              <button onClick={() => void doDelete(deletePending)} disabled={deleteMut.isPending} style={{ flex: 1, padding: '11px 0', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', opacity: deleteMut.isPending ? .7 : 1 }}>
                {deleteMut.isPending ? '…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.querySelector('.ar') as HTMLElement ?? document.body
      )}

      {showCreate && <CreateEventModal onClose={() => setShowCreate(false)} isDos={isDos} />}
    </div>
  )
}
