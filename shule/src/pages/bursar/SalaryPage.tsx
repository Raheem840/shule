import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ExcelJS from 'exceljs'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABEL } from '../../config/roleNav'
import { Avatar } from '../../components/shared/Avatar'
import type { UserRole } from '../../store/AuthContext'

type SalaryRow = {
  id:             string
  firstName:      string
  lastName:       string
  role:           UserRole
  employmentType: string | null
  joinDate:       string | null
  photoUrl:       string | null
  salaryBand:     string | null
}

// ── Hooks ──────────────────────────────────────────────────────
function useStaffSalaries() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['staff-salaries', user?.schoolId],
    enabled:  !!user?.schoolId,
    queryFn: async (): Promise<SalaryRow[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, role, employment_type, join_date, photo_url, salary_band')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id:             r.id,
        firstName:      r.first_name,
        lastName:       r.last_name,
        role:           r.role as UserRole,
        employmentType: r.employment_type ?? null,
        joinDate:       r.join_date ?? null,
        photoUrl:       r.photo_url ?? null,
        salaryBand:     r.salary_band ?? null,
      }))
    },
    staleTime: 5 * 60_000,
  })
}

function useUpdateSalaryBand() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, salaryBand }: { id: string; salaryBand: string }) => {
      const { error } = await supabase
        .from('staff')
        .update({ salary_band: salaryBand })
        .eq('id', id)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      // Audit trail — non-fatal
      await supabase.from('audit_log').insert({
        school_id:  user!.schoolId,
        table_name: 'staff',
        record_id:  id,
        action:     'UPDATE',
        old_value:  null,
        new_value:  { salary_band: salaryBand },
        user_id:    user!.id,
        role:       user!.role,
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff-salaries', user?.schoolId] }),
  })
}

// ── Inline editable salary band cell ─────────────────────────
function SalaryBandCell({ row }: { row: SalaryRow }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(row.salaryBand ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const update   = useUpdateSalaryBand()

  function start() {
    setDraft(row.salaryBand ?? '')
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }

  async function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed === (row.salaryBand ?? '')) return
    await update.mutateAsync({ id: row.id, salaryBand: trimmed })
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        aria-label="Edit salary band"
        style={{
          width: 120, padding: '0.25rem 0.5rem',
          border: '1.5px solid var(--brand)', borderRadius: 'var(--r)',
          background: 'var(--surface)', color: 'var(--txt)',
          fontSize: 12, fontFamily: 'var(--font3)', outline: 'none',
        }}
      />
    )
  }

  return (
    <button
      onClick={start}
      title="Click to edit"
      style={{
        background: 'none', border: 'none', cursor: 'text',
        padding: '0.2rem 0.4rem', borderRadius: 4,
        borderBottom: '1px dashed var(--border)',
        fontSize: 12, fontFamily: 'var(--font3)',
        color: row.salaryBand ? 'var(--txt)' : 'var(--txt3)',
      }}
    >
      {update.isPending ? '…' : (row.salaryBand ?? '—')}
    </button>
  )
}

function StaffAvatar({ row }: { row: SalaryRow }) {
  return (
    <Avatar
      photoPath={row.photoUrl}
      bucket="staff-photos"
      name={`${row.firstName} ${row.lastName}`}
      size="sm"
    />
  )
}

// ── Employment type badge ─────────────────────────────────────
const EMP_COLORS: Record<string, string> = {
  permanent: 'green',
  contract:  'amber',
  volunteer: 'muted',
}

