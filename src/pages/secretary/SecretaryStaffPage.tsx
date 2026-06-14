import { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useStaff, type StaffFilters } from '../../hooks/useStaff'
import { useDepartments } from '../../hooks/useClasses'
import { StaffRegistrationWizard } from './StaffRegistrationWizard'
import { Avatar } from '../../components/shared/Avatar'
import { useIsMobile } from '../../hooks/useIsMobile'
import { supabase } from '../../lib/supabase'
import type { Staff, UserRole } from '../../types/app'

// ── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
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

const ADMIN_ROLES = new Set(['principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin'])

const ROLE_FILTER_TABS = [
  { value: '',              label: 'All' },
  { value: 'principal',     label: 'Principal' },
  { value: 'deputy',        label: 'Deputy' },
  { value: 'dos',           label: 'DoS' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'class_teacher', label: 'Class Teacher' },
]

// ── Staff Card ────────────────────────────────────────────────────────────────
function StaffCard({ staff, deptName, onEdit }: { staff: Staff; deptName: string | null; onEdit: (s: Staff) => void }) {
  const [hovered, setHovered] = useState(false)
  const [c1, c2] = roleGrad(staff.role)
  const roleLabel = ROLE_LABELS[staff.role] ?? staff.role

  return (
    <div
      style={{
        borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)',
        overflow: 'hidden', position: 'relative',
        transition: 'transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s',
        transform: hovered ? 'translateY(-3px)' : 'none',
        boxShadow: hovered ? '0 12px 40px rgba(0,0,0,.10)' : '0 1px 6px rgba(0,0,0,.06)',
        cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Role accent strip */}
      <div style={{
        height: 4, width: '100%',
        background: `linear-gradient(90deg, ${c1}, ${c2})`,
      }} />

      {/* Card body */}
      <div style={{ padding: '18px 18px 16px' }}>
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          {/* Avatar with gradient ring */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              padding: 2.5, position: 'relative',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                overflow: 'hidden', background: 'var(--surface)',
              }}>
                <Avatar
                  photoPath={staff.photoUrl}
                  bucket="staff-photos"
                  name={`${staff.firstName} ${staff.lastName}`}
                  size="md"
                />
              </div>
              {/* Status dot */}
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 12, height: 12, borderRadius: '50%',
                background: staff.isActive ? 'var(--success)' : 'var(--txt3)',
                border: '2px solid var(--surface)',
              }} />
            </div>
          </div>

          {/* Name + role */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 15, color: 'var(--txt)',
              lineHeight: 1.3, marginBottom: 5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {staff.firstName} {staff.lastName}
            </div>
            <span style={{
              display: 'inline-block',
              padding: '2px 9px', borderRadius: 99,
              background: `${c1}18`, color: c1,
              border: `1px solid ${c1}30`,
              fontSize: 10.5, fontWeight: 800, fontFamily: 'var(--font2)',
              textTransform: 'uppercase', letterSpacing: .5,
            }}>
              {roleLabel}
            </span>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 5, fontFamily: 'var(--font3)' }}>
              {staff.staffNumber}
            </div>
          </div>
        </div>

        {/* Department */}
        {deptName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2"/>
              <path d="M16 3H8a2 2 0 00-2 2v2h12V5a2 2 0 00-2-2z"/>
            </svg>
            <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 500 }}>{deptName}</span>
          </div>
        )}

        {/* Contact info */}
        {(staff.phone || staff.email) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
            {staff.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91A16 16 0 0016.09 17.9l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 18.92z"/>
                </svg>
                <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{staff.phone}</span>
              </div>
            )}
            {staff.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span style={{ fontSize: 11.5, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.email}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer: employment chip + status + edit */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          {staff.employmentType ? (
            <span style={{
              padding: '3px 9px', borderRadius: 6, fontSize: 10.5, fontWeight: 700,
              background: 'var(--surface2)', color: 'var(--txt2)', fontFamily: 'var(--font2)',
              textTransform: 'capitalize',
            }}>
              {staff.employmentType.replace('_', ' ')}
            </span>
          ) : <span />}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: staff.isActive ? 'var(--success)' : 'var(--txt3)',
              }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: staff.isActive ? 'var(--success)' : 'var(--txt3)' }}>
                {staff.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onEdit(staff) }}
              style={{ padding: '3px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font2)' }}
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div className="shule-skeleton" style={{ height: 4, width: '100%' }} />
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <span className="shule-skeleton" style={{ display: 'block', width: 56, height: 56, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span className="shule-skeleton" style={{ display: 'block', height: 14, width: 140, borderRadius: 6, marginBottom: 8 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 20, width: 90, borderRadius: 99, marginBottom: 8 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 11, width: 70, borderRadius: 4 }} />
          </div>
        </div>
        <span className="shule-skeleton" style={{ display: 'block', height: 11, width: '60%', borderRadius: 4, marginBottom: 14 }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          <span className="shule-skeleton" style={{ display: 'block', height: 22, width: 70, borderRadius: 6 }} />
          <span className="shule-skeleton" style={{ display: 'block', height: 22, width: 55, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

// ── Mobile Staff Row ─────────────────────────────────────────────────────────
function MobileStaffRow({ staff, deptName, onEdit }: { staff: Staff; deptName: string | null; onEdit: (s: Staff) => void }) {
  const [c1, c2] = roleGrad(staff.role)
  const roleLabel = ROLE_LABELS[staff.role] ?? staff.role

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 16px', minHeight: 72,
      background: 'var(--surface)',
      borderBottom: '0.5px solid rgba(0,0,0,0.05)',
      borderLeft: `3px solid ${c1}`,
      WebkitTapHighlightColor: 'transparent',
      transition: 'background 0.1s',
    }}
      onTouchStart={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
      onTouchEnd={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)' }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
          background: `linear-gradient(145deg, ${c1}, ${c2})`,
          padding: 2,
        }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
            <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={`${staff.firstName} ${staff.lastName}`} size="md" />
          </div>
        </div>
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: 12, height: 12, borderRadius: '50%',
          background: staff.isActive ? 'var(--success)' : 'var(--txt3)',
          border: '2px solid var(--surface)',
        }} />
      </div>

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
          {deptName && <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{deptName}</span>}
        </div>
        {staff.phone && (
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 3, fontFamily: 'var(--font3)' }}>
            {staff.phone}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
          {staff.staffNumber}
        </div>
        <button
          onClick={() => onEdit(staff)}
          style={{ padding: '3px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font2)' }}
        >
          Edit
        </button>
      </div>
    </div>
  )
}

