import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../store/AuthContext'

// ── Decode JWT payload ─────────────────────────────────────────────────────────
function decodeJWT(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1]
    const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=')
    return JSON.parse(atob(padded.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return {} }
}

const ROLE_HOME: Record<UserRole, string> = {
  principal:     '/principal/dashboard',
  deputy:        '/deputy/dashboard',
  dos:           '/dos/dashboard',
  secretary:     '/secretary/dashboard',
  bursar:        '/bursar/dashboard',
  class_teacher: '/teacher/dashboard',
  teacher:       '/teacher/dashboard',
  student:       '/student/portal',
  parent:        '/parent/portal',
  it_admin:      '/admin/dashboard',
}

// ── Feature cards shown on the left panel ─────────────────────────────────────
const FEATURES = [
  {
    icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    title: 'Student Management',
    desc:  'Full student records, admissions, guardians, and portal access for parents.',
    color: '#0d9488',
  },
  {
    icon: 'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    title: 'Fee Collection',
    desc:  'Ledger, receipts, SMS reminders, and payment tracking — term by term.',
    color: '#f59e0b',
  },
  {
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    title: 'Exam Journals & Reports',
    desc:  'CBC-graded assessments, teacher remarks, and one-click PDF report cards.',
    color: '#8b5cf6',
  },
  {
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    title: 'Attendance & Timetables',
    desc:  'Daily register, discipline tracking, and drag-drop timetable builder.',
    color: '#0ea5e9',
  },
  {
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    title: 'Staff Messaging',
    desc:  'Real-time direct messages, school-wide announcements, and file sharing.',
    color: '#10b981',
  },
  {
    icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    title: 'Works Offline',
    desc:  'Runs on your school LAN — no internet required. Syncs when reconnected.',
    color: '#ec4899',
  },
] as const

// ── Animated feature ticker ────────────────────────────────────────────────────
function FeatureTicker() {
  const [idx, setIdx] = useState(0)
  const [fade, setFade] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setFade(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % FEATURES.length)
        setFade(true)
      }, 260)
    }, 3200)
    return () => clearInterval(t)
  }, [])

  const f = FEATURES[idx]
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      opacity: fade ? 1 : 0,
      transform: fade ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity .26s ease, transform .26s ease',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        background: `${f.color}22`, border: `1px solid ${f.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 16px ${f.color}28`,
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={f.icon}/>
        </svg>
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Space Grotesk, var(--font2)', marginBottom: 3, letterSpacing: -.2 }}>
          {f.title}
        </div>
        <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</div>
      </div>
    </div>
  )
}

// ── Animated orb component ─────────────────────────────────────────────────────
function Orb({ w, h, top, left, right, bottom, color, delay = 0 }: {
  w: number; h: number; top?: number|string; left?: number|string
  right?: number|string; bottom?: number|string; color: string; delay?: number
}) {
  return (
    <div style={{
      position: 'absolute', width: w, height: h,
      top, left, right, bottom,
      borderRadius: '50%',
      background: color,
      filter: 'blur(72px)',
      pointerEvents: 'none',
      animation: `loginOrbFloat ${14 + delay}s ease-in-out ${delay}s infinite`,
      willChange: 'transform',
    }}/>
  )
}

// ── Floating particle dots ─────────────────────────────────────────────────────
const DOTS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: (i * 17 + 11) % 100,
  y: (i * 31 + 7)  % 100,
  s: 1.5 + (i % 3) * .8,
  delay: (i * .4) % 4,
  dur:   6 + (i % 4) * 2,
}))

