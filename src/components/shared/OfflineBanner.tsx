// OfflineBanner.tsx — Premium floating status banner.
// Three states:
//   1. Browser offline     → dark pill with animated wifi-off + queued count
//   2. Server unreachable  → dark pill with animated cloud-x icon
//   3. Back online         → green pill with checkmark, auto-dismisses after 3s

import { useState, useEffect } from 'react'
import { useOfflineMode } from '../../hooks/useOfflineMode'

function formatAge(date: Date): string {
  const diffMs   = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 2)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)  return `${diffHrs}h ago`
  return `${Math.floor(diffHrs / 24)}d ago`
}

// ── Layered wifi-off icon ─────────────────────────────────────
function WifiOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Arcs */}
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke="currentColor" strokeWidth="1.8" opacity=".4"/>
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" stroke="currentColor" strokeWidth="1.8" opacity=".6"/>
      {/* Strike-through */}
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2"/>
      {/* Dot */}
      <circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"
        style={{ animation: 'ob-pulse 1.8s ease-in-out infinite' }} />
    </svg>
  )
}

// ── Server cloud-off icon ─────────────────────────────────────
function ServerOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" opacity=".5"/>
      <line x1="4.22" y1="4.22" x2="19.78" y2="19.78" strokeWidth="2"/>
    </svg>
  )
}

// ── Animated back-online check ────────────────────────────────
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round"
      style={{ animation: 'ob-pop .4s cubic-bezier(.18,.89,.32,1.28) both' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"
        strokeDasharray="56.5" style={{ animation: 'ob-ring .5s ease both' }} />
      <polyline points="7 12.5 10.5 16 17 9" stroke="currentColor" strokeWidth="2.2"
        style={{ strokeDasharray: 14, animation: 'ob-check .3s .3s ease forwards', strokeDashoffset: 14 }} />
    </svg>
  )
}


const KEYFRAMES = `
  @keyframes ob-in    { from { opacity:0; transform:translateX(-50%) translateY(-18px) scale(.9) } to { opacity:1; transform:translateX(-50%) translateY(0) scale(1) } }
  @keyframes ob-out   { from { opacity:1; transform:translateX(-50%) translateY(0) scale(1) } to { opacity:0; transform:translateX(-50%) translateY(-14px) scale(.94) } }
  @keyframes ob-pulse { 0%,100% { opacity:.35; transform:scale(.75) } 55% { opacity:1; transform:scale(1.2) } }
  @keyframes ob-ring  { from { stroke-dashoffset:56.5 } to { stroke-dashoffset:0 } }
  @keyframes ob-check { to   { stroke-dashoffset:0 } }
  @keyframes ob-pop   { from { transform:scale(.6); opacity:0 } to { transform:scale(1); opacity:1 } }
  @keyframes ob-spin  { to   { transform:rotate(360deg) } }
`

