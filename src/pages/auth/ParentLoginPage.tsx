import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'

// ── Floating feature card ──────────────────────────────────────────────────
function FeatureCard({
  icon, label, sub, style,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      position: 'absolute',
      background: 'rgba(255,255,255,0.14)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.25)',
      borderRadius: 16,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      minWidth: 200,
      ...style,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
        background: 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', fontFamily: 'var(--font2)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

// ── Illustrated scene ──────────────────────────────────────────────────────
function ParentScene() {
  return (
    <svg viewBox="0 0 520 480" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 480, filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.2))' }}>
      {/* Ground */}
      <ellipse cx="260" cy="440" rx="220" ry="24" fill="rgba(255,255,255,0.08)" />

      {/* === PARENT FIGURE (left, teal dress) === */}
      {/* Body */}
      <rect x="108" y="240" width="72" height="110" rx="36" fill="#0d9488" />
      {/* Dress flare */}
      <path d="M100 310 Q144 360 188 310" fill="#0f766e" />
      {/* Neck */}
      <rect x="133" y="220" width="22" height="26" rx="11" fill="#FBBF8A" />
      {/* Head */}
      <circle cx="144" cy="198" r="34" fill="#FBBF8A" />
      {/* Hair */}
      <path d="M112 188 Q120 148 144 150 Q168 148 176 188 Q170 160 144 158 Q118 160 112 188Z" fill="#1a0a00" />
      {/* Hair bun */}
      <circle cx="144" cy="152" r="12" fill="#1a0a00" />
      {/* Eyes */}
      <circle cx="136" cy="196" r="4" fill="#1a0a00" />
      <circle cx="152" cy="196" r="4" fill="#1a0a00" />
      <circle cx="137.5" cy="194.5" r="1.5" fill="white" />
      <circle cx="153.5" cy="194.5" r="1.5" fill="white" />
      {/* Smile */}
      <path d="M137 206 Q144 214 151 206" stroke="#c87941" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Ears */}
      <ellipse cx="110" cy="198" rx="6" ry="8" fill="#FBBF8A" />
      <ellipse cx="178" cy="198" rx="6" ry="8" fill="#FBBF8A" />
      {/* Earrings */}
      <circle cx="110" cy="206" r="3" fill="#fcd34d" />
      <circle cx="178" cy="206" r="3" fill="#fcd34d" />
      {/* Left arm raised, holding tablet */}
      <path d="M108 270 Q70 250 60 230" stroke="#FBBF8A" strokeWidth="18" strokeLinecap="round" fill="none"/>
      {/* Right arm down */}
      <path d="M180 270 Q200 290 196 320" stroke="#FBBF8A" strokeWidth="18" strokeLinecap="round" fill="none"/>
      {/* Legs */}
      <rect x="120" y="344" width="20" height="70" rx="10" fill="#0f766e" />
      <rect x="148" y="344" width="20" height="70" rx="10" fill="#0f766e" />
      {/* Shoes */}
      <ellipse cx="130" cy="414" rx="16" ry="8" fill="#1a0a00" />
      <ellipse cx="158" cy="414" rx="16" ry="8" fill="#1a0a00" />
      {/* Tablet */}
      <rect x="28" y="210" width="44" height="56" rx="6" fill="#fff" />
      <rect x="32" y="214" width="36" height="44" rx="4" fill="#e0f7f4" />
      <rect x="36" y="220" width="28" height="4" rx="2" fill="#0d9488" />
      <rect x="36" y="228" width="20" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="36" y="234" width="24" height="3" rx="1.5" fill="#94a3b8" />
      <rect x="36" y="240" width="16" height="3" rx="1.5" fill="#0d9488" />
      <circle cx="48" cy="252" r="5" fill="#10b981" />

      {/* === CHILD FIGURE (right of parent) === */}
      {/* Body */}
      <rect x="200" y="290" width="54" height="80" rx="27" fill="#8b5cf6" />
      {/* Neck */}
      <rect x="220" y="274" width="16" height="20" rx="8" fill="#FBBF8A" />
      {/* Head */}
      <circle cx="228" cy="254" r="26" fill="#FBBF8A" />
      {/* Hair */}
      <path d="M204 246 Q210 214 228 215 Q246 214 252 246 Q247 224 228 222 Q209 224 204 246Z" fill="#7c3aed" />
      {/* Eyes */}
      <circle cx="221" cy="252" r="3.5" fill="#1a0a00" />
      <circle cx="235" cy="252" r="3.5" fill="#1a0a00" />
      <circle cx="222" cy="250.5" r="1.2" fill="white" />
      <circle cx="236" cy="250.5" r="1.2" fill="white" />
      {/* Smile */}
      <path d="M222 261 Q228 268 234 261" stroke="#c87941" strokeWidth="2" strokeLinecap="round" fill="none"/>
      {/* Arm holding school bag */}
      <path d="M254 308 Q278 300 284 290" stroke="#FBBF8A" strokeWidth="14" strokeLinecap="round" fill="none"/>
      {/* Left arm */}
      <path d="M200 308 Q182 300 184 330" stroke="#FBBF8A" strokeWidth="14" strokeLinecap="round" fill="none"/>
      {/* Legs */}
      <rect x="208" y="364" width="16" height="54" rx="8" fill="#7c3aed" />
      <rect x="230" y="364" width="16" height="54" rx="8" fill="#7c3aed" />
      <ellipse cx="216" cy="418" rx="14" ry="7" fill="#1a0a00" />
      <ellipse cx="238" cy="418" rx="14" ry="7" fill="#1a0a00" />
      {/* School bag */}
      <rect x="270" y="272" width="32" height="40" rx="8" fill="#f59e0b" />
      <rect x="278" y="268" width="16" height="8" rx="4" fill="#d97706" />
      <rect x="276" y="284" width="20" height="4" rx="2" fill="#d97706" />
      <circle cx="286" cy="295" r="4" fill="#d97706" />

      {/* === TEACHER FIGURE (far right, small) === */}
      <rect x="370" y="290" width="52" height="90" rx="26" fill="#0ea5e9" />
      <rect x="389" y="275" width="16" height="20" rx="8" fill="#e8b88a" />
      <circle cx="397" cy="255" r="25" fill="#e8b88a" />
      <path d="M374 247 Q379 218 397 220 Q415 218 420 247 Q415 228 397 226 Q379 228 374 247Z" fill="#334155" />
      <circle cx="390" cy="252" r="3.5" fill="#1a0a00" />
      <circle cx="404" cy="252" r="3.5" fill="#1a0a00" />
      <circle cx="391" cy="250.5" r="1.2" fill="white" />
      <circle cx="405" cy="250.5" r="1.2" fill="white" />
      <path d="M391 261 Q397 267 403 261" stroke="#c87941" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M370 310 Q350 300 346 285" stroke="#e8b88a" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M422 310 Q440 305 442 330" stroke="#e8b88a" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <rect x="378" y="374" width="16" height="50" rx="8" fill="#0284c7" />
      <rect x="400" y="374" width="16" height="50" rx="8" fill="#0284c7" />
      <ellipse cx="386" cy="424" rx="13" ry="7" fill="#1a0a00" />
      <ellipse cx="408" cy="424" rx="13" ry="7" fill="#1a0a00" />
      {/* Chalkboard */}
      <rect x="326" y="200" width="100" height="70" rx="8" fill="#1e293b" />
      <rect x="332" y="206" width="88" height="58" rx="4" fill="#273854" />
      <text x="376" y="228" fill="#94a3b8" fontSize="9" textAnchor="middle">Term 2 Results</text>
      <rect x="340" y="234" width="72" height="3" rx="1.5" fill="#0d9488" />
      <rect x="340" y="242" width="56" height="3" rx="1.5" fill="#475569" />
      <rect x="340" y="250" width="64" height="3" rx="1.5" fill="#475569" />
      <path d="M344 258 L360 258" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"/>
      {/* Chalk arrow up */}
      <path d="M370 258 L376 250 L382 258" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M376 250 L376 262" stroke="#10b981" strokeWidth="2" strokeLinecap="round"/>

      {/* Stars / sparkles */}
      <circle cx="80" cy="140" r="4" fill="rgba(255,255,255,0.6)" />
      <circle cx="460" cy="160" r="3" fill="rgba(255,255,255,0.5)" />
      <circle cx="300" cy="90" r="5" fill="rgba(255,255,255,0.4)" />
      <circle cx="170" cy="80" r="3" fill="rgba(255,255,255,0.6)" />
      <circle cx="440" cy="380" r="3.5" fill="rgba(255,255,255,0.4)" />

      {/* Dotted path connecting parent+child to school */}
      <path d="M190 380 Q250 420 340 400" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeDasharray="6 5" fill="none" />
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function ParentLoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const [showForgot,   setShowForgot]   = useState(false)
  const [resetEmail,   setResetEmail]   = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent,    setResetSent]    = useState(false)

  const navigate  = useNavigate()
  const { user }  = useAuth()

  async function handleEmailReset() {
    if (!resetEmail.trim() || resetSending) return
    setResetSending(true)
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch {
      // Deliberately ignored — same neutral confirmation either way, so no
      // information about account existence ever leaks.
    } finally {
      setResetSending(false)
      setResetSent(true)
    }
  }

  // Already logged in as parent → go straight to portal
  useEffect(() => {
    if (user?.role === 'parent') navigate('/parent/portal', { replace: true })
  }, [user, navigate])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (authErr) { setError('Incorrect email or password. Please try again.'); return }

      const role = data.user?.app_metadata?.user_role ?? data.session?.user?.app_metadata?.user_role
      if (role !== 'parent') {
        await supabase.auth.signOut()
        setError('This login is for parents only. Please use the staff login page.')
        return
      }
      navigate('/parent/portal', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: '#f8fafc',
      fontFamily: 'var(--font)',
    }}>
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(145deg, #0d9488 0%, #0284c7 55%, #7c3aed 100%)',
        padding: '48px 40px',
        position: 'relative', overflow: 'hidden',
        minHeight: '100vh',
      }}>
        {/* Background circles */}
        <div style={{ position: 'absolute', top: -120, left: -120, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, alignSelf: 'flex-start' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: -0.5 }}>
              Shule
            </span>
          </div>

          {/* Headline */}
          <div style={{ alignSelf: 'flex-start', marginBottom: 8 }}>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 34, color: '#fff', margin: 0, letterSpacing: -1, lineHeight: 1.15 }}>
              Stay connected<br />to your child's
            </h1>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 34, margin: '0 0 10px', letterSpacing: -1, lineHeight: 1.15, background: 'linear-gradient(90deg,#fcd34d,#fb923c)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              education.
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 15, margin: 0, lineHeight: 1.6, maxWidth: 400 }}>
              View report cards, track fees, monitor attendance and stay up to date — all in one place.
            </p>
          </div>

          {/* Illustration */}
          <div style={{ position: 'relative', width: '100%', margin: '16px 0' }}>
            <ParentScene />

            {/* Floating feature cards */}
            <FeatureCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fcd34d" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
              label="Report Cards"
              sub="Released term results"
              style={{ top: 20, right: -16, zIndex: 2 }}
            />
            <FeatureCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
              label="Fee Balance"
              sub="Payments & receipts"
              style={{ bottom: 60, left: -16, zIndex: 2 }}
            />
            <FeatureCard
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
              label="Attendance"
              sub="Daily school records"
              style={{ bottom: 20, right: 8, zIndex: 2 }}
            />
          </div>

          {/* Testimonial pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 99, padding: '8px 16px 8px 8px',
            alignSelf: 'flex-start',
          }}>
            {/* Avatar stack */}
            <div style={{ display: 'flex' }}>
              {['#0d9488','#8b5cf6','#f59e0b'].map((c, i) => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,0.3)', marginLeft: i > 0 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                  {['M','S','A'][i]}
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
              1,200+ parents already using Shule
            </span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div style={{
        width: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '48px 48px',
        background: '#fff',
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Header */}
          <div style={{ marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
              borderRadius: 99, padding: '4px 12px', marginBottom: 16,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', letterSpacing: 0.3 }}>PARENT PORTAL</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 28, color: 'var(--txt)', margin: '0 0 8px', letterSpacing: -0.5 }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: 'var(--txt3)', margin: 0, lineHeight: 1.6 }}>
              Sign in with the credentials provided by your child's school.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 7 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)', pointerEvents: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <input
                  type="email"
                  className="sui-input"
                  placeholder="you@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  required
                  autoComplete="email"
                  style={{ width: '100%', paddingLeft: 42, height: 48, fontSize: 14 }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 7 }}>
                Password
                <button type="button"
                  onClick={() => { setShowForgot(true); setResetSent(false); setResetEmail('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--brand)', fontWeight: 700, fontFamily: 'inherit', padding: 0 }}
                >Forgot password?</button>
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--txt3)', pointerEvents: 'none' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="sui-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  autoComplete="current-password"
                  style={{ width: '100%', paddingLeft: 42, paddingRight: 48, height: 48, fontSize: 14 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 4 }}
                >
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.25)',
                borderRadius: 10, padding: '10px 14px',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 13, color: 'var(--danger)', lineHeight: 1.5 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              style={{
                width: '100%', height: 50, borderRadius: 14, border: 'none',
                background: loading ? 'var(--border)' : 'linear-gradient(135deg, #0d9488, #0284c7)',
                color: '#fff', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15,
                cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
                opacity: !email || !password ? 0.6 : 1,
                transition: 'all 0.2s',
                boxShadow: loading || !email || !password ? 'none' : '0 4px 20px rgba(13,148,136,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  Signing in…
                </>
              ) : (
                <>
                  Sign In to Portal
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Help text */}
          <div style={{
            marginTop: 28, padding: '16px 18px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6 }}>
              🔑 Need your login credentials?
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.7 }}>
              Your email and password were provided by the school secretary when your child was registered. Contact the school office if you haven't received them.
            </div>
          </div>

          {/* Staff login link */}
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <a href="/login" style={{ fontSize: 12, color: 'var(--txt3)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Are you a staff member? Sign in here
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .parent-left { display: none !important; }
          .parent-right { width: 100% !important; padding: 32px 24px !important; }
        }
      `}</style>

      {/* ── Forgot password modal ────────────────────────────────────────── */}
      {showForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(15,23,42,.35)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
          onClick={e => e.target === e.currentTarget && setShowForgot(false)}
        >
          <div style={{
            width: '100%', maxWidth: 420,
            background: '#fff', borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(15,23,42,.22)',
          }}>
            <div style={{ padding: '20px 22px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)' }}>Reset your password</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>We'll email you a secure reset link</div>
            </div>
            <div style={{ padding: '20px 22px 22px' }}>
              {resetSent ? (
                <>
                  <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.7, marginBottom: 18 }}>
                    If <strong style={{ color: 'var(--txt)' }}>{resetEmail.trim()}</strong> is on file, a reset link is on its way.
                    Didn't get one? Contact the school office for a manual reset.
                  </div>
                  <button onClick={() => setShowForgot(false)}
                    style={{ width: '100%', height: 46, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#0d9488,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >Back to Sign In</button>
                </>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 7 }}>Email address</label>
                  <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleEmailReset() }}
                    placeholder="you@email.com" autoFocus
                    className="sui-input" style={{ width: '100%', marginBottom: 18 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" onClick={() => setShowForgot(false)}
                      style={{ flex: 1, height: 46, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >Cancel</button>
                    <button type="button" onClick={() => void handleEmailReset()}
                      disabled={!resetEmail.trim() || resetSending}
                      style={{ flex: 2, height: 46, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#0d9488,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!resetEmail.trim() || resetSending) ? 0.6 : 1 }}
                    >{resetSending ? 'Sending…' : 'Send Reset Link'}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
