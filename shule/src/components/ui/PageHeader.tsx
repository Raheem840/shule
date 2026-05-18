import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: 'var(--font2)',
            fontSize: 20,
            fontWeight: 900,
            color: 'var(--txt)',
            letterSpacing: '-0.5px',
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: 12.5,
              color: 'var(--txt3)',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {action}
        </div>
      )}
    </div>
  )
}
