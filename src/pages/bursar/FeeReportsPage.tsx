import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useFeeCollectionByClass, useBursarKpis, ugx } from '../../hooks/useFeePayments'
import { useAcademicYears } from '../../hooks/useFeeStructure'

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
  const [term, setTerm] = useState(1)
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYears()

  // Default to the active year once years are loaded
  const resolvedYearId = useMemo(() => {
    if (academicYearId) return academicYearId
    return academicYears.find(y => y.isActive)?.id ?? academicYears[0]?.id ?? null
  }, [academicYearId, academicYears])

  const { data: classes = [], isLoading: classLoading } = useFeeCollectionByClass(term, resolvedYearId)
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useBursarKpis(term, resolvedYearId)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(16,185,129,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Fee Reports</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Collection analytics and payment summaries</p>
        </div>
      </div>

      {/* Term / Academic Year selectors */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Term pills */}
        <div style={{ display: 'flex', gap: 6, background: 'var(--surface2)', borderRadius: 99, padding: 4, border: '1px solid var(--border)' }}>
          {TERM_OPTIONS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTerm(t.value)}
              style={{
                padding: '10px 18px',
                borderRadius: 99,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--font2)',
                fontWeight: 700,
                fontSize: 13,
                transition: 'all .15s',
                background: term === t.value
                  ? 'linear-gradient(135deg, var(--brand), var(--brand-dark))'
                  : 'transparent',
                color: term === t.value ? '#fff' : 'var(--txt3)',
                boxShadow: term === t.value ? '0 2px 8px rgba(13,148,136,.35)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Academic year dropdown (kept as select — year labels are long) */}
        <select
          className="sui-input"
          value={resolvedYearId ?? ''}
          onChange={e => setAcademicYearId(e.target.value || null)}
          style={{ minWidth: 160 }}
        >
          {academicYears.map(y => (
            <option key={y.id} value={y.id}>
              {y.name}{y.isActive ? ' (Current)' : ''}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <>
          {/* KPI summary */}
          {kpisError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
              Could not load fee totals. Check your connection and try again.
            </div>
          )}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
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
          <div className="mob-cards" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
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
