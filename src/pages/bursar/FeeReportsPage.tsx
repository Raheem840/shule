import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts'
import ExcelJS from 'exceljs'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  useFeeCollectionByClass, useBursarKpis, useFeeCollectionOverTime,
  useTopDefaulters, useFeeCollectionByStudentType, ugx,
} from '../../hooks/useFeePayments'
import { useAcademicYears } from '../../hooks/useFeeStructure'
import { useCurrentTermDefault } from '../../hooks/useCurrentTerm'

const TERM_OPTIONS = [
  { value: 1, label: 'Term 1' },
  { value: 2, label: 'Term 2' },
  { value: 3, label: 'Term 3' },
] as const

function ugxCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function FeeReportsPage() {
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYears()
  // Auto-corrects once to whichever term today's date falls in, as soon as
  // real term dates load — previously stayed hardcoded at Term 1 forever, so
  // reports/exports mid-Term-2/3 silently showed Term 1 numbers by default.
  const [term, setTerm] = useCurrentTermDefault(academicYears.find(y => y.isActive) ?? null)

  // Default to the active year once years are loaded
  const resolvedYearId = useMemo(() => {
    if (academicYearId) return academicYearId
    return academicYears.find(y => y.isActive)?.id ?? academicYears[0]?.id ?? null
  }, [academicYearId, academicYears])

  const yearLabel = academicYears.find(y => y.id === resolvedYearId)?.name ?? ''

  const { data: classes = [], isLoading: classLoading } = useFeeCollectionByClass(term, resolvedYearId)
  const { data: kpis, isLoading: kpisLoading, isError: kpisError } = useBursarKpis(term, resolvedYearId)
  const { data: overTime, isLoading: overTimeLoading } = useFeeCollectionOverTime(term, resolvedYearId)
  const { data: defaulters = [], isLoading: defaultersLoading } = useTopDefaulters(term, resolvedYearId, 10)
  const { data: typeSplit, isLoading: typeSplitLoading } = useFeeCollectionByStudentType(term, resolvedYearId)

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

  // Sum per-class monthly collections into one "Collected" trend series
  const trendData = (overTime?.points ?? []).map(p => ({
    month: p.month as string,
    collected: (overTime?.classes ?? []).reduce((sum, cls) => sum + (Number(p[cls]) || 0), 0),
  }))

  async function handleExport() {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Fee Report')

    ws.mergeCells('A1:D1')
    const title = ws.getCell('A1')
    title.value = `FEE REPORT — TERM ${term}, ${yearLabel}`
    title.font  = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    title.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } }
    title.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    ws.addRow([])
    ws.addRow(['Expected', 'Collected', 'Outstanding', 'Collection Rate'])
    ws.getRow(3).eachCell(c => { c.font = { bold: true } })
    const rate = kpis && kpis.expected > 0 ? Math.round((kpis.collected / kpis.expected) * 100) : 0
    ws.addRow([kpis?.expected ?? 0, kpis?.collected ?? 0, kpis?.outstanding ?? 0, `${rate}%`])

    ws.addRow([])
    ws.addRow(['Class', 'Collected', 'Outstanding', 'Rate'])
    ws.getRow(ws.rowCount).eachCell(c => { c.font = { bold: true } })
    for (const c of classes) {
      const total = c.collected + c.outstanding
      const r = total > 0 ? Math.round((c.collected / total) * 100) : 0
      ws.addRow([c.className, c.collected, c.outstanding, `${r}%`])
    }

    ws.addRow([])
    ws.addRow(['Top Outstanding Balances'])
    ws.addRow(['Student', 'Admission No.', 'Class', 'Due', 'Paid', 'Balance'])
    ws.getRow(ws.rowCount).eachCell(c => { c.font = { bold: true } })
    for (const d of defaulters) {
      ws.addRow([`${d.firstName} ${d.lastName}`, d.admissionNumber, d.className, d.amountDue, d.amountPaid, d.balance])
    }

    ws.columns.forEach(col => { col.width = 18 })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `fee-report-T${term}-${yearLabel.replace(/[^a-zA-Z0-9]+/g, '-')}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero band ──────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden', position: 'relative',
        background: 'linear-gradient(135deg, #065f46 0%, #0d9488 55%, #0f766e 100%)',
        padding: '26px 28px 22px',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 100, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>Fee Reports</h1>
                <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: '2px 0 0' }}>Collection analytics, trends, and top outstanding balances</p>
              </div>
            </div>
            <button
              onClick={() => void handleExport()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 12, border: '.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', backdropFilter: 'blur(8px)', color: '#fff', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export Report
            </button>
          </div>

          {/* KPI glass chips */}
          {kpis && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { label: 'Expected',       value: ugxCompact(kpis.expected) },
                { label: 'Collected',      value: ugxCompact(kpis.collected) },
                { label: 'Outstanding',    value: ugxCompact(kpis.outstanding) },
                { label: 'Collection Rate', value: kpis.expected > 0 ? `${Math.round((kpis.collected / kpis.expected) * 100)}%` : '—' },
              ].map(k => (
                <div key={k.label} style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.25)', borderRadius: 14, padding: '10px 18px', minWidth: 110 }}>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1 }}>{k.value}</div>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}
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
          {kpisError && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
              Could not load fee totals. Check your connection and try again.
            </div>
          )}

          {/* Monthly collection trend */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Collection Trend This Term</div>
            {overTimeLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><LoadingSpinner size="sm" /></div>
            ) : trendData.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No dated payments recorded yet this term.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <defs>
                    <linearGradient id="collectedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                  <YAxis tickFormatter={ugxCompact} tick={{ fontSize: 10, fill: 'var(--txt3)' }} />
                  <Tooltip formatter={v => ugx(Number(v))} />
                  <Area type="monotone" dataKey="collected" name="Collected" stroke="#0d9488" fill="url(#collectedGradient)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Boarder / Day split */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 14 }}>Boarder vs Day-Scholar Collection</div>
            {typeSplitLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><LoadingSpinner size="sm" /></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {(['boarder', 'day'] as const).map(t => {
                  const s     = typeSplit?.[t] ?? { collected: 0, outstanding: 0 }
                  const total = s.collected + s.outstanding
                  const rate  = total > 0 ? Math.round((s.collected / total) * 100) : 0
                  return (
                    <div key={t} style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)', textTransform: 'capitalize' }}>
                          {t === 'boarder' ? 'Boarders' : 'Day Scholars'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)' }}>{rate}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'var(--surface)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{ width: `${rate}%`, height: '100%', background: rate >= 80 ? 'var(--success)' : rate >= 50 ? 'var(--warning)' : 'var(--danger)', borderRadius: 3 }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                        <span style={{ color: 'var(--success)', fontWeight: 700, fontFamily: 'var(--font3)' }}>{ugx(s.collected)}</span>
                        <span style={{ color: s.outstanding > 0 ? 'var(--danger)' : 'var(--txt3)', fontWeight: 600, fontFamily: 'var(--font3)' }}>{ugx(s.outstanding)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

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

          {/* Top outstanding balances */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
              Top Outstanding Balances
            </div>
            {defaultersLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><LoadingSpinner size="sm" /></div>
            ) : defaulters.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No outstanding balances this term — fully collected.</div>
            ) : (
              <div className="mob-cards" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Student', 'Class', 'Type', 'Due', 'Paid', 'Balance'].map(h => (
                        <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.map(d => (
                      <tr key={d.studentId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 14px', fontSize: 12.5, fontWeight: 700, color: 'var(--txt)' }}>
                          {d.firstName} {d.lastName}
                          <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 500 }}>{d.admissionNumber}</div>
                        </td>
                        <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--txt2)' }}>{d.className}</td>
                        <td style={{ padding: '9px 14px', fontSize: 11.5, color: 'var(--txt3)', textTransform: 'capitalize' }}>{d.studentType}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>{ugx(d.amountDue)}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--success)' }}>{ugx(d.amountPaid)}</td>
                        <td style={{ padding: '9px 14px', fontSize: 12.5, fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--danger)' }}>{ugx(d.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
