import { useState, useEffect, useRef } from 'react'
import { useSchoolSettings, useSaveSchoolSettings } from '../../hooks/useAdmin'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { applyBrandColor } from '../../lib/brandColor'
import { uploadSchoolLogo } from '../../lib/storage'

const BRAND_SWATCHES = [
  '#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b',
  '#f43f5e', '#10b981', '#6366f1', '#ec4899',
]

const PAGE_CSS = `
  .spg-badge-wrap { position: relative; cursor: pointer; display: inline-block; }
  .spg-badge-wrap:hover .spg-badge-ov { opacity: 1; }
  .spg-badge-ov {
    position: absolute; inset: 0; border-radius: 16px;
    background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s ease; gap: 4px;
  }
  @keyframes spg-up   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes spg-spin { to{transform:rotate(360deg)} }
`

export function SchoolProfilePage() {
  const { data, isLoading, isError, error } = useSchoolSettings()
  const save = useSaveSchoolSettings()
  const { success: ok, error: err } = useToast()
  const { user } = useAuth()
  const logoRef = useRef<HTMLInputElement>(null)

  const [editMode,     setEditMode]     = useState(false)
  const [schoolName,   setSchoolName]   = useState('')
  const [shortName,    setShortName]    = useState('')
  const [motto,        setMotto]        = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0d9488')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)

  useEffect(() => {
    if (data) {
      setSchoolName(data.schoolName ?? '')
      setShortName(data.shortName  ?? '')
      setMotto(data.motto          ?? '')
      setPrimaryColor(data.primaryColor ?? '#0d9488')
      setLogoUrl(data.logoUrl ?? null)
      setLogoPreview(data.logoUrl ?? null)
      // Auto-open edit mode when school name hasn't been configured yet
      if (!data.schoolName) setEditMode(true)
      else setEditMode(false)
    }
  }, [data])

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file || !user) return
    setLogoPreview(URL.createObjectURL(file))
    setUploading(true)
    try {
      const url = await uploadSchoolLogo(user.schoolId, file)
      setLogoUrl(url)
      ok('Badge uploaded. Save to confirm.')
    } catch (e: any) {
      err(e.message)
      setLogoPreview(logoUrl)
    } finally { setUploading(false) }
  }

  async function handleSave() {
    const shortNameChanged = shortName.trim() !== (data?.shortName ?? '').trim()
    try {
      await save.mutateAsync({ schoolName, shortName, motto, primaryColor, logoUrl: logoUrl ?? undefined })
      applyBrandColor(primaryColor)
      if (shortNameChanged && shortName.trim()) {
        ok('School short name updated — all staff numbers have been refreshed.')
      } else {
        ok('School profile saved.')
      }
      setEditMode(false)
    } catch (e: any) { err(e.message) }
  }

  function handleCancel() {
    if (data) {
      setSchoolName(data.schoolName ?? '')
      setShortName(data.shortName ?? '')
      setMotto(data.motto ?? '')
      setPrimaryColor(data.primaryColor ?? '#0d9488')
      setLogoUrl(data.logoUrl ?? null)
      setLogoPreview(data.logoUrl ?? null)
    }
    setEditMode(false)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 10, color: 'var(--txt3)' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--brand)', animation: 'spg-spin 0.7s linear infinite' }} />
        Loading…
      </div>
    )
  }

  if (isError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 12, color: 'var(--txt3)' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>Could not load school profile</div>
        <div style={{ fontSize: 12, color: 'var(--txt3)', maxWidth: 400, textAlign: 'center' }}>
          {(error as Error)?.message ?? 'An unexpected error occurred. Please refresh the page.'}
        </div>
      </div>
    )
  }

  const schoolInitial = (schoolName || data?.schoolName || 'S').trim()[0]?.toUpperCase() ?? 'S'

  return (
    <>
      <style>{PAGE_CSS}</style>
      <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960, margin: '0 auto' }}>

        {/* ── Hero card ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        }}>
          <div style={{
            height: 80,
            background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}10 50%, rgba(139,92,246,0.08) 100%)`,
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
          </div>

          <div style={{ padding: '0 28px 28px', marginTop: -40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>

              {/* Badge — an uploaded crest/seal keeps its own outline (no circular
                  crop forced onto it); only the plain-initial fallback gets the
                  circular gradient avatar treatment. */}
              <div className="spg-badge-wrap" onClick={() => editMode && logoRef.current?.click()}>
                <div style={{
                  width: 80, height: 80, flexShrink: 0,
                  borderRadius: logoPreview ? 0 : '50%',
                  background: logoPreview ? 'transparent' : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}99 100%)`,
                  border: logoPreview ? 'none' : '3px solid var(--surface)',
                  boxShadow: logoPreview ? 'none' : `0 4px 20px ${primaryColor}35, 0 0 0 3px ${primaryColor}20`,
                  overflow: logoPreview ? 'visible' : 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 3px 10px rgba(0,0,0,.25))' }} />
                    : <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)' }}>{schoolInitial}</span>
                  }
                  {uploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: logoPreview ? 12 : '50%' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spg-spin 0.6s linear infinite' }} />
                    </div>
                  )}
                </div>
                {editMode && !uploading && (
                  <div className="spg-badge-ov">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: 0.4 }}>CHANGE</span>
                  </div>
                )}
              </div>

              {/* Info / name edit */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                {!editMode ? (
                  <>
                    <div style={{
                      fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)',
                      color: 'var(--txt)',
                      lineHeight: 1.2, marginBottom: 4,
                    }}>
                      {schoolName || <span style={{ color: 'var(--txt3)', fontWeight: 600, fontSize: 18 }}>Not configured — click Edit Profile</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {shortName && (
                        <span style={{
                          fontFamily: 'var(--font3)', fontSize: 11, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 6,
                          background: `${primaryColor}15`, color: primaryColor,
                          border: `1px solid ${primaryColor}25`,
                        }}>{shortName}</span>
                      )}
                      {motto && <span style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>"{motto}"</span>}
                    </div>
                  </>
                ) : (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>SCHOOL NAME ★</div>
                    <input className="sui-input" value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="Full school name"
                      style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font2)' }} />
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 4 }}>
                {!editMode ? (
                  <button onClick={() => setEditMode(true)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '9px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    border: '1.5px solid var(--border)', background: 'var(--surface)',
                    color: 'var(--txt2)', cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--brand)'; b.style.color = 'var(--brand)'; b.style.boxShadow = '0 4px 16px rgba(13,148,136,0.15)' }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--border)'; b.style.color = 'var(--txt2)'; b.style.boxShadow = 'none' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button onClick={handleCancel} style={{ padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt3)', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={handleSave} disabled={save.isPending || !schoolName.trim()} style={{
                      padding: '9px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                      border: 'none', cursor: 'pointer',
                      background: save.isPending || !schoolName.trim() ? 'var(--surface2)' : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
                      color: save.isPending || !schoolName.trim() ? 'var(--txt3)' : '#fff',
                      boxShadow: save.isPending ? 'none' : `0 4px 14px ${primaryColor}35`,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {save.isPending
                        ? <><div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spg-spin 0.6s linear infinite' }} />Saving…</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Save</>
                      }
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Edit form */}
            {editMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'spg-up 0.25s ease both' }}>

                {/* Logo upload */}
                <div onClick={() => logoRef.current?.click()} style={{
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  background: `${primaryColor}08`, border: `1px dashed ${primaryColor}30`,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${primaryColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                      {logoPreview ? 'Change school badge / crest' : 'Upload school badge / crest'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>PNG, JPG, SVG · 200×200px recommended</div>
                  </div>
                  {logoPreview && <img src={logoPreview} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, marginLeft: 'auto', border: '1px solid var(--border)' }} />}
                </div>

                <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>SHORT NAME</label>
                    <input className="sui-input" value={shortName} onChange={e => setShortName(e.target.value)} placeholder="e.g. KGGS" style={{ fontFamily: 'var(--font3)', fontWeight: 700 }} />
                    {shortName.trim() !== (data?.shortName ?? '').trim() && shortName.trim() ? (
                      <div style={{
                        marginTop: 6, padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                        display: 'flex', alignItems: 'flex-start', gap: 6,
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span style={{ fontSize: 10, color: '#d97706', lineHeight: 1.5 }}>
                          Changing this will update the prefix on new staff numbers going forward
                          (e.g. <strong>{data?.shortName || 'OLD'}/STAFF/{new Date().getFullYear()}/001</strong> → <strong>{shortName.trim()}/STAFF/{new Date().getFullYear()}/001</strong>). Admission numbers always use a fixed STU prefix and are unaffected.
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>Prefix for staff IDs. Admission numbers always use a fixed STU prefix.</div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>MOTTO</label>
                    <input className="sui-input" value={motto} onChange={e => setMotto(e.target.value)} placeholder="e.g. Knowledge · Integrity · Service" />
                  </div>
                </div>

                {/* Brand colour */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 8 }}>BRAND COLOUR</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {BRAND_SWATCHES.map(c => (
                      <button key={c} onClick={() => { setPrimaryColor(c); applyBrandColor(c) }} style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', background: c, flexShrink: 0, transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                        outline: primaryColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2,
                        transform: primaryColor === c ? 'scale(1.18)' : 'none',
                        boxShadow: primaryColor === c ? `0 4px 12px ${c}50` : 'none',
                      }} />
                    ))}
                    <input type="color" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); applyBrandColor(e.target.value) }}
                      style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
                    <input className="sui-input" value={primaryColor} onChange={e => { setPrimaryColor(e.target.value); applyBrandColor(e.target.value) }}
                      style={{ fontFamily: 'var(--font3)', fontSize: 12, width: 100 }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info tiles */}
        {!editMode && (
          <div className="mob-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animation: 'spg-up 0.3s ease both' }}>
            {[
              { label: 'Short Name', value: data?.shortName, mono: true },
              { label: 'Curriculum', value: data?.curriculum },
              { label: 'Currency',   value: data?.currency },
            ].map(tile => (
              <div key={tile.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{tile.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tile.value ? 'var(--txt)' : 'var(--txt3)', fontStyle: tile.value ? 'normal' : 'italic', fontFamily: tile.mono ? 'var(--font3)' : undefined }}>
                  {tile.value || 'Not set'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Motto strip */}
        {!editMode && data?.motto && (
          <div style={{
            background: `linear-gradient(135deg, ${primaryColor}0a 0%, rgba(139,92,246,0.04) 100%)`,
            border: `1px solid ${primaryColor}20`, borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 2, height: 32, background: `linear-gradient(180deg, ${primaryColor} 0%, rgba(139,92,246,0.6) 100%)`, borderRadius: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>School Motto</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: 'var(--txt)', fontFamily: 'var(--font2)' }}>"{data.motto}"</div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
