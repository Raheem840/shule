import { InputHTMLAttributes, ReactNode, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helper?: string
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helper, leftIcon, rightSlot, id, className = '', style, ...props }, ref) => {
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
              transition: 'color 0.25s',
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
                zIndex: 1,
              }}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            // sui-input → CSS :focus ring in index.css
            // sui-input-error → keeps red ring while focused on an errored field
            className={`sui-input ${error ? 'sui-input-error' : ''} ${className}`.trim()}
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
              ...style,
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
                pointerEvents: 'none',
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
