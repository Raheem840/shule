import { ReactNode, CSSProperties } from 'react'

type Variant = 'green' | 'amber' | 'red' | 'blue' | 'teal' | 'violet' | 'muted'

interface BadgeProps {
  variant?: Variant
  dot?: boolean
  children: ReactNode
  style?: CSSProperties
}

const variantStyles: Record<Variant, CSSProperties> = {
  green: {
    background: 'var(--success-bg)',
    color: 'var(--success)',
    border: '1px solid rgba(16,185,129,0.2)',
  },
  amber: {
    background: 'var(--warning-bg)',
    color: 'var(--warning)',
    border: '1px solid rgba(245,158,11,0.2)',
  },
  red: {
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    border: '1px solid rgba(244,63,94,0.2)',
  },
  blue: {
    background: 'var(--info-bg)',
    color: 'var(--info)',
    border: '1px solid rgba(14,165,233,0.2)',
  },
  teal: {
    background: 'rgba(13,217,196,0.12)',
    color: 'var(--brand)',
    border: '1px solid rgba(13,217,196,0.2)',
  },
  violet: {
    background: 'var(--violet-bg)',
    color: 'var(--violet)',
    border: '1px solid rgba(139,92,246,0.2)',
  },
  muted: {
    background: 'var(--surface2)',
    color: 'var(--txt2)',
    border: '1px solid var(--border)',
  },
}

const dotColors: Record<Variant, string> = {
  green:  '#10b981',
  amber:  '#f59e0b',
  red:    '#f43f5e',
  blue:   '#0ea5e9',
  teal:   'var(--brand)',
  violet: '#8b5cf6',
  muted:  'var(--txt3)',
}

export function Badge({ variant = 'muted', dot = false, children, style }: BadgeProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '10.5px',
        fontWeight: 800,
        padding: '3px 9px',
        borderRadius: 20,
        fontFamily: 'var(--font2)',
        whiteSpace: 'nowrap',
        ...variantStyles[variant],
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dotColors[variant],
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}