export function OfflineBanner() {
  const { isOffline, isSupabaseUnreachable, lastOnlineAt } = useOfflineMode()
  const [showOnlineFlash, setShowOnlineFlash] = useState(false)
  const [wasOffline,      setWasOffline]      = useState(false)
  const [leaving,         setLeaving]         = useState(false)
  const [ageLabel,        setAgeLabel]        = useState<string | null>(null)
  const [retrying,        setRetrying]        = useState(false)

  useEffect(() => {
    if (!isOffline && !isSupabaseUnreachable && wasOffline) {
      setShowOnlineFlash(true)
      setLeaving(false)
    }
    setWasOffline(isOffline || isSupabaseUnreachable)
  }, [isOffline, isSupabaseUnreachable])

  useEffect(() => {
    if (!showOnlineFlash) return
    const dismiss = setTimeout(() => {
      setLeaving(true)
      setTimeout(() => { setShowOnlineFlash(false); setLeaving(false) }, 350)
    }, 3_000)
    return () => clearTimeout(dismiss)
  }, [showOnlineFlash])

  useEffect(() => {
    if ((!isOffline && !isSupabaseUnreachable) || !lastOnlineAt) { setAgeLabel(null); return }
    setAgeLabel(formatAge(lastOnlineAt))
    const t = setInterval(() => setAgeLabel(formatAge(lastOnlineAt)), 30_000)
    return () => clearInterval(t)
  }, [isOffline, isSupabaseUnreachable, lastOnlineAt])

  function handleRetry() {
    setRetrying(true)
    setTimeout(() => window.location.reload(), 300)
  }

  const pill = (children: React.ReactNode, cfg: { bg: string; border: string; color: string; glow: string }, testId: string) => (
    <>
      <style>{KEYFRAMES}</style>
      <div
        data-testid={testId}
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', top: 56, left: '50%',
          zIndex: 9998,
          animation: leaving ? 'ob-out .35s ease forwards' : 'ob-in .38s cubic-bezier(.32,.72,0,1) both',
          willChange: 'transform, opacity',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          borderRadius: 99,
          background: cfg.bg,
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: `1px solid ${cfg.border}`,
          boxShadow: `0 8px 40px rgba(0,0,0,.32), 0 0 0 1px ${cfg.border} inset, 0 0 24px ${cfg.glow}`,
          color: cfg.color,
          fontFamily: 'var(--font2)',
          fontWeight: 700,
          fontSize: 13,
          userSelect: 'none',
          whiteSpace: 'nowrap',
          minWidth: 240,
        }}>
          {children}
        </div>
      </div>
    </>
  )

  // ── Offline ──────────────────────────────────────────────────
  if (isOffline || isSupabaseUnreachable) {
    const isServerIssue = !isOffline && isSupabaseUnreachable
    return pill(
      <>
        {/* Icon bubble */}
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fbbf24' }}>
          {isServerIssue ? <ServerOffIcon /> : <WifiOffIcon />}
        </div>

        {/* Labels */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -.2 }}>
            {isServerIssue ? 'Server unreachable' : 'No internet'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 500, opacity: .65 }}>
              {ageLabel ? `Cached · ${ageLabel}` : 'Showing cached data'}
            </span>
          </div>
        </div>

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            padding: '5px 12px', borderRadius: 99,
            border: '1px solid rgba(251,191,36,.4)',
            background: retrying ? 'transparent' : 'rgba(251,191,36,.12)',
            color: '#fbbf24', fontSize: 11.5, fontWeight: 800,
            cursor: retrying ? 'wait' : 'pointer',
            fontFamily: 'inherit', transition: 'all .15s',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
        >
          {retrying
            ? <><svg style={{ animation: 'ob-spin .8s linear infinite' }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.2-8.6"/></svg> Retrying</>
            : <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg> Retry</>
          }
        </button>

        {/* Pulse dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 0 3px rgba(245,158,11,.25)', animation: 'ob-pulse 2s ease-in-out infinite', flexShrink: 0 }} />
      </>,
      { bg: 'rgba(15,23,42,.88)', border: 'rgba(245,158,11,.3)', color: '#fde68a', glow: 'rgba(245,158,11,.08)' },
      'offline-banner'
    )
  }

  // ── Back online ──────────────────────────────────────────────
  if (showOnlineFlash) {
    return pill(
      <>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(110,231,183,.15)', border: '1px solid rgba(110,231,183,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#6ee7b7' }}>
          <CheckIcon />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -.2 }}>Back online</div>
          <div style={{ fontSize: 11, fontWeight: 500, opacity: .7, marginTop: 2 }}>Syncing queued changes…</div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 0 3px rgba(16,185,129,.25)', flexShrink: 0 }} />
      </>,
      { bg: 'rgba(5,150,105,.9)', border: 'rgba(110,231,183,.35)', color: '#fff', glow: 'rgba(16,185,129,.12)' },
      'online-banner'
    )
  }

  return null
}
