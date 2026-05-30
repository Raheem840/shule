import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { UserRole } from '../../store/AuthContext'

// ── Decode JWT payload to read custom hook claims ─────────────
function decodeJWT(token: string): Record<string, any> {
  try {
    const base64 = token.split('.')[1]
    const padded  = base64.padEnd(
      base64.length + (4 - (base64.length % 4)) % 4, '='
    )
    const json = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return {}
  }
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

export function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // Forgot password modal state
  const [showForgot,   setShowForgot]   = useState(false)
  const [forgotEmail,  setForgotEmail]  = useState('')
  const [forgotSent,   setForgotSent]   = useState(false)
  const [forgotLoading,setForgotLoading]= useState(false)

  async function handleForgotPassword() {
    if (!forgotEmail.trim()) return
    setForgotLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setForgotSent(true)
    } catch { /* show success regardless to avoid email enumeration */ }
    finally { setForgotLoading(false) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Decode the access_token JWT — our custom hook stamps
    // user_role into app_metadata inside the token payload.
    // session.user.app_metadata is NOT updated by the hook,
    // only the token itself is, so we decode it manually.
    let session = data.session
    if (!session) {
      setError('No session returned. Please try again.')
      setLoading(false)
      return
    }

    if (import.meta.env.DEV) {
      try {
        const p = JSON.parse(atob(session.access_token.split('.')[1]))
        console.log('[AUTH DEBUG] JWT payload keys:', Object.keys(p))
        console.log('[AUTH DEBUG] user_role:', p.user_role)
        console.log('[AUTH DEBUG] school_id:', p.school_id)
        console.log('[AUTH DEBUG] app_metadata:', session.user.app_metadata)
      } catch (e) { console.error('[AUTH DEBUG] Failed to decode JWT', e) }
    }

    let jwt  = decodeJWT(session.access_token)
    let role = (jwt.user_role ?? jwt.app_metadata?.user_role) as UserRole | undefined

    if (!role) {
      // Claims not in first token — refresh once so the hook can stamp them
      console.log('[Shule Auth] Role missing after sign-in, refreshing session...')
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed.session) {
        session = refreshed.session
        jwt  = decodeJWT(session.access_token)
        role = (jwt.user_role ?? jwt.app_metadata?.user_role) as UserRole | undefined
        if (import.meta.env.DEV) {
          console.log('[AUTH DEBUG] After refresh — user_role:', jwt.user_role, 'app_metadata:', session.user.app_metadata)
        }
      }
    }

    if (!role) {
      setError('Account not linked to a school role. Contact your IT Admin.')
      setLoading(false)
      return
    }

    navigate(ROLE_HOME[role] ?? '/')
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
    }}>

      {/* ── Left — branding panel ── */}
      <div style={{
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem',
      }}>
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '3rem' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: 'linear-gradient(145deg,#0f766e 0%,#0891b2 55%,#0369a1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 24px rgba(13,148,136,0.45), 0 0 0 1px rgba(255,255,255,0.1) inset',
              position: 'relative', overflow: 'hidden', flexShrink: 0,
            }}>
              <svg width="28" height="28" viewBox="0 0 26 26" fill="none">
                <rect x="2" y="6" width="22" height="4" rx="2" fill="white"/>
                <rect x="8" y="10" width="10" height="7" rx="1.5" fill="white"/>
                <line x1="21" y1="8" x2="21" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.75"/>
                <circle cx="21" cy="19.5" r="2.2" fill="white" fillOpacity="0.75"/>
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: '1.2rem', fontWeight: 900,
                background: 'linear-gradient(135deg,#0dd9c4,#22d3ee)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Shule</div>
              <div style={{
                fontSize: 9, color: '#3a5470',
                letterSpacing: 2, textTransform: 'uppercase',
              }}>School Management System</div>
            </div>
          </div>

          {/* Headline */}
          <div style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: '2.2rem', fontWeight: 900,
            color: '#f8fafc', lineHeight: 1.2,
            letterSpacing: -1, marginBottom: '1rem',
          }}>
            Your school.<br />
            <span style={{ color: '#0dd9c4' }}>One platform.</span>
          </div>

          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.85 }}>
            Students · Fees · Exams · Attendance<br />
            Reports · Staff · Parent Portal
          </div>
        </div>

        {/* Country chips */}
        <div style={{ display: 'flex', gap: 8 }}>
          {['🇺🇬 Uganda', '🇰🇪 Kenya', '🇹🇿 Tanzania'].map(c => (
            <div key={c} style={{
              background: 'rgba(13,217,196,0.06)',
              border: '1px solid rgba(13,217,196,0.15)',
              borderRadius: 7, padding: '4px 10px',
              fontSize: 11, fontWeight: 700, color: '#0dd9c4',
            }}>{c}</div>
          ))}
        </div>
      </div>

      {/* ── Right — login form ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', padding: '2rem',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }}>

          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: '1.25rem', fontWeight: 900,
              color: '#0f172a', marginBottom: 4,
            }}>Welcome back</div>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Sign in to your school account
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, fontWeight: 700,
                color: '#475569', marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: 0.5,
                fontFamily: 'Space Grotesk, sans-serif',
              }}>Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@school.ac.ug"
                style={{
                  width: '100%', padding: '0.6rem 0.85rem',
                  background: '#fff', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, fontSize: 13,
                  fontFamily: 'inherit', color: '#0f172a',
                  outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = '#0d9488')}
                onBlur={e  => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, fontWeight: 700, color: '#475569',
                marginBottom: 6, textTransform: 'uppercase',
                letterSpacing: 0.5, fontFamily: 'Space Grotesk, sans-serif',
              }}>
                Password
                <span
                  onClick={() => { setShowForgot(true); setForgotSent(false); setForgotEmail('') }}
                  style={{
                    color: '#0d9488', fontWeight: 500,
                    textTransform: 'none', letterSpacing: 0, cursor: 'pointer',
                  }}
                >Forgot password?</span>
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '0.6rem 0.85rem',
                  background: '#fff', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, fontSize: 13,
                  fontFamily: 'inherit', color: '#0f172a', outline: 'none',
                }}
                onFocus={e => (e.target.style.borderColor = '#0d9488')}
                onBlur={e  => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                padding: '0.65rem 0.85rem',
                background: '#ffe4e6', border: '1px solid #fecaca',
                borderRadius: 8, fontSize: 12.5,
                color: '#be123c', fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.72rem',
                background: loading
                  ? '#99d4cf'
                  : 'linear-gradient(135deg,#0d9488,#0f766e)',
                border: 'none', borderRadius: 10,
                fontFamily: 'Space Grotesk, sans-serif',
                fontSize: 13.5, fontWeight: 800,
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(13,148,136,0.3)',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in to Shule →'}
            </button>
          </form>

          {/* Footer note */}
          <div style={{
            marginTop: '1.25rem', padding: '0.75rem',
            background: '#f1f5f9', border: '1px solid #e2e8f0',
            borderRadius: 10, fontSize: 11.5,
            color: '#94a3b8', textAlign: 'center', lineHeight: 1.7,
          }}>
            New staff? Your IT Admin or Secretary<br />
            provides your login credentials.
          </div>

        </div>
      </div>
    </div>

    {/* ── Forgot Password modal ── */}
    {showForgot && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32,
          width: 420, maxWidth: '90vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        }}>
          {forgotSent ? (
            <>
              <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'rgba(13,148,136,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 8 }}>
                  Reset link sent
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  If <strong>{forgotEmail}</strong> is registered, a password reset link has been sent.<br/>
                  If you don't receive it within a few minutes, contact your <strong>IT Admin</strong> directly.
                </div>
              </div>
              <button
                onClick={() => setShowForgot(false)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10,
                  background: 'linear-gradient(135deg,#0d9488,#0f766e)',
                  color: '#fff', border: 'none', fontWeight: 800,
                  fontSize: 13, cursor: 'pointer',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                Back to Sign In
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', fontFamily: 'Space Grotesk, sans-serif', marginBottom: 6 }}>
                  Forgot your password?
                </div>
                <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                  Enter your school email and we'll send you a reset link. If email delivery isn't configured, contact your IT Admin.
                </div>
              </div>

              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6, fontFamily: 'Space Grotesk, sans-serif' }}>
                Email address
              </label>
              <input
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleForgotPassword() }}
                placeholder="name@school.ac.ug"
                autoFocus
                style={{
                  width: '100%', padding: '0.65rem 0.85rem', marginBottom: 16,
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  borderRadius: 10, fontSize: 13, fontFamily: 'inherit',
                  color: '#0f172a', outline: 'none',
                }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowForgot(false)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    color: '#475569', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleForgotPassword()}
                  disabled={!forgotEmail.trim() || forgotLoading}
                  style={{
                    flex: 2, padding: '10px', borderRadius: 10,
                    background: forgotEmail.trim() ? 'linear-gradient(135deg,#0d9488,#0f766e)' : '#e2e8f0',
                    color: forgotEmail.trim() ? '#fff' : '#94a3b8',
                    border: 'none', fontWeight: 800, fontSize: 13,
                    cursor: forgotEmail.trim() ? 'pointer' : 'default',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  )
}
