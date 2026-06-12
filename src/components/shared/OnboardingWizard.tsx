/**
 * OnboardingWizard — role-specific first-login wizard + school setup.
 *
 * Shows:
 *   • it_admin   : school setup (name/short_name/motto/color/logo → academic year → done)
 *   • principal  : welcome + academic year status check
 *   • dos        : welcome + subjects reminder
 *   • secretary  : welcome + classes reminder
 *   • deputy / bursar / teacher / class_teacher : simple welcome screen
 *
 * First-login detection: caller passes isFirstLogin=true when staff.last_login_at was NULL.
 * School-setup condition: schoolNeedsSetup=true when school_profile.school_name is empty.
 */

import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useSaveSchoolSettings } from '../../hooks/useAdmin'
import { uploadSchoolLogo } from '../../lib/storage'
import { applyBrandColor } from '../../lib/brandColor'
import type { UserRole } from '../../store/AuthContext'

// ── Design tokens ─────────────────────────────────────────────────────────────
const SWATCHES = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#10b981', '#6366f1', '#ec4899']

const CSS = `
  @keyframes ob-in   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ob-pop  { 0%{opacity:0;transform:scale(.75)} 70%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
  @keyframes ob-spin { to{transform:rotate(360deg)} }
  @keyframes ob-fade { from{opacity:0} to{opacity:1} }
  @keyframes ob-ping { 0%{transform:scale(1);opacity:.7} 70%{transform:scale(1.15);opacity:0} 100%{transform:scale(1);opacity:0} }
  @keyframes ob-shimmer { 0%{transform:translateX(-100%) skewX(-12deg)} 100%{transform:translateX(220%) skewX(-12deg)} }

  .ob-card { animation: ob-in .42s cubic-bezier(.2,.8,.4,1) both }
  .ob-card:nth-child(2) { animation-delay: .06s }
  .ob-card:nth-child(3) { animation-delay: .12s }

  .ob-badge-wrap:hover .ob-badge-ov { opacity:1 }
  .ob-badge-ov {
    position:absolute;inset:0;border-radius:50%;
    background:rgba(0,0,0,.42);display:flex;flex-direction:column;
    align-items:center;justify-content:center;gap:3px;
    opacity:0;transition:opacity .18s;cursor:pointer;
  }
  .ob-field label{display:block;font-size:10.5px;font-weight:700;color:var(--txt3);margin-bottom:5px;letter-spacing:.4px;text-transform:uppercase}
  .ob-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .ob-g2t{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  @media(max-width:520px){.ob-g2,.ob-g2t{grid-template-columns:1fr}}

  .ob-role-card{
    padding:14px 16px;border-radius:14px;border:1.5px solid var(--border);
    background:var(--surface);transition:all .2s cubic-bezier(.2,.8,.4,1);cursor:default;
  }
  .ob-role-card:hover{
    background:var(--surface2);
    border-color:rgba(13,148,136,.3);
    transform:translateY(-1px);
    box-shadow:0 4px 14px rgba(13,148,136,.1);
  }

  .ob-check-row{
    display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;
    background:var(--surface2);border:1px solid var(--border);
    transition:background .15s,border-color .15s;
  }
  .ob-check-row:hover{background:var(--surface);border-color:rgba(13,148,136,.2)}

  .ob-primary-btn{
    position:relative;overflow:hidden;
    width:100%;padding:13px 20px;border-radius:12px;border:none;cursor:pointer;
    font-weight:800;font-size:14px;font-family:var(--font2);
    display:flex;align-items:center;justify-content:center;gap:8px;
    transition:all .18s;
  }
  .ob-primary-btn:disabled{cursor:default}
  .ob-primary-btn::after{
    content:'';position:absolute;top:0;left:0;width:45%;height:100%;
    background:linear-gradient(90deg,transparent,rgba(255,255,255,.28),transparent);
    transform:translateX(-100%) skewX(-12deg);
    transition:none;pointer-events:none;
  }
  .ob-primary-btn:not(:disabled):hover::after{
    animation:ob-shimmer .55s ease forwards;
  }
  .ob-primary-btn:not(:disabled):hover{
    filter:brightness(1.06);
    box-shadow:0 6px 22px var(--ob-btn-shadow,rgba(13,148,136,.42));
    transform:translateY(-1px);
  }

  .ob-done-ping{
    position:absolute;inset:0;border-radius:50%;
    background:rgba(13,148,136,.35);
    animation:ob-ping 2s cubic-bezier(.4,0,.6,1) infinite;
    pointer-events:none;
  }

  /* Full-screen on mobile */
  @media(max-width:640px){
    .ob-shell-card{
      border-radius:0 !important;
      max-width:100% !important;
      width:100% !important;
      height:100dvh !important;
      display:flex !important;
      flex-direction:column !important;
    }
    .ob-shell-overlay{
      padding:0 !important;
      align-items:stretch !important;
    }
    .ob-shell-content{
      flex:1 !important;
      max-height:none !important;
    }
  }

  /* Stepper label overflow on narrow screens */
  @media(max-width:400px){
    .ob-stepper-label{ font-size:8px !important }
  }
`

