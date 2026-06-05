// CachedDataBadge.tsx — Small amber badge shown when data comes from IndexedDB cache.
// Returns null when data is live.

/** Formats a Date into a human-readable relative time string. */
function timeAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours   = Math.floor(diffMinutes / 60)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  return `${diffHours}h ago`
}

interface CachedDataBadgeProps {
  /** Whether the data is being served from cache. When false, renders nothing. */
  isFromCache: boolean
  /** The timestamp when the data was last cached. */
  cachedAt: Date | null
}

/**
 * Displays an amber "Cached" badge with relative age when serving stale IndexedDB data.
 * Renders null when isFromCache is false.
 */
export function CachedDataBadge({ isFromCache, cachedAt }: CachedDataBadgeProps) {
  if (!isFromCache) return null

  const ageLabel = cachedAt ? timeAgo(cachedAt) : 'unknown time'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--warning, #f59e0b)',
        padding: '2px 8px',
        borderRadius: 6,
        background: 'var(--warning-bg, rgba(245,158,11,0.1))',
        border: '1px solid rgba(245,158,11,0.25)',
        whiteSpace: 'nowrap',
      }}
      title="This data is from your device's offline cache"
    >
      {/* Clock icon */}
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      Cached · last updated {ageLabel}
    </span>
  )
}
