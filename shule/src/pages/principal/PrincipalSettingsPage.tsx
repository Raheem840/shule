import { useSchoolSettings } from '../../hooks/useAdmin'

export function PrincipalSettingsPage() {
  const { data: settings, isLoading } = useSchoolSettings()

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading settings…</div>
  if (!settings) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          School Settings
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Read-only view. Edits require IT Admin access.
        </div>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 28,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
      }}>
        <SettingRow label="School Name"   value={settings.schoolName} />
        <SettingRow label="Short Name"    value={settings.shortName ?? '—'} />
        <SettingRow label="Motto"         value={settings.motto ?? '—'} />
        <SettingRow label="Currency"      value={settings.currency} />
        <SettingRow label="Primary Color" value={settings.primaryColor} color={settings.primaryColor} />
        {settings.logoUrl && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 6 }}>Logo</div>
            <img
              src={settings.logoUrl}
              alt="School logo"
              style={{ height: 48, width: 'auto', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)' }}
            />
          </div>
        )}
      </div>

      <div style={{
        padding: '12px 16px', background: 'var(--info-bg)', borderRadius: 10,
        border: '1px solid var(--info)', fontSize: 13, color: 'var(--info)',
      }}>
        To change school settings, contact your IT Administrator (/admin/school).
      </div>
    </div>
  )
}

function SettingRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {color && (
          <div style={{ width: 16, height: 16, borderRadius: 4, background: color, border: '1px solid var(--border)' }} />
        )}
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{value}</span>
      </div>
    </div>
  )
}
