import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useStudents, useSetStudentStatus } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import type { Student } from '../../types/app'

// ── Types ──────────────────────────────────────────────────────────────────────
type StudentStatus = 'active' | 'suspended' | 'expelled'

const STATUS_META: Record<StudentStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  expelled:  { label: 'Expelled',  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
}

// Level → accent color
const LEVEL_COLOR: Record<string, string> = {
  '1': '#0d9488',
  '2': '#0ea5e9',
  '3': '#8b5cf6',
  '4': '#f59e0b',
  '5': '#f43f5e',
  '6': '#10b981',
}
function levelColor(level: string | null | undefined): string {
  return LEVEL_COLOR[level ?? ''] ?? '#0d9488'
}

// Avatar palette
const PALETTE = [
  ['#0d9488', 'rgba(13,148,136,.18)'],
  ['#8b5cf6', 'rgba(139,92,246,.18)'],
  ['#0ea5e9', 'rgba(14,165,233,.18)'],
  ['#f59e0b', 'rgba(245,158,11,.18)'],
  ['#f43f5e', 'rgba(244,63,94,.18)'],
  ['#10b981', 'rgba(16,185,129,.18)'],
] as const

function pal(name: string) {
  const i = ((name.charCodeAt(0) || 65) + (name.charCodeAt(1) || 65)) % PALETTE.length
  return PALETTE[i]
}
function ini(f: string, l: string) { return `${f[0] ?? ''}${l[0] ?? ''}`.toUpperCase() }

