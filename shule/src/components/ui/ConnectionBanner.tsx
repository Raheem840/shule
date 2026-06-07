// ConnectionBanner.tsx — Premium floating toast for connectivity & sync states.
// Floats as a glass pill from the top-center — not a full-width bar.
// Three states: offline · syncing · synced (auto-dismisses after 3s)

import { useEffect, useRef, useState } from 'react'
import { useConnection } from '../../hooks/useConnectionStatus'
import { useSyncQueue } from '../../hooks/useSyncQueue'

const SYNCED_DISMISS_MS = 3_000

type BannerState = 'offline' | 'syncing' | 'synced' | 'hidden'

// ── Animated cloud-off SVG ────────────────────────────────────
function IconOffline() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18.36 6.64a9 9 0 0 1 1.22 10.14"/>
      <path d="M6.16 6.16a9 9 0 0 0 0 12.68"/>
      <path d="M8.7 9.71a5 5 0 0 0-.39 6.56"/>
      <path d="M15.3 9.7a5 5 0 0 1 .37 6.57"/>
      <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none"/>
      <line x1="2" y1="2" x2="22" y2="22" strokeWidth="2"/>
    </svg>
  )
}

// ── Rotating sync orbits SVG ──────────────────────────────────
function IconSyncing() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ animation: 'cb-spin 1.1s cubic-bezier(.5,0,.5,1) infinite' }}>
      <path d="M23 4v6h-6"/>
      <path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>
  )
}

// ── Animated checkmark SVG ────────────────────────────────────
function IconSynced() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      {/* Outer ring — draw-on animation */}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" strokeDasharray="56.5" strokeDashoffset="0"
        style={{ animation: 'cb-ring .5s ease both' }} />
      {/* Checkmark */}
      <polyline points="7 12.5 10.5 16 17 9" stroke="currentColor" strokeWidth="2"
        style={{ animation: 'cb-check .35s .25s ease both', strokeDasharray: 14, strokeDashoffset: 14 }} />
    </svg>
  )
}

// ── Cloud save icon (queued) ──────────────────────────────────
function IconQueued() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
      <polyline points="16 16 12 12 8 16"/>
      <line x1="12" y1="12" x2="12" y2="21"/>
    </svg>
  )
}

const KEYFRAMES = `
  @keyframes cb-slide-in  { from { opacity:0; transform: translateX(-50%) translateY(-20px) scale(.92) } to { opacity:1; transform: translateX(-50%) translateY(0) scale(1) } }
  @keyframes cb-slide-out { from { opacity:1; transform: translateX(-50%) translateY(0) scale(1) }      to { opacity:0; transform: translateX(-50%) translateY(-16px) scale(.94) } }
  @keyframes cb-spin       { to   { transform: rotate(360deg) } }
  @keyframes cb-ring       { from { stroke-dashoffset: 56.5 } to { stroke-dashoffset: 0 } }
  @keyframes cb-check      { to   { stroke-dashoffset: 0 } }
  @keyframes cb-pulse-dot  { 0%,100% { opacity:.4; transform:scale(.8) } 50% { opacity:1; transform:scale(1.15) } }
`

export function ConnectionBanner() {
  const { isOnline, isVerified } = useConnection()
  const { isSyncing, lastSyncAt, pendingCount } = useSyncQueue()
  const [banner, setBanner] = useState<BannerState>('hidden')
  const [leaving, setLeaving] = useState(false)
  const wasSyncingRef = useRef(false)

  useEffect(() => {
    if (!isVerified) return
    if (!isOnline) { setBanner('offline'); setLeaving(false); wasSyncingRef.current = false; return }
    if (isSyncing) { setBanner('syncing'); setLeaving(false); wasSyncingRef.current = true; return }
    if (wasSyncingRef.current) {
      wasSyncingRef.current = false
      setBanner('synced')
      setLeaving(false)
      const dismiss = setTimeout(() => {
        setLeaving(true)
        setTimeout(() => setBanner('hidden'), 320)
      }, SYNCED_DISMISS_MS)
      return () => clearTimeout(dismiss)
    }
    wasSyncingRef.current = false
    setBanner('hidden')
  }, [isOnline, isVerified, isSyncing, lastSyncAt])

  useEffect(() => {
    document.documentElement.style.setProperty('--banner-height', banner !== 'hidden' ? '48px' : '0px')
  }, [banner])

  if (banner === 'hidden') return null

  const isOffline = banner === 'offline'
  const isSyncingState = banner === 'syncing'
  const isSyncedState = banner === 'synced'

  // Colour tokens per state
  const config = isOffline
    ? { bg: 'rgba(15,23,42,.92)', border: 'rgba(245,158,11,.35)', color: '#fbbf24', accent: '#f59e0b' }
    : isSyncingState
    ? { bg: 'rgba(13,148,136,.92)',  border: 'rgba(13,148,136,.5)',  color: '#fff',    accent: '#5eead4' }
    : { bg: 'rgba(5,150,105,.92)',   border: 'rgba(16,185,129,.5)',  color: '#fff',    accent: '#6ee7b7' }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 99999,
          animation: leaving ? 'cb-slide-out .32s ease forwards' : 'cb-slide-in .36s cubic-bezier(.32,.72,0,1) both',
          willChange: 'transform, opacity',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px 10px 12px',
          borderRadius: 99,
          background: config.bg,
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${config.border}`,
          boxShadow: `0 8px 32px rgba(0,0,0,.28), 0 0 0 1px ${config.border} inset`,
          color: config.color,
          fontFamily: 'var(--font2)',
          fontWeight: 700,
          fontSize: 13,
          whiteSpace: 'nowrap',
          userSelect: 'none',
          minWidth: 220,
        }}>

          {/* Icon */}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${config.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${config.accent}40` }}>
            {isOffline      && <IconOffline />}
            {isSyncingState && <IconSyncing />}
            {isSyncedState  && <IconSynced />}
          </div>

          {/* Text */}
          <div style={{ flex: 1 }}>
            {isOffline && (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -.2 }}>No internet connection</div>
                {pendingCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, opacity: .75, fontWeight: 500, fontSize: 11 }}>
                    <IconQueued />
                    {pendingCount} change{pendingCount !== 1 ? 's' : ''} saved locally
                  </div>
                )}
              </>
            )}
            {isSyncingState && (
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -.2 }}>
                Syncing your changes
                <span style={{ display: 'inline-flex', gap: 3, marginLeft: 6, verticalAlign: 'middle' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: config.accent, display: 'inline-block', animation: `cb-pulse-dot .9s ${i * .2}s ease-in-out infinite` }} />
                  ))}
                </span>
              </div>
            )}
            {isSyncedState && (
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -.2 }}>All changes synced</div>
            )}
          </div>

          {/* Status dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: config.accent,
            boxShadow: `0 0 0 3px ${config.accent}33`,
            animation: isOffline ? 'cb-pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
        </div>
      </div>
    </>
  )
}
