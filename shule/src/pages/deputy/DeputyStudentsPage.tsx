import { useState, useMemo, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents, useSetStudentStatus } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'

// Deputy sees student names, class, stream, status — zero financial data.

type Status = 'active' | 'suspended' | 'expelled'

const STATUS: Record<Status, { label: string; color: string; bg: string; ring: boolean }> = {
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,.12)', ring: true  },
  suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', ring: false },
  expelled:  { label: 'Expelled',  color: '#f43f5e', bg: 'rgba(244,63,94,.12)',  ring: false },
}

const PALETTE = [
  ['#0d9488','rgba(13,148,136,.18)'],
  ['#8b5cf6','rgba(139,92,246,.18)'],
  ['#0ea5e9','rgba(14,165,233,.18)'],
  ['#f59e0b','rgba(245,158,11,.18)'],
  ['#f43f5e','rgba(244,63,94,.18)'],
  ['#10b981','rgba(16,185,129,.18)'],
] as const

function pal(name: string) {
  const i = ((name.charCodeAt(0) || 65) + (name.charCodeAt(1) || 65)) % PALETTE.length
  return PALETTE[i]
}
function ini(f: string, l: string) { return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() }

// ─── KPI chip ───────────────────────────────────────────────────────────────────
function KpiChip({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div style={{
      flex: 1, minWidth: 130,
      background: 'var(--surface)', border: '.5px solid var(--border)',
      borderRadius: 18, padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 14px rgba(0,0,0,.06)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -16, right: -16, width: 80, height: 80, borderRadius: '50%', filter: 'blur(28px)', background: `${color}28`, pointerEvents: 'none' }}/>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon}/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', lineHeight: 1, letterSpacing: -1 }}>
          {value.toLocaleString()}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>
          {label}
        </div>
      </div>
    </div>
  )
}

// ─── Status dot with pulse ───────────────────────────────────────────────────────
function StatusDot({ status }: { status: Status }) {
  const s = STATUS[status] ?? STATUS.active
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }}/>
        {s.ring && (
          <div style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            border: `1.5px solid ${s.color}`, opacity: .5,
            animation: 'shule-ping 1.8s ease-out infinite',
          }}/>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
    </div>
  )
}

// ─── Filter pill ────────────────────────────────────────────────────────────────
function Pill({ label, active, color, onClick }: { label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      fontFamily: 'var(--font2)', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s',
      background: active ? (color ? `${color}18` : 'var(--brand)') : 'var(--surface2)',
      color:      active ? (color ?? '#fff') : 'var(--txt2)',
      border:     active ? `1px solid ${color ?? 'var(--brand)'}50` : '1px solid var(--border)',
      boxShadow:  active ? `0 2px 10px ${color ?? 'var(--brand)'}28` : 'none',
    }}>
      {label}
    </button>
  )
}

// ─── Action menu ────────────────────────────────────────────────────────────────
type StudentAction = 'suspend' | 'expel' | 'reinstate'