// ── Main page ─────────────────────────────────────────────────
export function SalaryPage() {
  const { success: toastOk, error: toastErr } = useToast()
  const { data: rows = [], isLoading, error } = useStaffSalaries()

  const [roleFilter, setRoleFilter] = useState('')
  const [empFilter,  setEmpFilter]  = useState('')

  const filtered = rows.filter(r => {
    if (roleFilter && r.role !== roleFilter) return false
    if (empFilter  && r.employmentType !== empFilter) return false
    return true
  })

  // Distinct roles + employment types for filter dropdowns
  const roles    = [...new Set(rows.map(r => r.role))].sort()
  const empTypes = [...new Set(rows.map(r => r.employmentType).filter(Boolean))].sort()

  // ── Excel export ───────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!filtered.length) return
    try {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Salary Records')
      ws.columns = [
        { header: 'Staff Name',      key: 'name',           width: 28 },
        { header: 'Role',            key: 'role',           width: 18 },
        { header: 'Employment Type', key: 'employmentType', width: 16 },
        { header: 'Salary Band',     key: 'salaryBand',     width: 14 },
        { header: 'Join Date',       key: 'joinDate',       width: 14 },
      ]
      for (const r of filtered) {
        ws.addRow({
          name:           `${r.firstName} ${r.lastName}`,
          role:           ROLE_LABEL[r.role] ?? r.role,
          employmentType: r.employmentType ?? '',
          salaryBand:     r.salaryBand ?? '',
          joinDate:       r.joinDate ?? '',
        })
      }
      const buffer = await wb.xlsx.writeBuffer()
      const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url    = URL.createObjectURL(blob)
      const a      = document.createElement('a')
      a.href = url; a.download = 'salary-records.xlsx'; a.click()
      URL.revokeObjectURL(url)
      toastOk('Salary records exported')
    } catch (e: any) {
      toastErr(e.message)
    }
  }, [filtered, toastOk, toastErr])

  const thStyle = {
    textAlign: 'left' as const, fontSize: 10, fontWeight: 700 as const,
    color: 'var(--txt3)', padding: '0.6rem 1rem',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
  }
  const tdStyle = { padding: '0.65rem 1rem', verticalAlign: 'middle' as const }

  const selectStyle = {
    padding: '0.38rem 0.85rem', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r)', background: 'var(--surface)',
    color: 'var(--txt)', fontSize: 13, outline: 'none',
  }

  return (
    <div className="sui-page-enter" style={{ padding: '1.5rem 2rem', maxWidth: 1100 }}>
      <PageHeader
        title="Salary Records"
        subtitle="Staff salary bands — click a band to edit inline"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleExport}
              disabled={!filtered.length}
              style={{
                padding: '0.45rem 1rem', border: '1.5px solid var(--border)',
                borderRadius: 'var(--r)', background: 'var(--surface)',
                color: 'var(--txt2)', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font2)',
                opacity: filtered.length ? 1 : 0.5,
              }}
            >
              Export Excel
            </button>
          </div>
        }
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={selectStyle} value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {roles.map(r => (
            <option key={r} value={r}>{ROLE_LABEL[r] ?? r}</option>
          ))}
        </select>
        <select style={selectStyle} value={empFilter} onChange={e => setEmpFilter(e.target.value)}>
          <option value="">All Employment Types</option>
          {empTypes.map(e => (
            <option key={e!} value={e!}>{e!.charAt(0).toUpperCase() + e!.slice(1)}</option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: 'var(--txt3)', marginLeft: 4 }}>
          {filtered.length} staff member{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <LoadingSpinner size="lg" />
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--r)', color: 'var(--danger)', fontSize: 13 }}>
          {(error as Error).message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="mob-cards" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Role', 'Employment Type', 'Join Date', 'Salary Band'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
                    No staff found for the selected filters.
                  </td>
                </tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="sui-tr">
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <StaffAvatar row={row} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                          {row.firstName} {row.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <Badge variant="teal" size="sm">{ROLE_LABEL[row.role] ?? row.role}</Badge>
                  </td>
                  <td style={tdStyle}>
                    {row.employmentType ? (
                      <Badge variant={(EMP_COLORS[row.employmentType] ?? 'muted') as any} size="sm">
                        {row.employmentType.charAt(0).toUpperCase() + row.employmentType.slice(1)}
                      </Badge>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--txt3)' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
                    {row.joinDate ? new Date(row.joinDate).toLocaleDateString('en-UG') : '—'}
                  </td>
                  <td style={tdStyle}>
                    <SalaryBandCell row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
