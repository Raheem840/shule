import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { InitialsAvatar } from '../../components/shared/InitialsAvatar'

type StudentStatus = 'active' | 'suspended' | 'expelled'

const STATUS_META: Record<StudentStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  suspended: { label: 'Suspended', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  expelled:  { label: 'Expelled',  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
}

function FilterPill({
  label, active, color, bg, onClick,
}: {
  label: string; active: boolean
  color?: string; bg?: string
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
        border:     active ? `1px solid ${color ?? 'var(--brand)'}50` : '1px solid var(--border)',
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: active ? `0 2px 8px ${color ?? 'var(--brand)'}25` : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

export function PrincipalStudentsPage() {
  const navigate = useNavigate()
  const { data: students = [], isLoading } = useStudents()
  const { data: classes = [] } = useClasses()
  const [search,       setSearch]       = useState('')
  const [classFilter,  setClassFilter]  = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | ''>('')

  const classNameMap = new Map(classes.map(c => [c.id, c.name]))

  const filtered = students.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = (
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    )
    const matchClass  = !classFilter  || s.classId === classFilter
    const matchStatus = !statusFilter || s.status === statusFilter
    return matchSearch && matchClass && matchStatus
  })

  // Count per status (unfiltered, so pills show real totals)
  const countByStatus = (st: StudentStatus) => students.filter(s => s.status === st && (!classFilter || s.classId === classFilter)).length

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
          Students
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          {filtered.length} of {students.length} student{students.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Search + class row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
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
            style={{ minWidth: 140 }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Status pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 }}>Status</span>
          <FilterPill
            label="All"
            active={statusFilter === ''}
            color="#fff" bg="var(--brand)"
            onClick={() => setStatusFilter('')}
          />
          {(Object.entries(STATUS_META) as [StudentStatus, typeof STATUS_META[StudentStatus]][]).map(([key, m]) => {
            const count = countByStatus(key)
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
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No students found</div>
          <div style={{ fontSize: 12 }}>Try a different search or filter.</div>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Adm #', 'Class', 'Status'].map(h => (
                  <th key={h} className="sui-th">{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 600 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const s = filtered[vRow.index]
                const statusMeta = STATUS_META[s.status as StudentStatus] ?? STATUS_META.active

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
                    onClick={() => navigate(`/principal/students/${s.id}`)}
                    className="sui-tr"
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <InitialsAvatar name={`${s.firstName} ${s.lastName}`} photoUrl={s.photoUrl} size="sm" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                        {s.firstName} {s.lastName}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                      {s.admissionNumber}
                    </div>
                    <div style={{ flex: 1, fontSize: 13, color: 'var(--txt2)' }}>
                      {s.classId ? (classNameMap.get(s.classId) ?? s.classId) : '—'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: statusMeta.bg, color: statusMeta.color,
                        textTransform: 'capitalize',
                      }}>
                        {s.status}
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
