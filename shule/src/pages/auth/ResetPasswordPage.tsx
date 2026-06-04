import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function ResetPasswordPage() {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)
  const [hasSession, setHasSession] = useState(false)
  const navigate = useNavigate()

  // Supabase embeds the recovery token in the URL hash — detect it
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setHasSession(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setError(''); setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) { setError(err.message); return }
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0d4a47 100%)',
      padding: 24,
    }}>
      {/* Background circles */}
      <div style={{ position: 'fixed', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(13,148,136,.1)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(139,92,246,.08)', pointerEvents: 'none' }} />

      <div style={{
        background: 'rgba(255,255,255,.97)',
        borderRadius: 24, padding: '40px 44px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 32px 80px rgba(0,0,0,.35)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', letterSpacing: -.5 }}>Reset Password</span>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 18, color: 'var(--success)' }}>Password Updated!</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6 }}>Your password has been changed. Redirecting you to login…</div>
          </div>
        ) : !hasSession ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(245,158,11,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>Invalid or Expired Link</div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6 }}>This password reset link is invalid or has expired. Please request a new one from the login page.</div>
            <button onClick={() => navigate('/login')} style={{ padding: '10px 24px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--info))', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p style={{ fontSize: 13.5, color: 'var(--txt2)', margin: '0 0 4px', lineHeight: 1.6 }}>
              Enter your new password below. Use at least 8 characters.
            </p>

            {/* New password */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 7 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  className="sui-input"
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  required
                  style={{ width: '100%', paddingRight: 44, height: 46, fontSize: 14 }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex' }}>
                  {showPw
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Confirm */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--txt2)', marginBottom: 7 }}>Confirm Password</label>
              <input
                type={showPw ? 'text' : 'password'}
                className="sui-input"
                placeholder="Repeat new password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                required
                style={{ width: '100%', height: 46, fontSize: 14, borderColor: confirm && confirm !== password ? 'var(--danger)' : undefined }}
              />
              {confirm && confirm !== password && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>Passwords do not match</div>
              )}
            </div>

            {/* Strength bar */}
            {password && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[1,2,3,4].map(i => {
                  const strength = password.length >= 12 ? 4 : password.length >= 10 ? 3 : password.length >= 8 ? 2 : 1
                  const col = strength >= 4 ? 'var(--success)' : strength >= 3 ? 'var(--brand)' : strength >= 2 ? 'var(--warning)' : 'var(--danger)'
                  return <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: i <= strength ? col : 'var(--border)', transition: 'background .3s' }} />
                })}
              </div>
            )}

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,.06)', border: '1px solid rgba(244,63,94,.25)', borderRadius: 10, fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password || !confirm || password !== confirm}
              style={{ height: 48, borderRadius: 14, border: 'none', background: loading ? 'var(--border)' : 'linear-gradient(135deg,#0d9488,#0284c7)', color: '#fff', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: (!password || !confirm || password !== confirm) ? 0.6 : 1, transition: 'all .2s', boxShadow: password && confirm && password === confirm ? '0 4px 16px rgba(13,148,136,.4)' : 'none' }}
            >
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