// ── Shared primitives ─────────────────────────────────────────────────────────
function Spinner({ size = 14, color = '#fff' }: { size?: number; color?: string }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2.5px solid ${color}25`, borderTopColor: color, animation: 'ob-spin .6s linear infinite', flexShrink: 0 }} />
}

function PrimaryBtn({ onClick, disabled, loading, children, color = 'var(--brand)' }: {
  onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode; color?: string
}) {
  const isDisabled = disabled || loading
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className="ob-primary-btn"
      style={{
        background: isDisabled ? 'var(--surface2)' : color,
        color: isDisabled ? 'var(--txt3)' : '#fff',
        boxShadow: isDisabled ? 'none' : `0 4px 18px ${color === 'var(--brand)' ? 'rgba(13,148,136,.35)' : color + '40'}`,
        // expose shadow color to CSS hover rule
        ['--ob-btn-shadow' as string]: color === 'var(--brand)' ? 'rgba(13,148,136,.42)' : color + '55',
      }}
    >
      {loading ? <><Spinner /><span>Please wait…</span></> : children}
    </button>
  )
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: '0 0 auto', padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--border)',
      background: 'transparent', color: 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    }}>{children}</button>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return msg ? (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.25)', fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{msg}</div>
  ) : null
}

// ── Step indicators ───────────────────────────────────────────────────────────
function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 12, fontFamily: 'var(--font2)',
              background: current > i + 1 ? 'var(--brand)' : current === i + 1 ? 'rgba(13,148,136,.12)' : 'var(--surface2)',
              color:      current > i + 1 ? '#fff'          : current === i + 1 ? 'var(--brand)'           : 'var(--txt3)',
              border:     current === i + 1 ? '2px solid var(--brand)' : current > i + 1 ? 'none' : '2px solid var(--border)',
              boxShadow:  current === i + 1 ? '0 0 0 4px rgba(13,148,136,.1)' : 'none',
              transition: 'all .25s',
            }}>
              {current > i + 1
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : i + 1}
            </div>
            <span className="ob-stepper-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: .3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72, color: current === i + 1 ? 'var(--brand)' : current > i + 1 ? 'var(--txt2)' : 'var(--txt3)' }}>{label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ flex: 1, height: 2, background: current > i + 1 ? 'var(--brand)' : 'var(--border)', margin: '-16px 6px 0', transition: 'background .3s' }} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Done screen (shared) ──────────────────────────────────────────────────────
function DoneScreen({ title, subtitle, cta, note, onDone }: {
  title: string; subtitle: string; cta: string; note?: string; onDone: () => void
}) {
  return (
    <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center', padding: '8px 0' }}>
      {/* checkmark with ping ring */}
      <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
        <div className="ob-done-ping" />
        <div style={{
          position: 'relative', width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--brand), #0f766e)',
          boxShadow: '0 8px 32px rgba(13,148,136,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'ob-pop .55s cubic-bezier(.34,1.56,.64,1) both',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 6, lineHeight: 1.65, maxWidth: 320, margin: '6px auto 0' }}>{subtitle}</div>
      </div>
      {note && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.25)', fontSize: 12, color: 'var(--warning)', fontWeight: 600, maxWidth: 340 }}>{note}</div>
      )}
      <button onClick={onDone} className="ob-primary-btn" style={{
        width: 'auto', padding: '13px 40px', marginTop: 4, fontSize: 15,
        background: 'var(--brand)', color: '#fff',
        boxShadow: '0 4px 18px rgba(13,148,136,.4)',
        ['--ob-btn-shadow' as string]: 'rgba(13,148,136,.42)',
      }}>{cta}</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// IT ADMIN WIZARD — School Setup
// ═══════════════════════════════════════════════════════════════════════════
function ItAdminWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const save = useSaveSchoolSettings()
  const logoRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [skippedYear, setSkippedYear] = useState(false)

  // Step 1 state
  const [name,   setName]   = useState('')
  const [short,  setShort]  = useState('')
  const [motto,  setMotto]  = useState('')
  const [color,  setColor]  = useState('#0d9488')
  const [logo,   setLogo]   = useState<string | null>(null)
  const [prev,   setPrev]   = useState<string | null>(null)
  const [upl,    setUpl]    = useState(false)
  const [saving, setSaving] = useState(false)
  const [err1,   setErr1]   = useState('')

  // Step 2 state
  const yr = new Date().getFullYear()
  const [yvals, setYvals] = useState({
    name: String(yr),
    startDate: `${yr}-01-01`, endDate: `${yr}-12-31`,
    term1Start: `${yr}-01-20`, term1End: `${yr}-04-20`,
    term2Start: `${yr}-05-06`, term2End: `${yr}-08-10`,
    term3Start: `${yr}-09-01`, term3End: `${yr}-12-05`,
  })
  const [ySaving, setYSaving] = useState(false)
  const [err2, setErr2] = useState('')

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !user) return
    setPrev(URL.createObjectURL(f)); setUpl(true)
    try { const url = await uploadSchoolLogo(user.schoolId, f); setLogo(url) }
    catch { setPrev(null) } finally { setUpl(false) }
  }

  async function saveSchool() {
    if (!name.trim()) { setErr1('School name is required.'); return }
    if (!short.trim()) { setErr1('Short name / abbreviation is required.'); return }
    setSaving(true); setErr1('')
    try {
      await save.mutateAsync({ schoolName: name.trim(), shortName: short.trim(), motto: motto.trim() || undefined, primaryColor: color, logoUrl: logo ?? undefined })
      applyBrandColor(color)
      setStep(2)
    } catch (e: any) { setErr1(e.message) } finally { setSaving(false) }
  }

  async function saveYear() {
    if (!yvals.name.trim()) { setErr2('Year name is required.'); return }
    setYSaving(true); setErr2('')
    try {
      const { error } = await supabase.from('academic_years').insert({
        school_id: user!.schoolId, label: yvals.name.trim(),
        start_date: yvals.startDate, end_date: yvals.endDate, is_active: true, survey_active: false,
        term1_start: yvals.term1Start, term1_end: yvals.term1End,
        term2_start: yvals.term2Start, term2_end: yvals.term2End,
        term3_start: yvals.term3Start, term3_end: yvals.term3End,
      })
      if (error) throw new Error(error.message)
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
      setStep(3)
    } catch (e: any) { setErr2(e.message) } finally { setYSaving(false) }
  }

  function finish() {
    void qc.invalidateQueries({ queryKey: ['school-settings', user?.schoolId] })
    void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
    onDone()
    window.location.reload()
  }

  const initial = name.trim()[0]?.toUpperCase() ?? null

  return (
    <>
      <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
      <WizardShell
        title="School Setup"
        subtitle="Configure your school before going live"
        steps={['School Info', 'Academic Year', 'Done']}
        currentStep={step}
        role="it_admin"
      >
        {step === 1 && (
          <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Set up your school</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>This appears on report cards, credentials, and the school badge.</div>
            </div>

            {/* Badge + logo upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div className="ob-badge-wrap" style={{ position: 'relative', flexShrink: 0 }} onClick={() => logoRef.current?.click()}>
                <div style={{
                  width: 68, height: 68, borderRadius: '50%', overflow: 'hidden',
                  background: prev ? 'transparent' : `linear-gradient(135deg, ${color}, ${color}bb)`,
                  border: '3px solid var(--surface)', boxShadow: `0 4px 18px ${color}40, 0 0 0 2px ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {prev ? <img src={prev} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : upl ? <Spinner size={20} color="#fff" />
                    : initial ? <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)' }}>{initial}</span>
                    : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffffcc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 21h18"/><path d="M9 21V7l3-3 3 3v14"/>
                        <path d="M3 21V10l6-6"/><path d="M21 21V10l-6-6"/>
                        <rect x="9" y="12" width="2" height="3"/><rect x="13" y="12" width="2" height="3"/>
                      </svg>
                  }
                </div>
                <div className="ob-badge-ov">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span style={{ fontSize: 8, fontWeight: 800, color: '#fff', letterSpacing: .4 }}>UPLOAD</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)' }}>School badge / crest</div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>PNG or SVG · square · 200×200px min</div>
                <button onClick={() => logoRef.current?.click()} style={{ marginTop: 7, padding: '5px 12px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--txt2)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {prev ? 'Change image' : 'Upload image'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="ob-field">
                <label>School Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="sui-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kampala Girls Grammar School" style={{ fontSize: 15, fontWeight: 700, fontFamily: 'var(--font2)' }} />
              </div>
              <div className="ob-g2">
                <div className="ob-field">
                  <label>Short Name / Abbrev. <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input className="sui-input" value={short} onChange={e => setShort(e.target.value.toUpperCase())} placeholder="e.g. KGGS" style={{ fontFamily: 'var(--font3)', fontWeight: 700 }} />
                  <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 3 }}>Prefix for staff & admission numbers.</div>
                </div>
                <div className="ob-field">
                  <label>Motto</label>
                  <input className="sui-input" value={motto} onChange={e => setMotto(e.target.value)} placeholder="e.g. Knowledge · Integrity" />
                </div>
              </div>
              <div className="ob-field">
                <label>Brand Colour</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {SWATCHES.map(c => (
                    <button key={c} onClick={() => { setColor(c); applyBrandColor(c) }} style={{
                      width: 26, height: 26, borderRadius: 7, border: 'none', cursor: 'pointer', background: c,
                      outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: 2,
                      transform: color === c ? 'scale(1.2)' : 'none',
                      boxShadow: color === c ? `0 4px 12px ${c}55` : 'none',
                      transition: 'all .14s cubic-bezier(.34,1.56,.64,1)',
                    }} />
                  ))}
                  <input type="color" value={color} onChange={e => { setColor(e.target.value); applyBrandColor(e.target.value) }} style={{ width: 26, height: 26, padding: 2, border: '1px solid var(--border)', borderRadius: 7, cursor: 'pointer' }} />
                </div>
              </div>
            </div>

            <ErrBox msg={err1} />
            <PrimaryBtn onClick={saveSchool} loading={saving} disabled={!name.trim() || !short.trim()} color={color}>
              Save &amp; Continue →
            </PrimaryBtn>
          </div>
        )}

        {step === 2 && (
          <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Set up the academic year</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>The active year is used across attendance, exams, fees and report cards.</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="ob-field">
                <label>Year Label <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input className="sui-input" value={yvals.name} onChange={e => setYvals(v => ({ ...v, name: e.target.value }))} placeholder={String(yr)} style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 16, width: 140 }} />
              </div>
              <div className="ob-g2">
                <div className="ob-field"><label>Year Start</label><input type="date" className="sui-input" value={yvals.startDate} onChange={e => setYvals(v => ({ ...v, startDate: e.target.value }))} /></div>
                <div className="ob-field"><label>Year End</label><input type="date" className="sui-input" value={yvals.endDate} onChange={e => setYvals(v => ({ ...v, endDate: e.target.value }))} /></div>
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Term Dates</div>
              {(['term1', 'term2', 'term3'] as const).map((t, i) => (
                <div key={t} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', marginBottom: 8 }}>Term {i + 1}</div>
                  <div className="ob-g2t">
                    <div className="ob-field"><label>Start</label><input type="date" className="sui-input" value={yvals[`${t}Start`]} onChange={e => setYvals(v => ({ ...v, [`${t}Start`]: e.target.value }))} /></div>
                    <div className="ob-field"><label>End</label><input type="date" className="sui-input" value={yvals[`${t}End`]} onChange={e => setYvals(v => ({ ...v, [`${t}End`]: e.target.value }))} /></div>
                  </div>
                </div>
              ))}
            </div>

            <ErrBox msg={err2} />
            <div style={{ display: 'flex', gap: 10 }}>
              <GhostBtn onClick={() => { setSkippedYear(true); setStep(3) }}>Skip for now</GhostBtn>
              <div style={{ flex: 1 }}>
                <PrimaryBtn onClick={saveYear} loading={ySaving} disabled={!yvals.name.trim()}>Create &amp; Activate →</PrimaryBtn>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <DoneScreen
            title={skippedYear ? 'School profile saved!' : 'School is ready!'}
            subtitle={skippedYear
              ? 'Create an academic year from Principal → Academic Years whenever you\'re ready.'
              : 'School profile and active academic year are configured. All modules are now live.'
            }
            note={skippedYear ? 'Without an active academic year, exams, fees and timetable will show empty.' : undefined}
            cta="Go to Dashboard →"
            onDone={finish}
          />
        )}
      </WizardShell>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPAL WIZARD — First login orientation
