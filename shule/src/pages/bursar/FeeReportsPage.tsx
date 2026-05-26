import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useFeeCollectionByClass, useBursarKpis, ugx } from '../../hooks/useFeePayments'

const TERM_OPTIONS = [
  { value: 1, label: 'Term 1' },
  { value: 2, label: 'Term 2' },
  { value: 3, label: 'Term 3' },
]

function ugxCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function FeeReportsPage() {
  const currentYear = new Date().getFullYear()
  const [term, setTerm] = useState(1)
  const [year, setYear] = useState(currentYear)

  const { data: classes = [], isLoading: classLoading } = useFeeCollectionByClass(term, year)
  const { data: kpis, isLoading: kpisLoading } = useBursarKpis(term, year)

  const isLoading = classLoading || kpisLoading

  const chartData = classes.map(c => ({
    name:        c.className,
    collected:   c.collected,
    outstanding: c.outstanding,
  }))

  const pieData = [
    { name: 'Collected',   value: kpis?.collected   ?? 0 },
    { name: 'Outstanding', value: kpis?.outstanding ?? 0 },
  ]

  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Fee Reports"
        subtitle="Term-by-term fee collection summary by class."
      />

      {/* Term / Year selectors */}
      <div style={{ display: 'flex', gap: 10 }}>
        <select className="sui-input" value={term} onChange={e => setTerm(Number(e.target.value))}>
          {TERM_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select className="sui-input" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <>
          {/* KPI summary */}
          {kpis && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Expected',        value: ugx(kpis.expected),     color: 'var(--txt2)'    },
                { label: 'Collected',        value: ugx(kpis.collected),   color: 'var(--success)' },
                { label: 'Outstanding',      value: ugx(kpis.outstanding), color: 'var(--danger)'  },
                { label: 'Collection Rate',  value: kpis.expected > 0 ? `${Math.round((kpis.collected / kpis.expected) * 100)}%` : '—', color: 'var(--brand)' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color, fontFamily: 'var(--font3)' }}>{k.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Overview pie + bar chart */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Collection Overview</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent = 0 }) => `${name} ${Math.round(percent * 100)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={i === 0 ? '#0d9488' : '#f43f5e'} />)}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={v => ugx(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Collection by Class</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                  <YAxis tickFormatter={ugxCompact} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                  <Tooltip formatter={v => ugx(Number(v))} />
                  <Bar dataKey="collected"   name="Collected"   fill="#0d9488" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-class table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Class', 'Collected', 'Outstanding', 'Rate'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No fee data for this period.</td></tr>
                ) : classes.map((c, i) => {
                  const total = c.collected + c.outstanding
                  const rate  = total > 0 ? Math.round((c.collected / total) * 100) : 0
                  return (
                    <tr key={c.className ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--txt)', fontSize: 13 }}>{c.className}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--success)', fontWeight: 600 }}>{ugx(c.collected)}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: c.outstanding > 0 ? 'var(--danger)' : 'var(--txt3)' }}>{ugx(c.outstanding)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
                            <div style={{ width: `${rate}%`, height: '100%', background: rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', minWidth: 32 }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
