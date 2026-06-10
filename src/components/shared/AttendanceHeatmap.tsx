export interface HeatmapWeek {
  weekNumber: number
  weekLabel:  string
  rate:        number | null
}

export interface HeatmapClass {
  className: string
  classId:   string
  weeks:     HeatmapWeek[]
}

export interface AttendanceHeatmapProps {
  data:      HeatmapClass[]
  termWeeks: number
}

function cellStyle(rate: number | null): React.CSSProperties {
  if (rate === null) return { background: '#f8fafc', color: '#94a3b8' }
  if (rate >= 90)   return { background: '#ecfdf5', color: '#10b981' }
  if (rate >= 80)   return { background: '#fefce8', color: '#ca8a04' }
  if (rate >= 70)   return { background: '#fff7ed', color: '#c2410c' }
  return              { background: '#fff1f2', color: '#f43f5e' }
}

export function AttendanceHeatmap({ data, termWeeks }: AttendanceHeatmapProps) {
  if (!data.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        No attendance data available.
      </div>
    )
  }

  // Build week columns from termWeeks if data sparse
  const weeks = Array.from({ length: termWeeks }, (_, i) => i + 1)

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
                minWidth: 110,
                whiteSpace: 'nowrap',
              }}
            >
              Class
            </th>
            {weeks.map(w => (
              <th
                key={w}
                style={{
                  width: 52, minWidth: 52, maxWidth: 52,
                  padding: '4px 2px',
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--txt3)',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                W{w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((cls, ri) => {
            const weekMap = new Map<number, HeatmapWeek>()
            for (const w of cls.weeks) weekMap.set(w.weekNumber, w)

            return (
              <tr key={cls.classId} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.012)' }}>
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
                  {cls.className}
                </td>
                {weeks.map(w => {
                  const wk = weekMap.get(w)
                  const rate = wk?.rate ?? null
                  const cs = cellStyle(rate)
                  const title = wk
                    ? `${cls.className} · ${wk.weekLabel} · ${rate !== null ? rate + '%' : '—'}`
                    : `${cls.className} · Week ${w} · —`
                  return (
                    <td
                      key={w}
                      title={title}
                      style={{
                        width: 52, minWidth: 52, maxWidth: 52,
                        height: 36,
                        textAlign: 'center',
                        fontSize: 11,
                        fontWeight: 700,
                        verticalAlign: 'middle',
                        cursor: 'default',
                        ...cs,
                        borderRadius: 4,
                        margin: 1,
                        padding: 0,
                      }}
                    >
                      {rate !== null ? `${rate}%` : '—'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
