// OfflineBanner.tsx — Sticky banner at the top of AppShell.
// Three states:
//   1. Browser offline → amber "No internet" banner with age of cached data
//   2. Online but Supabase unreachable → amber "Can't reach server" banner
//   3. Just came back online → green flash for 3 s then hides
//
// The banner never polls — it relies on browser online/offline events for
// the primary state and a lightweight Supabase probe (via useOfflineMode)
// to detect server-side outages.

import { useState, useEffect } from 'react'
import { useOfflineMode }      from '../../hooks/useOfflineMode'

// Format "2h ago", "45m ago", "just now"
function formatAge(date: Date): string {
  const diffMs   = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 2)  return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24)  return `${diffHrs}h ago`
  return `${Math.floor(diffHrs / 24)}d ago`
}

export function OfflineBanner() {
  const { isOffline, isSupabaseUnreachable, lastOnlineAt } = useOfflineMode()
  const [showOnlineFlash, setShowOnlineFlash] = useState(false)
  const [wasOffline,      setWasOffline]      = useState(false)
  const [ageLabel,        setAgeLabel]        = useState<string | null>(null)
  const [retrying,        setRetrying]        = useState(false)

  // Detect transition → online to trigger the "Back online" flash
  useEffect(() => {
    if (!isOffline && !isSupabaseUnreachable && wasOffline) {
      setShowOnlineFlash(true)
    }
    setWasOffline(isOffline || isSupabaseUnreachable)
  }, [isOffline, isSupabaseUnreachable, wasOffline])

  // Auto-dismiss the online flash after 3 s
  useEffect(() => {
    if (!showOnlineFlash) return
    const t = setTimeout(() => setShowOnlineFlash(false), 3000)
    return () => clearTimeout(t)
  }, [showOnlineFlash])

  // Refresh the "X ago" label every 30 s
  useEffect(() => {
    if ((!isOffline && !isSupabaseUnreachable) || !lastOnlineAt) {
      setAgeLabel(null)
      return
    }
    setAgeLabel(formatAge(lastOnlineAt))
    const t = setInterval(() => setAgeLabel(formatAge(lastOnlineAt)), 30_000)
    return () => clearInterval(t)
  }, [isOffline, isSupabaseUnreachable, lastOnlineAt])

  // Manual retry — just reload the page; the sync listener fires automatically
  function handleRetry() {
    setRetrying(true)
    // Give the browser 300 ms to attempt reconnect before the reload
    setTimeout(() => window.location.reload(), 300)
  }

  // ── Offline banner ──────────────────────────────────────────────────────────
  if (isOffline || isSupabaseUnreachable) {
    const message = isOffline
      ? 'No internet connection — showing cached data'
      : "Can't reach server — showing cached data"

    return (
      <div
        data-testid="offline-banner"
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            10,
          background:     'var(--warning-bg, #fef3c7)',
          color:          '#92400e',
          padding:        '7px 16px',
          fontSize:       13,
          fontWeight:     600,
          borderBottom:   '1px solid var(--warning, #f59e0b)',
          fontFamily:     'var(--font1, Plus Jakarta Sans, sans-serif)',
        }}
      >
        {/* Wifi-off icon */}
        <svg
          width="15" height="15"
          viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.75 }}
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
        </svg>

        <span style={{ flex: 1, textAlign: 'center' }}>
          {message}
          {ageLabel && (
            <span style={{ marginLeft: 6, fontWeight: 400, opacity: 0.8 }}>
              · Last synced {ageLabel}
            </span>
          )}
        </span>

        {/* Changes saved locally notice */}
        {isOffline && (
          <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 12 }}>
            Writes queued locally
          </span>
        )}

        {/* Retry button */}
        <button
          onClick={handleRetry}
          disabled={retrying}
          aria-label="Retry connection"
          style={{
            marginLeft:   8,
            padding:      '3px 10px',
            borderRadius: 6,
            border:       '1.5px solid #92400e',
            background:   'transparent',
            color:        '#92400e',
            fontSize:     11,
            fontWeight:   700,
            cursor:       retrying ? 'wait' : 'pointer',
            flexShrink:   0,
            fontFamily:   'inherit',
            opacity:      retrying ? 0.6 : 1,
          }}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    )
  }

  // ── Back online flash ───────────────────────────────────────────────────────
  if (showOnlineFlash) {
    return (
      <div
        data-testid="online-banner"
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            8,
          background:     'var(--success-bg, #d1fae5)',
          color:          '#065f46',
          padding:        '7px 16px',
          fontSize:       13,
          fontWeight:     600,
          borderBottom:   '1px solid var(--success, #10b981)',
          fontFamily:     'var(--font1, Plus Jakarta Sans, sans-serif)',
        }}
      >
        {/* Check-circle icon */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Back online — syncing queued changes…
      </div>
    )
  }

  return null
}
