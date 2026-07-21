import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useClasses, useSubjects, useDepartments } from '../../hooks/useClasses'
import { useIsMobile } from '../../hooks/useIsMobile'
import { localToday } from '../../lib/dates'
import { csvField } from '../../lib/csv'

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DeputyStaffRow {
  id: string
  firstName: string
  lastName: string
  name: string
  role: string
  staffNumber: string
  subjects: string[]
  classes: string[]
  departmentId: string | null
  email: string | null
  phone: string | null
  joinDate: string | null
  photoUrl: string | null
  isActive: boolean
}

// ─── Hook ──────────────────────────────────────────────────────────────────────
function useDeputyStaff() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['deputy-staff', user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, role, staff_number, subjects, classes, department_id, email, phone, join_date, photo_url, is_active')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .order('last_name')
      if (error) throw error
      return (data ?? []).map((r: any): DeputyStaffRow => ({
        id:          r.id as string,
        firstName:   r.first_name as string,
        lastName:    r.last_name as string,
        name:        `${r.first_name} ${r.last_name}`,
        role:        r.role as string,
        staffNumber: r.staff_number as string,
        subjects:    (r.subjects as string[]) ?? [],
        classes:     (r.classes as string[]) ?? [],
        departmentId: (r.department_id as string) ?? null,
        email:       (r.email as string) ?? null,
        phone:       (r.phone as string) ?? null,
        joinDate:    (r.join_date as string) ?? null,
        photoUrl:    (r.photo_url as string) ?? null,
        isActive:    r.is_active as boolean,
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ─── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    teacher:       { label: 'Teacher',       color: 'var(--brand)',   bg: 'rgba(13,148,136,.09)',  border: 'rgba(13,148,136,.22)' },
    class_teacher: { label: 'Class Teacher', color: 'var(--violet)',  bg: 'rgba(139,92,246,.09)',  border: 'rgba(139,92,246,.22)' },
    principal:     { label: 'Principal',     color: 'var(--info)',    bg: 'rgba(14,165,233,.09)',  border: 'rgba(14,165,233,.22)' },
    deputy:        { label: 'Deputy',        color: 'var(--info)',    bg: 'rgba(14,165,233,.09)',  border: 'rgba(14,165,233,.22)' },
    dos:           { label: 'DoS',           color: 'var(--info)',    bg: 'rgba(14,165,233,.09)',  border: 'rgba(14,165,233,.22)' },
    bursar:        { label: 'Bursar',        color: 'var(--warning)', bg: 'rgba(245,158,11,.09)',  border: 'rgba(245,158,11,.22)' },
    secretary:     { label: 'Secretary',     color: 'var(--success)', bg: 'rgba(16,185,129,.09)',  border: 'rgba(16,185,129,.22)' },
  }
  const s = map[role] ?? { label: role.replace('_', ' '), color: 'var(--txt3)', bg: 'var(--surface2)', border: 'var(--border)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color, border: `.5px solid ${s.border}`, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
      {s.label}
    </span>
  )
}

// ─── Initials avatar ───────────────────────────────────────────────────────────
function InitialsAvatar({ firstName, lastName, size = 40 }: { firstName: string; lastName: string; size?: number }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const hue = ((firstName.charCodeAt(0) ?? 0) * 37 + (lastName.charCodeAt(0) ?? 0) * 17) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(145deg,hsl(${hue},65%,52%),hsl(${(hue + 40) % 360},70%,40%))`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 900, color: '#fff', letterSpacing: -.5,
      boxShadow: `0 2px 10px hsla(${hue},60%,50%,0.35)`,
    }}>
      {initials}
    </div>
  )
}

// ─── Color chip ────────────────────────────────────────────────────────────────
const CHIP_COLORS = [
  { color: '#0d9488', bg: 'rgba(13,148,136,.09)',  border: 'rgba(13,148,136,.22)' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,.09)',  border: 'rgba(139,92,246,.22)' },
  { color: '#0ea5e9', bg: 'rgba(14,165,233,.09)',  border: 'rgba(14,165,233,.22)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,.09)',  border: 'rgba(245,158,11,.22)' },
  { color: '#10b981', bg: 'rgba(16,185,129,.09)',  border: 'rgba(16,185,129,.22)' },
  { color: '#f43f5e', bg: 'rgba(244,63,94,.09)',   border: 'rgba(244,63,94,.22)'  },
]

function ColorChip({ label, index }: { label: string; index: number }) {
  const c = CHIP_COLORS[index % CHIP_COLORS.length]
  return (
    <span style={{ padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `.5px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

// ─── Staff detail modal (centered) ─────────────────────────────────────────────
function StaffDetailModal({ staff, onClose }: { staff: DeputyStaffRow; onClose: () => void }) {
  const navigate = useNavigate()
  const { data: allSubjects = [] } = useSubjects()
  // null = all years — staff.classes[] can reference a class from any past
  // year the teacher was assigned to, not just the currently active one.
  const { data: allClasses  = [] } = useClasses(null)

  const subjectNames = useMemo(() => {
    const map = new Map(allSubjects.map(s => [s.id, s.name]))
    return staff.subjects.map(id => map.get(id) ?? id)
  }, [allSubjects, staff.subjects])

  const classNames = useMemo(() => {
    const map = new Map(allClasses.map(c => [c.id, c.name]))
    return staff.classes.map(id => map.get(id) ?? id)
  }, [allClasses, staff.classes])

  const joinDateFormatted = staff.joinDate
    ? new Date(staff.joinDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

  const modal = (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '100%', maxWidth: 500, borderRadius: 20, background: 'var(--surface)', boxShadow: '0 20px 60px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', maxHeight: 'min(90dvh,680px)' }}>

        {/* Header */}
        <div style={{ flexShrink: 0, padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <InitialsAvatar firstName={staff.firstName} lastName={staff.lastName} size={52} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--txt)', fontFamily: 'var(--font2)', letterSpacing: -.3 }}>{staff.name}</div>
              <div style={{ marginTop: 5 }}><RoleBadge role={staff.role} /></div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Staff details grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Staff Number', value: staff.staffNumber, mono: true },
              { label: 'Join Date',    value: joinDateFormatted },
              { label: 'Email',        value: staff.email ?? '—' },
              { label: 'Phone',        value: staff.phone ?? '—' },
            ].map(({ label, value, mono }) => (
              <div key={label} style={{ background: 'var(--surface2)', borderRadius: 12, padding: '12px 14px', border: '.5px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--txt)', fontFamily: mono ? 'var(--font3)' : undefined, fontWeight: mono ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Subjects */}
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '14px 16px', border: '.5px solid var(--border)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Subjects Assigned</div>
            {subjectNames.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {subjectNames.map((name, i) => <ColorChip key={i} label={name} index={i} />)}
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--txt3)' }}>No subjects assigned</span>
            )}
          </div>

          {/* Classes */}
          <div style={{ background: 'var(--surface2)', borderRadius: 12, padding: '14px 16px', border: '.5px solid var(--border)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Classes Assigned</div>
            {classNames.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {classNames.map((name, i) => <ColorChip key={i} label={name} index={i + 2} />)}
              </div>
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--txt3)' }}>No classes assigned</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ flexShrink: 0, padding: '12px 24px 20px', borderTop: '.5px solid var(--border)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px 0', background: 'var(--surface2)', color: 'var(--txt2)', border: '.5px solid var(--border)', borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
            Close
          </button>
          <button
            onClick={() => { onClose(); navigate(`/deputy/staff/${staff.id}`) }}
            style={{ flex: 2, padding: '11px 0', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(13,148,136,.35)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Full Profile
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ─── Mobile staff card ─────────────────────────────────────────────────────────
function StaffCard({ staff, onClick }: { staff: DeputyStaffRow; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 8px rgba(0,0,0,.05)', cursor: 'pointer' }}
      className="sui-tr"
    >
      <InitialsAvatar firstName={staff.firstName} lastName={staff.lastName} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14.5, color: 'var(--txt)', marginBottom: 2, letterSpacing: -.2 }}>{staff.name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginBottom: 6 }}>{staff.staffNumber}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          <RoleBadge role={staff.role} />
          {staff.subjects.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: 'var(--surface2)', color: 'var(--txt3)', border: '.5px solid var(--border)' }}>
              {staff.subjects.length} subject{staff.subjects.length !== 1 ? 's' : ''}
            </span>
          )}
          {staff.classes.length > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, fontWeight: 600, background: 'var(--surface2)', color: 'var(--txt3)', border: '.5px solid var(--border)' }}>
              {staff.classes.length} class{staff.classes.length !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
    </div>
  )
}

// ─── Role filter options ───────────────────────────────────────────────────────
const ROLE_FILTERS = [
  { value: '',              label: 'All' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'class_teacher', label: 'Class Teacher' },
]

// "Teacher" filter should match both teacher and class_teacher roles
function matchesRoleFilter(role: string, filter: string): boolean {
  if (!filter) return true
  if (filter === 'teacher') return role === 'teacher' || role === 'class_teacher'
  return role === filter
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPUTY STAFF PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DeputyStaffPage() {
  const isMobile = useIsMobile()
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [selected,   setSelected]   = useState<DeputyStaffRow | null>(null)

  const { data: staffList = [], isLoading, isError } = useDeputyStaff()
  const { data: depts = [] } = useDepartments()
  const deptMap = useMemo(() => new Map(depts.map(d => [d.id, d.name])), [depts])

  const rows = useMemo(() => {
    let r = staffList
    if (roleFilter) r = r.filter(s => matchesRoleFilter(s.role, roleFilter))
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(s => s.name.toLowerCase().includes(q) || s.staffNumber.toLowerCase().includes(q))
    }
    return r
  }, [staffList, roleFilter, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(145deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(139,92,246,.38)', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Staff</h1>
            {staffList.length > 0 && (
              <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: 'rgba(139,92,246,.1)', color: 'var(--violet)', border: '.5px solid rgba(139,92,246,.22)' }}>
                {staffList.length}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: 0 }}>Read-only staff directory</p>
        </div>
        {rows.length > 0 && (
          <button
            onClick={() => {
              const header = 'Name,Staff Number,Role,Email,Phone,Department\n'
              const csv = rows.map(s =>
                [s.name, s.staffNumber, s.role, s.email ?? '', s.phone ?? '',
                 s.departmentId ? (deptMap.get(s.departmentId) ?? '') : '']
                  .map(csvField).join(',')
              ).join('\n')
              const blob = new Blob([header + csv], { type: 'text/csv' })
              const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `staff-${localToday()}.csv`; a.click(); URL.revokeObjectURL(a.href)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.color = '#8b5cf6' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', boxShadow: '0 2px 12px rgba(0,0,0,.05)' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input
            className="sui-input"
            placeholder="Search name or staff number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ROLE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setRoleFilter(f.value)} style={{
              padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', transition: 'all .14s',
              border: `.5px solid ${roleFilter === f.value ? 'var(--violet)' : 'var(--border)'}`,
              background: roleFilter === f.value ? 'rgba(139,92,246,.09)' : 'var(--surface)',
              color: roleFilter === f.value ? 'var(--violet)' : 'var(--txt3)',
              WebkitTapHighlightColor: 'transparent',
            }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="shule-skeleton" style={{ height: isMobile ? 90 : 56, borderRadius: 14 }} />)}
        </div>
      )}

      {/* ── Error ── */}
      {isError && (
        <div style={{ padding: '20px 24px', background: 'rgba(244,63,94,.06)', border: '.5px solid rgba(244,63,94,.2)', borderRadius: 14, color: 'var(--danger)', fontSize: 13.5, fontWeight: 600 }}>
          Failed to load staff list. Please try again.
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && rows.length === 0 && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'var(--surface2)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" /></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
            {search || roleFilter ? 'No matching staff' : 'No staff found'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            {search || roleFilter ? 'Try adjusting your filters.' : 'Active staff will appear here.'}
          </div>
        </div>
      )}

      {/* ── Mobile: cards ── */}
      {!isLoading && !isError && rows.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(s => (
            <StaffCard key={s.id} staff={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      {/* ── Desktop: premium table ── */}
      {!isLoading && !isError && rows.length > 0 && !isMobile && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Staff', 'Staff No', 'Role', 'Subjects', 'Classes'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textAlign: 'left', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(s => (
                <tr key={s.id} style={{ borderBottom: '.5px solid var(--border)', cursor: 'pointer' }} className="sui-tr" onClick={() => setSelected(s)}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <InitialsAvatar firstName={s.firstName} lastName={s.lastName} size={34} />
                      <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)' }}>{s.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{s.staffNumber}</td>
                  <td style={{ padding: '12px 16px' }}><RoleBadge role={s.role} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--txt2)' }}>
                    {s.subjects.length > 0
                      ? <span style={{ fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--brand)' }}>{s.subjects.length}</span>
                      : <span style={{ color: 'var(--txt3)' }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--txt2)' }}>
                    {s.classes.length > 0
                      ? <span style={{ fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--violet)' }}>{s.classes.length}</span>
                      : <span style={{ color: 'var(--txt3)' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '8px 16px', borderTop: '.5px solid var(--border)', fontSize: 11.5, color: 'var(--txt3)' }}>
            {rows.length} of {staffList.length} staff member{staffList.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {selected && <StaffDetailModal staff={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
