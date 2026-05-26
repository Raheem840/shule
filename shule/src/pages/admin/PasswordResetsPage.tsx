import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { getPendingActivations, clearPendingActivation } from '../../hooks/useStaffAuth'
import type { PendingActivation } from '../../hooks/useStaffAuth'

function PendingRow({ activation, onClear }: { activation: PendingActivation; onClear: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  const storedDate = new Date(activation.storedAt).toLocaleString('en-UG', { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--warning)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>{activation.name}</div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Stored {storedDate}</div>
        </div>
        <button className="sui-btn-ghost" style={{ fontSize: 11, color: 'var(--danger)' }} onClick={onClear}>Clear</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Email',         value: activation.email,        key: 'email' },
          { label: 'Temp Password', value: activation.tempPassword,  key: 'pass'  },
        ].map(f => (
          <div key={f.key} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{f.value}</div>
            </div>
            <button className="sui-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => copy(f.value, f.key)}>
              {copied === f.key ? 'Copied!' : 'Copy'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--warning)', background: 'var(--warning-bg)', borderRadius: 8, padding: '8px 12px' }}>
        Action required: Create this user in Supabase Dashboard → Authentication → Users, then link their auth ID to the staff record.
      </div>
    </div>
  )
}

export function PasswordResetsPage() {
  const [activations, setActivations] = useState(() => getPendingActivations())

  const entries = Object.values(activations)

  function handleClear(staffId: string) {
    clearPendingActivation(staffId)
    setActivations(getPendingActivations())
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Pending Activations"
        subtitle="Staff logins that need manual creation in Supabase Dashboard."
      />

      {entries.length === 0 ? (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 14, padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>All clear</div>
          <div style={{ fontSize: 13, color: 'var(--txt2)' }}>No pending activations.</div>
        </div>
      ) : (
        <>
          <div style={{ padding: '10px 16px', background: 'var(--warning-bg)', borderRadius: 10, fontSize: 13, color: 'var(--warning)', fontWeight: 600 }}>
            {entries.length} pending activation{entries.length !== 1 ? 's' : ''} — create these accounts in Supabase Dashboard
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {entries.map(a => (
              <PendingRow key={a.staffId} activation={a} onClear={() => handleClear(a.staffId)} />
            ))}
          </div>
        </>
      )}

      <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: 12, color: 'var(--txt3)' }}>
        Entries are stored in localStorage on this browser. Once the Edge Function is deployed, activations will happen automatically and this list will stay empty.
      </div>
    </div>
  )
}