// ═══════════════════════════════════════════════════════════════════════════
function PrincipalWizard({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const CAPABILITIES = [
    { icon: '📋', title: 'Report Cards',     desc: 'Approve and release term report cards to parents and students.' },
    { icon: '📅', title: 'Academic Years',   desc: 'Manage terms, promote students at year end, toggle end-of-term surveys.' },
    { icon: '👥', title: 'Student Profiles', desc: 'View full academic history, fee records, discipline and attendance for every student.' },
    { icon: '📊', title: 'School Overview',  desc: 'Full performance analytics across all classes, subjects and terms.' },
  ]

  function finish() { onDone(); navigate('/principal/dashboard') }

  return (
    <WizardShell title="Principal Portal" subtitle="Welcome — here's your quick orientation" steps={['Your Role', 'Done']} currentStep={step} role="principal">
      {step === 1 && (
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Welcome, Principal</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>Your portal gives you oversight across the entire school. Here's what you can do.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAPABILITIES.map(c => (
              <div key={c.title} className="ob-role-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)', fontSize: 12, color: 'var(--brand)', fontWeight: 600, lineHeight: 1.6 }}>
            <strong>Next step:</strong> Go to Academic Years to set up the current year and activate it.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={finish}>Skip →</GhostBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={() => { setStep(2) }}>Got it →</PrimaryBtn></div>
          </div>
        </div>
      )}
      {step === 2 && (
        <DoneScreen
          title="You're all set!"
          subtitle="Your principal dashboard is ready. Head to Academic Years to activate the current term."
          cta="Go to Dashboard →"
          onDone={finish}
        />
      )}
    </WizardShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DOS WIZARD — First login orientation
// ═══════════════════════════════════════════════════════════════════════════
function DosWizard({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const CAPABILITIES = [
    { icon: '📚', title: 'Timetable',        desc: 'Build and publish the school timetable with drag-and-drop scheduling.' },
    { icon: '🧪', title: 'Exam Journals',    desc: 'Oversee all teacher exam journals and results across every class.' },
    { icon: '🏫', title: 'Departments & Subjects', desc: 'Create departments, assign subjects and link teachers.' },
    { icon: '📝', title: 'Surveys',          desc: 'Open end-of-term student surveys and view feedback analytics.' },
    { icon: '📋', title: 'Curriculum',       desc: 'Track topic coverage across all classes and terms.' },
  ]

  function finish() { onDone(); navigate('/dos/dashboard') }

  return (
    <WizardShell title="Director of Studies" subtitle="Welcome — here's your quick orientation" steps={['Your Role', 'First Steps', 'Done']} currentStep={step} role="dos">
      {step === 1 && (
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Welcome, Director of Studies</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>You manage academics, scheduling and curriculum for the whole school.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAPABILITIES.map(c => (
              <div key={c.title} className="ob-role-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={finish}>Skip →</GhostBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={() => setStep(2)}>Got it →</PrimaryBtn></div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>First things first</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>Before the timetable and exams work, the admin team needs to set up the foundation.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'IT Admin sets school name & active academic year', who: 'IT Admin' },
              { label: 'Secretary creates classes and streams', who: 'Secretary' },
              { label: 'You create departments and subjects', who: 'You' },
              { label: 'You assign subjects to classes and build the timetable', who: 'You' },
            ].map((item, i) => (
              <div key={i} className="ob-check-row">
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: item.who === 'You' ? 'var(--brand)' : 'var(--surface)',
                  border: `2px solid ${item.who === 'You' ? 'var(--brand)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: item.who === 'You' ? '#fff' : 'var(--txt3)' }}>{i + 1}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt)', lineHeight: 1.4 }}>{item.label}</div>
                  <div style={{ fontSize: 10.5, color: item.who === 'You' ? 'var(--brand)' : 'var(--txt3)', fontWeight: 700, marginTop: 2 }}>{item.who}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep(1)}>← Back</GhostBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={() => setStep(3)}>Start Exploring →</PrimaryBtn></div>
          </div>
        </div>
      )}
      {step === 3 && (
        <DoneScreen
          title="You're ready!"
          subtitle="Your DoS dashboard is live. Start by creating departments and subjects."
          cta="Go to Dashboard →"
          onDone={finish}
        />
      )}
    </WizardShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECRETARY WIZARD — First login orientation
// ═══════════════════════════════════════════════════════════════════════════
function SecretaryWizard({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const CAPABILITIES = [
    { icon: '🎓', title: 'Student Registration', desc: 'Enrol new students, upload photos and assign them to classes and streams.' },
    { icon: '👨‍🏫', title: 'Staff Registration',   desc: 'Register teachers, support staff, set roles and issue credentials.' },
    { icon: '🏛️', title: 'Classes & Streams',    desc: 'Create class levels and stream groups for each academic year.' },
    { icon: '🔑', title: 'Parent Credentials',   desc: 'Generate and send login credentials for parent portal access.' },
  ]

  function finish() { onDone(); navigate('/secretary/dashboard') }

  return (
    <WizardShell title="Secretary Portal" subtitle="Welcome — here's your quick orientation" steps={['Your Role', 'Checklist', 'Done']} currentStep={step} role="secretary">
      {step === 1 && (
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Welcome, Secretary</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>You're the backbone of student and staff records. Here's what you manage.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CAPABILITIES.map(c => (
              <div key={c.title} className="ob-role-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{c.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{c.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, lineHeight: 1.5 }}>{c.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={finish}>Skip →</GhostBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={() => setStep(2)}>Got it →</PrimaryBtn></div>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Setup checklist</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>Follow these steps to get the school ready for operations.</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'IT Admin configures school name and academic year', who: 'IT Admin', done: false },
              { label: 'Create classes (S.1 → S.6) for the active academic year', who: 'You', done: false },
              { label: 'Create streams within each class', who: 'You', done: false },
              { label: 'Register all students and assign to classes', who: 'You', done: false },
              { label: 'Register all teaching and support staff', who: 'You', done: false },
              { label: 'Generate parent login credentials', who: 'You', done: false },
            ].map((item, i) => (
              <div key={i} className="ob-check-row">
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: item.who === 'You' ? 'var(--brand)' : 'var(--surface)',
                  border: `2px solid ${item.who === 'You' ? 'var(--brand)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 8.5, fontWeight: 800, color: item.who === 'You' ? '#fff' : 'var(--txt3)' }}>{i + 1}</span>
                </div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--txt)', lineHeight: 1.4 }}>{item.label}</div>
                  <div style={{ fontSize: 10.5, color: item.who === 'You' ? 'var(--brand)' : 'var(--txt3)', fontWeight: 700, marginTop: 2 }}>{item.who}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <GhostBtn onClick={() => setStep(1)}>← Back</GhostBtn>
            <div style={{ flex: 1 }}><PrimaryBtn onClick={() => setStep(3)}>Ready to go →</PrimaryBtn></div>
          </div>
        </div>
      )}
      {step === 3 && (
        <DoneScreen
          title="Let's get started!"
          subtitle="Your secretary dashboard is ready. Begin by creating classes and enrolling students."
          cta="Go to Dashboard →"
          onDone={finish}
        />
      )}
    </WizardShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERIC STAFF WELCOME — deputy, bursar, teacher, class_teacher
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_INFO: Partial<Record<UserRole, { title: string; desc: string; caps: string[] }>> = {
  deputy: {
    title: 'Deputy Head Portal',
    desc: 'You oversee discipline, attendance and the school timetable.',
    caps: ['View and record discipline incidents', 'Monitor class attendance rates', 'Manage the school timetable', 'Send disciplinary notices to parents'],
  },
  bursar: {
    title: 'Bursar Portal',
    desc: 'You manage the full financial operations of the school.',
    caps: ['Record fee payments and track balances', 'Generate fee receipts and statements', 'Manage salary payments', 'Send fee reminders via SMS/WhatsApp'],
  },
  teacher: {
    title: 'Teacher Portal',
    desc: 'Your portal for exams, attendance, curriculum and parent messaging.',
    caps: ['Create exam journals and enter marks', 'Record class attendance', 'Track curriculum coverage', 'Message parents directly'],
  },
  class_teacher: {
    title: 'Class Teacher Portal',
    desc: 'Your portal for your class, exams, curriculum and parent messaging.',
    caps: ['Manage your class list and attendance', 'Create exam journals and enter marks', 'Track curriculum coverage', 'Message your students\' parents'],
  },
}

function StaffWelcome({ role, onDone }: { role: UserRole; onDone: () => void }) {
  const navigate = useNavigate()
  const info = ROLE_INFO[role] ?? { title: 'Welcome', desc: 'Your school management portal.', caps: [] }

  const dashPaths: Partial<Record<UserRole, string>> = {
    deputy: '/deputy/dashboard', bursar: '/bursar/dashboard',
    teacher: '/teacher/dashboard', class_teacher: '/teacher/dashboard',
  }

  function finish() { onDone(); navigate(dashPaths[role] ?? '/') }

  return (
    <WizardShell title={info.title} subtitle="First-login orientation" steps={['Welcome']} currentStep={1} role={role}>
      <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Welcome aboard</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 3 }}>{info.desc}</div>
        </div>
        {info.caps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {info.caps.map((cap, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 9, background: 'var(--surface2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.4 }}>{cap}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(13,148,136,.06)', border: '1px solid rgba(13,148,136,.2)', fontSize: 12, color: 'var(--brand)', fontWeight: 600, lineHeight: 1.6 }}>
          Your account password was set when your account was created. Change it any time in your Profile → Settings.
        </div>
        <PrimaryBtn onClick={finish}>Enter Dashboard →</PrimaryBtn>
      </div>
    </WizardShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// WIZARD SHELL — shared layout wrapper
// ═══════════════════════════════════════════════════════════════════════════
const ROLE_ACCENT: Partial<Record<UserRole, string>> = {
  it_admin:      'linear-gradient(135deg, #0d9488, #0f766e)',
  principal:     'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  dos:           'linear-gradient(135deg, #0ea5e9, #0284c7)',
  secretary:     'linear-gradient(135deg, #f59e0b, #d97706)',
  deputy:        'linear-gradient(135deg, #6366f1, #4f46e5)',
  bursar:        'linear-gradient(135deg, #10b981, #059669)',
  teacher:       'linear-gradient(135deg, #0d9488, #0ea5e9)',
  class_teacher: 'linear-gradient(135deg, #0d9488, #0ea5e9)',
}

function WizardShell({ title, subtitle, steps, currentStep, role, children }: {
  title: string; subtitle: string; steps: string[]; currentStep: number
  role: UserRole; children: React.ReactNode
}) {
  const accent = ROLE_ACCENT[role] ?? 'linear-gradient(135deg, var(--brand), #0f766e)'

  return (
    <>
      <style>{CSS}</style>
      <div className="ob-shell-overlay" style={{
        position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <div className="ob-shell-card" style={{
          width: '100%', maxWidth: 520,
          background: 'var(--surface)', borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,.16)', border: '1px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Header gradient with dot-grid overlay */}
          <div style={{ background: accent, padding: '20px 24px 18px', position: 'relative', overflow: 'hidden' }}>
            {/* dot-grid pattern */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(rgba(255,255,255,.2) 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
                </div>
                <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 13, color: '#fff', opacity: .9 }}>Shule</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)' }}>{title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', marginTop: 2 }}>{subtitle}</div>
              {steps.length > 1 && (
                <div style={{ marginTop: 16, background: 'rgba(0,0,0,.15)', borderRadius: 12, padding: '10px 14px' }}>
                  <Stepper steps={steps} current={currentStep} />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="ob-shell-content" style={{ padding: '22px 24px 26px', maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — role router + school-setup fallback
// ═══════════════════════════════════════════════════════════════════════════
interface OnboardingWizardProps {
  /** True when staff.last_login_at was NULL before being stamped — first login ever */
  isFirstLogin: boolean
  /** True when school_profile.school_name is blank — school not yet configured */
  schoolNeedsSetup: boolean
  /** Call this when the wizard is done to clear its trigger */
  onDone: () => void
}

export function OnboardingWizard({ isFirstLogin, schoolNeedsSetup, onDone }: OnboardingWizardProps) {
  const { user } = useAuth()
  if (!user) return null

  const role = user.role as UserRole

  // it_admin always sees school setup wizard when school isn't configured
  if (role === 'it_admin' && schoolNeedsSetup) {
    return <ItAdminWizard onDone={onDone} />
  }

  // First-login wizards for specific roles
  if (isFirstLogin) {
    if (role === 'principal')     return <PrincipalWizard onDone={onDone} />
    if (role === 'dos')           return <DosWizard onDone={onDone} />
    if (role === 'secretary')     return <SecretaryWizard onDone={onDone} />
    if (role === 'deputy' || role === 'bursar' || role === 'teacher' || role === 'class_teacher') {
      return <StaffWelcome role={role} onDone={onDone} />
    }
  }

  // Principal also sees a reminder if school isn't set up (can't fix, just inform)
  if (role === 'principal' && schoolNeedsSetup) {
    return (
      <WizardShell title="School Setup Pending" subtitle="The IT Admin needs to configure the school first" steps={[]} currentStep={1} role="principal">
        <div className="ob-card" style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', alignItems: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>School not configured yet</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 6, maxWidth: 300, lineHeight: 1.6 }}>
              The IT Admin needs to set the school name and create an academic year before the portal is fully functional.
            </div>
          </div>
          <button onClick={onDone} style={{ padding: '11px 28px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Continue anyway →
          </button>
        </div>
      </WizardShell>
    )
  }

  return null
}
