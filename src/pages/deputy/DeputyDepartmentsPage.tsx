import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import {
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useArchiveDepartment,
} from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import { useToast } from '../../components/ui/Toast'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import type { Department } from '../../types/app'

// ── Accent palette ────────────────────────────────────────────
const ACCENT_PALETTE = [
  '#0d9488', '#8b5cf6', '#0ea5e9', '#f59e0b',
  '#f43f5e', '#10b981', '#6366f1', '#ec4899',
  '#14b8a6', '#f97316',
]

// ── Staff count per department ────────────────────────────────
function useStaffCountByDept() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['dept-staff-counts', user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('department_id')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .not('department_id', 'is', null)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const r of data ?? []) {
        const id = r.department_id as string
        counts[id] = (counts[id] ?? 0) + 1
      }
      return counts
    },
  })
}

// ── Department form modal ──────────────────────────────────────
function DeptModal({
  dept,
  staffList,
  onClose,
}: {
  dept: Department | null
  staffList: { id: string; firstName: string; lastName: string }[]
  onClose: () => void
}) {
  const { success: ok, error: err } = useToast()
  const createMut = useCreateDepartment()
  const updateMut = useUpdateDepartment()
  const isEdit = !!dept

  const [name,     setName]     = useState(dept?.name     ?? '')
  const [desc,     setDesc]     = useState((dept as any)?.description ?? '')
  const [color,    setColor]    = useState(dept?.accentColor ?? ACCENT_PALETTE[0])
  const [headId,   setHeadId]   = useState(dept?.headTeacherId ?? '')

  const busy = createMut.isPending || updateMut.isPending

  async function handleSave() {
    if (!name.trim()) { err('Department name is required'); return }
    try {
      if (isEdit) {
        await updateMut.mutateAsync({ id: dept!.id, name, description: desc, accentColor: color, headTeacherId: headId || null })
        ok(`"${name}" updated`)
      } else {
        await createMut.mutateAsync({ name, description: desc, accentColor: color })
        ok(`"${name}" department created`)
      }
      onClose()
    } catch (e: any) { err(e.message ?? 'Failed to save') }
  }

  const inStyle: React.CSSProperties = {
    width: '100%', padding: '0.55rem 0.85rem',
    border: '1.5px solid var(--border)', borderRadius: 10,
    background: 'var(--surface)', color: 'var(--txt)',
    fontSize: 13, fontFamily: 'var(--font1)', outline: 'none', boxSizing: 'border-box',
  }
  const lbStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--txt2)', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--font2)',
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Edit — ${dept!.name}` : 'New Department'}
      size="sm"
      footer={
        <>
          <ModalCancelButton onClose={onClose} />
          <Button variant="primary" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Department'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={lbStyle}>Department Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} style={inStyle} placeholder="e.g. Science Department" autoFocus />
        </div>

        <div>
          <label style={lbStyle}>Description (optional)</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
            style={{ ...inStyle, resize: 'vertical', fontFamily: 'var(--font1)' }}
            placeholder="Brief overview of the department…" />
        </div>

        {/* Accent colour picker */}
        <div>
          <label style={lbStyle}>Accent Colour</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ACCENT_PALETTE.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c,
                  border: color === c ? `3px solid var(--txt)` : '2px solid transparent',
                  cursor: 'pointer', transition: 'border .12s',
                  boxShadow: color === c ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>

        {/* Head teacher */}
        <div>
          <label style={lbStyle}>Head of Department (optional)</label>
          <select value={headId} onChange={e => setHeadId(e.target.value)} style={inStyle}>
            <option value="">— None —</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}

// ── Department card ────────────────────────────────────────────
function DeptCard({
  dept,
  staffCount,
  headName,
  onEdit,
  onToggleArchive,
}: {
  dept:           Department
  staffCount:     number
  headName:       string | null
  onEdit:         () => void
  onToggleArchive: () => void
}) {
  const accent = dept.accentColor ?? 'var(--brand)'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', borderRadius: 18,
        border: `1.5px solid ${hovered ? accent : 'var(--border)'}`,
        overflow: 'hidden', transition: 'border-color .15s, box-shadow .15s',
        boxShadow: hovered ? `0 6px 24px ${accent}28` : '0 1px 4px rgba(0,0,0,.05)',
        opacity: dept.archived ? 0.55 : 1,
      }}
    >
      {/* Colour bar */}
      <div style={{ height: 4, background: accent }} />

      <div style={{ padding: '1.25rem 1.25rem 1rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '0.85rem' }}>
          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', lineHeight: 1.2, marginBottom: 3 }}>
              {dept.name}
            </div>
            {headName && (
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
                HoD: {headName}
              </div>
            )}
          </div>

          {dept.archived && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 8px', flexShrink: 0 }}>
              ARCHIVED
            </span>
          )}
        </div>

        {/* Staff count chip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px', borderRadius: 99,
            background: `${accent}10`, border: `1px solid ${accent}28`,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: accent, fontFamily: 'var(--font2)' }}>
              {staffCount}
            </span>
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
              staff
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onEdit}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 10,
              border: `1px solid ${accent}40`, background: `${accent}0a`,
              color: accent, fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', transition: 'all .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${accent}18` }}
            onMouseLeave={e => { e.currentTarget.style.background = `${accent}0a` }}
          >
            Edit
          </button>
          <button
            onClick={onToggleArchive}
            style={{
              padding: '7px 14px', borderRadius: 10,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
              cursor: 'pointer', transition: 'all .14s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = dept.archived ? 'var(--success)' : 'var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--txt3)' }}
          >
            {dept.archived ? 'Restore' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export function DeputyDepartmentsPage() {
  const { success: ok, error: err } = useToast()
  const { data: departments = [], isLoading } = useDepartments()
  const { data: staffCounts = {} }            = useStaffCountByDept()
  const { data: allStaff = [] }               = useStaff(useMemo(() => ({}), []))
  const archiveMut                            = useArchiveDepartment()

  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const staffMap = useMemo(
    () => new Map(allStaff.map(s => [s.id, `${s.firstName} ${s.lastName}`])),
    [allStaff],
  )

  const staffForHead = useMemo(
    () => allStaff.map(s => ({ id: s.id, firstName: s.firstName, lastName: s.lastName })),
    [allStaff],
  )

  const visible  = departments.filter(d => showArchived || !d.archived)
  const archived = departments.filter(d => d.archived)
  const total    = departments.filter(d => !d.archived).length
  const totalStaff = Object.values(staffCounts).reduce((a, b) => a + b, 0)

  async function handleToggleArchive(dept: Department) {
    try {
      await archiveMut.mutateAsync({ id: dept.id, archived: !dept.archived })
      ok(dept.archived ? `"${dept.name}" restored` : `"${dept.name}" archived`)
    } catch (e: any) { err(e.message) }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)',
        padding: '28px 28px 24px', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'rgba(139,92,246,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>
              Departments
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 12.5, margin: '0 0 20px' }}>
            Manage academic and administrative departments
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { label: 'Active Departments', value: String(total) },
              { label: 'Staff Assigned',     value: String(totalStaff) },
              { label: 'Archived',           value: String(archived.length) },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '8px 16px' }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.6)', marginTop: 3, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
            <button
              onClick={() => setShowCreate(true)}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(139,92,246,.45)', fontFamily: 'var(--font2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Department
            </button>
          </div>
        </div>
      </div>

      {/* Archive toggle */}
      {archived.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowArchived(v => !v)}
            style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font2)', cursor: 'pointer' }}
          >
            {showArchived ? 'Hide Archived' : `Show Archived (${archived.length})`}
          </button>
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ height: 180, borderRadius: 18, background: 'var(--surface)', border: '1.5px solid var(--border)' }} className="shule-skeleton" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(139,92,246,.08)', border: '1px dashed rgba(139,92,246,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
              <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>No departments yet</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Create your first department to organise staff by subject area.</div>
          </div>
          <Button variant="primary" onClick={() => setShowCreate(true)}>Create First Department</Button>
        </div>
      ) : (
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
          {visible.map(dept => (
            <DeptCard
              key={dept.id}
              dept={dept}
              staffCount={staffCounts[dept.id] ?? 0}
              headName={dept.headTeacherId ? (staffMap.get(dept.headTeacherId) ?? null) : null}
              onEdit={() => setEditTarget(dept)}
              onToggleArchive={() => void handleToggleArchive(dept)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {(showCreate || editTarget) && (
        <DeptModal
          dept={editTarget}
          staffList={staffForHead}
          onClose={() => { setShowCreate(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
