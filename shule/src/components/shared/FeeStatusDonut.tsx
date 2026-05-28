import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const C = {
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#f43f5e',
  txt3:    '#94a3b8',
}

export interface FeeStatusDonutProps {
  paid:        number
  partial:     number
  unpaid:      number
  size?:       number
  showLegend?: boolean
}

interface CustomLabelProps {
  cx:           number
  cy:           number
  total:        number
}

function CentreLabel({ cx, cy, total }: CustomLabelProps) {
  return (
    <g>
      <text
        x={cx} y={cy - 8}
        textAnchor="middle"
        fill="var(--txt)"
        style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 22 }}
      >
        {total}
      </text>
      <text
        x={cx} y={cy + 10}
        textAnchor="middle"
        fill="var(--txt3)"
        style={{ fontSize: 11, fontWeight: 500 }}
      >
        students
      </text>
    </g>
  )
}

interface TooltipPayload {
  name: string
  value: number
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '6px 10px',
      fontSize: 12,
      fontWeight: 600,
      color: 'var(--txt)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      {entry.value} students — {entry.name}
    </div>
  )
}

export function FeeStatusDonut({
  paid,
  partial,
  unpaid,
  size = 160,
  showLegend = false,
}: FeeStatusDonutProps) {
  const total = paid + partial + unpaid
  const cx = size / 2
  const cy = size / 2
  const outerR = size / 2 - 4
  const innerR = outerR * 0.62

  const data = [
    { name: 'Paid',    value: paid,    color: C.success },
    { name: 'Partial', value: partial, color: C.warning },
    { name: 'Unpaid',  value: unpaid,  color: C.danger  },
  ].filter(d => d.value > 0)

  const isEmpty = total === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ width: size, height: size, position: 'relative' }}>
        {isEmpty ? (
          <div style={{
            width: size, height: size, borderRadius: '50%',
            border: `${outerR - innerR}px solid var(--border)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxSizing: 'border-box',
          }}>
            <span style={{ fontSize: 12, color: C.txt3 }}>No data</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={innerR}
                outerRadius={outerR}
                dataKey="value"
                paddingAngle={2}
                stroke="none"
              >
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        )}
        {!isEmpty && (
          <svg
            width={size}
            height={size}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            <CentreLabel cx={cx} cy={cy} total={total} />
          </svg>
        )}
      </div>

      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
          {[
            { label: 'Paid',    value: paid,    color: C.success },
            { label: 'Partial', value: partial, color: C.warning },
            { label: 'Unpaid',  value: unpaid,  color: C.danger  },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: item.color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{item.label}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font-mono)' }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
