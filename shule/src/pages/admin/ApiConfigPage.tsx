import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useApiConfigStatus, useSaveApiConfig } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'

type KeyName = 'at_api_key' | 'at_username' | 'at_sender_id' | 'wa_phone_number_id' | 'wa_access_token'

function ApiKeyRow({ label, keyName, savedLabel }: { label: string; keyName: KeyName; savedLabel?: string }) {
  const { success: ok, error: err } = useToast()
  const save = useSaveApiConfig()
  const [value, setValue] = useState('')
  const [enabled] = useState(true)

  async function handleSave() {
    if (!value.trim()) return
    try {
      await save.mutateAsync({ keyName, keyValue: value, enabled })
      ok(`${label} saved.`)
      setValue('')
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>{label}</label>
      {savedLabel && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{savedLabel}</div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="sui-input" type="password" style={{ flex: 1 }} value={value}
          onChange={e => setValue(e.target.value)} placeholder="Enter new value…" />
        <button className="sui-btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}
          disabled={!value.trim() || save.isPending}
          onClick={handleSave}>
          {save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Keys are stored securely in Supabase Vault — never in the database.</div>
    </div>
  )
}

export function ApiConfigPage() {
  const { data, isLoading } = useApiConfigStatus()
  const { success: ok, error: err } = useToast()
  const saveConfig = useSaveApiConfig()

  async function toggleAt() {
    try {
      await saveConfig.mutateAsync({ keyName: 'at_api_key', keyValue: '', enabled: !data?.atEnabled })
      ok(`Africa's Talking ${!data?.atEnabled ? 'enabled' : 'disabled'}.`)
    } catch (e: any) { err(e.message) }
  }

  async function toggleWa() {
    try {
      await saveConfig.mutateAsync({ keyName: 'wa_access_token', keyValue: '', enabled: !data?.waEnabled })
      ok(`WhatsApp ${!data?.waEnabled ? 'enabled' : 'disabled'}.`)
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 600 }}>
      <PageHeader
        title="SMS / WhatsApp"
        subtitle="Configure Africa's Talking (SMS) and WhatsApp Cloud API keys."
      />

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <>
          {/* Africa's Talking */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>Africa's Talking (SMS)</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>Used for SMS fee reminders to guardians.</div>
              </div>
              <button
                onClick={toggleAt}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: data?.atEnabled ? 'var(--success-bg)' : 'var(--surface2)',
                  color:      data?.atEnabled ? 'var(--success)'    : 'var(--txt3)',
                }}>
                {data?.atEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <ApiKeyRow label="API Key"   keyName="at_api_key"   savedLabel={data?.atEnabled ? '●●●●●●●●●●●●' : undefined} />
            <ApiKeyRow label="Username"  keyName="at_username"  savedLabel={data?.atEnabled ? '●●●●●●●●' : undefined} />
            <ApiKeyRow label="Sender ID" keyName="at_sender_id" />
          </div>

          {/* WhatsApp */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)' }}>WhatsApp Cloud API</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>Used for WhatsApp fee reminders and announcements.</div>
              </div>
              <button
                onClick={toggleWa}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: data?.waEnabled ? 'var(--success-bg)' : 'var(--surface2)',
                  color:      data?.waEnabled ? 'var(--success)'    : 'var(--txt3)',
                }}>
                {data?.waEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <ApiKeyRow label="Phone Number ID" keyName="wa_phone_number_id" />
            <ApiKeyRow label="Access Token"    keyName="wa_access_token"    savedLabel={data?.waEnabled ? '●●●●●●●●●●●●●●●●' : undefined} />
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: 12, color: 'var(--txt3)' }}>
            API keys are stored in Supabase Vault using a SECURITY DEFINER function. They are never returned in plain text after saving.
          </div>
        </>
      )}
    </div>
  )
}
