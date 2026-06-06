import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { applyBrandColor } from '../../lib/brandColor'
import { uploadSchoolLogo } from '../../lib/storage'

// ─── Save mutation ─────────────────────────────────────────────────────────────
function useSave() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: { schoolName: string; shortName: string; motto: string; primaryColor: string; logoUrl?: string }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('school_profile')
        .update({
          school_name:   updates.schoolName,
          short_name:    updates.shortName || null,
          motto:         updates.motto     || null,
          primary_color: updates.primaryColor,
          ...(updates.logoUrl != null ? { logo_url: updates.logoUrl } : {}),
        })
        .eq('id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['school-settings'] })
      // DB trigger re-prefixes all staff numbers when short_name changes
      void qc.invalidateQueries({ queryKey: ['staff', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['next-staff-num', user?.schoolId] })
    },
  })
}

// ─── Portal access hooks ─────────────────────────────────────────────────────
function usePortalOpen(schoolId: string | undefined) {
  return useQuery({
    queryKey: ['portal-open', schoolId],
    enabled: !!schoolId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_profile')
        .select('parent_portal_open')
        .eq('id', schoolId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data?.parent_portal_open ?? true) as boolean
    },
  })
}

function useTogglePortal(schoolId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (open: boolean) => {
      const { error } = await supabase
        .from('school_profile')
        .update({ parent_portal_open: open })
        .eq('id', schoolId!)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['portal-open', schoolId] })
    },
  })
}

// ─── Settings CSS ─────────────────────────────────────────────────────────────
const SETTINGS_CSS = `
  .sts-badge-wrap { position: relative; cursor: pointer; display: inline-block; }
  .sts-badge-wrap:hover .sts-badge-overlay { opacity: 1; }
  .sts-badge-overlay {
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(0,0,0,0.45); backdrop-filter: blur(4px);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s ease;
    gap: 4px;
  }
  .sts-edit-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 20px; border-radius: 12px; font-size: 13px; font-weight: 700;
    border: 1.5px solid var(--border); background: var(--surface);
    color: var(--txt2); cursor: pointer;
    transition: all 0.18s cubic-bezier(0.34,1.56,0.64,1);
    font-family: var(--font1);
  }
  .sts-edit-btn:hover {
    border-color: var(--brand); color: var(--brand);
    background: rgba(13,148,136,0.06);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(13,148,136,0.15);
  }
  .sts-field-in { animation: stsFadeUp 0.22s ease both; }
  @keyframes stsFadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes stsSpin   { to{transform:rotate(360deg)} }
`

// ─── Colour swatches ──────────────────────────────────────────────────────────
const BRAND_SWATCHES = [
  '#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b',
  '#f43f5e', '#10b981', '#6366f1', '#ec4899',
]