// ── Action menu ───────────────────────────────────────────────────────────────
const STATUS_ACTIONS: Record<StudentStatus, { action: StudentStatus; label: string; icon: string; color: string; hoverBg: string }[]> = {
  active: [
    { action: 'suspended', label: 'Suspend', icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', color: '#f59e0b', hoverBg: 'rgba(245,158,11,.07)' },
    { action: 'expelled',  label: 'Expel',   icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6',                                              color: '#f43f5e', hoverBg: 'rgba(244,63,94,.07)' },
  ],
  suspended: [
    { action: 'active',   label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', color: '#10b981', hoverBg: 'rgba(16,185,129,.07)' },
    { action: 'expelled', label: 'Expel',     icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6', color: '#f43f5e', hoverBg: 'rgba(244,63,94,.07)' },
  ],
  expelled: [
    { action: 'active', label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3', color: '#10b981', hoverBg: 'rgba(16,185,129,.07)' },
  ],
}

function StudentActionMenu({ student, pos, onClose, onView }: {
  student: Student; pos: { top: number; left: number }; onClose: () => void; onView: () => void
}) {
  const setStatus = useSetStudentStatus()
  const { success: ok, error: err } = useToast()
  const status = (student.status ?? 'active') as StudentStatus

  const opts = STATUS_ACTIONS[status] ?? []

  async function doStatus(newStatus: StudentStatus) {
    try {
      await setStatus.mutateAsync({ id: student.id, status: newStatus as Student['status'] })
      ok(`${student.firstName} is now ${newStatus}`)
    } catch (e: any) { err(e?.message ?? 'Action failed') }
    onClose()
  }

  return createPortal(
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
        background: 'var(--surface)', border: '.5px solid var(--border)',
        borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.16)',
        minWidth: 168, overflow: 'hidden', animation: 'fadeUp .16s ease both',
      }}
    >
      <div style={{ padding: '8px 14px 6px', borderBottom: '.5px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8 }}>Actions</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', marginTop: 2 }}>{student.firstName} {student.lastName}</div>
      </div>
      <button onClick={() => { onClose(); onView() }}
        style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: 'var(--brand)', transition: 'background .1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13,148,136,.07)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View Profile
      </button>
      {opts.length > 0 && <div style={{ height: '.5px', background: 'var(--border)', margin: '2px 0' }} />}
      {opts.map(o => (
        <button key={o.action} disabled={setStatus.isPending} onClick={() => { void doStatus(o.action) }}
          style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: o.color, transition: 'background .1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = o.hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d={o.icon}/></svg>
          {o.label}
        </button>
      ))}
    </div>,
    document.body
  )
}

// ── Student Card ──────────────────────────────────────────────────────────────
function StudentCard({ student, className, classLevel, streamName, onView }: {
  student: Student
  className: string
  classLevel: string | null
  streamName: string
  onView: () => void
}) {
  const [hovered,  setHovered]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos,  setMenuPos]  = useState({ top: 0, left: 0 })
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const status = (student.status ?? 'active') as StudentStatus
  const [col]  = pal(`${student.firstName}${student.lastName}`)
  const accent = levelColor(classLevel)
  const inits  = ini(student.firstName, student.lastName)
  const gender = student.gender === 'male' ? 'M' : student.gender === 'female' ? 'F' : null
  const boarderLabel = student.studentType === 'boarder' ? 'Boarder' : student.studentType === 'day' ? 'Day' : null

  useEffect(() => {
    if (!menuOpen) return
    function close() { setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden', position: 'relative',
        transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,.10)' : '0 1px 6px rgba(0,0,0,.06)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Class-level accent strip */}
      <div style={{ height: 4, width: '100%', background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

      <div style={{ padding: '16px 16px 14px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: `linear-gradient(135deg, ${col}, ${col}88)`,
              padding: 2.5, position: 'relative',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%', background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 900, color: col, fontFamily: 'var(--font2)', userSelect: 'none',
              }}>
                {inits}
              </div>
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 12, height: 12, borderRadius: '50%',
                background: STATUS_META[status]?.color ?? '#94a3b8',
                border: '2px solid var(--surface)',
              }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 14.5, color: 'var(--txt)',
              lineHeight: 1.3, marginBottom: 5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {className && (
                <span style={{
                  padding: '2px 8px', borderRadius: 7,
                  background: `${accent}18`, color: accent,
                  border: `1px solid ${accent}30`,
                  fontSize: 10.5, fontWeight: 800, fontFamily: 'var(--font2)',
                }}>
                  {className}
                </span>
              )}
              <span style={{
                padding: '2px 8px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                background: STATUS_META[status]?.bg ?? 'var(--surface2)',
                color: STATUS_META[status]?.color ?? 'var(--txt3)',
              }}>
                {STATUS_META[status]?.label ?? status}
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 4, fontFamily: 'var(--font3)', letterSpacing: .3 }}>
              {student.admissionNumber}
            </div>
          </div>
        </div>

        {/* Stream + gender */}
        {(streamName || gender || boarderLabel) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {streamName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                <span style={{ fontSize: 11.5, color: 'var(--txt2)', fontWeight: 600 }}>{streamName}</span>
              </div>
            )}
            {gender && (
              <span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt3)' }}>
                {gender}
              </span>
            )}
            {boarderLabel && (
              <span style={{ padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt3)' }}>
                {boarderLabel}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          <button
            onClick={onView}
            style={{
              padding: '4px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: 'var(--brand-light)', color: 'var(--brand)',
              border: '1px solid rgba(13,148,136,.2)', cursor: 'pointer', transition: 'all .13s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(13,148,136,.15)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-light)' }}
          >
            View Profile
          </button>

          <div onClick={e => e.stopPropagation()}>
            <button
              ref={menuBtnRef}
              onClick={e => {
                e.stopPropagation()
                if (!menuOpen && menuBtnRef.current) {
                  const r = menuBtnRef.current.getBoundingClientRect()
                  setMenuPos({ top: r.bottom + 6, left: r.left })
                }
                setMenuOpen(v => !v)
              }}
              style={{
                width: 28, height: 28, borderRadius: 7,
                border: '1px solid var(--border)',
                background: menuOpen ? 'var(--surface2)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--txt3)', transition: 'all .13s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
              onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>
              </svg>
            </button>
          </div>
          {menuOpen && (
            <StudentActionMenu student={student} pos={menuPos} onClose={() => setMenuOpen(false)} onView={onView} />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div className="shule-skeleton" style={{ height: 4, width: '100%' }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <span className="shule-skeleton" style={{ display: 'block', width: 52, height: 52, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span className="shule-skeleton" style={{ display: 'block', height: 14, width: 130, borderRadius: 6, marginBottom: 7 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 18, width: 80, borderRadius: 7, marginBottom: 7 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 10, width: 60, borderRadius: 4 }} />
          </div>
        </div>
        <span className="shule-skeleton" style={{ display: 'block', height: 11, width: '50%', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          <span className="shule-skeleton" style={{ display: 'block', height: 26, width: 80, borderRadius: 7 }} />
          <span className="shule-skeleton" style={{ display: 'block', height: 26, width: 28, borderRadius: 7 }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function PrincipalStudentsPage() {
  const navigate = useNavigate()
  const { data: students = [], isLoading } = useStudents()
  const { data: classes  = [] }            = useClasses()
  const { data: streams  = [] }            = useStreams(null)

  const [search,       setSearch]       = useState('')
  const [classFilter,  setClassFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')

  const classMap  = useMemo(() => new Map(classes.map(c => [c.id, c])), [classes])
  const streamMap = useMemo(() => new Map(streams.map(s => [s.id, s.name])), [streams])

  const filtered = useMemo(() => {
    let r = students
    if (classFilter)  r = r.filter(s => s.classId === classFilter)
    if (statusFilter) r = r.filter(s => s.status  === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(s =>
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.admissionNumber.toLowerCase().includes(q)
      )
    }
    return r
  }, [students, classFilter, statusFilter, search])

  const base           = classFilter ? students.filter(s => s.classId === classFilter) : students
  const countActive    = base.filter(s => s.status === 'active').length
  const countSuspended = base.filter(s => s.status === 'suspended').length
  const countExpelled  = base.filter(s => s.status === 'expelled').length

  return (
    <>
      <style>{`
        @keyframes shule-ping {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Hero Band ─────────────────────────────────────────────── */}
        <div style={{
          borderRadius: 18, overflow: 'hidden',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          padding: '28px 28px 24px', position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.20)',
                backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>
                Students
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
              {isLoading ? 'Loading students…' : 'Enrolled student register'}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total',     value: isLoading ? '—' : base.length },
                { label: 'Active',    value: isLoading ? '—' : countActive },
                { label: 'Suspended', value: isLoading ? '—' : countSuspended },
                { label: 'Expelled',  value: isLoading ? '—' : countExpelled },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)',
                  border: '.5px solid rgba(255,255,255,.28)', borderRadius: 12,
                  padding: '10px 16px', minWidth: 80,
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Search + filters ──────────────────────────────────── */}
          <div style={{ position: 'relative', zIndex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                border: '.5px solid rgba(255,255,255,.28)', borderRadius: 10,
                padding: '0 12px', height: 40, flex: '1 1 220px',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  placeholder="Search by name or admission number…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#fff', fontSize: 13, fontWeight: 500 }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', padding: 0, display: 'flex' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
              <select
                value={classFilter}
                onChange={e => setClassFilter(e.target.value)}
                style={{
                  height: 40, padding: '0 12px', borderRadius: 10, border: '.5px solid rgba(255,255,255,.28)',
                  background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                  color: '#fff', fontSize: 12.5, fontWeight: 600, outline: 'none', minWidth: 140,
                }}
              >
                <option value="" style={{ color: '#0f172a' }}>All Classes</option>
                {classes.map(c => <option key={c.id} value={c.id} style={{ color: '#0f172a' }}>{c.name}</option>)}
              </select>
            </div>

            {/* Status pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {([
                { key: '' as const,         label: 'All' },
                { key: 'active' as const,    label: `Active · ${countActive}` },
                { key: 'suspended' as const, label: `Suspended · ${countSuspended}` },
                { key: 'expelled' as const,  label: `Expelled · ${countExpelled}` },
              ] as const).map(p => (
                <button key={p.key} onClick={() => setStatusFilter(p.key)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    fontFamily: 'var(--font2)', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all .15s',
                    background: statusFilter === p.key ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.10)',
                    color:      statusFilter === p.key ? '#fff' : 'rgba(255,255,255,.72)',
                    border:     statusFilter === p.key ? '1px solid rgba(255,255,255,.55)' : '1px solid rgba(255,255,255,.22)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Card Grid ─────────────────────────────────────────────── */}
        {isLoading && (
          <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '60px 24px', textAlign: 'center',
            background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)',
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No students found</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              {search || classFilter || statusFilter ? 'Try clearing some filters.' : 'No students have been enrolled yet.'}
            </div>
            {(search || classFilter || statusFilter) && (
              <button
                onClick={() => { setSearch(''); setClassFilter(''); setStatusFilter('') }}
                style={{ marginTop: 4, padding: '7px 18px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <>
            <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
              {filtered.map(s => {
                const cls   = s.classId  ? classMap.get(s.classId)   : null
                const sName = s.streamId ? (streamMap.get(s.streamId) ?? '') : ''
                return (
                  <StudentCard
                    key={s.id}
                    student={s}
                    className={cls?.name ?? ''}
                    classLevel={cls?.level ?? null}
                    streamName={sName}
                    onView={() => navigate(`/principal/students/${s.id}`)}
                  />
                )
              })}
            </div>
            <div style={{ textAlign: 'center', padding: '2px 0 8px', fontSize: 11.5, color: 'var(--txt3)', fontWeight: 600 }}>
              {filtered.length} student{filtered.length !== 1 ? 's' : ''}
              {(search || classFilter || statusFilter) ? ' matching filters' : ' enrolled'}
            </div>
          </>
        )}
      </div>
    </>
  )
}
