// TermPicker — pill-style term selector (Term 1 / Term 2 / Term 3)
// Supports two value formats via `format` prop:
//   'short'  → values are '1', '2', '3'  (default)
//   'full'   → values are 'Term 1', 'Term 2', 'Term 3'
//   'number' → values are 1, 2, 3  (numeric)

type ShortFormat = { format?: 'short'; value: string; onChange: (v: string) => void }
type FullFormat  = { format: 'full';   value: string; onChange: (v: string) => void }
type NumFormat   = { format: 'number'; value: number; onChange: (v: number) => void }

type Props = (ShortFormat | FullFormat | NumFormat) & {
  allowAll?: boolean
  allLabel?: string
}

export function TermPicker(props: Props) {
  const { allowAll = false, allLabel = 'All' } = props

  const terms: Array<{ val: string | number; label: string }> =
    props.format === 'full'
      ? [{ val: 'Term 1', label: 'Term 1' }, { val: 'Term 2', label: 'Term 2' }, { val: 'Term 3', label: 'Term 3' }]
      : props.format === 'number'
      ? [{ val: 1, label: 'Term 1' }, { val: 2, label: 'Term 2' }, { val: 3, label: 'Term 3' }]
      : [{ val: '1', label: 'Term 1' }, { val: '2', label: 'Term 2' }, { val: '3', label: 'Term 3' }]

  const allVal = props.format === 'number' ? (0 as any) : ''
  const options = allowAll ? [{ val: allVal, label: allLabel }, ...terms] : terms

  return (
    <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 14, padding: 3, border: '.5px solid var(--border)', gap: 2, flexShrink: 0 }}>
      {options.map(({ val, label }) => {
        const on = props.value == val
        return (
          <button
            key={String(val)}
            type="button"
            onClick={() => (props.onChange as (v: any) => void)(val)}
            style={{
              flex: '1 0 auto', minWidth: 64, height: 36, padding: '0 14px', borderRadius: 11, border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font2)', fontWeight: on ? 800 : 600, fontSize: 13,
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--brand)' : 'var(--txt3)',
              boxShadow: on ? '0 2px 10px rgba(0,0,0,.09)' : 'none',
              transition: 'all .18s cubic-bezier(.32,.72,0,1)',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
