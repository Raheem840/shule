// OfflineFeatureGuard.tsx — Wraps a feature area and dims it when offline.
// Does NOT block the whole page — only the wrapped content area.

import type { ReactNode } from 'react'
import { useConnection } from '../../hooks/useConnectionStatus'

/** Features that require a verified internet connection. */
export type OfflineGuardedFeature =
  | 'messaging'
  | 'sms-reminders'
  | 'report-card-pdf'
  | 'notifications'
  | 'realtime'

/** Human-readable label for each guarded feature. */
const FEATURE_LABELS: Record<OfflineGuardedFeature, string> = {
  'messaging':        'Messaging',
  'sms-reminders':    'SMS Reminders',
  'report-card-pdf':  'Report Card PDF',
  'notifications':    'Notifications',
  'realtime':         'Real-time updates',
}

interface OfflineFeatureGuardProps {
  /** The feature being guarded — used for the overlay label. */
  feature: OfflineGuardedFeature
  /** The content to render inside the guard. */
  children: ReactNode
}

/**
 * Wraps children in a dimmed, non-interactive overlay when the connection is not verified.
 * Shows a centred message so the user knows why the area is disabled.
 */
export function OfflineFeatureGuard({ feature, children }: OfflineFeatureGuardProps) {
  const { isVerified } = useConnection()

  if (isVerified) {
    // Online — render children normally
    return <>{children}</>
  }

  const label = FEATURE_LABELS[feature]

  return (
    <div style={{ position: 'relative' }}>
      {/* Dim + disable the wrapped content */}
      <div style={{ opacity: 0.4, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>

      {/* Centred overlay message */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'var(--surface, #fff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 14,
            padding: '12px 20px',
            boxShadow: 'var(--sh-md, 0 4px 12px rgba(0,0,0,0.1))',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--txt2, #475569)',
            textAlign: 'center',
            maxWidth: 320,
          }}
        >
          📡 {label} requires an internet connection
        </div>
      </div>
    </div>
  )
}
