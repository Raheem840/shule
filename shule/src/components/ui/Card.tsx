import { ReactNode, CSSProperties, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  action?: ReactNode
}

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, style, ...props }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-sm)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.25s, border-color 0.25s, box-shadow 0.2s',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, action, style, ...props }: CardHeaderProps) {
  return (
    <div
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
        }}
      >
        {title}
      </span>
      {action}
    </div>
  )
}

export function CardBody({ children, style, ...props }: CardBodyProps) {
  return (
    <div style={{ padding: '1.1rem', ...style }} {...props}>
      {children}
    </div>
  )
}
