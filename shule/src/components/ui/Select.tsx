import { SelectHTMLAttributes, forwardRef, ReactNode } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helper?: string
  options: SelectOption[]
  placeholder?: string
  leftIcon?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helper, options, placeholder, leftIcon, id, style, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {label && (
          <label
            htmlFor={selectId}
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
                zIndex: 1,
              }}
            >
              {leftIcon}
            </span>
          )}

          <select
            ref={ref}
            id={selectId}
            style={{
              width: '100%',
              padding: leftIcon ? '0.55rem 2.2rem 0.55rem 2.2rem' : '0.55rem 2.2rem 0.55rem 0.85rem',
              background: error ? 'rgba(244,63,94,0.04)' : 'var(--surface2)',
              border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: 'var(--r)',
              fontSize: 12.5,
              fontFamily: 'var(--font1)',
              color: 'var(--txt)',
              outline: 'none',
              appearance: 'none',
              WebkitAppearance: 'none',
              cursor: 'pointer',
              transition: 'all 0.18s',
              ...style,
            }}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Chevron arrow */}
          <span
            style={{
              position: 'absolute',
              right: '0.75rem',
              pointerEvents: 'none',
              color: 'var(--txt3)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
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

Select.displayName = 'Select'
