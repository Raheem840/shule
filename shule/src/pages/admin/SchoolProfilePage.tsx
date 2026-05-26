import { useState, useEffect } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useSchoolSettings, useSaveSchoolSettings } from '../../hooks/useAdmin'
import { useToast } from '../../components/ui/Toast'

export function SchoolProfilePage() {
  const { data, isLoading } = useSchoolSettings()
  const save = useSaveSchoolSettings()
  const { success: ok, error: err } = useToast()

  const [schoolName,  setSchoolName]  = useState('')
  const [shortName,   setShortName]   = useState('')
  const [motto,       setMotto]       = useState('')
  const [isDirty,     setIsDirty]     = useState(false)

  useEffect(() => {
    if (data) {
      setSchoolName(data.schoolName ?? '')
      setShortName(data.shortName  ?? '')
      setMotto(data.motto          ?? '')
      setIsDirty(false)
    }
  }, [data])

  function handleChange<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setIsDirty(true) }
  }

  async function handleSave() {
    try {
      await save.mutateAsync({ schoolName, shortName, motto })
      ok('School profile saved.')
      setIsDirty(false)
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <PageHeader
        title="School Profile"
        subtitle="Edit your school's name, short name, and motto."
      />

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && data && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>School Name</label>
            <input className="sui-input" style={{ width: '100%' }} value={schoolName}
              onChange={e => handleChange(setSchoolName)(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>Short Name / Abbreviation</label>
            <input className="sui-input" style={{ width: '100%' }} value={shortName}
              onChange={e => handleChange(setShortName)(e.target.value)}
              placeholder="e.g. NSSS" />
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>Used as prefix for admission numbers and staff IDs.</div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>School Motto</label>
            <input className="sui-input" style={{ width: '100%' }} value={motto}
              onChange={e => handleChange(setMotto)(e.target.value)}
              placeholder="e.g. Excellence Through Knowledge" />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
            <button className="sui-btn-primary"
              disabled={!isDirty || save.isPending}
              onClick={handleSave}>
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
            {!isDirty && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>No unsaved changes</span>}
          </div>
        </div>
      )}

      {!isLoading && data && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 12 }}>Current Values</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'School Name', value: data.schoolName },
              { label: 'Short Name',  value: data.shortName },
              { label: 'Motto',       value: data.motto },
              { label: 'Currency',    value: data.currency },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 2 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: f.value ? 'var(--txt)' : 'var(--txt3)', fontStyle: f.value ? 'normal' : 'italic' }}>{f.value || 'Not set'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
