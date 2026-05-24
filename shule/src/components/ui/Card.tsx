import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hoverable?: boolean
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  action?: ReactNode
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, hoverable = true, className = '', style, ...props }: CardProps) {
  return (
    <div
      className={`sui-card ${className}`.trim()}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-sm)',
        // hover + dark mode glassmorphism applied via .sui-card in index.css
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action, className = '', style, ...props }: CardHeaderProps) {
  return (
    <div
      className={className}
      style={{
        padding: '0.85rem 1.1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'border-color 0.25s',
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          fontFamily: 'var(--font2)',
          fontSize: 13,
          fontWeight: 800,
          color: 'var(--txt)',
          transition: 'color 0.25s',
        }}
      >
        {title}
      </span>
      {action}
    </div>
  )
}

export function CardBody({ children, className = '', style, ...props }: CardBodyProps) {
  return (
    <div className={className} style={{ padding: '1.1rem', ...style }} {...props}>
      {children}
    </div>
  )
}
