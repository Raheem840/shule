import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useRequestStaffPassword } from '../../hooks/useStaffPasswordRequests'
import type { UserRole } from '../../store/AuthContext'

// ── JWT helpers ────────────────────────────────────────────────────────────────
function decodeJWT(token: string): Record<string, any> {
  try {
    const b = token.split('.')[1]
    return JSON.parse(atob(b.padEnd(b.length + (4 - b.length % 4) % 4, '=').replace(/-/g,'+').replace(/_/g,'/')))
  } catch { return {} }
}
const ROLE_HOME: Record<UserRole, string> = {
  principal:'/principal/dashboard', deputy:'/deputy/dashboard', dos:'/dos/dashboard',
  secretary:'/secretary/dashboard', bursar:'/bursar/dashboard',
  class_teacher:'/teacher/dashboard', teacher:'/teacher/dashboard',
  student:'/student/portal', parent:'/parent/portal', it_admin:'/admin/dashboard',
}

// ── Static content ─────────────────────────────────────────────────────────────
const STATS = [
  { n: '9',     label: 'User roles',          icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z', color:'#0d9488' },
  { n: '100%',  label: 'Offline capable',     icon: 'M1 6s4-4 11-4 11 4 11 4M1 18s4-4 11-4 11 4 11 4M12 12a1 1 0 100-2 1 1 0 000 2z', color:'#8b5cf6' },
  { n: 'CBC',   label: 'Grading standard',    icon: 'M22 10v6M2 10l10-5 10 5-10 5z', color:'#f59e0b' },
]

const FEATURES = [
  { icon:'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', title:'Student Register',    desc:'Enrolment, profiles, guardians, portal access.', color:'#0d9488' },
  { icon:'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',                                                                  title:'Fee Management',     desc:'Ledger, receipts, balances, SMS reminders.',   color:'#f59e0b' },
  { icon:'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',                                                        title:'Exams & Report Cards', desc:'CBC journals, teacher remarks, PDF reports.', color:'#8b5cf6' },
  { icon:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',                                                   title:'Attendance',          desc:'Daily register, under-80% alerts, stats.',    color:'#0ea5e9' },
]

// ── Injected CSS ───────────────────────────────────────────────────────────────
const CSS = `
/* ── page wrapper ── */
.lp { min-height:100vh; display:grid; grid-template-columns:1fr 1fr; font-family:'Plus Jakarta Sans',sans-serif; overflow:hidden; }
@media(max-width:768px){ .lp{ grid-template-columns:1fr; } .lp-left{ display:none!important; } }

/* ── morphing blobs ── */
@keyframes lpBlob1 {
  0%,100%{ border-radius:60% 40% 70% 30%/50% 60% 40% 50%; transform:translate(0,0) scale(1); }
  33%    { border-radius:40% 60% 30% 70%/60% 40% 60% 40%; transform:translate(12px,-8px) scale(1.04); }
  66%    { border-radius:70% 30% 50% 50%/40% 70% 30% 60%; transform:translate(-8px,12px) scale(.97); }
}
@keyframes lpBlob2 {
  0%,100%{ border-radius:40% 60% 55% 45%/55% 45% 60% 40%; transform:translate(0,0); }
  40%    { border-radius:65% 35% 40% 60%/40% 55% 45% 60%; transform:translate(-14px,8px); }
  70%    { border-radius:35% 65% 60% 40%/60% 35% 65% 35%; transform:translate(10px,-14px); }
}
@keyframes lpBlob3 {
  0%,100%{ border-radius:50% 50% 30% 70%/30% 70% 50% 50%; }
  50%    { border-radius:70% 30% 60% 40%/50% 30% 70% 50%; }
}

/* ── stagger-in on mount ── */
@keyframes lpIn { from{ opacity:0; transform:translateY(20px); } to{ opacity:1; transform:none; } }

/* ── dot grid pattern ── */
.lp-dots {
  position:absolute; inset:0; pointer-events:none;
  background-image: radial-gradient(rgba(13,217,196,.08) 1.5px, transparent 1.5px);
  background-size: 28px 28px;
}

/* ── form inputs ── */
.lp-input {
  width:100%; height:50px; padding:0 44px 0 16px; box-sizing:border-box;
  border:1.5px solid #e2e8f0; border-radius:14px;
  background:#fff; color:#0f172a; font-size:14.5px; font-family:inherit;
  outline:none; transition:border-color .18s, box-shadow .18s, background .18s;
}
.lp-input:focus {
  border-color:#0d9488;
  box-shadow:0 0 0 3px rgba(13,148,136,.12);
  background:#f0fdfa;
}
.lp-input::placeholder { color:#94a3b8; }

/* ── submit button ── */
.lp-btn {
  width:100%; height:50px; border:none; cursor:pointer; border-radius:14px;
  font-family:'Space Grotesk',var(--font2),sans-serif;
  font-size:15px; font-weight:800; color:#fff;
  background:linear-gradient(135deg,#0d9488,#0891b2);
  box-shadow:0 6px 24px rgba(13,148,136,.35);
  position:relative; overflow:hidden;
  transition:transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .18s, opacity .15s;
}
.lp-btn:hover:not(:disabled){ transform:translateY(-2px); box-shadow:0 10px 32px rgba(13,148,136,.45); }
.lp-btn:active:not(:disabled){ transform:scale(.97); }
.lp-btn:disabled{ opacity:.65; cursor:not-allowed; transform:none; }
.lp-btn::after{
  content:''; position:absolute; inset:0;
  background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.25) 50%,transparent 62%);
  background-size:200% 100%;
  animation:lpShimmer 2.4s linear infinite;
}
@keyframes lpShimmer{ 0%{background-position:-200% center} 100%{background-position:200% center} }
@keyframes lpSpin { to{ transform:rotate(360deg); } }
`

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function LoginPage() {
  const navigate = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)
  const [featIdx,  setFeatIdx]  = useState(0)

  const [showForgot,      setShowForgot]      = useState(false)
  const [forgotEmail,     setForgotEmail]     = useState('')
  const [forgotStaffNum,  setForgotStaffNum]  = useState('')
  const [forgotPassword,  setForgotPassword]  = useState('')
  const [forgotSent,      setForgotSent]      = useState(false)
  const [forgotError,     setForgotError]     = useState('')

  const requestPassword = useRequestStaffPassword()

  const emailRef = useRef<HTMLInputElement>(null)
  useEffect(() => { emailRef.current?.focus() }, [])

  // Auto-cycle feature ticker
  useEffect(() => {
    const t = setInterval(() => setFeatIdx(i => (i + 1) % FEATURES.length), 3000)
    return () => clearInterval(t)
  }, [])

  async function handleForgotPassword() {
    if (!forgotEmail.trim() || !forgotStaffNum.trim() || forgotPassword.length < 8) return
    setForgotError('')
    try {
      await requestPassword.mutateAsync({
        email:        forgotEmail.trim(),
        staffNumber:  forgotStaffNum.trim(),
        newPassword:  forgotPassword,
      })
      setForgotSent(true)
    } catch (e) {
      setForgotError(e instanceof Error ? e.message : 'Something went wrong — please try again')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { data, error:authErr } = await supabase.auth.signInWithPassword({ email, password })
    if (authErr) { setError(authErr.message); setLoading(false); return }
    let session = data.session
    if (!session) { setError('No session returned. Please try again.'); setLoading(false); return }
    if (import.meta.env.DEV) {
      try { const p=JSON.parse(atob(session.access_token.split('.')[1])); console.log('[AUTH] role:',p.user_role,'school:',p.school_id) } catch {}
    }
    let jwt = decodeJWT(session.access_token)
    let role = (jwt.user_role ?? jwt.app_metadata?.user_role) as UserRole | undefined
    if (!role) {
      const { data:r } = await supabase.auth.refreshSession()
      if (r.session) { session=r.session; jwt=decodeJWT(session.access_token); role=(jwt.user_role??jwt.app_metadata?.user_role) as UserRole|undefined }
    }
    if (!role) { setError('Account not linked to a school role. Contact your IT Admin.'); setLoading(false); return }
    navigate(ROLE_HOME[role] ?? '/')
  }

  return (
    <>
      <style>{CSS}</style>

      <div className="lp">

        {/* ══════════════════════════════════════
            LEFT — animated illustration panel
        ══════════════════════════════════════ */}
        <div className="lp-left" style={{
          position:'relative', overflow:'hidden',
          /* Deeper, richer background so content stands out clearly */
          background:'linear-gradient(145deg,#0f172a 0%,#0a1628 55%,#0c1a30 100%)',
          display:'flex', flexDirection:'column',
          justifyContent:'space-between', padding:'48px 52px',
        }}>
          <div className="lp-dots"/>

          {/* Morphing blobs — vivid on dark background */}
          <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
            <div style={{ position:'absolute', width:420, height:420, top:-80, left:-80, background:'radial-gradient(circle,rgba(13,148,136,.32) 0%,rgba(13,148,136,.08) 60%,transparent 80%)', animation:'lpBlob1 18s ease-in-out infinite', willChange:'transform,border-radius' }}/>
            <div style={{ position:'absolute', width:360, height:360, bottom:-60, right:-60, background:'radial-gradient(circle,rgba(139,92,246,.28) 0%,rgba(139,92,246,.06) 60%,transparent 80%)', animation:'lpBlob2 22s ease-in-out infinite', willChange:'transform,border-radius' }}/>
            <div style={{ position:'absolute', width:280, height:280, top:'38%', right:'10%', background:'radial-gradient(circle,rgba(14,165,233,.22) 0%,rgba(14,165,233,.04) 60%,transparent 80%)', animation:'lpBlob3 16s ease-in-out 4s infinite', willChange:'border-radius' }}/>
          </div>

          {/* ── Brand ── */}
          <div style={{ position:'relative', zIndex:2, animation:'lpIn .7s ease both' }}>
            <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:48 }}>
              <div style={{
                width:48, height:48, borderRadius:15,
                background:'linear-gradient(145deg,#0f766e,#0891b2)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 6px 28px rgba(13,148,136,.55), 0 0 0 1px rgba(255,255,255,.08) inset',
              }}>
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <rect x="2" y="6" width="22" height="4" rx="2" fill="white"/>
                  <rect x="8" y="10" width="10" height="7" rx="1.5" fill="white"/>
                  <line x1="21" y1="8" x2="21" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity=".7"/>
                  <circle cx="21" cy="19.5" r="2.2" fill="white" fillOpacity=".7"/>
                </svg>
              </div>
              <div>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:'1.4rem', fontWeight:900, background:'linear-gradient(135deg,#0dd9c4,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', letterSpacing:-.3 }}>Shule</div>
                <div style={{ fontSize:9.5, fontWeight:700, color:'#334155', letterSpacing:2.2, textTransform:'uppercase', marginTop:1 }}>School Management</div>
              </div>
            </div>

            {/* Headline — white on dark */}
            <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:'clamp(1.8rem,2.8vw,2.5rem)', fontWeight:900, lineHeight:1.18, letterSpacing:-1.2, marginBottom:16, animation:'lpIn .8s .08s ease both' }}>
              <span style={{ color:'#f1f5f9' }}>The smarter way</span><br/>
              <span style={{ color:'#f1f5f9' }}>to run your</span>{' '}
              <span style={{ background:'linear-gradient(135deg,#0dd9c4,#22d3ee)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>school.</span>
            </div>
            <div style={{ fontSize:13.5, color:'#475569', lineHeight:1.8, marginBottom:40, animation:'lpIn .8s .14s ease both' }}>
              Purpose-built for Ugandan secondary schools.<br/>
              Works on your school LAN — even offline.
            </div>

            {/* Stat chips — glass on dark */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:40, animation:'lpIn .8s .2s ease both' }}>
              {STATS.map(s => (
                <div key={s.n} style={{
                  display:'flex', alignItems:'center', gap:9,
                  padding:'8px 14px', borderRadius:12,
                  background:'rgba(255,255,255,.06)',
                  border:'1px solid rgba(255,255,255,.1)',
                  backdropFilter:'blur(12px)',
                }}>
                  <div style={{ width:30, height:30, borderRadius:9, background:`${s.color}28`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round"><path d={s.icon}/></svg>
                  </div>
                  <div>
                    <div style={{ fontFamily:'Space Grotesk,sans-serif', fontWeight:900, fontSize:15, color:'#f1f5f9', lineHeight:1 }}>{s.n}</div>
                    <div style={{ fontSize:10, color:'#475569', fontWeight:600, marginTop:1 }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Feature list — clear on dark */}
            <div style={{ animation:'lpIn .8s .26s ease both' }}>
              <div style={{ fontSize:9.5, fontWeight:800, color:'#334155', textTransform:'uppercase', letterSpacing:2, marginBottom:14 }}>What's inside</div>
              {FEATURES.map((f, i) => (
                <div key={f.title} style={{
                  display:'flex', alignItems:'center', gap:14,
                  padding:'11px 14px', borderRadius:14,
                  background: i === featIdx ? 'rgba(255,255,255,.08)' : 'transparent',
                  border: i === featIdx ? `1px solid ${f.color}30` : '1px solid transparent',
                  boxShadow: i === featIdx ? `0 4px 20px rgba(0,0,0,.2), inset 0 0 0 .5px ${f.color}20` : 'none',
                  cursor:'pointer',
                  transition:'all .26s cubic-bezier(.34,1.56,.64,1)',
                  transform: i === featIdx ? 'scale(1.01)' : 'scale(1)',
                  marginBottom: 4,
                }}
                  onClick={() => setFeatIdx(i)}
                >
                  <div style={{
                    width:36, height:36, borderRadius:11, flexShrink:0,
                    background:`${f.color}22`, border:`1px solid ${f.color}38`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    transition:'all .2s',
                    boxShadow: i===featIdx ? `0 4px 16px ${f.color}40` : 'none',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="1.9" strokeLinecap="round"><path d={f.icon}/></svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'#e2e8f0', marginBottom:1 }}>{f.title}</div>
                    <div style={{ fontSize:11.5, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.desc}</div>
                  </div>
                  {i === featIdx && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={f.color} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Footer: region chips ── */}
          <div style={{ position:'relative', zIndex:2, display:'flex', gap:8, animation:'lpIn .8s .4s ease both' }}>
            {['🇺🇬 Uganda','🇰🇪 Kenya','🇹🇿 Tanzania'].map(c=>(
              <div key={c} style={{ padding:'4px 11px', borderRadius:7, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', fontSize:11, fontWeight:600, color:'#475569' }}>{c}</div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            RIGHT — login form (light clean)
        ══════════════════════════════════════ */}
        <div style={{
          position:'relative', display:'flex', alignItems:'center', justifyContent:'center',
          padding:'2rem', background:'#ffffff',
          boxShadow:'-4px 0 40px rgba(15,23,42,.06)',
        }}>
          {/* Soft warm glow top-right */}
          <div style={{ position:'absolute', top:-60, right:-60, width:300, height:300, borderRadius:'50%', background:'radial-gradient(circle,rgba(13,148,136,.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

          <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1, animation:'lpIn .7s .1s ease both' }}>

            {/* Welcome header */}
            <div style={{ marginBottom:32 }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:6,
                padding:'5px 12px', borderRadius:99, marginBottom:18,
                background:'rgba(13,148,136,.07)', border:'1px solid rgba(13,148,136,.18)',
                fontSize:11, fontWeight:700, color:'#0d9488',
              }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }}/>
                Secure school login
              </div>
              <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:26, fontWeight:900, color:'#0f172a', letterSpacing:-.6, lineHeight:1.15, marginBottom:8 }}>
                Welcome back
              </div>
              <div style={{ fontSize:13.5, color:'#64748b', lineHeight:1.7 }}>
                Sign in with your school credentials.<br/>
                Issued by your IT Admin or Secretary.
              </div>
            </div>

            {/* Form */}
            <form onSubmit={e=>{void handleLogin(e)}} style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Email */}
              <div>
                <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:7, textTransform:'uppercase', letterSpacing:.6 }}>
                  Email address
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#94a3b8' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <input
                    ref={emailRef} type="email" required
                    value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="name@school.ac.ug"
                    className="lp-input"
                    style={{ paddingLeft:44 }}
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ display:'flex', justifyContent:'space-between', fontSize:11.5, fontWeight:700, color:'#475569', marginBottom:7, textTransform:'uppercase', letterSpacing:.6 }}>
                  Password
                  <button type="button"
                    onClick={()=>{ setShowForgot(true); setForgotSent(false); setForgotError(''); setForgotEmail(''); setForgotStaffNum(''); setForgotPassword('') }}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:11.5, color:'#0d9488', fontWeight:700, textTransform:'none', letterSpacing:0, fontFamily:'inherit', padding:0, transition:'color .14s' }}
                    onMouseEnter={e=>(e.currentTarget.style.color='#0f766e')}
                    onMouseLeave={e=>(e.currentTarget.style.color='#0d9488')}
                  >Forgot password / new staff?</button>
                </label>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#94a3b8' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <input
                    type={showPwd?'text':'password'} required
                    value={password} onChange={e=>setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="lp-input"
                    style={{ paddingLeft:44, paddingRight:44 }}
                    autoComplete="current-password"
                  />
                  <button type="button" tabIndex={-1}
                    onClick={()=>setShowPwd(v=>!v)}
                    style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4, display:'flex', alignItems:'center', transition:'color .14s' }}
                    onMouseEnter={e=>(e.currentTarget.style.color='#0d9488')}
                    onMouseLeave={e=>(e.currentTarget.style.color='#94a3b8')}
                  >
                    {showPwd
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(244,63,94,.05)', border:'1px solid rgba(244,63,94,.2)', color:'#be123c', fontSize:12.5, lineHeight:1.5, animation:'lpIn .22s ease both' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ flexShrink:0, marginTop:1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading} className="lp-btn">
                {loading
                  ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
                      <span style={{ width:16, height:16, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', display:'inline-block', animation:'lpSpin .65s linear infinite' }}/>
                      Signing in…
                    </span>
                  : <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                      Sign in to Shule
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </span>}
              </button>
            </form>

            {/* Hint */}
            <div style={{ marginTop:22, display:'flex', gap:11, padding:'13px 16px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:13, alignItems:'flex-start' }}>
              <div style={{ width:30, height:30, borderRadius:9, background:'rgba(13,148,136,.08)', border:'1px solid rgba(13,148,136,.16)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div style={{ fontSize:12, color:'#64748b', lineHeight:1.65 }}>
                New to Shule? Your <span style={{ color:'#0f172a', fontWeight:700 }}>IT Admin</span> or <span style={{ color:'#0f172a', fontWeight:700 }}>Secretary</span> sets up your account and sends your credentials.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          Forgot password modal — light theme
      ══════════════════════════════════════ */}
      {showForgot && (
        <div style={{
          position:'fixed', inset:0, zIndex:500,
          background:'rgba(15,23,42,.35)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:20,
          animation:'lpIn .2s ease both',
        }}
          onClick={e=>e.target===e.currentTarget&&setShowForgot(false)}
        >
          <div style={{
            width:'100%', maxWidth:440,
            background:'#fff', borderRadius:24, overflow:'hidden',
            boxShadow:'0 24px 80px rgba(15,23,42,.22), 0 0 0 1px rgba(15,23,42,.06)',
            animation:'lpIn .28s cubic-bezier(.16,1,.3,1) both',
          }}>
            {/* Header */}
            <div style={{ padding:'22px 24px 18px', background:'linear-gradient(135deg,rgba(13,148,136,.06) 0%,transparent 100%)', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'rgba(13,148,136,.1)', border:'1px solid rgba(13,148,136,.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              <div>
                <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:17, fontWeight:900, color:'#0f172a' }}>Set or reset your password</div>
                <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>Your IT Admin approves it — they never see the password itself</div>
              </div>
            </div>
            <div style={{ padding:'22px 24px 24px' }}>
              {forgotSent ? (
                <>
                  <div style={{ textAlign:'center', padding:'8px 0 24px' }}>
                    <div style={{ width:54, height:54, borderRadius:16, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:'0 4px 20px rgba(16,185,129,.15)' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style={{ fontFamily:'Space Grotesk,sans-serif', fontSize:17, fontWeight:900, color:'#0f172a', marginBottom:10 }}>Request submitted!</div>
                    <div style={{ fontSize:13, color:'#64748b', lineHeight:1.7 }}>
                      Your IT Admin has been notified and will approve your password shortly.<br/>
                      Once approved, sign in with the password you just set.
                    </div>
                  </div>
                  <button onClick={()=>setShowForgot(false)} className="lp-btn">Back to Sign In</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize:13, color:'#64748b', lineHeight:1.7, marginBottom:20 }}>
                    Enter your details and the password you want to use. Your IT Admin will approve the request — they'll see who's asking, never the password.
                  </div>
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Email address</label>
                  <input type="email" value={forgotEmail} onChange={e=>setForgotEmail(e.target.value)}
                    placeholder="name@school.ac.ug" autoFocus
                    className="lp-input" style={{ marginBottom:14 }}
                  />
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>Staff number</label>
                  <input type="text" value={forgotStaffNum} onChange={e=>setForgotStaffNum(e.target.value)}
                    placeholder="e.g. GM/STAFF/2026/001"
                    className="lp-input" style={{ marginBottom:14 }}
                  />
                  <label style={{ display:'block', fontSize:11.5, fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:.6, marginBottom:7 }}>New password</label>
                  <input type="password" value={forgotPassword} onChange={e=>setForgotPassword(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter') void handleForgotPassword() }}
                    placeholder="At least 8 characters"
                    className="lp-input" style={{ marginBottom:18 }}
                  />
                  {forgotError && (
                    <div style={{ marginBottom:14, padding:'10px 12px', borderRadius:10, background:'rgba(244,63,94,.05)', border:'1px solid rgba(244,63,94,.2)', color:'#be123c', fontSize:12 }}>
                      {forgotError}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:10 }}>
                    <button type="button" onClick={()=>setShowForgot(false)}
                      style={{ flex:1, height:46, borderRadius:12, background:'#f1f5f9', border:'1px solid #e2e8f0', color:'#475569', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit', transition:'background .14s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='#e2e8f0')}
                      onMouseLeave={e=>(e.currentTarget.style.background='#f1f5f9')}
                    >Cancel</button>
                    <button type="button" onClick={()=>void handleForgotPassword()}
                      disabled={!forgotEmail.trim()||!forgotStaffNum.trim()||forgotPassword.length<8||requestPassword.isPending}
                      className="lp-btn" style={{ flex:2 }}
                    >{requestPassword.isPending?'Submitting…':'Submit for Approval'}</button>
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
