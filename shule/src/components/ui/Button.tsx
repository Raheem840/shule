import { ButtonHTMLAttributes, ReactNode, CSSProperties } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
type Size = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
}

// Static visual properties — hover/focus states are in index.css .sui-btn-*
const variantStyles: Record<Variant, CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
    color: '#030711',
    border: '1px solid transparent',
    boxShadow: 'var(--sh-brand)',
    fontWeight: 800,
  },
  secondary: {
    background: 'var(--surface2)',
    color: 'var(--txt2)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'var(--danger-bg)',
    color: 'var(--danger-txt)',
    border: '1px solid rgba(244,63,94,0.25)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--txt2)',
    border: '1px solid transparent',
  },
}

const sizeStyles: Record<Size, CSSProperties> = {
  sm: { padding: '0.28rem 0.65rem', fontSize: '11px' },
  md: { padding: '0.42rem 0.9rem',  fontSize: '12px' },
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={`sui-btn sui-btn-${variant} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        borderRadius: 'var(--r)',
        fontWeight: 700,
        fontFamily: 'var(--font2)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        outline: 'none',
        opacity: isDisabled ? 0.55 : 1,
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {loading
        ? <LoadingSpinner size={13} color={variant === 'primary' ? '#030711' : 'currentColor'} />
        : icon
      }
      {children}
    </button>
  )
}
