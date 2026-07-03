export interface ContributionCell {
  label: string
  count: number
}

export interface ContributionRow {
  id:    string
  label: string
  cells: ContributionCell[]
}

export interface ContributionHeatmapProps {
  columnLabels: string[]
  rows:         ContributionRow[]
  emptyMessage?: string
}

// GitHub-contributions-style intensity scale — 5 buckets from "no activity" to "high activity".
function cellStyle(count: number, max: number): React.CSSProperties {
  if (count === 0 || max === 0) return { background: '#f1f5f9', color: '#94a3b8' }
  const ratio = count / max
  if (ratio >= 0.75) return { background: '#0d9488', color: '#fff' }
  if (ratio >= 0.5)  return { background: '#2dd4bf', color: '#053b36' }
  if (ratio >= 0.25) return { background: '#99f6e4', color: '#0f766e' }
  return                { background: '#ccfbf1', color: '#0f766e' }
}

export function ContributionHeatmap({ columnLabels, rows, emptyMessage }: ContributionHeatmapProps) {
  if (!rows.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        {emptyMessage ?? 'No data available.'}
      </div>
    )
  }

  const max = Math.max(1, ...rows.flatMap(r => r.cells.map(c => c.count)))

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky', left: 0, zIndex: 2,
                background: 'var(--surface)',
                padding: '6px 12px',
                textAlign: 'left',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'var(--txt3)',
                borderBottom: '1px solid var(--border)',
                minWidth: 90,
                whiteSpace: 'nowrap',
              }}
            >
              Class
            </th>
            {columnLabels.map(c => (
              <th
                key={c}
                style={{
                  width: 34, minWidth: 34, maxWidth: 34,
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--txt3)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={row.id} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
              <td
                style={{
                  position: 'sticky', left: 0, zIndex: 1,
                  background: ri % 2 === 0 ? 'var(--surface)' : 'var(--surface2)',
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--txt)',
                  whiteSpace: 'nowrap',
                  borderRight: '1px solid var(--border)',
                }}
              >
                {row.label}
              </td>
              {row.cells.map((cell, ci) => (
                <td
                  key={ci}
                  title={`${row.label} · ${cell.label} · ${cell.count}`}
                  style={{
                    width: 34, minWidth: 34, maxWidth: 34,
                    height: 24,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    verticalAlign: 'middle',
                    cursor: 'default',
                    ...cellStyle(cell.count, max),
                    borderRadius: 4,
                    padding: 0,
                  }}
                >
                  {cell.count > 0 ? cell.count : ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
