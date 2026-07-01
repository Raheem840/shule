import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useIsMobile } from '../../hooks/useIsMobile'
import { Avatar } from '../../components/shared/Avatar'
import { PromoteStudentsSection } from '../../components/shared/PromoteStudentsSection'

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: 'active' | 'suspended' | 'expelled' }) {
  const map = {
    active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,.1)',  border: 'rgba(16,185,129,.25)' },
    suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,.1)', border: 'rgba(245,158,11,.25)' },
    expelled:  { label: 'Expelled',  color: '#f43f5e', bg: 'rgba(244,63,94,.1)',  border: 'rgba(244,63,94,.25)'  },
  }
  const s = map[status] ?? map.active
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color, border: `.5px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}


// ─── Mobile student card ───────────────────────────────────────────────────────
function StudentCard({ s, className, streamName }: {
  s: { id: string; firstName: string; lastName: string; admissionNumber: string; classId: string | null; streamId: string | null; status: 'active' | 'suspended' | 'expelled'; photoUrl?: string | null }
  className: string
  streamName: string
}) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 8px rgba(0,0,0,.05)' }}>
      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
        <Avatar photoPath={s.photoUrl ?? null} bucket="student-photos" name={`${s.firstName} ${s.lastName}`} size="md" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--txt)', marginBottom: 2, letterSpacing: -.2 }}>{s.firstName} {s.lastName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginBottom: 6 }}>{s.admissionNumber}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {className && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: 'rgba(13,148,136,.08)', color: 'var(--brand)', border: '.5px solid rgba(13,148,136,.2)' }}>
              {className}
            </span>
          )}
          {streamName && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 700, background: 'rgba(139,92,246,.08)', color: 'var(--violet)', border: '.5px solid rgba(139,92,246,.2)' }}>
              {streamName}
            </span>
          )}
          <StatusBadge status={s.status} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPUTY STUDENTS PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DeputyStudentsPage() {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [classId,  setClassId]  = useState('')
  const [streamId, setStreamId] = useState('')
  const [search,   setSearch]   = useState('')
  const [showPromote, setShowPromote] = useState(false)

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const { data: allStreams = [] } = useStreams(null)
  const { data: students = [], isLoading } = useStudents(
    { classId: classId || undefined, streamId: streamId || undefined },
    true
  )

  const classMap  = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])
  const streamMap = useMemo(() => new Map(allStreams.map(s => [s.id, s.name])), [allStreams])

  const rows = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    )
  }, [students, search])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count:            rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 56,
    overscan:         10,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(13,148,136,.38)', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Students</h1>
            {students.length > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', border: '.5px solid rgba(13,148,136,.2)' }}>
                {students.length}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: 0 }}>Student directory · end-of-year promotion</p>
        </div>
        <button
          onClick={() => setShowPromote(v => !v)}
          className="sui-btn-primary"
          style={{ fontSize: 12.5, flexShrink: 0 }}
        >
          {showPromote ? 'Hide Promotion' : 'Promote Students'}
        </button>
        {rows.length > 0 && (
          <button
            onClick={() => {
              const header = 'Name,Admission No,Class,Stream,Gender,Type,Status\n'
              const csv = rows.map(s =>
                `"${s.firstName} ${s.lastName}","${s.admissionNumber}","${classMap.get(s.classId ?? '') ?? ''}","${streamMap.get(s.streamId ?? '') ?? ''}","${s.gender}","${s.studentType ?? ''}","${s.status}"`
              ).join('\n')
              const blob = new Blob([header + csv], { type: 'text/csv' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `students-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {showPromote && <PromoteStudentsSection />}

      {/* ── Filters ── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            className="sui-input"
            placeholder="Search name or adm. number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
        <select className="sui-input" style={{ minWidth: 150 }} value={classId} onChange={e => { setClassId(e.target.value); setStreamId('') }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {streams.length > 0 && (
          <select className="sui-input" style={{ minWidth: 140 }} value={streamId} onChange={e => setStreamId(e.target.value)}>
            <option value="">All Streams</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* ── Loading skeletons ── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="shule-skeleton" style={{ height: isMobile ? 80 : 56, borderRadius: 14 }} />)}
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && rows.length === 0 && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--surface2)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
            {search || classId || streamId ? 'No matching students' : 'No students enrolled yet'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            {search || classId || streamId ? 'Try adjusting your filters.' : 'Students enrolled by the secretary will appear here.'}
          </div>
        </div>
      )}

      {/* ── Mobile: card list ── */}
      {!isLoading && rows.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(s => (
            <div key={s.id} onClick={() => navigate(`/deputy/students/${s.id}`)} style={{ cursor: 'pointer' }}>
              <StudentCard
                s={s}
                className={s.classId ? (classMap.get(s.classId) ?? '') : ''}
                streamName={s.streamId ? (streamMap.get(s.streamId) ?? '') : ''}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop: virtualised premium table ── */}
      {!isLoading && rows.length > 0 && !isMobile && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Adm No', 'Student', 'Class', 'Stream', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 560 }}>
            <div style={{ height: virtualiser.getTotalSize(), position: 'relative' }}>
              {virtualiser.getVirtualItems().map(vRow => {
                const s = rows[vRow.index]
                const className  = s.classId  ? (classMap.get(s.classId)   ?? '—') : '—'
                const streamName = s.streamId ? (streamMap.get(s.streamId) ?? '—') : '—'
                return (
                  <div key={s.id}
                    onClick={() => navigate(`/deputy/students/${s.id}`)}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)`, height: 56, display: 'flex', alignItems: 'center', borderBottom: '.5px solid var(--border)', cursor: 'pointer' }}
                    className="sui-tr"
                  >
                    {/* Adm No */}
                    <div style={{ flex: '0 0 130px', padding: '0 16px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>
                      {s.admissionNumber}
                    </div>
                    {/* Name with avatar */}
                    <div style={{ flex: 2, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                        <Avatar photoPath={s.photoUrl ?? null} bucket="student-photos" name={`${s.firstName} ${s.lastName}`} size="sm" />
                      </div>
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)' }}>{s.firstName} {s.lastName}</span>
                    </div>
                    {/* Class */}
                    <div style={{ flex: 1, padding: '0 16px', fontSize: 12.5, color: 'var(--txt2)' }}>
                      {className}
                    </div>
                    {/* Stream */}
                    <div style={{ flex: 1, padding: '0 16px', fontSize: 12.5, color: 'var(--txt2)' }}>
                      {streamName}
                    </div>
                    {/* Status */}
                    <div style={{ flex: '0 0 110px', padding: '0 16px' }}>
                      <StatusBadge status={s.status} />
                    </div>
                    {/* View action */}
                    <div style={{ flex: '0 0 90px', padding: '0 16px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        View
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ padding: '8px 16px', borderTop: '.5px solid var(--border)', fontSize: 11.5, color: 'var(--txt3)' }}>
            {rows.length} of {students.length} student{students.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
