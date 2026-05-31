import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents, useSetStudentStatus } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { useToast } from '../../components/ui/Toast'
import type { Student } from '../../types/app'

// ─── Types & constants ────────────────────────────────────────────────────────
type StudentStatus = 'active' | 'suspended' | 'expelled'

const STATUS_META: Record<StudentStatus, {
  label: string; color: string; bg: string; ping: boolean
}> = {
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,0.12)', ping: true  },
  suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', ping: false },
  expelled:  { label: 'Expelled',  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  ping: false },
}

const AVATAR_PALETTE = [
  { color: '#0d9488', bg: 'rgba(13,148,136,0.18)' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.18)' },
  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)' },
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.18)'  },
  { color: '#10b981', bg: 'rgba(16,185,129,0.18)' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function avatarColor(name: string) {
  const code = (name.charCodeAt(0) ?? 65) + (name.charCodeAt(1) ?? 65)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiChip({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: string
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 20px', flex: 1, minWidth: 130,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', lineHeight: 1 }}>
          {value.toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

function StatusPing({ status }: { status: StudentStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.active
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
        {m.ping && (
          <div style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            border: `1.5px solid ${m.color}`, opacity: 0.5,
            animation: 'shule-ping 1.8s ease-out infinite',
          }} />
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: m.color }}>{m.label}</span>
    </div>
  )
}

function FilterPill({
  label, active, color, bg, onClick,
}: {
  label: string; active: boolean; color?: string; bg?: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
        background: active ? (bg ?? 'var(--brand)') : 'var(--surface2)',
        color:      active ? (color ?? '#fff')       : 'var(--txt2)',
        border:     active ? `1px solid ${color ?? 'var(--brand)'}50` : '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: active ? `0 2px 10px ${color ?? 'var(--brand)'}25` : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ─── Action menu ──────────────────────────────────────────────────────────────
const STATUS_ACTIONS: Record<StudentStatus, { action: StudentStatus | 'active'; label: string; icon: string; color: string; hoverBg: string }[]> = {
  active:    [
    { action: 'suspended', label: 'Suspend',   icon: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01', color: '#f59e0b', hoverBg: 'rgba(245,158,11,.07)' },
    { action: 'expelled',  label: 'Expel',     icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6',                                              color: '#f43f5e', hoverBg: 'rgba(244,63,94,.07)'  },
  ],
  suspended: [
    { action: 'active',    label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',                                                 color: '#10b981', hoverBg: 'rgba(16,185,129,.07)' },
    { action: 'expelled',  label: 'Expel',     icon: 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6',                                              color: '#f43f5e', hoverBg: 'rgba(244,63,94,.07)'  },
  ],
  expelled:  [
    { action: 'active',    label: 'Reinstate', icon: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',                                                 color: '#10b981', hoverBg: 'rgba(16,185,129,.07)' },
  ],
}

function StudentActionMenu({ student, onClose, onView }: {
  student: Student; onClose: () => void; onView: () => void
}) {
  const setStatus = useSetStudentStatus()
  const { success: ok, error: err } = useToast()
  const ref = useRef<HTMLDivElement>(null)
  const status = (student.status ?? 'active') as StudentStatus

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  const opts = STATUS_ACTIONS[status] ?? []

  async function doStatus(newStatus: StudentStatus | 'active') {
    try {
      await setStatus.mutateAsync({ id: student.id, status: newStatus as Student['status'] })
      ok(`${student.firstName} is now ${newStatus}`)
    } catch (e: any) { err(e?.message ?? 'Action failed') }
    onClose()
  }

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
      background: 'var(--surface)', border: '.5px solid var(--border)',
      borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,.16)',
      minWidth: 168, overflow: 'hidden',
      animation: 'fadeUp .16s ease both',
    }}>
      <div style={{ padding: '8px 14px 6px', borderBottom: '.5px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8 }}>Actions</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', marginTop: 2 }}>{student.firstName} {student.lastName}</div>
      </div>
      {/* View profile */}
      <button onClick={() => { onClose(); onView() }}
        style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: 'var(--brand)', transition: 'background .1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(13,148,136,.07)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View Profile
      </button>
      {/* Divider */}
      {opts.length > 0 && <div style={{ height: '.5px', background: 'var(--border)', margin: '2px 0' }}/>}
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
    </div>
  )
}

function StudentRow({ s, className, onView, hovered, onEnter, onLeave }: {
  s: Student
  className: string
  onView: () => void
  hovered: boolean
  onEnter: () => void
  onLeave: () => void
}) {
  const av = avatarColor(`${s.firstName}${s.lastName}`)
  const inits = initials(s.firstName, s.lastName)
  const status = (s.status ?? 'active') as StudentStatus
  const type = s.studentType === 'boarder' ? 'Boarder' : s.studentType === 'day' ? 'Day' : null
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 160px 130px 44px',
        alignItems: 'center',
        gap: 16,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        transition: 'background 0.12s',
        cursor: 'pointer',
      }}
      onClick={onView}
    >
      {/* ── Identity ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: 13, flexShrink: 0,
          background: `linear-gradient(135deg, ${av.color}cc 0%, ${av.color}88 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
          boxShadow: `0 4px 12px ${av.color}30`,
          userSelect: 'none',
        }}>
          {inits}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--txt)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {s.firstName} {s.lastName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{
              fontFamily: 'var(--font3)', fontSize: 10, fontWeight: 700,
              color: 'var(--txt3)', letterSpacing: 0.3,
            }}>
              {s.admissionNumber}
            </span>
            {type && (
              <>
                <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
                  padding: '1px 6px', borderRadius: 5,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                }}>
                  {type}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Class ── */}
      <div>
        {className ? (
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 8,
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.15)',
            fontSize: 11, fontWeight: 800, color: 'var(--brand)',
            fontFamily: 'var(--font2)',
          }}>
            {className}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>
        )}
      </div>

      {/* ── Status ── */}
      <StatusPing status={status} />

      {/* ── Action menu ── */}
      <div style={{ position: 'relative', opacity: hovered || menuOpen ? 1 : 0, transition: 'opacity .18s' }} onClick={e => e.stopPropagation()}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
          style={{
            width: 32, height: 32, borderRadius: 8,
            border: '.5px solid var(--border)',
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
          <StudentActionMenu student={s} onClose={() => setMenuOpen(false)} onView={onView} />
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function PrincipalStudentsPage() {
  const navigate = useNavigate()
  const { data: students = [], isLoading } = useStudents()
  const { data: classes  = [] }            = useClasses()

  const [search,       setSearch]       = useState('')
  const [classFilter,  setClassFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')
  const [hoveredId,    setHoveredId]    = useState<string | null>(null)

  const classNameMap = new Map(classes.map(c => [c.id, c.name]))

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    )
    const matchClass  = !classFilter  || s.classId === classFilter
    const matchStatus = !statusFilter || s.status  === statusFilter
    return matchSearch && matchClass && matchStatus
  })

  // KPI counts (unfiltered by status, respect class filter)
  const base = classFilter ? students.filter(s => s.classId === classFilter) : students
  const countActive    = base.filter(s => s.status === 'active').length
  const countSuspended = base.filter(s => s.status === 'suspended').length
  const countExpelled  = base.filter(s => s.status === 'expelled').length

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 66,
    overscan: 8,
  })

  return (
    <>
      <style>{`
        @keyframes shule-ping {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
              Students
            </h1>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
              {filtered.length === students.length
                ? `${students.length.toLocaleString()} student${students.length !== 1 ? 's' : ''} enrolled`
                : `${filtered.length} of ${students.length} students`}
            </div>
          </div>
        </div>

        {/* ── KPI strip ──────────────────────────────────────────── */}
        {!isLoading && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <KpiChip
              label="Total Enrolled" value={base.length} color="var(--brand)"
              icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z"
            />
            <KpiChip
              label="Active" value={countActive} color="#10b981"
              icon="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"
            />
            {countSuspended > 0 && (
              <KpiChip
                label="Suspended" value={countSuspended} color="#f59e0b"
                icon="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            )}
            {countExpelled > 0 && (
              <KpiChip
                label="Expelled" value={countExpelled} color="#f43f5e"
                icon="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            )}
          </div>
        )}

        {/* ── Search + class ─────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search by name or admission number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="sui-input"
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            className="sui-input"
            style={{ minWidth: 150 }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* ── Status pills ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>
            Status
          </span>
          <FilterPill
            label="All"
            active={statusFilter === ''}
            color="#fff" bg="var(--brand)"
            onClick={() => setStatusFilter('')}
          />
          {(Object.entries(STATUS_META) as [StudentStatus, typeof STATUS_META[StudentStatus]][]).map(([key, m]) => {
            const count = base.filter(s => s.status === key).length
            if (count === 0 && statusFilter !== key) return null
            return (
              <FilterPill
                key={key}
                label={`${m.label}${count > 0 ? ` · ${count}` : ''}`}
                active={statusFilter === key}
                color={m.color} bg={m.bg}
                onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              />
            )
          })}
        </div>

        {/* ── Student list ────────────────────────────────────────── */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[...Array(7)].map((_, i) => (
              <div key={i} className="shule-skeleton" style={{
                height: 66,
                borderRadius: i === 0 ? '16px 16px 0 0' : i === 6 ? '0 0 16px 16px' : 0,
              }} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
            padding: '60px 24px', textAlign: 'center',
            background: 'var(--surface)', borderRadius: 16,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18,
              background: 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>
              No students found
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              {search || classFilter || statusFilter
                ? 'Try clearing some filters.'
                : 'No students have been enrolled yet.'}
            </div>
            {(search || statusFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter('') }}
                style={{
                  marginTop: 4, padding: '7px 18px', borderRadius: 9,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  color: 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            {/* ── Column headers ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 160px 130px 44px',
              gap: 16, padding: '10px 20px',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
            }}>
              {['Student', 'Class', 'Status', ''].map((h, i) => (
                <div key={i} style={{
                  fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>
                  {h}
                </div>
              ))}
            </div>

            {/* ── Virtualised rows ── */}
            <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 560 }}>
              <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                {virtualizer.getVirtualItems().map(vRow => {
                  const s = filtered[vRow.index]
                  return (
                    <div
                      key={s.id}
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%',
                        transform: `translateY(${vRow.start}px)`,
                        height: 66,
                      }}
                    >
                      <StudentRow
                        s={s}
                        className={s.classId ? (classNameMap.get(s.classId) ?? '—') : '—'}
                        onView={() => navigate(`/principal/students/${s.id}`)}
                        hovered={hoveredId === s.id}
                        onEnter={() => setHoveredId(s.id)}
                        onLeave={() => setHoveredId(null)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '10px 20px', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>
                {filtered.length} student{filtered.length !== 1 ? 's' : ''}
                {classFilter ? ` · ${classNameMap.get(classFilter) ?? ''}` : ''}
                {statusFilter ? ` · ${STATUS_META[statusFilter]?.label ?? ''}` : ''}
              </span>
              <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
                <span style={{ color: '#10b981', fontWeight: 700 }}>{countActive}</span>{' active'}
                {countSuspended > 0 && <> · <span style={{ color: '#f59e0b', fontWeight: 700 }}>{countSuspended}</span>{' suspended'}</>}
                {countExpelled  > 0 && <> · <span style={{ color: '#f43f5e', fontWeight: 700 }}>{countExpelled}</span>{' expelled'}</>}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
