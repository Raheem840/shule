/**
 * PillGroup — shared premium pill-style filter control.
 * Used for Term/Class/Boarder-Day filters across the Bursar module so the
 * same interaction (rounded track, brand-filled active pill) doesn't get
 * reimplemented slightly differently on every page.
 */
export interface PillOption<T extends string> {
  value: T
  label: string
}

export function PillGroup<T extends string>({
  options, value, onChange, scrollable = false,
}: {
  options:     PillOption<T>[]
  value:       T
  onChange:    (v: T) => void
  scrollable?: boolean
}) {
  return (
    <div style={{
      display: 'flex', gap: 3, background: 'var(--surface2)', borderRadius: 20, padding: 3,
      overflowX: scrollable ? 'auto' : 'visible', maxWidth: scrollable ? 360 : undefined,
    }}>
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 14px', border: 'none', borderRadius: 20,
            background: value === o.value ? 'var(--brand)' : 'transparent',
            color: value === o.value ? '#fff' : 'var(--txt3)',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12.5,
            cursor: 'pointer', transition: 'all .18s', whiteSpace: 'nowrap', flexShrink: 0,
            boxShadow: value === o.value ? '0 2px 8px rgba(13,148,136,.35)' : 'none',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