export function PrincipalSettingsPage() {
  const { data: settings, isLoading } = useSchoolSettings()
  const { success: ok, error: err } = useToast()
  const save = useSave()
  const logoRef = useRef<HTMLInputElement>(null)

  const { user } = useAuth()
  const { data: portalOpen, isLoading: portalLoading } = usePortalOpen(user?.schoolId)
  const togglePortal = useTogglePortal(user?.schoolId)

  async function handlePortalToggle(open: boolean) {
    try {
      await togglePortal.mutateAsync(open)
      ok(open ? 'Parent portal is now open.' : 'Parent portal has been closed.')
    } catch (e: any) { err(e.message) }
  }

  const [editMode,     setEditMode]     = useState(false)
  const [schoolName,   setSchoolName]   = useState('')
  const [shortName,    setShortName]    = useState('')
  const [motto,        setMotto]        = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0d9488')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [uploading,    setUploading]    = useState(false)
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null)

  useEffect(() => {
    if (settings) {
      setSchoolName(settings.schoolName ?? '')
      setShortName(settings.shortName ?? '')
      setMotto(settings.motto ?? '')
      setPrimaryColor(settings.primaryColor ?? '#0d9488')
      setLogoUrl(settings.logoUrl ?? null)
      setLogoPreview(settings.logoUrl ?? null)
    }
  }, [settings])

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (!user) return
    const localPreview = URL.createObjectURL(file)
    setLogoPreview(localPreview)
    setUploading(true)
    try {
      const url = await uploadSchoolLogo(user.schoolId, file)
      setLogoUrl(url)
      ok('Badge uploaded. Save to confirm.')
    } catch (e: any) {
      err(e.message)
      setLogoPreview(logoUrl)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    const shortNameChanged = shortName.trim() !== (settings?.shortName ?? '').trim()
    try {
      await save.mutateAsync({ schoolName, shortName, motto, primaryColor, logoUrl: logoUrl ?? undefined })
      applyBrandColor(primaryColor)
      if (shortNameChanged && shortName.trim()) {
        ok('School short name updated — all staff numbers have been refreshed.')
      } else {
        ok('Settings saved.')
      }
      setEditMode(false)
    } catch (e: any) { err(e.message) }
  }

  function handleCancel() {
    if (settings) {
      setSchoolName(settings.schoolName ?? '')
      setShortName(settings.shortName ?? '')
      setMotto(settings.motto ?? '')
      setPrimaryColor(settings.primaryColor ?? '#0d9488')
      setLogoUrl(settings.logoUrl ?? null)
      setLogoPreview(settings.logoUrl ?? null)
    }
    setEditMode(false)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 10, color: 'var(--txt3)' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--brand)', animation: 'stsSpin 0.7s linear infinite' }} />
        Loading settings…
      </div>
    )
  }

  const schoolInitial = (schoolName || settings?.schoolName || 'S').trim()[0]?.toUpperCase() ?? 'S'

  return (
    <>
      <style>{SETTINGS_CSS}</style>
      <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

        {/* ── Identity Hero Card ── */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.05)',
        }}>
          {/* Gradient stripe header */}
          <div style={{
            height: 80,
            background: `linear-gradient(135deg, ${primaryColor}22 0%, ${primaryColor}10 50%, rgba(139,92,246,0.08) 100%)`,
            position: 'relative',
          }}>
            {/* Subtle pattern */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />
          </div>

          {/* Content */}
          <div style={{ padding: '0 28px 28px', marginTop: -40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, marginBottom: 20 }}>

              {/* Badge / Logo */}
              <div className="sts-badge-wrap" onClick={() => editMode && logoRef.current?.click()}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                  background: logoPreview ? 'transparent' : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}99 100%)`,
                  border: `3px solid var(--surface)`,
                  boxShadow: `0 4px 20px ${primaryColor}35, 0 0 0 3px ${primaryColor}20`,
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="School badge" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)' }}>{schoolInitial}</span>
                  }
                  {uploading && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'stsSpin 0.6s linear infinite' }} />
                    </div>
                  )}
                </div>
                {editMode && !uploading && (
                  <div className="sts-badge-overlay">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: 0.4 }}>CHANGE</span>
                  </div>
                )}
              </div>

              {/* School info */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                {!editMode ? (
                  <>
                    <div style={{
                      fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)',
                      color: 'var(--txt)',
                      lineHeight: 1.2, marginBottom: 4,
                    }}>
                      <span style={{ color: primaryColor }}>
                        {(settings?.schoolName || '').charAt(0)}
                      </span>
                      {(settings?.schoolName || 'Your School Name').slice(1)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {settings?.shortName && (
                        <span style={{
                          fontFamily: 'var(--font3)', fontSize: 11, fontWeight: 700,
                          padding: '2px 8px', borderRadius: 6,
                          background: `${primaryColor}15`, color: primaryColor,
                          border: `1px solid ${primaryColor}25`,
                        }}>
                          {settings.shortName}
                        </span>
                      )}
                      {settings?.motto && (
                        <span style={{ fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
                          "{settings.motto}"
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>SCHOOL NAME ★</div>
                    <input
                      className="sui-input sts-field-in"
                      value={schoolName}
                      onChange={e => setSchoolName(e.target.value)}
                      placeholder="Full school name"
                      style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font2)' }}
                    />
                  </div>
                )}
              </div>

              {/* Edit / Save button */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 4 }}>
                {!editMode ? (
                  <button className="sts-edit-btn" onClick={() => setEditMode(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button onClick={handleCancel} style={{
                      padding: '9px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                      border: '1.5px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--txt3)', cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={save.isPending || !schoolName.trim()}
                      style={{
                        padding: '9px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: save.isPending || !schoolName.trim()
                          ? 'var(--surface2)'
                          : `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}cc 100%)`,
                        color: save.isPending || !schoolName.trim() ? 'var(--txt3)' : '#fff',
                        boxShadow: save.isPending ? 'none' : `0 4px 14px ${primaryColor}35`,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {save.isPending ? (
                        <>
                          <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'stsSpin 0.6s linear infinite' }} />
                          Saving…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Edit mode fields */}
            {editMode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'stsFadeUp 0.25s ease both' }}>

                {/* Badge upload hint */}
                <div style={{
                  padding: '12px 16px', borderRadius: 12,
                  background: `${primaryColor}08`, border: `1px dashed ${primaryColor}30`,
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer',
                }}
                  onClick={() => logoRef.current?.click()}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: `${primaryColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primaryColor} strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                      {logoPreview ? 'Click to change the school badge' : 'Upload school badge / crest'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>PNG, JPG, SVG · Recommended 200×200px</div>
                  </div>
                  {logoPreview && (
                    <img src={logoPreview} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, marginLeft: 'auto', border: '1px solid var(--border)' }} />
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>SHORT NAME / ABBREVIATION</label>
                    <input className="sui-input" value={shortName}
                      onChange={e => setShortName(e.target.value)}
                      placeholder="e.g. KGGS" style={{ fontFamily: 'var(--font3)', fontWeight: 700 }} />
                    {shortName.trim() !== (settings?.shortName ?? '').trim() && shortName.trim() ? (
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
                          Changing this will update the prefix on all staff numbers
                          (e.g. <strong>{settings?.shortName || 'OLD'}/STAFF/001</strong> → <strong>{shortName.trim()}/STAFF/001</strong>)
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>Used as prefix for staff IDs and admission numbers.</div>
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5 }}>SCHOOL MOTTO</label>
                    <input className="sui-input" value={motto}
                      onChange={e => setMotto(e.target.value)}
                      placeholder="e.g. Knowledge · Integrity · Service" />
                  </div>
                </div>

                {/* Brand colour */}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 8 }}>BRAND COLOUR</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {BRAND_SWATCHES.map(c => (
                      <button key={c} onClick={() => { setPrimaryColor(c); applyBrandColor(c) }} style={{
                        width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: c, flexShrink: 0, transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                        outline: primaryColor === c ? `3px solid ${c}` : 'none',
                        outlineOffset: 2,
                        transform: primaryColor === c ? 'scale(1.18)' : 'none',
                        boxShadow: primaryColor === c ? `0 4px 12px ${c}50` : 'none',
                      }} />
                    ))}
                    <input type="color" value={primaryColor}
                      onChange={e => { setPrimaryColor(e.target.value); applyBrandColor(e.target.value) }}
                      style={{ width: 28, height: 28, padding: 2, border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }} />
                    <input className="sui-input"
                      value={primaryColor}
                      onChange={e => { setPrimaryColor(e.target.value); applyBrandColor(e.target.value) }}
                      style={{ fontFamily: 'var(--font3)', fontSize: 12, width: 100 }} />
                    <button type="button" onClick={() => { setPrimaryColor('#0d9488'); applyBrandColor('#0d9488') }}
                      style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', cursor: 'pointer' }}>
                      Reset
                    </button>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--txt3)' }}>Changes preview live — save to make permanent.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Info tiles (view mode only) ── */}
        {!editMode && (
          <div className="mob-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, animation: 'stsFadeUp 0.3s ease both' }}>
            {[
              { label: 'School Name', value: settings?.schoolName, icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
              { label: 'Abbreviation', value: settings?.shortName, icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', mono: true },
              { label: 'Brand Colour', value: settings?.primaryColor, icon: 'M12 2a10 10 0 100 20 10 10 0 000-20z', color: primaryColor },
            ].map(tile => (
              <div key={tile.label} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: tile.color ? tile.color + '18' : 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {tile.color ? (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: tile.color, boxShadow: `0 2px 6px ${tile.color}50` }} />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
                        <path d={tile.icon} />
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{tile.label}</span>
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700,
                  color: tile.value ? 'var(--txt)' : 'var(--txt3)',
                  fontStyle: tile.value ? 'normal' : 'italic',
                  fontFamily: tile.mono ? 'var(--font3)' : undefined,
                }}>
                  {tile.value || 'Not set'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Motto strip (view mode) ── */}
        {!editMode && settings?.motto && (
          <div style={{
            background: `linear-gradient(135deg, ${primaryColor}0a 0%, rgba(139,92,246,0.04) 100%)`,
            border: `1px solid ${primaryColor}20`,
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 2, height: 32, background: `linear-gradient(180deg, ${primaryColor} 0%, rgba(139,92,246,0.6) 100%)`,
              borderRadius: 2, flexShrink: 0,
            }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>School Motto</div>
              <div style={{ fontSize: 15, fontWeight: 700, fontStyle: 'italic', color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                "{settings.motto}"
              </div>
            </div>
          </div>
        )}

        {/* ── Read-only footer ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '14px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
            To update SMS/WhatsApp API keys, currency, or deploy settings — contact your IT Administrator.
          </span>
        </div>

        {/* ── Portal Access ── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 14 }}>Portal Access</div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            padding: '14px 16px', borderRadius: 12,
            background: portalOpen ? 'rgba(13,148,136,.04)' : 'rgba(244,63,94,.04)',
            border: `1px solid ${portalOpen ? 'rgba(13,148,136,.18)' : 'rgba(244,63,94,.18)'}`,
            transition: 'all .22s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={portalOpen ? 'var(--brand)' : 'var(--danger)'} strokeWidth="2" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>Parent Portal</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                  {portalOpen
                    ? 'Parents can log in and view their children\'s records'
                    : 'Portal is closed — parents cannot access the system'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{
                fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
                padding: '3px 10px', borderRadius: 99,
                color: portalOpen ? 'var(--brand)' : 'var(--danger)',
                background: portalOpen ? 'rgba(13,148,136,.12)' : 'rgba(244,63,94,.1)',
                border: `1px solid ${portalOpen ? 'rgba(13,148,136,.25)' : 'rgba(244,63,94,.2)'}`,
              }}>
                {portalOpen ? 'Open' : 'Closed'}
              </span>
              {portalLoading ? (
                <div style={{ width: 48, height: 26, borderRadius: 99, background: 'var(--border)' }} />
              ) : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={portalOpen ?? true}
                  disabled={togglePortal.isPending}
                  onClick={() => void handlePortalToggle(!(portalOpen ?? true))}
                  style={{
                    position: 'relative', width: 48, height: 26, borderRadius: 99,
                    background: portalOpen ? 'var(--brand)' : 'var(--border)',
                    border: 'none', cursor: togglePortal.isPending ? 'not-allowed' : 'pointer',
                    flexShrink: 0, transition: 'background .22s',
                    boxShadow: portalOpen ? '0 2px 8px rgba(13,148,136,.4)' : 'none',
                    opacity: togglePortal.isPending ? 0.5 : 1,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: portalOpen ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,.22)',
                    transition: 'left .22s cubic-bezier(.4,0,.2,1)',
                  }} />
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