// ── CSS injected once ──────────────────────────────────────────────────────────
const PAGE_CSS = `
@keyframes loginOrbFloat {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(24px,-18px) scale(1.06); }
  66%      { transform: translate(-16px,14px) scale(.94); }
}
@keyframes loginDotFloat {
  0%,100% { transform: translateY(0); opacity:.35; }
  50%      { transform: translateY(-8px); opacity:.7; }
}
@keyframes loginCardIn {
  from { opacity:0; transform:translateY(28px) scale(.97); }
  to   { opacity:1; transform:none; }
}
@keyframes loginShimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}
@keyframes loginBrandIn {
  from { opacity:0; transform:translateX(-16px); }
  to   { opacity:1; transform:none; }
}
@keyframes loginSpinRing {
  to { transform:rotate(360deg); }
}
@keyframes loginPulse {
  0%,100% { box-shadow:0 0 0 0 rgba(13,148,136,.4); }
  50%      { box-shadow:0 0 0 8px rgba(13,148,136,0); }
}
@keyframes loginFeatIn {
  from { opacity:0; transform:translateX(10px); }
  to   { opacity:1; transform:none; }
}

.login-input {
  width: 100%;
  padding: 0 16px;
  height: 48px;
  background: rgba(255,255,255,.06);
  border: 1.5px solid rgba(255,255,255,.1);
  border-radius: 14px;
  font-size: 14.5px;
  color: #f1f5f9;
  font-family: inherit;
  outline: none;
  transition: border-color .18s, background .18s, box-shadow .18s;
  box-sizing: border-box;
}
.login-input:focus {
  border-color: rgba(13,217,196,.55);
  background: rgba(255,255,255,.09);
  box-shadow: 0 0 0 3px rgba(13,217,196,.12);
}
.login-input::placeholder { color: rgba(148,163,184,.5); }

.login-btn {
  width: 100%; height: 50px; border: none; cursor: pointer;
  border-radius: 14px; font-size: 15px; font-weight: 800;
  font-family: Space Grotesk, var(--font2), sans-serif;
  color: #fff; position: relative; overflow: hidden;
  background: linear-gradient(135deg,#0d9488 0%,#0891b2 55%,#0369a1 100%);
  box-shadow: 0 6px 24px rgba(13,148,136,.42);
  transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s, opacity .15s;
}
.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 32px rgba(13,148,136,.52);
}
.login-btn:active:not(:disabled) { transform: scale(.97); }
.login-btn:disabled { opacity:.65; cursor:not-allowed; transform:none; }
.login-btn::after {
  content:''; position:absolute; inset:0;
  background: linear-gradient(105deg, transparent 38%, rgba(255,255,255,.18) 50%, transparent 62%);
  background-size: 200% 100%;
  animation: loginShimmer 2.4s linear infinite;
}

.login-feat-dot {
  width: 6px; height: 6px; border-radius: 50%;
  transition: background .3s;
  cursor: pointer;
}

@media (max-width: 768px) {
  .login-left { display: none !important; }
  .login-right { border-radius: 0 !important; }
  .login-page-root { grid-template-columns: 1fr !important; min-height: 100dvh !important; }
}
`

