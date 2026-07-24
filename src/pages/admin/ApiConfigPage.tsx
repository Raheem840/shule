import { useState } from 'react'
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
      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Keys are saved to your school's account and never shown in plain text again after saving.</div>
    </div>
  )
}

export function ApiConfigPage() {
  const { data, isLoading } = useApiConfigStatus()
  const { success: ok, error: err } = useToast()
  const saveConfig = useSaveApiConfig()

  // "Enabled" here is purely derived from whether at_api_key/wa_access_token
  // is non-null (see useApiConfigStatus) — there's no separate status flag
  // to flip. So this button's only real action is "disable" (wipe the saved
  // key); "enable" can only ever happen by saving a new key value below via
  // ApiKeyRow, which always sets enabled=true implicitly. A previous version
  // let this button fire with keyValue:'' in both directions — since
  // save_school_api_key's enabled&&value<>'' check fails on an empty string
  // either way, clicking to "enable" a not-yet-configured key silently did
  // nothing (false-success toast), and clicking an already-enabled key
  // silently wiped the saved credential with no warning.
  async function toggleAt() {
    if (!data?.atEnabled) {
      err('Enter and save an API key below first — there is nothing to enable yet.')
      return
    }
    if (!window.confirm("Disable Africa's Talking? This permanently deletes the saved API key — you'll need to re-enter it to turn SMS back on.")) return
    try {
      await saveConfig.mutateAsync({ keyName: 'at_api_key', keyValue: '', enabled: false })
      ok("Africa's Talking disabled.")
    } catch (e: any) { err(e.message) }
  }

  async function toggleWa() {
    if (!data?.waEnabled) {
      err('Enter and save an API key below first — there is nothing to enable yet.')
      return
    }
    if (!window.confirm('Disable WhatsApp? This permanently deletes the saved access token — you\'ll need to re-enter it to turn WhatsApp back on.')) return
    try {
      await saveConfig.mutateAsync({ keyName: 'wa_access_token', keyValue: '', enabled: false })
      ok('WhatsApp disabled.')
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>API Configuration</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Configure messaging API keys</p>
        </div>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <>
          <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
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
              <ApiKeyRow label="API Key"   keyName="at_api_key"   savedLabel={data?.atApiKeySet   ? '●●●●●●●●●●●●' : undefined} />
              <ApiKeyRow label="Username"  keyName="at_username"  savedLabel={data?.atUsernameSet ? '●●●●●●●●'     : undefined} />
              <ApiKeyRow label="Sender ID" keyName="at_sender_id" savedLabel={data?.atSenderIdSet ? '●●●●●'        : undefined} />
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
              <ApiKeyRow label="Phone Number ID" keyName="wa_phone_number_id" savedLabel={data?.waPhoneNumberIdSet ? '●●●●●●●●●●●●' : undefined} />
              <ApiKeyRow label="Access Token"    keyName="wa_access_token"    savedLabel={data?.waAccessTokenSet   ? '●●●●●●●●●●●●●●●●' : undefined} />
            </div>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10, fontSize: 12, color: 'var(--txt3)' }}>
            API keys are saved via a restricted database function only your school's IT Admin/Principal can call. They are never returned in plain text after saving.
          </div>
        </>
      )}
    </div>
  )
}
