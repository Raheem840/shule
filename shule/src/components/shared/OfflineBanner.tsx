import { useState, useEffect } from 'react'

// OfflineBanner — renders at the top of AppShell when the browser goes offline.
// Shows amber banner while offline, green flash for 3s when back online.
// Listens to native browser online/offline events — no polling.
export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showOnlineFlash, setShowOnlineFlash] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      setShowOnlineFlash(true)
    }

    function handleOffline() {
      setIsOnline(false)
      setShowOnlineFlash(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!showOnlineFlash) return
    const timer = setTimeout(() => setShowOnlineFlash(false), 3000)
    return () => clearTimeout(timer)
  }, [showOnlineFlash])

  if (!isOnline) {
    return (
      <div
        data-testid="offline-banner"
        style={{
          background: 'var(--warning-bg, #fef3c7)',
          color: '#92400e',
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'center',
          borderBottom: '1px solid var(--warning, #f59e0b)',
          fontFamily: 'var(--font1, Plus Jakarta Sans, sans-serif)',
        }}
      >
        You are offline — changes saved locally and will sync when connection returns
      </div>
    )
  }

  if (showOnlineFlash) {
    return (
      <div
        data-testid="online-banner"
        style={{
          background: 'var(--success-bg, #d1fae5)',
          color: '#065f46',
          padding: '6px 16px',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'center',
          borderBottom: '1px solid var(--success, #10b981)',
          fontFamily: 'var(--font1, Plus Jakarta Sans, sans-serif)',
        }}
      >
        Back online — syncing...
      </div>
    )
  }

  return null
}