// ── Staff Edit Modal ──────────────────────────────────────────────────────────
function StaffEditModal({ staff, depts, onClose }: {
  staff:  Staff
  depts:  { id: string; name: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    firstName:      staff.firstName,
    lastName:       staff.lastName,
    email:          staff.email ?? '',
    phone:          staff.phone ?? '',
    role:           staff.role,
    departmentId:   staff.departmentId ?? '',
    employmentType: staff.employmentType ?? 'full_time',
  })
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [saved,   setSaved]   = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value })); setSaved(false)
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null)
    try {
      const { error } = await supabase.from('staff').update({
        first_name:      form.firstName.trim(),
        last_name:       form.lastName.trim(),
        email:           form.email.trim() || null,
        phone:           form.phone.trim() || null,
        role:            form.role,
        department_id:   form.departmentId || null,
        employment_type: form.employmentType || null,
      }).eq('id', staff.id).eq('school_id', staff.schoolId)
      if (error) throw error
      void qc.invalidateQueries({ queryKey: ['staff', staff.schoolId] })
      setSaved(true)
      setTimeout(() => onClose(), 1200)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: 'var(--txt)', outline: 'none', boxSizing: 'border-box' }
  const sel: React.CSSProperties = { ...inp, appearance: 'none' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 520, background: 'var(--surface)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)' }}>Edit Staff Member</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, borderRadius: 6 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>First Name</label>
              <input value={form.firstName} onChange={e => set('firstName', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Last Name</label>
              <input value={form.lastName} onChange={e => set('lastName', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Email</label>
              <input value={form.email} onChange={e => set('email', e.target.value)} style={inp} type="email" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Role</label>
              <div style={{ position: 'relative' }}>
                <select value={form.role} onChange={e => set('role', e.target.value)} style={sel}>
                  {['teacher','class_teacher','dos','deputy','secretary','bursar','it_admin'].map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Department</label>
              <div style={{ position: 'relative' }}>
                <select value={form.departmentId} onChange={e => set('departmentId', e.target.value)} style={sel}>
                  <option value="">None</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>Employment Type</label>
              <div style={{ position: 'relative' }}>
                <select value={form.employmentType} onChange={e => set('employmentType', e.target.value)} style={sel}>
                  <option value="full_time">Full Time</option>
                  <option value="part_time">Part Time</option>
                  <option value="contract">Contract</option>
                </select>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>
          </div>
          {saveErr && <div style={{ fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>{saveErr}</div>}
          {saved && <div style={{ fontSize: 12.5, color: 'var(--success)', fontWeight: 700 }}>Saved successfully!</div>}
        </div>
        <div style={{ padding: '12px 24px 20px', borderTop: '.5px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={saving}
            style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function SecretaryStaffPage() {
  const isMobile   = useIsMobile()
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const filters: StaffFilters = useMemo(() => ({
    search:   search.trim() || undefined,
    role:     (roleFilter as UserRole) || undefined,
  }), [search, roleFilter])

  const { data: staffList = [], isLoading } = useStaff(filters)
  const { data: depts     = [] }            = useDepartments()

  const deptMap = new Map(depts.map(d => [d.id, d.name]))

  // Hero stats
  const totalCount   = staffList.length
  const teacherCount = staffList.filter(s => s.role === 'teacher' || s.role === 'class_teacher').length
  const adminCount   = staffList.filter(s => ADMIN_ROLES.has(s.role)).length
  const activeCount  = staffList.filter(s => s.isActive).length

  // ── Export Staff Excel (premium) ──────────────────────────────
  const handleExportStaff = useCallback(async () => {
    if (!staffList.length) return
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Staff Register')

    const lastCol = 'I'
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const title = `Staff Register — ${dateStr}`

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = title
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    ws.mergeCells(`A2:${lastCol}2`)
    const dateCell = ws.getCell('A2')
    dateCell.value = `Generated: ${dateStr}`
    dateCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF64748B' } }
    dateCell.alignment = { horizontal: 'right' }
    ws.getRow(2).height = 14

    const headers = ['Staff No', 'Name', 'Role', 'Department', 'Email', 'Phone', 'Employment Type', 'Join Date', 'Status']
    const headerRow = ws.addRow(headers)
    headerRow.height = 20
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF0D9488' } } }
    })

    staffList.forEach((s, i) => {
      const dataRow = ws.addRow([
        s.staffNumber,
        `${s.firstName} ${s.lastName}`,
        ROLE_LABELS[s.role] ?? s.role,
        s.departmentId ? (deptMap.get(s.departmentId) ?? '—') : '—',
        s.email ?? '—',
        s.phone ?? '—',
        s.employmentType ? s.employmentType.charAt(0).toUpperCase() + s.employmentType.slice(1) : '—',
        s.joinDate ? new Date(s.joinDate).toLocaleDateString('en-GB') : '—',
        s.isActive ? 'Active' : 'Inactive',
      ])
      dataRow.height = 16
      dataRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle' }
        // Status column: green for active, grey for inactive
        if (colNum === 9) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: s.isActive ? 'FF10B981' : 'FF94A3B8' } }
        }
      })
    })

    const colWidths = [14, 28, 22, 20, 28, 16, 18, 14, 10]
    ws.columns.forEach((col, i) => { col.width = colWidths[i] ?? 14 })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `staff-register-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }, [staffList, deptMap])

  return (
    <>
      <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Hero Band ───────────────────────────────────────────── */}
        <div style={{
          borderRadius: 18, overflow: 'hidden',
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          padding: '28px 28px 24px',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)',
                  backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                  </svg>
                </div>
                <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>
                  Staff
                </h1>
              </div>
              <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
                {isLoading ? 'Loading staff roster…' : 'School staff directory'}
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Staff',  value: isLoading ? '—' : totalCount },
                  { label: 'Teachers',     value: isLoading ? '—' : teacherCount },
                  { label: 'Admin',        value: isLoading ? '—' : adminCount },
                  { label: 'Active',       value: isLoading ? '—' : activeCount },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
                    border: '.5px solid rgba(255,255,255,.25)', borderRadius: 12,
                    padding: '10px 16px', minWidth: 80,
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.7)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {!isMobile && (
              <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleExportStaff()}
                  disabled={!staffList.length}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
                    borderRadius: 11, border: '1.5px solid rgba(255,255,255,.4)',
                    background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)',
                    color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: staffList.length ? 'pointer' : 'not-allowed',
                    opacity: staffList.length ? 1 : 0.5,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.25)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.15)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export Staff
                </button>
                <button
                  onClick={() => setWizardOpen(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px',
                    borderRadius: 11, border: 'none', background: '#fff', color: '#0f766e',
                    fontWeight: 800, fontSize: 13, cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(0,0,0,.18)',
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.22)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,0,0,.18)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Register Staff Member
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Top Bar: search + role filter pills ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Search row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '0 12px', height: 38, flex: '1 1 200px',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or staff number…"
                style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Role filter pills */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {ROLE_FILTER_TABS.map(tab => {
              const active = roleFilter === tab.value
              const [c1] = tab.value ? roleGrad(tab.value) : ['#0d9488', '#0f766e']
              return (
                <button
                  key={tab.value}
                  onClick={() => setRoleFilter(tab.value)}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 99,
                    border: `1px solid ${active ? `${c1}40` : 'var(--border)'}`,
                    fontSize: 12.5, fontWeight: active ? 800 : 600, fontFamily: 'var(--font2)',
                    background: active ? `${c1}14` : 'var(--surface)',
                    color: active ? c1 : 'var(--txt3)',
                    cursor: 'pointer', transition: 'all 0.14s',
                    WebkitTapHighlightColor: 'transparent',
                  } as React.CSSProperties}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {isLoading ? (
          isMobile ? (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', minHeight: 72, borderBottom: '.5px solid var(--border)' }}>
                  <span className="shule-skeleton" style={{ display: 'block', width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <span className="shule-skeleton" style={{ display: 'block', height: 13, width: 140, borderRadius: 6, marginBottom: 8 }} />
                    <span className="shule-skeleton" style={{ display: 'block', height: 11, width: 80, borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )
        ) : staffList.length === 0 ? (
          /* Empty state */
          <div style={{
            padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', border: '.5px solid var(--border)',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', textAlign: 'center' }}>
                {search || roleFilter ? 'No staff match your filters' : 'No staff registered yet'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', textAlign: 'center', marginTop: 5 }}>
                {search || roleFilter ? 'Try adjusting your search or filter.' : 'Register the first staff member to get started.'}
              </div>
            </div>
            {!search && !roleFilter && (
              <button
                onClick={() => setWizardOpen(true)}
                style={{
                  marginTop: 6, padding: '10px 22px', borderRadius: 11, border: 'none',
                  background: 'linear-gradient(135deg, #0d9488, #0ea5e9)',
                  color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(13,148,136,.35)',
                }}
              >
                Register First Staff Member
              </button>
            )}
          </div>
        ) : isMobile ? (
          /* Mobile: contact-list style */
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 12px rgba(0,0,0,.06)' }}>
            <div style={{
              padding: '8px 16px', background: 'var(--surface2)',
              borderBottom: '.5px solid var(--border)',
              fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {totalCount} Staff Member{totalCount !== 1 ? 's' : ''}
            </div>
            {staffList.map(staff => (
              <MobileStaffRow
                key={staff.id}
                staff={staff}
                deptName={staff.departmentId ? (deptMap.get(staff.departmentId) ?? null) : null}
                onEdit={setEditingStaff}
              />
            ))}
          </div>
        ) : (
          /* Desktop: card grid */
          <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {staffList.map(staff => (
              <StaffCard
                key={staff.id}
                staff={staff}
                deptName={staff.departmentId ? (deptMap.get(staff.departmentId) ?? null) : null}
                onEdit={setEditingStaff}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB */}
      {isMobile && !wizardOpen && (
        <button
          onClick={() => setWizardOpen(true)}
          aria-label="Register staff member"
          style={{
            position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 20,
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: 'linear-gradient(145deg, var(--brand), var(--brand-dark))',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(13,148,136,.5)',
            zIndex: 30, transition: 'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      )}

      <StaffRegistrationWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {editingStaff && (
        <StaffEditModal
          staff={editingStaff}
          depts={depts}
          onClose={() => setEditingStaff(null)}
        />
      )}
    </>
  )
}
