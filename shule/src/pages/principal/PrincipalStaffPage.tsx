import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStaff } from '../../hooks/useStaff'
import { Avatar } from '../../components/shared/Avatar'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

const ROLE_OPTS: UserRole[] = [
  'principal', 'deputy', 'dos', 'secretary', 'bursar',
  'class_teacher', 'teacher', 'it_admin',
]

const ROLE_META: Record<string, { color: string; bg: string }> = {
  principal:     { color: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  deputy:        { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  dos:           { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  secretary:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  bursar:        { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  class_teacher: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
  teacher:       { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
  it_admin:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const STATUS_META = {
  active:   { label: 'Active',   color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  inactive: { label: 'Inactive', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function FilterPill({
  label, active, color, bg, border, onClick,
}: {
  label: string; active: boolean
  color?: string; bg?: string; border?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        fontFamily: 'var(--font2)',
        background: active ? (bg ?? 'var(--brand)') : 'var(--surface2)',
        color:      active ? (color ?? '#fff')       : 'var(--txt2)',
        border:     active ? `1px solid ${border ?? color ?? 'var(--brand)'}50`
                           : '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: active ? `0 2px 8px ${color ?? 'var(--brand)'}25` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export function PrincipalStaffPage() {
  const navigate = useNavigate()
  const { data: staff = [], isLoading } = useStaff()
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState<UserRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('')

  const filtered = staff.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q) ||
      (s.staffNumber ?? '').toLowerCase().includes(q)
    )
    const matchRole   = !roleFilter   || s.role === roleFilter
    const matchStatus = !statusFilter
      || (statusFilter === 'active'   &&  s.isActive)
      || (statusFilter === 'inactive' && !s.isActive)
    return matchSearch && matchRole && matchStatus
  })

  // Only show role pills that actually exist in data
  const presentRoles = ROLE_OPTS.filter(r => staff.some(s => s.role === r))

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Staff
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          {filtered.length} of {staff.length} staff member{staff.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Search bar */}
        <div style={{ position: 'relative', maxWidth: 340 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search by name, role, or staff number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="sui-input"
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>

        {/* Role pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>Role</span>
          <FilterPill
            label="All Roles"
            active={roleFilter === ''}
            color="#fff" bg="var(--brand)" border="var(--brand)"
            onClick={() => setRoleFilter('')}
          />
          {presentRoles.map(r => {
            const m = ROLE_META[r] ?? { color: 'var(--txt2)', bg: 'var(--surface2)' }
            return (
              <FilterPill
                key={r}
                label={ROLE_LABEL[r] ?? r}
                active={roleFilter === r}
                color={m.color} bg={m.bg} border={m.color}
                onClick={() => setRoleFilter(roleFilter === r ? '' : r)}
              />
            )
          })}
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>Status</span>
          <FilterPill
            label="All"
            active={statusFilter === ''}
            color="#fff" bg="var(--brand)" border="var(--brand)"
            onClick={() => setStatusFilter('')}
          />
          {(Object.entries(STATUS_META) as [keyof typeof STATUS_META, typeof STATUS_META[keyof typeof STATUS_META]][]).map(([key, m]) => (
            <FilterPill
              key={key}
              label={m.label}
              active={statusFilter === key}
              color={m.color} bg={m.bg} border={m.color}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            />
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: i === 0 ? '14px 14px 0 0' : i === 4 ? '0 0 14px 14px' : 0 }} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          padding: 40, textAlign: 'center', color: 'var(--txt3)',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
            <circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No staff found</div>
          <div style={{ fontSize: 12 }}>Try a different search or filter.</div>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 14px', height: 36,
            borderBottom: '2px solid var(--border)',
            background: 'var(--surface2)',
          }}>
            {[
              { label: 'Name',        flex: 2 },
              { label: 'Role',        flex: 1 },
              { label: 'Staff #',     flex: 1 },
              { label: 'Employment',  flex: 1 },
              { label: 'Status',      flex: 1 },
            ].map(({ label, flex }) => (
              <div key={label} style={{
                flex, fontSize: 10, fontWeight: 800,
                color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.6,
              }}>
                {label}
              </div>
            ))}
          </div>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 600 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const s = filtered[vRow.index]
                const roleMeta = ROLE_META[s.role] ?? { color: 'var(--brand)', bg: 'var(--brand-light)' }
                return (
                  <div
                    key={s.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      height: 56, display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', padding: '0 14px',
                    }}
                    onClick={() => navigate(`/principal/staff/${s.id}`)}
                    className="sui-tr"
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={`${s.firstName} ${s.lastName}`} photoPath={s.photoUrl} bucket="staff-photos" size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                        background: roleMeta.bg, color: roleMeta.color,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: roleMeta.color, display: 'inline-block' }} />
                        {ROLE_LABEL[s.role as UserRole] ?? s.role}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                      {s.staffNumber ?? '—'}
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)', textTransform: 'capitalize' }}>
                      {s.employmentType?.replace('_', ' ') ?? '—'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: s.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                        color: s.isActive ? '#10b981' : '#94a3b8',
                      }}>
                        {s.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
