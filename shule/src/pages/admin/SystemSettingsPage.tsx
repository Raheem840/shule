import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAcademicYears, usePromoteStudents } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'
import { useStorageBuckets } from '../../hooks/useAdmin'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'

// ── Portal toggle helpers ─────────────────────────────────────────────────────
function usePortalOpen(schoolId: string | undefined) {
  return useQuery({
    queryKey: ['portal-open', schoolId],
    enabled: !!schoolId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_profile')
        .select('parent_portal_open')
        .eq('id', schoolId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data?.parent_portal_open ?? true) as boolean
    },
  })
}

function useTogglePortal(schoolId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (open: boolean) => {
      const { error } = await supabase
        .from('school_profile')
        .update({ parent_portal_open: open })
        .eq('id', schoolId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, open) => {
      qc.setQueryData(['portal-open', schoolId], open)
      void qc.invalidateQueries({ queryKey: ['portal-open', schoolId] })
    },
  })
}

// ── Toggle switch sub-component ───────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 48, height: 26, borderRadius: 99,
        background: checked ? 'var(--brand)' : 'var(--border)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0, transition: 'background .22s',
        boxShadow: checked ? '0 2px 8px rgba(13,148,136,.4)' : 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: checked ? 25 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,.22)',
        transition: 'left .22s cubic-bezier(.4,0,.2,1)',
      }} />
    </button>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, dangerous,
}: {
  title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; dangerous?: boolean
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 800, color: dangerous ? 'var(--danger)' : 'var(--txt)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--txt2)' }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="sui-btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: dangerous ? 'var(--danger)' : 'var(--brand)', color: '#fff',
            }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SystemSettingsPage() {
  const { user } = useAuth()
  const { data: years = [],   isLoading: yearsLoading  } = useAcademicYears()
  const { data: buckets = [], isLoading: bucketsLoading } = useStorageBuckets()
  const { success: ok, error: err } = useToast()
  const promote = usePromoteStudents()

  const { data: portalOpen, isLoading: portalLoading } = usePortalOpen(user?.schoolId)
  const togglePortal = useTogglePortal(user?.schoolId)

  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false)
  const [promoteResult, setPromoteResult] = useState<{ promoted: number; completed: number; total: number } | null>(null)
  const [progress, setProgress] = useState(0)

  async function handlePromote() {
    setShowPromoteConfirm(false)
    setProgress(0)
    try {
      const result = await promote.mutateAsync((current, total) => {
        setProgress(Math.round((current / total) * 100))
      })
      setPromoteResult(result)
      ok(`Promoted ${result.promoted} students. ${result.completed} completed.`)
    } catch (e: any) { err(e.message) }
    finally { setProgress(0) }
  }

  async function handlePortalToggle(open: boolean) {
    try {
      await togglePortal.mutateAsync(open)
      ok(open ? 'Parent portal is now open.' : 'Parent portal has been closed.')
    } catch (e: any) { err(e.message) }
  }

  const activeYear = years.find((y: any) => y.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>System Settings</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Portal access, academic years, student promotion and storage</p>
        </div>
      </div>

      {showPromoteConfirm && (
        <ConfirmDialog
          title="Promote All Students"
          message="This will advance every active student to the next class. S.4 and S.6 students will be marked as completed. This cannot be undone."
          confirmLabel="Promote"
          dangerous
          onConfirm={handlePromote}
          onCancel={() => setShowPromoteConfirm(false)}
        />
      )}

      {/* ── Portal Access ── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px',
        boxShadow: '0 1px 6px rgba(0,0,0,.04)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}>Portal Access</div>

        {/* Parent portal row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          padding: '14px 16px', borderRadius: 12,
          background: portalOpen ? 'rgba(13,148,136,.04)' : 'rgba(244,63,94,.04)',
          border: `1px solid ${portalOpen ? 'rgba(13,148,136,.18)' : 'rgba(244,63,94,.18)'}`,
          transition: 'all .22s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Icon */}
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={portalOpen ? 'var(--brand)' : 'var(--danger)'} strokeWidth="2" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Parent Portal</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                {portalOpen
                  ? 'Parents can log in and view their children\'s records'
                  : 'Portal is closed — parents cannot access the system'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
              padding: '3px 10px', borderRadius: 99,
              color: portalOpen ? 'var(--brand)' : 'var(--danger)',
              background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
              border: `1px solid ${portalOpen ? 'rgba(13,148,136,.25)' : 'rgba(244,63,94,.2)'}`,
            }}>
              {portalOpen ? 'Open' : 'Closed'}
            </span>
            {portalLoading ? (
              <div style={{ width: 48, height: 26, borderRadius: 99, background: 'var(--border)' }} />
            ) : (
              <ToggleSwitch
                checked={portalOpen ?? true}
                onChange={handlePortalToggle}
                disabled={togglePortal.isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Active year */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 6 }}>Active Academic Year</div>
        {yearsLoading ? (
          <LoadingSpinner size={16} />
        ) : activeYear ? (
          <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{(activeYear as any).name}</div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--txt3)', fontStyle: 'italic' }}>No active year set</div>
        )}
      </div>

      {/* End-of-year student promotion */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>End-of-Year: Promote Students</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
          Advances all active students to the next class. Run this at the end of the academic year after results are finalised.
        </div>
        {promote.isPending && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--brand)', transition: 'width 0.2s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Promoting… {progress}%</div>
          </div>
        )}
        {promoteResult && (
          <div style={{ background: 'var(--success-bg)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
            Done: {promoteResult.promoted} promoted · {promoteResult.completed} completed · {promoteResult.total} total
          </div>
        )}
        <button
          className="sui-btn-primary"
          style={{ background: 'var(--danger)' }}
          disabled={promote.isPending}
          onClick={() => setShowPromoteConfirm(true)}>
          {promote.isPending ? 'Promoting…' : 'Promote All Students'}
        </button>
      </div>

      {/* Storage */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>Storage Buckets</div>
        </div>
        {bucketsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><LoadingSpinner size="sm" /></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Bucket', 'Files', 'Size (MB)'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No buckets found.</td></tr>
              ) : buckets.map(b => (
                <tr key={b.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>{b.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{b.fileCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{b.sizeMb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
