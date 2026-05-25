import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

type SalaryRecord = {
  id: string
  staffId: string
  name: string
  role: UserRole
  salaryBand: string | null
  amount: number | null
  month: string
  paid: boolean
}

function useSalaryRecords() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['salary-records', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<SalaryRecord[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, role, salary_band')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id:         r.id,
        staffId:    r.id,
        name:       `${r.first_name} ${r.last_name}`,
        role:       r.role as UserRole,
        salaryBand: r.salary_band ?? null,
        amount:     null,
        month:      new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
        paid:       false,
      }))
    },
    staleTime: 5 * 60_000,
  })
}

export function SalaryPage() {
  const { data: records = [], isLoading } = useSalaryRecords()
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Salary Records
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          {records.length} active staff
        </div>
      </div>

      <div style={{
        padding: '10px 16px', background: 'var(--warning-bg)', borderRadius: 10,
        border: '1px solid var(--warning)', fontSize: 13, color: '#92400e',
      }}>
        Payroll module coming soon. Currently showing staff salary bands. Full payroll processing requires bank integration.
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading staff…</div>}

      {!isLoading && records.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Role', 'Salary Band', 'Amount (UGX)', 'Status'].map(h => (
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
                const r = records[vRow.index]
                return (
                  <div
                    key={r.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      height: 56, display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)', padding: '0 14px',
                    }}
                  >
                    <div style={{ flex: 2, fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{r.name}</div>
                    <div style={{ flex: 1.5 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: 'var(--brand-light)', color: 'var(--brand)',
                      }}>
                        {ROLE_LABEL[r.role] ?? r.role}
                      </span>
                    </div>
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)' }}>{r.salaryBand ?? '—'}</div>
                    <div style={{ flex: 1, fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>
                      {r.amount != null ? r.amount.toLocaleString() : '—'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: r.paid ? 'var(--success-bg)' : 'var(--surface2)',
                        color: r.paid ? 'var(--success)' : 'var(--txt3)',
                      }}>
                        {r.paid ? 'Paid' : 'Pending'}
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
