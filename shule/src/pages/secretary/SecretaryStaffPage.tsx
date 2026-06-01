import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStaff, type StaffFilters } from '../../hooks/useStaff'
import { useDepartments } from '../../hooks/useClasses'
import { StaffRegistrationWizard } from './StaffRegistrationWizard'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Avatar } from '../../components/shared/Avatar'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { Staff, UserRole } from '../../types/app'

const ROLE_LABELS: Record<UserRole, string> = {
  principal:     'Principal',
  deputy:        'Deputy Head',
  dos:           'Director of Studies',
  secretary:     'Secretary',
  bursar:        'Bursar',
  class_teacher: 'Class Teacher',
  teacher:       'Teacher',
  student:       'Student',
  parent:        'Parent',
  it_admin:      'IT Admin',
}

const ROLE_VARIANT: Record<string, 'teal' | 'violet' | 'amber' | 'blue' | 'muted'> = {
  principal:     'amber',
  deputy:        'teal',
  dos:           'violet',
  secretary:     'teal',
  bursar:        'amber',
  class_teacher: 'blue',
  teacher:       'blue',
}

const ROLE_FILTER_OPTIONS = [
  { value: '',              label: 'All Roles' },
  { value: 'deputy',        label: 'Deputy Head' },
  { value: 'dos',           label: 'Director of Studies' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'teacher',       label: 'Teacher' },
]

// ── Role palette for avatar gradients ─────────────────────────
const ROLE_GRAD: Record<string, [string, string]> = {
  principal:     ['#f59e0b', '#d97706'],
  deputy:        ['#0d9488', '#0f766e'],
  dos:           ['#8b5cf6', '#7c3aed'],
  secretary:     ['#0ea5e9', '#0284c7'],
  bursar:        ['#f43f5e', '#e11d48'],
  class_teacher: ['#10b981', '#059669'],
  teacher:       ['#6366f1', '#4f46e5'],
}

function roleGrad(role: string): [string, string] {
  return ROLE_GRAD[role] ?? ['#94a3b8', '#64748b']
}

// ── Desktop table row ──────────────────────────────────────────
function StaffRow({ staff, deptName }: { staff: Staff; deptName: string | null }) {
  return (
    <tr className="sui-tr">
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={`${staff.firstName} ${staff.lastName}`} size="md" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
              {staff.firstName} {staff.lastName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
              {staff.staffNumber}
            </div>
          </div>
        </div>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <Badge variant={ROLE_VARIANT[staff.role] ?? 'muted'}>{ROLE_LABELS[staff.role]}</Badge>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
          {deptName ?? <span style={{ color: 'var(--txt3)' }}>—</span>}
        </span>
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        {staff.phone
          ? <span style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{staff.phone}</span>
          : <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        {staff.employmentType
          ? <span style={{ fontSize: 12, color: 'var(--txt2)', textTransform: 'capitalize' }}>{staff.employmentType.replace('_', ' ')}</span>
          : <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>}
      </td>
      <td style={{ padding: '0.75rem 1rem' }}>
        <Badge variant={staff.isActive ? 'green' : 'muted'} dot>
          {staff.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
    </tr>
  )
}

// ── Mobile staff card ───────────────────────────────────────────
// Inspired by iOS Contacts + Telegram People list:
// • Full-width list row with large avatar, name, role, dept + status
// • 72px minimum tap target (Apple HIG)
// • Subtle left color stripe for role identity
// • Active state shows pressed feel
function StaffCard({ staff, deptName }: { staff: Staff; deptName: string | null }) {
  const [c1, c2] = roleGrad(staff.role)
  const initials = `${staff.firstName[0] ?? ''}${staff.lastName[0] ?? ''}`.toUpperCase()
  const roleLabel = ROLE_LABELS[staff.role] ?? staff.role

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px', minHeight: 72,
      background: 'var(--surface)',
      borderBottom: '0.5px solid rgba(0,0,0,0.05)',
      borderLeft: `3px solid ${c1}`,
      cursor: 'default',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background 0.1s',
    }}
      onTouchStart={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
      onTouchEnd={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
          background: `linear-gradient(145deg, ${c1}, ${c2})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 3px 12px ${c1}38`,
        }}>
          <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={`${staff.firstName} ${staff.lastName}`} size="md" />
        </div>
        {/* Status dot */}
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 12, height: 12, borderRadius: '50%',
          background: staff.isActive ? '#22c55e' : '#94a3b8',
          border: '2px solid var(--surface)',
        }} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)', letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {staff.firstName} {staff.lastName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color: c1, background: `${c1}14`, padding: '2px 7px', borderRadius: 99,
          }}>
            {roleLabel}
          </span>
          {deptName && (
            <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{deptName}</span>
          )}
        </div>
        {staff.phone && (
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 3, fontFamily: 'var(--font3)' }}>
            {staff.phone}
          </div>
        )}
      </div>

      {/* Staff number + chevron */}
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginBottom: 6 }}>
          {staff.staffNumber}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────
