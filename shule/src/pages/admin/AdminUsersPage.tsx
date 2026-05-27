import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useUserManagement } from '../../hooks/useAdmin'
import {
  useActivateStaffLogin,
  useResetStaffPassword,
  useLinkAuthUser,
} from '../../hooks/useStaffAuth'
import type { UserRow } from '../../types/week9'
import { useToast } from '../../components/ui/Toast'

function CredentialBanner({ email, tempPassword, manual, onDismiss }: {
  email: string; tempPassword: string; manual: boolean; onDismiss: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>
        {manual ? 'Credentials stored locally (Edge Function not yet deployed)' : 'Login activated successfully'}
      </div>
      {manual && <div style={{ fontSize: 11, color: 'var(--success)', opacity: 0.8 }}>These credentials are saved in localStorage. Use them to create the auth account manually in Supabase Dashboard.</div>}
      {[{ label: 'Email', value: email, key: 'email' }, { label: 'Temp Password', value: tempPassword, key: 'pass' }].map(f => (
        <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: '8px 12px' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase' }}>{f.label}</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{f.value}</div>
          </div>
          <button className="sui-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => copy(f.value, f.key)}>
            {copied === f.key ? 'Copied!' : 'Copy'}
          </button>
        </div>
      ))}
      <button className="sui-btn-ghost" style={{ alignSelf: 'flex-end', fontSize: 11 }} onClick={onDismiss}>Dismiss</button>
    </div>
  )
}

export function AdminUsersPage() {
  const { data = [], isLoading } = useUserManagement()
  const activateLogin  = useActivateStaffLogin()
  const resetPassword  = useResetStaffPassword()
  const { success: ok, error: err } = useToast()

  const linkAuth   = useLinkAuthUser()
  const [search,        setSearch]        = useState('')
  const [creds,         setCreds]         = useState<{ email: string; tempPassword: string; manual: boolean } | null>(null)
  const [actionId,      setActionId]      = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<UserRow | null>(null)
  const [authUidInput,  setAuthUidInput]  = useState('')
  const [linkError,     setLinkError]     = useState('')

  const rows = search.trim()
    ? data.filter(r => r.name.toLowerCase().includes(search.toLowerCase()) || r.role.includes(search.toLowerCase()))
    : data

  async function handleActivate(row: UserRow) {
    setActionId(row.staffId)
    try {
      const result = await activateLogin.mutateAsync(row.staffId)
      setCreds(result)
      ok('Login activated.')
    } catch (e: any) { err(e.message) }
    finally { setActionId(null) }
  }

  async function handleReset(row: UserRow) {
    if (!row.authUserId || !row.name) return
    setActionId(row.staffId)
    try {
      const result = await resetPassword.mutateAsync({
        authUserId: row.authUserId,
        staffId:    row.staffId,
        email:      '',
        name:       row.name,
      })
      setCreds({ email: '(unchanged)', ...result })
      ok('Password reset.')
    } catch (e: any) { err(e.message) }
    finally { setActionId(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Users"
        subtitle="Activate staff logins and reset passwords."
      />

      {creds && <CredentialBanner {...creds} onDismiss={() => setCreds(null)} />}

      <input className="sui-input" placeholder="Search by name or role…" value={search}
        onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Staff Member', 'Role', 'Login Status', 'Active', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)' }}>No staff found.</td></tr>
              ) : rows.map(row => (
                <tr key={row.staffId} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{row.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', textTransform: 'capitalize' }}>{row.role.replace('_', ' ')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {row.authUserId ? (
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>Active</span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--warning-bg)', color: 'var(--warning)' }}>No Login</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, color: row.isActive ? 'var(--success)' : 'var(--txt3)' }}>
                      {row.isActive ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {!row.authUserId ? (
                      <>
                        <button className="sui-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                          disabled={actionId === row.staffId}
                          onClick={() => handleActivate(row)}>
                          {actionId === row.staffId ? 'Activating…' : 'Activate Login'}
                        </button>
                        <button
                          className="sui-btn-ghost"
                          style={{ fontSize: 11, padding: '4px 12px', color: 'var(--info)', borderColor: 'var(--info)' }}
                          onClick={() => { setConfirmTarget(row); setAuthUidInput(''); setLinkError('') }}
                        >
                          Confirm Activated
                        </button>
                      </>
                    ) : (
                      <button className="sui-btn-ghost" style={{ fontSize: 11, padding: '4px 12px' }}
                        disabled={actionId === row.staffId}
                        onClick={() => handleReset(row)}>
                        {actionId === row.staffId ? 'Resetting…' : 'Reset Password'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              {rows.length} staff member{rows.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Confirm Activated modal */}
      {confirmTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: 440 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
              Confirm Activation
            </h3>
            <p style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 700, margin: '0 0 4px' }}>{confirmTarget.name}</p>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, margin: '0 0 4px' }}>
              After creating the account in Supabase Dashboard, paste the auth user UUID below to link it.
            </p>
            <p style={{ fontSize: 11, color: 'var(--txt3)', margin: '0 0 14px' }}>
              Supabase Dashboard → Authentication → Users → copy the UUID column.
            </p>
            <input
              className="sui-input"
              value={authUidInput}
              onChange={e => setAuthUidInput(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ width: '100%', marginBottom: 12, fontFamily: 'var(--font3)', fontSize: 12 }}
              autoFocus
            />
            {linkError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)',
                padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {linkError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="sui-btn-ghost" onClick={() => setConfirmTarget(null)}>Cancel</button>
              <button
                className="sui-btn-primary"
                disabled={!authUidInput.trim() || linkAuth.isPending}
                onClick={async () => {
                  setLinkError('')
                  try {
                    await linkAuth.mutateAsync({ staffId: confirmTarget.staffId, authUserId: authUidInput.trim() })
                    ok(`${confirmTarget.name}'s account linked successfully.`)
                    setConfirmTarget(null)
                  } catch (e: any) {
                    setLinkError(e.message ?? 'Failed to link account')
                  }
                }}
              >
                {linkAuth.isPending ? 'Linking…' : 'Link Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
