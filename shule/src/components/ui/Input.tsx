import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, leftIcon, rightSlot, id, style, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--txt2)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: 'var(--font2)',
            }}
          >
            {label}
          </label>
        )}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {leftIcon && (
            <span
              style={{
                position: 'absolute',
                left: '0.75rem',
                color: 'var(--txt3)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            style={{
              width: '100%',
              padding: leftIcon ? '0.55rem 0.85rem 0.55rem 2.2rem' : '0.55rem 0.85rem',
              paddingRight: rightSlot ? '2.5rem' : '0.85rem',
              background: error ? 'rgba(244,63,94,0.04)' : 'var(--surface2)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 'var(--r)',
              fontSize: 12.5,
              fontFamily: 'var(--font1)',
              color: 'var(--txt)',
              outline: 'none',
              transition: 'all 0.18s',
              boxShadow: error ? '0 0 0 3px rgba(244,63,94,0.1)' : 'none',
              ...style,
            }}
            onFocus={e => {
              if (!error) {
                e.target.style.borderColor = 'var(--brand)'
                e.target.style.background = 'var(--brand-light)'
                e.target.style.boxShadow = '0 0 0 3px rgba(13,148,136,0.12)'
              }
              props.onFocus?.(e)
            }}
            onBlur={e => {
              if (!error) {
                e.target.style.borderColor = 'var(--border)'
                e.target.style.background = 'var(--surface2)'
                e.target.style.boxShadow = 'none'
              }
              props.onBlur?.(e)
            }}
            {...props}
          />

          {rightSlot && (
            <span
              style={{
                position: 'absolute',
                right: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--txt3)',
              }}
            >
              {rightSlot}
            </span>
          )}
        </div>

        {error && (
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
            {error}
          </span>
        )}
        {helper && !error && (
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
            {helper}
          </span>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
