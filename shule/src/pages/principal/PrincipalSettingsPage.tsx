import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/ui/PageHeader'
import { useToast } from '../../components/ui/Toast'

function useSaveSchoolProfile() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: { schoolName: string; shortName: string; motto: string; primaryColor: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('school_profile')
        .update({
          school_name:   updates.schoolName,
          short_name:    updates.shortName || null,
          motto:         updates.motto     || null,
          primary_color: updates.primaryColor,
        })
        .eq('id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-settings'] })
    },
  })
}

export function PrincipalSettingsPage() {
  const { data: settings, isLoading } = useSchoolSettings()
  const { success: ok, error: err } = useToast()
  const save = useSaveSchoolProfile()

  const [schoolName,   setSchoolName]   = useState('')
  const [shortName,    setShortName]    = useState('')
  const [motto,        setMotto]        = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0d9488')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (settings) {
      setSchoolName(settings.schoolName ?? '')
      setShortName(settings.shortName ?? '')
      setMotto(settings.motto ?? '')
      setPrimaryColor(settings.primaryColor ?? '#0d9488')
      setDirty(false)
    }
  }, [settings])

  function markDirty() { setDirty(true) }

  async function handleSave() {
    try {
      await save.mutateAsync({ schoolName, shortName, motto, primaryColor })
      ok('School profile updated.')
      setDirty(false)
    } catch (e: any) { err(e.message) }
  }

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading settings…</div>
  if (!settings) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          title="School Settings"
          subtitle="Update your school's profile information."
        />
        {dirty && (
          <button
            onClick={handleSave}
            className="sui-btn-primary"
            disabled={save.isPending || !schoolName.trim()}
          >
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Basic info card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24,
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 4 }}>
          Basic Information
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormField label="School Name ★">
            <input
              className="sui-input"
              value={schoolName}
              onChange={e => { setSchoolName(e.target.value); markDirty() }}
              placeholder="Full school name"
            />
          </FormField>
          <FormField label="Short Name / Abbreviation">
            <input
              className="sui-input"
              value={shortName}
              onChange={e => { setShortName(e.target.value); markDirty() }}
              placeholder="e.g. KGGS"
            />
          </FormField>
          <FormField label="Motto">
            <input
              className="sui-input"
              value={motto}
              onChange={e => { setMotto(e.target.value); markDirty() }}
              placeholder="School motto"
              style={{ gridColumn: 'span 1' }}
            />
          </FormField>
          <FormField label="Primary Colour">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input
                type="color"
                value={primaryColor}
                onChange={e => { setPrimaryColor(e.target.value); markDirty() }}
                style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
              />
              <input
                className="sui-input"
                value={primaryColor}
                onChange={e => { setPrimaryColor(e.target.value); markDirty() }}
                style={{ fontFamily: 'var(--font3)', flex: 1 }}
                placeholder="#0d9488"
              />
              <div style={{ width: 32, height: 32, borderRadius: 8, background: primaryColor, border: '1px solid var(--border)', flexShrink: 0 }} />
            </div>
          </FormField>
        </div>
      </div>

      {/* Read-only info */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>
          Read-Only Information
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ReadRow label="Currency"    value={settings.currency} />
          <ReadRow label="School ID"   value={settings.id?.slice(0, 8) + '…'} mono />
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
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 10, fontSize: 12, color: 'var(--info)' }}>
          To change the logo, currency, or API integrations, contact your IT Administrator.
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ReadRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 3 }}>{label}</div>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', fontFamily: mono ? 'var(--font3)' : undefined }}>
        {value}
      </span>
    </div>
  )
}