export function SecretaryStaffPage() {
  const isMobile = useIsMobile()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const filters: StaffFilters = {
    search:       search.trim() || undefined,
    role:         (roleFilter as UserRole) || undefined,
    departmentId: deptFilter || undefined,
    isActive:     true,
  }

  const { data: staffList = [], isLoading } = useStaff(filters)
  const { data: depts     = [] }            = useDepartments()

  const deptMap = new Map(depts.map(d => [d.id, d.name]))
  const deptOptions = [
    { value: '', label: 'All Departments' },
    ...depts.filter(d => !d.archived).map(d => ({ value: d.id, label: d.name })),
  ]
  const totalActive = staffList.length

  // Desktop virtualizer
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: staffList.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  })

  const emptyState = (
    <div style={{
      padding: '3.5rem', textAlign: 'center',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, margin: '0 auto 1rem',
        background: 'var(--surface2)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
        {search || roleFilter || deptFilter ? 'No staff match your filters' : 'No staff registered yet'}
      </div>
      {!search && !roleFilter && !deptFilter && (
        <>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: '1.25rem' }}>Register the first staff member to get started.</div>
          <Button variant="primary" onClick={() => setWizardOpen(true)}>Register First Staff Member</Button>
        </>
      )}
    </div>
  )

  return (
    <>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap', position:'relative', overflow:'hidden', marginBottom:20 }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#0ea5e9,#0284c7)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(14,165,233,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Staff</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>{totalActive} active staff member{totalActive !== 1 ? 's' : ''}</p>
        </div>
        {!isMobile && (
          <button onClick={() => setWizardOpen(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'10px 18px', borderRadius:11, border:'none', background:'linear-gradient(145deg,#0ea5e9,#0284c7)', color:'#fff', fontWeight:700, fontSize:13.5, cursor:'pointer', boxShadow:'0 4px 14px rgba(14,165,233,.4)', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Register Staff Member
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      {isMobile ? (
        /* Mobile: stacked search + single row filter pills */
        <div style={{ marginBottom: '0.875rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Input
            placeholder="Search staff…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          />
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {[
              { value: '', label: 'All Roles' },
              { value: 'teacher', label: 'Teachers' },
              { value: 'class_teacher', label: 'Class Teachers' },
              { value: 'dos', label: 'DoS' },
              { value: 'bursar', label: 'Bursar' },
              { value: 'secretary', label: 'Secretary' },
            ].map(opt => {
              const active = roleFilter === opt.value
              const [c1] = roleGrad(opt.value || 'teacher')
              return (
                <button key={opt.value} onClick={() => setRoleFilter(opt.value)} style={{
                  flexShrink: 0, padding: '6px 13px', borderRadius: 99, border: 'none',
                  fontSize: 12.5, fontWeight: active ? 700 : 600,
                  background: active ? `${c1}18` : 'var(--surface)',
                  color: active ? c1 : 'var(--txt3)',
                  border: `1px solid ${active ? `${c1}30` : 'var(--border)'}`,
                  cursor: 'pointer', transition: 'all 0.14s',
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}>
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'end' }}>
          <Input
            placeholder="Search by name or staff number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
          />
          <Select placeholder="" options={ROLE_FILTER_OPTIONS} value={roleFilter} onChange={e => setRoleFilter(e.target.value)} />
          <Select placeholder="" options={deptOptions}          value={deptFilter} onChange={e => setDeptFilter(e.target.value)} />
        </div>
      )}

      {/* ── Content ── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner />
        </div>
      ) : staffList.length === 0 ? (
        emptyState
      ) : isMobile ? (
        /* ── Mobile: native contact-list style ── */
        <div style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Section header */}
          <div style={{
            padding: '8px 16px',
            background: 'var(--surface2)',
            borderBottom: '0.5px solid var(--border)',
            fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
            {totalActive} Staff Member{totalActive !== 1 ? 's' : ''}
          </div>

          {/* Card list */}
          {staffList.map(staff => (
            <StaffCard
              key={staff.id}
              staff={staff}
              deptName={staff.departmentId ? (deptMap.get(staff.departmentId) ?? null) : null}
            />
          ))}
        </div>
      ) : (
        /* ── Desktop: virtualised table ── */
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Staff Member', 'Role', 'Department', 'Phone', 'Employment', 'Status'].map(col => (
                  <th key={col} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '0.8px',
                    textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.6rem 1rem',
                    borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
                    fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {virtualizer.getVirtualItems()[0] != null && (
                  <tr><td colSpan={6} style={{ padding: 0, height: virtualizer.getVirtualItems()[0].start }} /></tr>
                )}
                {virtualizer.getVirtualItems().map(vRow => {
                  const staff = staffList[vRow.index]
                  return (
                    <StaffRow
                      key={staff.id}
                      staff={staff}
                      deptName={staff.departmentId ? (deptMap.get(staff.departmentId) ?? null) : null}
                    />
                  )
                })}
                {virtualizer.getVirtualItems().length > 0 && (
                  <tr><td colSpan={6} style={{ padding: 0, height: virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? 0) }} /></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mobile FAB — register new staff */}
      {isMobile && !wizardOpen && (
        <button
          onClick={() => setWizardOpen(true)}
          style={{
            position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 20,
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(145deg, var(--brand), var(--brand-dark))',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(13,148,136,0.5)',
            zIndex: 30,
            transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
          aria-label="Register staff member"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      )}

      <StaffRegistrationWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  )
}
