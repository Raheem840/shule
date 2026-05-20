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
    const token = data.session?.access_token
    if (!token) {
      setError('No session returned. Please try again.')
      setLoading(false)
      return
    }

    const jwt  = decodeJWT(token)
    // Read from app_metadata (hook used {claims,app_metadata,user_role})
    // OR from top-level (hook used {claims,user_role}) — handle both.
    const role = (jwt.app_metadata?.user_role ?? jwt.user_role) as UserRole | undefined

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
              width: 42, height: 42, borderRadius: 10,
              background: 'linear-gradient(135deg,#0d9488,#0f766e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 18, fontWeight: 900, color: '#fff',
              boxShadow: '0 0 24px rgba(13,148,136,0.4)',
            }}>S</div>
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
                <span style={{
                  color: '#0d9488', fontWeight: 500,
                  textTransform: 'none', letterSpacing: 0, cursor: 'pointer',
                }}>Forgot password?</span>
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
  )
}
