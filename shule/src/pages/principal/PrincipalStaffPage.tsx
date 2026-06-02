import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStaff, useSetStaffActive, type StaffFilters } from '../../hooks/useStaff'
import { useDepartments } from '../../hooks/useClasses'
import { Avatar } from '../../components/shared/Avatar'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
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
  it_admin:      ['#94a3b8', '#64748b'],
}

function roleGrad(role: string): [string, string] {
  return ROLE_GRAD[role] ?? ['#94a3b8', '#64748b']
}

const ADMIN_ROLES = new Set(['principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin'])

const ROLE_FILTER_TABS = [
  { value: '',              label: 'All' },
  { value: 'deputy',        label: 'Deputy' },
  { value: 'dos',           label: 'DoS' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'it_admin',      label: 'IT Admin' },
]

// ── Filter Pill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
        background: active ? 'rgba(255,255,255,.24)' : 'rgba(255,255,255,.10)',
        color:      active ? '#fff' : 'rgba(255,255,255,.72)',
        border:     active ? '1px solid rgba(255,255,255,.55)' : '1px solid rgba(255,255,255,.22)',
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: active ? '0 2px 8px rgba(0,0,0,.15)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

// ── Staff Card ────────────────────────────────────────────────────────────────
function StaffCard({
  staff, deptName, onActivate,
}: {
  staff: Staff
  deptName: string | null
  onActivate: (id: string, name: string, isActive: boolean) => void
}) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
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
      <div style={{ height: 4, width: '100%', background: `linear-gradient(90deg, ${c1}, ${c2})` }} />

      {/* Card body */}
      <div style={{ padding: '18px 18px 16px' }}>
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `linear-gradient(135deg, ${c1}, ${c2})`,
              padding: 2.5, position: 'relative',
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
                <Avatar
                  photoPath={staff.photoUrl}
                  bucket="staff-photos"
                  name={`${staff.firstName} ${staff.lastName}`}
                  size="md"
                />
              </div>
              <div style={{
                position: 'absolute', bottom: 1, right: 1,
                width: 12, height: 12, borderRadius: '50%',
                background: staff.isActive ? 'var(--success)' : 'var(--txt3)',
                border: '2px solid var(--surface)',
              }} />
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 15, color: 'var(--txt)',
              lineHeight: 1.3, marginBottom: 5,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {staff.firstName} {staff.lastName}
            </div>
            <span style={{
              display: 'inline-block', padding: '2px 9px', borderRadius: 99,
              background: `${c1}18`, color: c1, border: `1px solid ${c1}30`,
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

        {/* Footer: employment + status + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '.5px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => navigate(`/principal/staff/${staff.id}`)}
              style={{
                padding: '4px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                background: 'var(--brand-light)', color: 'var(--brand)',
                border: '1px solid rgba(13,148,136,.2)', cursor: 'pointer', transition: 'all .13s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(13,148,136,.15)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-light)' }}
            >
              View
            </button>
            {/* More menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
                style={{
                  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                  background: menuOpen ? 'var(--surface2)' : 'transparent',
                  color: 'var(--txt3)', cursor: 'pointer', transition: 'all .13s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
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
              {menuOpen && (
                <div style={{
                  position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 200,
                  background: 'var(--surface)', border: '.5px solid var(--border)',
                  borderRadius: 12, boxShadow: '0 8px 28px rgba(0,0,0,.14)',
                  minWidth: 148, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => { setMenuOpen(false); onActivate(staff.id, `${staff.firstName} ${staff.lastName}`, staff.isActive) }}
                    style={{
                      width: '100%', padding: '10px 14px', border: 'none', background: 'none',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 12.5, fontWeight: 700,
                      color: staff.isActive ? '#f59e0b' : '#10b981', transition: 'background .1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = staff.isActive ? 'rgba(245,158,11,.07)' : 'rgba(16,185,129,.07)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                  >
                    {staff.isActive ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: staff.isActive ? 'var(--success)' : 'var(--txt3)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: staff.isActive ? 'var(--success)' : 'var(--txt3)' }}>
              {staff.isActive ? 'Active' : 'Inactive'}
            </span>
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
          <span className="shule-skeleton" style={{ display: 'block', height: 26, width: 70, borderRadius: 7 }} />
          <span className="shule-skeleton" style={{ display: 'block', height: 22, width: 55, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function PrincipalStaffPage() {
  const { user }                    = useAuth()
  const { success: ok, error: err } = useToast()
  const setActive                   = useSetStaffActive()
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const filters: StaffFilters = useMemo(() => ({
    search: search.trim() || undefined,
    role:   (roleFilter as UserRole) || undefined,
  }), [search, roleFilter])

  const { data: staffList = [], isLoading } = useStaff(filters)
  const { data: depts     = [] }            = useDepartments()
  const deptMap = new Map(depts.map(d => [d.id, d.name]))

  // Filter out the logged-in principal's own record
  const filtered = useMemo(
    () => staffList.filter(s => s.authUserId !== user?.id),
    [staffList, user?.id],
  )

  // Hero stats
  const teacherCount = filtered.filter(s => s.role === 'teacher' || s.role === 'class_teacher').length
  const adminCount   = filtered.filter(s => ADMIN_ROLES.has(s.role)).length
  const activeCount  = filtered.filter(s => s.isActive).length

  async function handleActivate(id: string, name: string, isActive: boolean) {
    try {
      await setActive.mutateAsync({ id, isActive: !isActive })
      ok(`${name} is now ${!isActive ? 'active' : 'deactivated'}`)
    } catch (e: any) { err(e?.message ?? 'Action failed') }
  }

  const handleExportStaff = useCallback(async () => {
    if (!filtered.length) return
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Staff Register')
    const lastCol = 'I'
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = `Staff Register — ${dateStr}`
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } }
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
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFF59E0B' } } }
    })

    filtered.forEach((s, i) => {
      const row = ws.addRow([
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
      row.height = 16
      row.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle' }
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
  }, [filtered, deptMap])

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero Band ─────────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        padding: '28px 28px 24px', position: 'relative',
      }}>
        {/* decorative circles */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, position: 'relative', zIndex: 1 }}>
          <div>
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
                Staff Directory
              </h1>
            </div>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
              {isLoading ? 'Loading staff roster…' : 'Complete school staff register'}
            </p>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Staff', value: isLoading ? '—' : filtered.length },
                { label: 'Teachers',    value: isLoading ? '—' : teacherCount },
                { label: 'Admin',       value: isLoading ? '—' : adminCount },
                { label: 'Active',      value: isLoading ? '—' : activeCount },
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

          <button
            onClick={() => { void handleExportStaff() }}
            disabled={!filtered.length}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 16px',
              borderRadius: 11, border: '1.5px solid rgba(255,255,255,.4)',
              background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)',
              color: '#fff', fontWeight: 700, fontSize: 12.5,
              cursor: filtered.length ? 'pointer' : 'not-allowed',
              opacity: filtered.length ? 1 : 0.5, transition: 'background 0.15s',
              alignSelf: 'flex-start',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.25)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.15)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Staff
          </button>
        </div>

        {/* ── Search + Role Filter Pills ──────────────────────────── */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)',
            border: '.5px solid rgba(255,255,255,.28)', borderRadius: 10,
            padding: '0 12px', height: 40, maxWidth: 400,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              placeholder="Search by name, role, or staff number…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                color: '#fff', fontSize: 13, fontWeight: 500,
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.6)', padding: 0, display: 'flex' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ROLE_FILTER_TABS.map(tab => (
              <FilterPill
                key={tab.value}
                label={tab.label}
                active={roleFilter === tab.value}
                onClick={() => setRoleFilter(roleFilter === tab.value && tab.value !== '' ? '' : tab.value)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Card Grid ─────────────────────────────────────────────── */}
      {isLoading && (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
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
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No staff found</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
            {search || roleFilter ? 'Try a different search or filter.' : 'No staff have been registered yet.'}
          </div>
          {(search || roleFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter('') }}
              style={{ marginTop: 4, padding: '7px 18px', borderRadius: 9, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <>
          <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(s => (
              <StaffCard
                key={s.id}
                staff={s}
                deptName={s.departmentId ? (deptMap.get(s.departmentId) ?? null) : null}
                onActivate={(id, name, isActive) => { void handleActivate(id, name, isActive) }}
              />
            ))}
          </div>
          <div style={{ textAlign: 'center', padding: '2px 0 8px', fontSize: 11.5, color: 'var(--txt3)', fontWeight: 600 }}>
            {filtered.length} staff member{filtered.length !== 1 ? 's' : ''}
            {(search || roleFilter) ? ' matching filters' : ' in directory'}
          </div>
        </>
      )}
    </div>
  )
}
