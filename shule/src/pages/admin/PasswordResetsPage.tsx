import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { getPendingActivations, clearPendingActivation } from '../../hooks/useStaffAuth'
import {
  usePasswordResetRequests,
  useApprovePasswordReset,
} from '../../hooks/useProfile'
import type { PendingActivation } from '../../hooks/useStaffAuth'

// ── Pending activation row ─────────────────────────────────────────────────
function ActivationRow({ activation, onClear }: { activation: PendingActivation; onClear: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  const storedDate = new Date(activation.storedAt).toLocaleString('en-UG', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 14, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
            {activation.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>
            Stored {storedDate}
          </div>
        </div>
        <button
          onClick={onClear}
          style={{
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
            color: 'var(--danger)', borderRadius: 8, padding: '4px 12px',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Email',         value: activation.email,       key: 'email' },
          { label: 'Temp Password', value: activation.tempPassword, key: 'pass'  },
        ].map(f => (
          <div key={f.key} style={{
            background: 'var(--surface2)', borderRadius: 10,
            padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid var(--border)',
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>
                {f.label}
              </div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>
                {f.value}
              </div>
            </div>
            <button
              onClick={() => copy(f.value, f.key)}
              style={{
                border: '1px solid var(--border)', borderRadius: 7,
                padding: '3px 10px', fontSize: 11, fontWeight: 700,
                background: copied === f.key ? 'var(--brand-light)' : 'transparent',
                color: copied === f.key ? 'var(--brand)' : 'var(--txt2)', cursor: 'pointer',
              }}
            >
              {copied === f.key ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>

      <div style={{
        fontSize: 12, color: 'var(--warning)',
        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8, padding: '8px 12px',
      }}>
        Action required: Create this user in Supabase Dashboard → Authentication → Users, then link their auth ID.
      </div>
    </div>
  )
}

// ── Password reset request row ─────────────────────────────────────────────
function ResetRequestRow({ req }: {
  req: import('../../hooks/useProfile').PasswordResetRequest
}) {
  const approve = useApprovePasswordReset()
  const [copied, setCopied] = useState(false)
  const [done,   setDone]   = useState(false)

  const reqDate = new Date(req.requestedAt).toLocaleString('en-UG', {
    dateStyle: 'medium', timeStyle: 'short',
  })

  function copyPwd() {
    void navigator.clipboard.writeText(req.desiredPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleApprove() {
    try {
      await approve.mutateAsync(req.id)
      setDone(true)
    } catch { /* handled by query invalidation */ }
  }

  if (done) return null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid rgba(14,165,233,0.35)',
      borderRadius: 14, padding: 20,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
            {req.staffName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 3 }}>
            Requested {reqDate}
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800,
          background: 'rgba(14,165,233,0.1)', color: 'var(--info)',
          border: '1px solid rgba(14,165,233,0.25)',
          textTransform: 'uppercase', letterSpacing: 0.5,
        }}>
          Password Reset
        </span>
      </div>

      {/* Desired password */}
      <div style={{
        background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
            Requested New Password
          </div>
          <div style={{ fontSize: 14, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 700, letterSpacing: 1 }}>
            {'•'.repeat(req.desiredPassword.length)}
          </div>
        </div>
        <button
          onClick={copyPwd}
          style={{
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '6px 14px', fontSize: 12, fontWeight: 700,
            background: copied ? 'var(--brand-light)' : 'transparent',
            color: copied ? 'var(--brand)' : 'var(--txt2)', cursor: 'pointer',
            transition: 'all 0.15s', flexShrink: 0,
          }}
        >
          {copied ? '✓ Copied' : 'Copy Password'}
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        fontSize: 12, color: 'var(--info)',
        background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)',
        borderRadius: 8, padding: '8px 12px', lineHeight: 1.6,
      }}>
        <strong>How to approve:</strong> Copy the password above → go to Supabase Dashboard → Authentication → Users → find {req.staffName} → set their password. Then click Approve below.
      </div>

      {/* Approve button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => void handleApprove()}
          disabled={approve.isPending}
          style={{
            padding: '9px 22px', borderRadius: 10,
            background: 'var(--brand)', color: '#fff',
            border: 'none', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'var(--font2)',
            boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
            transition: 'all 0.15s',
          }}
        >
          {approve.isPending ? 'Marking done…' : 'Approve — Mark as Done'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function PasswordResetsPage() {
  const [activations, setActivations] = useState(() => getPendingActivations())
  const { data: resetRequests = [], isLoading } = usePasswordResetRequests()

  const activationEntries = Object.values(activations)
  const totalPending = activationEntries.length + resetRequests.length

  function handleClearActivation(staffId: string) {
    clearPendingActivation(staffId)
    setActivations(getPendingActivations())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Pending Requests"
        subtitle="Pending account activations and staff password reset requests."
      />

      {/* Status banner */}
      {!isLoading && (
        totalPending === 0 ? (
          <div style={{
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 14, padding: '20px 24px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(16,185,129,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>
                All clear
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
                No pending activations or password reset requests.
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            padding: '10px 16px', background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderRadius: 10, fontSize: 13, color: 'var(--warning)', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />
            {totalPending} pending request{totalPending !== 1 ? 's' : ''} — action required
          </div>
        )
      )}

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><LoadingSpinner size="md" /></div>}

      {/* ── Password Reset Requests ── */}
      {resetRequests.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 0.8,
          }}>
            Password Reset Requests ({resetRequests.length})
          </div>
          {resetRequests.map(r => (
            <ResetRequestRow key={r.id} req={r} />
          ))}
        </div>
      )}

      {/* ── Pending Activations ── */}
      {activationEntries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 800, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 0.8,
          }}>
            Pending Account Activations ({activationEntries.length})
          </div>
          {activationEntries.map(a => (
            <ActivationRow key={a.staffId} activation={a} onClear={() => handleClearActivation(a.staffId)} />
          ))}
        </div>
      )}

      <div style={{
        padding: '12px 16px', background: 'var(--surface2)',
        borderRadius: 10, fontSize: 12, color: 'var(--txt3)', lineHeight: 1.6,
      }}>
        Activations are stored in this browser's localStorage. Password reset requests are stored in the database and visible from any device.
      </div>
    </div>
  )
}
