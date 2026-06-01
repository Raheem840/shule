import { useState } from 'react'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useAcademicYears, usePromoteStudents } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'
import { useStorageBuckets } from '../../hooks/useAdmin'

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
  const { data: years = [],   isLoading: yearsLoading  } = useAcademicYears()
  const { data: buckets = [], isLoading: bucketsLoading } = useStorageBuckets()
  const { success: ok, error: err } = useToast()
  const promote = usePromoteStudents()

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

  const activeYear = years.find((y: any) => y.is_active)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>System Settings</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Academic years, student promotion and storage</p>
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
