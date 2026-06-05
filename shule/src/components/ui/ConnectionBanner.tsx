// ConnectionBanner.tsx — Fixed top banner showing offline / syncing / just-synced states.
// Sets --banner-height CSS variable so the layout can shift without prop drilling.

import { useEffect, useState } from 'react'
import { useConnection } from '../../hooks/useConnectionStatus'
import { useSyncQueue } from '../../hooks/useSyncQueue'

/** Duration in ms to show the "synced" confirmation before hiding. */
const SYNCED_DISMISS_MS = 3_000

type BannerState = 'offline' | 'syncing' | 'synced' | 'hidden'

/** Fixed top banner that shows connectivity and sync status. Returns null when online and idle. */
export function ConnectionBanner() {
  const { isOnline, isVerified } = useConnection()
  const { isSyncing, lastSyncAt, pendingCount } = useSyncQueue()
  const [banner, setBanner] = useState<BannerState>('hidden')

  useEffect(() => {
    // Not yet verified — don't flash anything on initial load
    if (!isVerified) return

    if (!isOnline) {
      setBanner('offline')
      return
    }

    if (isSyncing) {
      setBanner('syncing')
      return
    }

    // Just finished syncing — show confirmation briefly then hide
    if (lastSyncAt && banner === 'syncing') {
      setBanner('synced')
      const t = setTimeout(() => setBanner('hidden'), SYNCED_DISMISS_MS)
      return () => clearTimeout(t)
    }

    // Back online with nothing to sync
    if (banner === 'offline') {
      setBanner('hidden')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isVerified, isSyncing, lastSyncAt])

  const visible = banner !== 'hidden'

  // Push --banner-height into the document root so AppShell can compensate
  useEffect(() => {
    document.documentElement.style.setProperty('--banner-height', visible ? '40px' : '0px')
  }, [visible])

  if (banner === 'hidden') return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        transition: 'transform 0.25s ease',
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        ...(banner === 'offline'
          ? {
              background: 'var(--warning-bg, #fef3c7)',
              color: 'var(--warning, #f59e0b)',
              borderBottom: '1px solid rgba(245,158,11,0.3)',
            }
          : {
              background: 'var(--success-bg, #d1fae5)',
              color: 'var(--success, #10b981)',
              borderBottom: '1px solid rgba(16,185,129,0.3)',
            }),
      }}
      role="status"
      aria-live="polite"
    >
      {/* Offline state */}
      {banner === 'offline' && (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/>
            <path d="M5 12.55a10.94 10.94 0 015.17-2.39"/>
            <path d="M10.71 5.05A16 16 0 0122.56 9"/>
            <path d="M1.42 9a15.91 15.91 0 014.7-2.88"/>
            <path d="M8.53 16.11a6 6 0 016.95 0"/>
            <circle cx="12" cy="20" r="1" fill="currentColor"/>
          </svg>
          No internet connection
          {pendingCount > 0 && (
            <span style={{ opacity: 0.75, fontWeight: 400 }}>
              — {pendingCount} change{pendingCount !== 1 ? 's' : ''} will sync when back online
            </span>
          )}
        </>
      )}

      {/* Syncing state */}
      {banner === 'syncing' && (
        <>
          {/* Spinner */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ animation: 'spin 1s linear infinite' }}
          >
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
          Syncing offline changes…
        </>
      )}

      {/* Just synced state */}
      {banner === 'synced' && (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          All changes synced
        </>
      )}

      {/* Inline keyframe for spinner — avoids a separate CSS file */}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
