import { useMemo, useState } from 'react'
import type { DisciplineRecord } from '../../types/week9'

// GitHub-contributions-style intensity scale — reuses the same teal buckets
// as ContributionHeatmap.tsx for visual consistency across the app.
function cellColor(count: number, max: number): { bg: string; border: string } {
  if (count === 0 || max === 0) return { bg: '#f1f5f9', border: 'rgba(0,0,0,.04)' }
  const ratio = count / max
  if (ratio >= 0.75) return { bg: '#0d9488', border: '#0f766e' }
  if (ratio >= 0.5)  return { bg: '#2dd4bf', border: '#0d9488' }
  if (ratio >= 0.25) return { bg: '#99f6e4', border: '#2dd4bf' }
  return                { bg: '#ccfbf1', border: '#99f6e4' }
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_ROW_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']   // Sun=0 … Sat=6, GitHub shows alternating labels

function localDateKey(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DisciplineCalendarHeatmap({ records }: { records: DisciplineRecord[] }) {
  const [hovered, setHovered] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const { weeks, monthLabels, maxCount, totalIncidents } = useMemo(() => {
    const countByDate = new Map<string, number>()
    for (const r of records) {
      countByDate.set(r.incidentDate, (countByDate.get(r.incidentDate) ?? 0) + 1)
    }

    // Last 53 weeks ending today, grid starts on the Sunday on/before 52 weeks ago.
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - 52 * 7)
    start.setDate(start.getDate() - start.getDay())   // snap back to Sunday

    const weeks: { date: Date; key: string; count: number }[][] = []
    let cursor = new Date(start)
    while (cursor <= today) {
      const week: { date: Date; key: string; count: number }[] = []
      for (let d = 0; d < 7; d++) {
        const key = localDateKey(cursor)
        week.push({ date: new Date(cursor), key, count: cursor > today ? -1 : (countByDate.get(key) ?? 0) })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
    }

    // Month label sits above the first week column that enters a new month.
    const monthLabels: { weekIndex: number; label: string }[] = []
    let lastMonth = -1
    weeks.forEach((week, wi) => {
      const m = week[0].date.getMonth()
      if (m !== lastMonth) {
        monthLabels.push({ weekIndex: wi, label: MONTH_NAMES[m] })
        lastMonth = m
      }
    })

    const maxCount = Math.max(1, ...Array.from(countByDate.values()))
    const totalIncidents = records.length

    return { weeks, monthLabels, countByDate, maxCount, totalIncidents }
  }, [records])

  const cellSize = 12
  const gap = 3

  if (records.length === 0) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        No incidents recorded in the selected range — nothing to plot yet.
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, minWidth: weeks.length * (cellSize + gap) + 30 }}>
          {/* Month labels */}
          <div style={{ display: 'flex', paddingLeft: 30 }}>
            {weeks.map((_, wi) => {
              const m = monthLabels.find(ml => ml.weekIndex === wi)
              return (
                <div key={wi} style={{ width: cellSize + gap, fontSize: 10, fontWeight: 700, color: 'var(--txt3)', flexShrink: 0 }}>
                  {m ? m.label : ''}
                </div>
              )
            })}
          </div>

          {/* Grid — day-of-week rows × week columns */}
          <div style={{ display: 'flex', gap }}>
            {/* Day-of-week row labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap, width: 26, flexShrink: 0 }}>
              {DAY_ROW_LABELS.map((lbl, i) => (
                <div key={i} style={{ height: cellSize, fontSize: 9, color: 'var(--txt3)', display: 'flex', alignItems: 'center' }}>{lbl}</div>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap, flexShrink: 0 }}>
                {week.map(cell => {
                  if (cell.count === -1) {
                    return <div key={cell.key} style={{ width: cellSize, height: cellSize }} />
                  }
                  const { bg, border } = cellColor(cell.count, maxCount)
                  return (
                    <div
                      key={cell.key}
                      onMouseEnter={e => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setHovered({ date: cell.key, count: cell.count, x: r.left + r.width / 2, y: r.top })
                      }}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        width: cellSize, height: cellSize, borderRadius: 3,
                        background: bg, border: `1px solid ${border}`,
                        cursor: 'default', transition: 'transform .1s',
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend + total */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)' }}>
          {totalIncidents} incident{totalIncidents !== 1 ? 's' : ''} in the last 52 weeks
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 10.5, color: 'var(--txt3)' }}>Less</span>
          {[0, 0.2, 0.4, 0.65, 0.9].map((r, i) => {
            const { bg, border } = cellColor(Math.round(r * maxCount) || (r > 0 ? 1 : 0), maxCount)
            return <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: bg, border: `1px solid ${border}` }} />
          })}
          <span style={{ fontSize: 10.5, color: 'var(--txt3)' }}>More</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div style={{
          position: 'fixed', left: hovered.x, top: hovered.y - 10, transform: 'translate(-50%, -100%)',
          background: 'var(--txt)', color: 'var(--surface)', fontSize: 11.5, fontWeight: 600,
          padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 999,
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
        }}>
          {hovered.count} incident{hovered.count !== 1 ? 's' : ''} · {new Date(hovered.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      )}
    </div>
  )
}
