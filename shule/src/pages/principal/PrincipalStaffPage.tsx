import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStaff } from '../../hooks/useStaff'
import { InitialsAvatar } from '../../components/shared/InitialsAvatar'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

const ROLE_OPTS: UserRole[] = [
  'principal', 'deputy', 'dos', 'secretary', 'bursar',
  'class_teacher', 'teacher', 'it_admin',
]

export function PrincipalStaffPage() {
  const navigate = useNavigate()
  const { data: staff = [], isLoading } = useStaff()
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')

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

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          placeholder="Search by name, role, or staff number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sui-input"
          style={{ maxWidth: 300 }}
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="sui-input"
          style={{ minWidth: 150 }}
        >
          <option value="">All Roles</option>
          {ROLE_OPTS.map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="sui-input"
          style={{ minWidth: 130 }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading staff…</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--txt3)',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          No staff found.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Role', 'Staff #', 'Employment', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 600 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const s = filtered[vRow.index]
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
                      <InitialsAvatar name={`${s.firstName} ${s.lastName}`} photoUrl={s.photoUrl} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: 'var(--brand-light)', color: 'var(--brand)',
                      }}>
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
                        background: s.isActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                        color: s.isActive ? 'var(--success)' : 'var(--danger)',
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
