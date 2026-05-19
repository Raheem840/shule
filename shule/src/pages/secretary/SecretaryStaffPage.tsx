import { useState } from 'react'
import { useStaff, type StaffFilters } from '../../hooks/useStaff'
import { useDepartments } from '../../hooks/useClasses'
import { StaffRegistrationWizard } from './StaffRegistrationWizard'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { Staff, UserRole } from '../../types/app'

// ── Role display labels ───────────────────────────────────────
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

// ── Avatar initials ───────────────────────────────────────────
function StaffAvatar({ staff }: { staff: Staff }) {
  if (staff.photoUrl) {
    return (
      <img
        src={staff.photoUrl}
        alt=""
        style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const initials = `${staff.firstName[0] ?? ''}${staff.lastName[0] ?? ''}`.toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
      background: 'var(--brand-light)', border: '1.5px solid var(--brand)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 12, color: 'var(--brand)',
    }}>
      {initials}
    </div>
  )
}

// ── Staff table row ───────────────────────────────────────────
function StaffRow({ staff, deptName }: { staff: Staff; deptName: string | null }) {
  return (
    <tr className="sui-tr">
      <td style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <StaffAvatar staff={staff} />
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
        <Badge variant={ROLE_VARIANT[staff.role] ?? 'muted'}>
          {ROLE_LABELS[staff.role]}
        </Badge>
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

// ── Page ──────────────────────────────────────────────────────
export function SecretaryStaffPage() {
  const [wizardOpen, setWizardOpen] = useState(false)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const filters: StaffFilters = {
    search:     search.trim() || undefined,
    role:       (roleFilter as UserRole) || undefined,
    departmentId: deptFilter || undefined,
    isActive:   true,
  }

  const { data: staffList = [], isLoading } = useStaff(filters)
  const { data: depts     = [] }            = useDepartments()

  const deptMap = new Map(depts.map(d => [d.id, d.name]))

  const deptOptions = [
    { value: '', label: 'All Departments' },
    ...depts.filter(d => !d.archived).map(d => ({ value: d.id, label: d.name })),
  ]

  const totalActive = staffList.length

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle={`${totalActive} active staff member${totalActive !== 1 ? 's' : ''}`}
        actions={
          <Button
            variant="primary"
            onClick={() => setWizardOpen(true)}
            leftIcon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            }
          >
            Register Staff Member
          </Button>
        }
      />

      {/* ── Filters ───────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'end' }}>
        <Input
          placeholder="Search by name or staff number…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          leftIcon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          }
        />
        <Select
          placeholder=""
          options={ROLE_FILTER_OPTIONS}
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        />
        <Select
          placeholder=""
          options={deptOptions}
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        />
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <LoadingSpinner />
        </div>
      ) : staffList.length === 0 ? (
        <div style={{
          padding: '4rem', textAlign: 'center',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--surface2)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>
            {search || roleFilter || deptFilter ? 'No staff match your filters' : 'No staff registered yet'}
          </div>
          {!search && !roleFilter && !deptFilter && (
            <>
              <div style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: '1.25rem' }}>
                Register the first staff member to get started.
              </div>
              <Button variant="primary" onClick={() => setWizardOpen(true)}>
                Register First Staff Member
              </Button>
            </>
          )}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden',
        }}>
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
            <tbody>
              {staffList.map(staff => (
                <StaffRow
                  key={staff.id}
                  staff={staff}
                  deptName={staff.departmentId ? (deptMap.get(staff.departmentId) ?? null) : null}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Registration wizard ───────────────────────────── */}
      <StaffRegistrationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
      />
    </>
  )
}