const ACTION_OPTS: Record<Status, { action: StudentAction; label: string; icon: string; color: string; hoverBg: string }[]> = {
  active:    [
    { action: 'suspend',   label: 'Suspend',   icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', color: '#f59e0b', hoverBg: 'rgba(245,158,11,.08)' },
    { action: 'expel',     label: 'Expel',     icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6', color: '#f43f5e', hoverBg: 'rgba(244,63,94,.08)' },
  ],
  suspended: [
    { action: 'reinstate', label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', color: '#10b981', hoverBg: 'rgba(16,185,129,.08)' },
    { action: 'expel',     label: 'Expel',     icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6', color: '#f43f5e', hoverBg: 'rgba(244,63,94,.08)' },
  ],
  expelled:  [
    { action: 'reinstate', label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', color: '#10b981', hoverBg: 'rgba(16,185,129,.08)' },
  ],
}

function ActionMenu({ studentId, studentName, status, onClose }: {
  studentId: string; studentName: string; status: Status; onClose: () => void
}) {
  const setStatus = useSetStudentStatus()
  const { success: toastOk, error: toastErr } = useToast()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const opts = ACTION_OPTS[status] ?? []

  async function doAction(action: StudentAction) {
    const newStatus: Status = action === 'reinstate' ? 'active' : action === 'suspend' ? 'suspended' : 'expelled'
    try {
      await setStatus.mutateAsync({ id: studentId, status: newStatus })
      toastOk(`${studentName} is now ${newStatus}`)
    } catch (e: any) { toastErr(e?.message ?? 'Action failed') }
    onClose()
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
      background: 'var(--surface)', border: '.5px solid var(--border)',
      borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.16)', zIndex: 200,
      minWidth: 160, overflow: 'hidden',
      animation: 'fadeUp .16s ease both',
    }}>
      <div style={{ padding: '8px 12px 6px', borderBottom: '.5px solid var(--border)' }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8 }}>Actions</div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--txt)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{studentName}</div>
      </div>
      {opts.map(opt => (
        <button key={opt.action} disabled={setStatus.isPending}
          onClick={() => { void doAction(opt.action) }}
          style={{
            width: '100%', padding: '10px 14px', border: 'none', background: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 13, fontWeight: 700, color: opt.color, transition: 'background .1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = opt.hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d={opt.icon}/></svg>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── Student row (virtualised) ────────────────────────────────────────────────
function StudentRow({ s, className, streamName, hovered, onEnter, onLeave }: {
  s: ReturnType<typeof useStudents>['data'][number]
  className: string
  streamName: string
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const [col] = pal(`${s.firstName}${s.lastName}`)
  const status = (s.status ?? 'active') as Status
  const type = s.studentType === 'boarder' ? 'Boarder' : s.studentType === 'day' ? 'Day' : null
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 150px 120px 110px 44px',
        alignItems: 'center',
        gap: 12,
        padding: '11px 20px',
        borderBottom: '.5px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        transition: 'background .1s',
      }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 13, flexShrink: 0,
          background: `linear-gradient(135deg,${col}cc,${col}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
          boxShadow: `0 3px 10px ${col}30`, userSelect: 'none',
        }}>
          {ini(s.firstName, s.lastName)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {s.firstName} {s.lastName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font3)', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', letterSpacing: .3 }}>
              {s.admissionNumber}
            </span>
            {type && (
              <>
                <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', padding: '1px 6px', borderRadius: 5, background: 'var(--surface2)', border: '.5px solid var(--border)' }}>
                  {type}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Class */}
      <div>
        {className ? (
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 8, background: 'rgba(13,148,136,.08)', border: '1px solid rgba(13,148,136,.15)', fontSize: 11, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font2)' }}>
            {className}
          </span>
        ) : <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>}
      </div>

      {/* Stream */}
      <div>
        {streamName ? (
          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 8, background: 'rgba(139,92,246,.07)', border: '1px solid rgba(139,92,246,.15)', fontSize: 11, fontWeight: 700, color: '#8b5cf6', fontFamily: 'var(--font2)' }}>
            {streamName}
          </span>
        ) : <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>}
      </div>

      {/* Status */}
      <StatusDot status={status}/>

      {/* Action trigger */}
      <div style={{ position: 'relative', opacity: hovered || menuOpen ? 1 : 0, transition: 'opacity .15s' }}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '.5px solid var(--border)',
            background: menuOpen ? 'var(--surface2)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--txt3)', transition: 'all .13s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt)' }}
          onMouseLeave={e => { if (!menuOpen) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt3)' } }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>
          </svg>
        </button>
        {menuOpen && (
          <ActionMenu
            studentId={s.id}
            studentName={`${s.firstName} ${s.lastName}`}
            status={status}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DeputyStudentsPage() {
  const [classId,      setClassId]      = useState('')
  const [streamId,     setStreamId]     = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)

  const { data: classes  = [] }                             = useClasses()
  // Only fetch streams for the selected class — passing null returns ALL streams
  // across all classes which causes duplicates (e.g. "East" from S1, S2, S3, S4).
  const { data: streams  = [] }                             = useStreams(classId || null)
  const { data: students = [], isLoading, isFetching }      = useStudents(
    { classId: classId || undefined, streamId: streamId || undefined },
    true,
  )

  const classMap  = useMemo(() => new Map(classes.map(c  => [c.id,  c.name])), [classes])
  const streamMap = useMemo(() => new Map(streams.map(s  => [s.id,  s.name])), [streams])

  const filtered = useMemo(() => {
    let r = students
    if (statusFilter) r = r.filter(s => s.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q)
      )
    }
    return r
  }, [students, statusFilter, search])

  // KPI counts — always based on the full class selection (ignoring status/search filter)
  const base           = students
  const countActive    = base.filter(s => s.status === 'active').length
  const countSuspended = base.filter(s => s.status === 'suspended').length
  const countExpelled  = base.filter(s => s.status === 'expelled').length

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  })

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg,rgba(13,148,136,.07) 0%,rgba(139,92,246,.04) 100%)',
        border: '.5px solid var(--border)', borderRadius: 20, padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', filter: 'blur(50px)', background: 'rgba(13,148,136,.12)', pointerEvents: 'none' }}/>
        <div style={{ position: 'absolute', bottom: -20, left: 40, width: 100, height: 100, borderRadius: '50%', filter: 'blur(40px)', background: 'rgba(139,92,246,.1)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 5 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(13,148,136,.35)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Student Register</h1>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>Read-only · No financial data shown</div>
            </div>
          </div>
        </div>
        {isFetching && !isLoading && (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--txt3)', fontWeight: 700 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--brand)', animation: 'mgSpin .6s linear infinite' }}/>
            Syncing…
          </div>
        )}
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiChip
          label="Active"
          value={countActive}
          color="#10b981"
          icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        />
        <KpiChip
          label="Suspended"
          value={countSuspended}
          color="#f59e0b"
          icon="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"
        />
        <KpiChip
          label="Expelled"
          value={countExpelled}
          color="#f43f5e"
          icon="M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6"
        />
        <KpiChip
          label="Total"
          value={students.length}
          color="#0ea5e9"
          icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
        />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Search + dropdowns */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              className="sui-input"
              placeholder="Search name or admission number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 36, width: '100%' }}
            />
          </div>
          <select className="sui-input" value={classId} onChange={e => { setClassId(e.target.value); setStreamId('') }} style={{ minWidth: 150 }}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {/* Only render when a class is selected — avoids duplicate stream names
               that arise from multiple classes having streams with the same name */}
          {classId && streams.length > 0 && (
            <select className="sui-input" value={streamId} onChange={e => setStreamId(e.target.value)} style={{ minWidth: 140 }}>
              <option value="">All Streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label={`All  ·  ${students.length}`} active={statusFilter === ''} onClick={() => setStatusFilter('')}/>
          <Pill label={`Active  ·  ${countActive}`}    active={statusFilter === 'active'}    color="#10b981" onClick={() => setStatusFilter(statusFilter === 'active'    ? '' : 'active')}/>
          <Pill label={`Suspended  ·  ${countSuspended}`} active={statusFilter === 'suspended'} color="#f59e0b" onClick={() => setStatusFilter(statusFilter === 'suspended' ? '' : 'suspended')}/>
          {countExpelled > 0 && (
            <Pill label={`Expelled  ·  ${countExpelled}`}  active={statusFilter === 'expelled'}  color="#f43f5e" onClick={() => setStatusFilter(statusFilter === 'expelled'  ? '' : 'expelled')}/>
          )}
          {(search || statusFilter || classId) && (
            <button onClick={() => { setSearch(''); setStatusFilter(''); setClassId(''); setStreamId('') }}
              style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'none', border: '1px solid rgba(244,63,94,.3)', color: 'var(--danger)', transition: 'all .14s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,.07)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              Clear filters
            </button>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)', fontWeight: 700 }}>
            {filtered.length} {filtered.length === 1 ? 'student' : 'students'}
          </span>
        </div>
      </div>

      {/* ── Table card ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: 14 }}/>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '.5px solid var(--border)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(0,0,0,.06)',
        }}>
          {/* Sticky table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 150px 120px 110px 44px',
            gap: 12, padding: '10px 20px',
            background: 'var(--surface2)',
            borderBottom: '.5px solid var(--border)',
          }}>
            {['Student', 'Class', 'Stream', 'Status', ''].map(h => (
              <div key={h} style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, fontFamily: 'var(--font2)' }}>
                {h}
              </div>
            ))}
          </div>

          {/* Virtualised rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--surface2)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>No students match</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            <div ref={parentRef} style={{ maxHeight: 580, overflowY: 'auto' }}>
              <div style={{ height: virtualiser.getTotalSize(), position: 'relative' }}>
                {virtualiser.getVirtualItems().map(vi => {
                  const s = filtered[vi.index]
                  return (
                    <div key={s.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}>
                      <StudentRow
                        s={s}
                        className={s.classId  ? classMap.get(s.classId)   ?? '—' : '—'}
                        streamName={s.streamId ? streamMap.get(s.streamId) ?? '—' : '—'}
                        hovered={hoveredId === s.id}
                        onEnter={() => setHoveredId(s.id)}
                        onLeave={() => setHoveredId(null)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div style={{
              padding: '10px 20px',
              borderTop: '.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface2)',
            }}>
              <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontWeight: 700 }}>
                Showing {filtered.length} of {students.length} students
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}/>
                  {countActive} active
                </div>
                {countSuspended > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }}/>
                    {countSuspended} suspended
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