// ══════════════════════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════════════════════
export function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)
  const [featIdx,  setFeatIdx]  = useState(0)

  // Forgot password
  const [showForgot,    setShowForgot]    = useState(false)
  const [forgotEmail,   setForgotEmail]   = useState('')
  const [forgotSent,    setForgotSent]    = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  useEffect(() => { emailRef.current?.focus() }, [])

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setForgotSent(true)
    } catch { /* show success regardless */ }
    finally { setForgotLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) { setError(authError.message); setLoading(false); return }

    let session = data.session
    if (!session) { setError('No session returned. Please try again.'); setLoading(false); return }

    if (import.meta.env.DEV) {
      try {
        const p = JSON.parse(atob(session.access_token.split('.')[1]))
        console.log('[AUTH DEBUG] user_role:', p.user_role, '| school_id:', p.school_id)
      } catch (e) { console.error('[AUTH DEBUG] Failed to decode JWT', e) }
    }

    let jwt  = decodeJWT(session.access_token)
    let role = (jwt.user_role ?? jwt.app_metadata?.user_role) as UserRole | undefined

    if (!role) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed.session) {
        session = refreshed.session
        jwt  = decodeJWT(session.access_token)
        role = (jwt.user_role ?? jwt.app_metadata?.user_role) as UserRole | undefined
      }
    }

    if (!role) { setError('Account not linked to a school role. Contact your IT Admin.'); setLoading(false); return }
    navigate(ROLE_HOME[role] ?? '/')
  }

  return (
    <>
      <style>{PAGE_CSS}</style>

      {/* ─── Full-page dark canvas ─────────────────────────────────────────── */}
      <div className="login-page-root" style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        background: '#060d1a',
        fontFamily: 'Plus Jakarta Sans, sans-serif',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* ─── LEFT — animated showcase ──────────────────────────────────── */}
        <div className="login-left" style={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 52px',
          background: 'linear-gradient(160deg,#060d1a 0%,#0a1628 60%,#060d1a 100%)',
        }}>
          {/* Animated ambient orbs */}
          <Orb w={380} h={380} top={-80}  left={-80}  color="rgba(13,148,136,.22)"  delay={0}/>
          <Orb w={320} h={320} bottom={-60} right={-60} color="rgba(139,92,246,.18)"  delay={3}/>
          <Orb w={220} h={220} top="40%"  right={-40}  color="rgba(14,165,233,.14)"  delay={7}/>

          {/* Particle dots */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {DOTS.map(d => (
              <div key={d.id} style={{
                position: 'absolute',
                left:  `${d.x}%`,
                top:   `${d.y}%`,
                width:  d.s,
                height: d.s,
                borderRadius: '50%',
                background: 'rgba(13,217,196,.45)',
                animation: `loginDotFloat ${d.dur}s ease-in-out ${d.delay}s infinite`,
              }}/>
            ))}
          </div>

          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: `
              linear-gradient(rgba(13,217,196,.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(13,217,196,.03) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
          }}/>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Brand */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 13, marginBottom: 52,
              animation: 'loginBrandIn .7s cubic-bezier(.16,1,.3,1) both',
            }}>
              <div style={{
                width: 46, height: 46, borderRadius: 14,
                background: 'linear-gradient(145deg,#0f766e,#0891b2 55%,#0369a1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 28px rgba(13,148,136,.5), 0 0 0 1px rgba(255,255,255,.08) inset',
                animation: 'loginPulse 3s ease infinite',
              }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="2" y="6" width="22" height="4" rx="2" fill="white"/>
                  <rect x="8" y="10" width="10" height="7" rx="1.5" fill="white"/>
                  <line x1="21" y1="8" x2="21" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity=".75"/>
                  <circle cx="21" cy="19.5" r="2.2" fill="white" fillOpacity=".75"/>
                </svg>
              </div>
              <div>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '1.35rem', fontWeight: 900, letterSpacing: -.3,
                  background: 'linear-gradient(135deg,#0dd9c4,#22d3ee)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>Shule</div>
                <div style={{ fontSize: 9.5, color: '#334155', letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: 700, marginTop: 1 }}>
                  School Management
                </div>
              </div>
            </div>

            {/* Headline */}
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(1.9rem, 3vw, 2.6rem)',
              fontWeight: 900, color: '#f8fafc',
              lineHeight: 1.18, letterSpacing: -1.2, marginBottom: 18,
              animation: 'loginCardIn .8s .1s cubic-bezier(.16,1,.3,1) both',
            }}>
              One platform<br/>
              for every<br/>
              <span style={{
                background: 'linear-gradient(135deg,#0dd9c4 0%,#22d3ee 50%,#818cf8 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>school role.</span>
            </div>

            <div style={{
              fontSize: 13.5, color: '#475569', lineHeight: 1.8, marginBottom: 44,
              animation: 'loginCardIn .8s .18s cubic-bezier(.16,1,.3,1) both',
            }}>
              Designed for Ugandan secondary schools. Works offline.<br/>
              Principals, teachers, bursars, parents — all in one system.
            </div>

            {/* Feature ticker */}
            <div style={{
              animation: 'loginCardIn .8s .25s cubic-bezier(.16,1,.3,1) both',
              borderTop: '1px solid rgba(255,255,255,.05)',
              paddingTop: 28,
            }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18 }}>
                What's inside
              </div>
              <FeatureTicker />

              {/* Dot indicators */}
              <div style={{ display: 'flex', gap: 6, marginTop: 20 }}>
                {FEATURES.map((_, i) => (
                  <div
                    key={i}
                    className="login-feat-dot"
                    style={{ background: i === featIdx ? '#0dd9c4' : 'rgba(255,255,255,.12)' }}
                    onClick={() => setFeatIdx(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bottom region chips */}
          <div style={{
            position: 'relative', zIndex: 1,
            animation: 'loginCardIn .8s .35s cubic-bezier(.16,1,.3,1) both',
          }}>
            {/* Role tags */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, color: '#334155', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
                Built for every role
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {['Principal','Deputy','D.o.S','Secretary','Bursar','Teacher','Parent','Student'].map(r => (
                  <div key={r} style={{
                    padding: '4px 11px', borderRadius: 99,
                    background: 'rgba(13,217,196,.06)', border: '1px solid rgba(13,217,196,.14)',
                    fontSize: 11, fontWeight: 700, color: 'rgba(13,217,196,.7)',
                    letterSpacing: .2,
                  }}>{r}</div>
                ))}
              </div>
            </div>

            {/* Country chips */}
            <div style={{ display: 'flex', gap: 8 }}>
              {['🇺🇬 Uganda', '🇰🇪 Kenya', '🇹🇿 Tanzania'].map(c => (
                <div key={c} style={{
                  padding: '4px 11px', borderRadius: 7,
                  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
                  fontSize: 11, fontWeight: 600, color: '#475569',
                }}>{c}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RIGHT — login form ─────────────────────────────────────────── */}
        <div className="login-right" style={{
          position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2rem',
          background: 'linear-gradient(160deg,#0a1628 0%,#060d1a 100%)',
        }}>
          {/* Subtle ambient */}
          <Orb w={260} h={260} top={-60}  right={-60}  color="rgba(139,92,246,.1)"  delay={2}/>
          <Orb w={200} h={200} bottom={-50} left={-50}  color="rgba(13,148,136,.09)" delay={5}/>

          <div style={{
            width: '100%', maxWidth: 400, position: 'relative', zIndex: 1,
            animation: 'loginCardIn .7s .1s cubic-bezier(.16,1,.3,1) both',
          }}>
            {/* Form header */}
            <div style={{ marginBottom: 32 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 99, marginBottom: 18,
                background: 'rgba(13,217,196,.08)', border: '1px solid rgba(13,217,196,.18)',
                fontSize: 11, fontWeight: 700, color: '#0dd9c4', letterSpacing: .5,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0dd9c4', animation: 'loginPulse 2s ease infinite' }}/>
                Secure Sign In
              </div>
              <div style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 28, fontWeight: 900, color: '#f8fafc',
                letterSpacing: -.7, lineHeight: 1.1, marginBottom: 8,
              }}>
                Welcome back
              </div>
              <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                Sign in to your school account.<br/>
                Your credentials are provided by your IT Admin.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={e => { void handleLogin(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Email */}
              <div>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 700,
                  color: '#475569', marginBottom: 8,
                  textTransform: 'uppercase', letterSpacing: .8,
                }}>Email address</label>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input
                    ref={emailRef}
                    type="email" required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@school.ac.ug"
                    className="login-input"
                    style={{ paddingLeft: 42 }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 11, fontWeight: 700, color: '#475569',
                  marginBottom: 8, textTransform: 'uppercase', letterSpacing: .8,
                }}>
                  Password
                  <button
                    type="button"
                    onClick={() => { setShowForgot(true); setForgotSent(false); setForgotEmail('') }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, color: '#0dd9c4', fontWeight: 700,
                      textTransform: 'none', letterSpacing: 0, fontFamily: 'inherit',
                      padding: 0, transition: 'color .14s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#22d3ee')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#0dd9c4')}
                  >
                    Forgot password?
                  </button>
                </label>
                <div style={{ position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  <input
                    type={showPwd ? 'text' : 'password'} required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="login-input"
                    style={{ paddingLeft: 42, paddingRight: 44 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#475569', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'color .14s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#0dd9c4')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                    tabIndex={-1}
                  >
                    {showPwd ? (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.22)',
                  color: '#fca5a5', fontSize: 12.5, lineHeight: 1.5,
                  animation: 'loginCardIn .22s ease both',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="login-btn">
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'loginSpinRing .65s linear infinite' }}/>
                    Signing in…
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Sign in to Shule
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </span>
                )}
              </button>
            </form>

            {/* Footer hint */}
            <div style={{
              marginTop: 24,
              padding: '14px 16px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(255,255,255,.06)',
              borderRadius: 12,
              display: 'flex', alignItems: 'flex-start', gap: 11,
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(13,217,196,.1)', border: '1px solid rgba(13,217,196,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0dd9c4" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.65 }}>
                New to Shule? Your <span style={{ color: '#94a3b8', fontWeight: 700 }}>IT Admin</span> or <span style={{ color: '#94a3b8', fontWeight: 700 }}>Secretary</span> sets up your account.<br/>
                Contact them to receive your login credentials.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Forgot password modal ──────────────────────────────────────────── */}
      {showForgot && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          animation: 'loginCardIn .22s ease both',
        }}
          onClick={e => e.target === e.currentTarget && setShowForgot(false)}
        >
          <div style={{
            width: '100%', maxWidth: 440,
            background: '#0d1a2d',
            border: '1px solid rgba(255,255,255,.08)',
            borderRadius: 24, overflow: 'hidden',
            boxShadow: '0 24px 80px rgba(0,0,0,.5)',
            animation: 'loginCardIn .3s cubic-bezier(.16,1,.3,1) both',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '22px 24px 18px',
              background: 'linear-gradient(135deg,rgba(13,148,136,.12) 0%,transparent 100%)',
              borderBottom: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(13,217,196,.12)', border: '1px solid rgba(13,217,196,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0dd9c4" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Space Grotesk, sans-serif' }}>Reset password</div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>We'll send a link to your email</div>
              </div>
            </div>

            <div style={{ padding: '22px 24px 24px' }}>
              {forgotSent ? (
                <>
                  <div style={{ textAlign: 'center', padding: '8px 0 24px' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 20px rgba(16,185,129,.2)' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 10 }}>Reset link sent</div>
                    <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>
                      If <strong style={{ color: '#94a3b8' }}>{forgotEmail}</strong> is registered, a reset link has been sent.<br/>
                      Didn't receive it? Contact your <strong style={{ color: '#94a3b8' }}>IT Admin</strong> directly.
                    </div>
                  </div>
                  <button onClick={() => setShowForgot(false)} className="login-btn">
                    Back to Sign In
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 20 }}>
                    Enter your school email. If email delivery isn't configured, ask your IT Admin to reset your password directly.
                  </div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: .8, display: 'block', marginBottom: 8 }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleForgotPassword() }}
                    placeholder="name@school.ac.ug"
                    autoFocus
                    className="login-input"
                    style={{ marginBottom: 20 }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowForgot(false)}
                      style={{
                        flex: 1, height: 46, borderRadius: 12,
                        background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)',
                        color: '#94a3b8', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'background .14s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.09)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleForgotPassword()}
                      disabled={!forgotEmail.trim() || forgotLoading}
                      className="login-btn"
                      style={{ flex: 2 }}
                    >
                      {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
