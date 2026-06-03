// OfflineNotAvailable.tsx — Shown in place of mutation-heavy page sections
// when the user is offline or Supabase is unreachable.
// Use it wherever a loading spinner would otherwise hang indefinitely.
//
// Usage:
//   import { OfflineNotAvailable } from '../shared/OfflineNotAvailable'
//   if (isOffline) return <OfflineNotAvailable feature="Payment recording" />

interface Props {
  /** Human-readable feature name, e.g. "Payment recording" or "Import Wizard" */
  feature: string
  /** Optional extra context shown below the main message */
  hint?: string
}

export function OfflineNotAvailable({ feature, hint }: Props) {
  return (
    <div
      role="status"
      aria-label={`${feature} not available offline`}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        padding:        '48px 24px',
        borderRadius:   14,
        background:     'var(--surface2, #f1f5f9)',
        border:         '1.5px dashed var(--border, #e2e8f0)',
        textAlign:      'center',
        color:          'var(--txt3, #94a3b8)',
        fontFamily:     'var(--font1, Plus Jakarta Sans, sans-serif)',
      }}
    >
      {/* Wifi-off icon */}
      <svg
        width="40" height="40"
        viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
        style={{ opacity: 0.55 }}
      >
        {/* Slash line across the whole icon */}
        <line x1="1" y1="1" x2="23" y2="23" />
        {/* Top arc (full wifi) */}
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        {/* Middle arc */}
        <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        {/* Bottom arc */}
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        {/* Dot */}
        <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
      </svg>

      <div>
        <div style={{
          fontSize:   15,
          fontWeight: 700,
          color:      'var(--txt2, #475569)',
          marginBottom: 4,
        }}>
          {feature} requires an internet connection
        </div>

        <div style={{ fontSize: 13, lineHeight: 1.5, maxWidth: 320 }}>
          {hint ?? 'Connect to the internet to use this feature. Your other data is still available offline.'}
        </div>
      </div>
    </div>
  )
}
