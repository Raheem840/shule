import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  useBursarKpis, useFeeCollectionByClass, useRecentPayments,
  useSmsCount, useFeeCollectionOverTime, ugx,
} from '../../hooks/useFeePayments'
import { useAcademicYears } from '../../hooks/useFeeStructure'

// ── Formatters ────────────────────────────────────────────────
function ugxCompact(v: number) {
  if (v >= 1_000_000_000) return `UGX ${(v / 1_000_000_000).toFixed(2)}B`
  if (v >= 1_000_000)     return `UGX ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `UGX ${(v / 1_000).toFixed(0)}K`
  return `UGX ${v}`
}

// For chart axis — no UGX prefix, abbreviated
function axisCompact(v: number) {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)         return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── Class palette — up to 8 classes ──────────────────────────
const CLASS_COLORS = [
  '#0d9488', '#8b5cf6', '#0ea5e9', '#f59e0b',
  '#f43f5e', '#10b981', '#6366f1', '#ec4899',
]

// ── Custom tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, e: any) => s + (Number(e.value) || 0), 0)
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '12px 16px', minWidth: 180,
      boxShadow: '0 8px 32px rgba(0,0,0,.18)',
    }}>
      <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12, color: 'var(--txt)', marginBottom: 8 }}>
        {label}
      </div>
      {payload.map((e: any) => (
        <div key={e.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>{e.dataKey}</span>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--txt)', fontFamily: 'var(--font3)', fontWeight: 700 }}>
            {axisCompact(Number(e.value) || 0)}
          </span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: .4 }}>Total</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{axisCompact(total)}</span>
      </div>
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────
const KPI_PATHS: Record<string, string> = {
  brand:   'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  success: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  danger:  'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  violet:  'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  warning: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
}
function KpiCard({ label, value, sub, accent = 'brand' }: {
  label: string; value: string; sub?: string; accent?: 'brand' | 'success' | 'danger' | 'warning' | 'violet'
}) {
  return (
    <div className={`sui-kpi-v2 sui-kpi-accent-${accent}`} style={{ flex: 1, minWidth: 130 }}>
      <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={KPI_PATHS[accent] ?? KPI_PATHS.brand} />
        </svg>
      </div>
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num">{value}</div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Recent payment row ────────────────────────────────────────
function PaymentRow({ p }: { p: ReturnType<typeof useRecentPayments>['data'] extends (infer T)[] | undefined ? T : never }) {
  return (
    <tr className="sui-tr">
      <td style={{ padding: '0.6rem 1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{p.firstName} {p.lastName}</div>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{p.className}</div>
      </td>
      <td style={{ padding: '0.6rem 1rem', fontFamily: 'var(--font3)', fontWeight: 700, color: 'var(--brand)', fontSize: 13 }}>
        {ugx(p.amountPaid)}
      </td>
      <td style={{ padding: '0.6rem 1rem', fontSize: 12, color: 'var(--txt2)' }}>{p.paymentDate ?? '—'}</td>
      <td style={{ padding: '0.6rem 1rem', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>{p.receiptNumber ?? '—'}</td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()

export function BursarDashboard() {
  const [term, setTerm]           = useState<1 | 2 | 3>(1)
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYears()
  const activeYear = academicYears.find(y => y.isActive) ?? academicYears[0]
  const effectiveYearId = academicYearId ?? activeYear?.id ?? null

  const kpis      = useBursarKpis(term, effectiveYearId)
  const byClass   = useFeeCollectionByClass(term, effectiveYearId)
  const overTime  = useFeeCollectionOverTime()
  const recent    = useRecentPayments(10)
  const smsCount  = useSmsCount()

  const K = kpis.data
  const { points = [], classes: classNames = [] } = overTime.data ?? {}

  // Compute total collected from byClass for the chart sub-header
  const totalCollected = (byClass.data ?? []).reduce((s, c) => s + c.collected, 0)
  const totalOutstanding = (byClass.data ?? []).reduce((s, c) => s + c.outstanding, 0)
  const collectionPct = totalCollected + totalOutstanding > 0
    ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100)
    : 0

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero band ─────────────────────────────────────────── */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#0c2a28 100%)',
        padding: '26px 28px 22px', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(13,148,136,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 60, width: 140, height: 140, borderRadius: '50%', background: 'rgba(139,92,246,.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(13,148,136,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0dd9c4" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>Finance Overview</h1>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: '1px 0 0' }}>Fee collection, balances and payment trends</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Term selector ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginRight: 4 }}>Term</span>
        {([1, 2, 3] as const).map(t => (
          <button key={t} onClick={() => setTerm(t)} style={{
            padding: '5px 16px', border: 'none', borderRadius: 20,
            background: term === t ? 'var(--brand)' : 'var(--surface2)',
            color: term === t ? '#fff' : 'var(--txt2)',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
            boxShadow: term === t ? '0 2px 8px rgba(13,148,136,.35)' : 'none',
            transition: 'all .18s',
          }}>T{t}</button>
        ))}
        {academicYears.length > 0 && (
          <select
            value={effectiveYearId ?? ''}
            onChange={e => setAcademicYearId(e.target.value || null)}
            style={{ height: 32, padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontSize: 12, cursor: 'pointer', outline: 'none', marginLeft: 8 }}
          >
            {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}{y.isActive ? ' (Active)' : ''}</option>)}
          </select>
        )}
      </div>

      {/* ── KPI grid ──────────────────────────────────────────── */}
      <div className="stagger-cards" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Total Expected"  value={K ? ugxCompact(K.expected)    : '—'} sub={K && K.expected >= 1000 ? ugx(K.expected) : `Term ${term}`} accent="brand" />
        <KpiCard label="Total Collected" value={K ? ugxCompact(K.collected)   : '—'} sub={K && K.collected >= 1000 ? ugx(K.collected) : undefined} accent="success" />
        <KpiCard label="Outstanding"     value={K ? ugxCompact(K.outstanding) : '—'} sub={K && K.outstanding >= 1000 ? ugx(K.outstanding) : undefined} accent="danger" />
        <KpiCard label="Fully Unpaid"    value={K ? String(K.unpaidCount) : '—'} sub="students" accent="warning" />
        <KpiCard label="SMS Reminders"   value={smsCount.data != null ? String(smsCount.data) : '—'} sub="queued" accent="violet" />
      </div>

      {/* ── PREMIUM FEE COLLECTION CHART ──────────────────────── */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 18, overflow: 'hidden',
      }}>
        {/* Chart header */}
        <div style={{
          padding: '18px 24px 16px',
          background: 'linear-gradient(135deg,rgba(13,148,136,.06) 0%,rgba(139,92,246,.04) 100%)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 15, color: 'var(--txt)', letterSpacing: -.3 }}>
              Fee Collection by Class — Over Time
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
              Monthly payments received per class across all terms
            </div>
          </div>
          {/* Collection progress pill */}
          {totalCollected + totalOutstanding > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, fontFamily: 'var(--font2)' }}>
                Term {term} progress
              </div>
              <div style={{ position: 'relative', width: 120, height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${collectionPct}%`,
                  background: collectionPct >= 80 ? 'var(--success)' : collectionPct >= 50 ? 'var(--brand)' : 'var(--warning)',
                  borderRadius: 99, transition: 'width .6s ease',
                }} />
              </div>
              <div style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13, color: 'var(--brand)' }}>
                {collectionPct}%
              </div>
            </div>
          )}
        </div>

        {/* Chart body */}
        <div style={{ padding: '20px 20px 16px' }}>
          {overTime.isLoading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner size="md" />
            </div>
          ) : points.length === 0 ? (
            <div style={{ height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              <div style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 600 }}>No payment data yet</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Payments with dates will appear here as a trend chart</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={points} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <defs>
                  {classNames.slice(0, 8).map((cls, i) => (
                    <linearGradient key={cls} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={CLASS_COLORS[i % CLASS_COLORS.length]} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={CLASS_COLORS[i % CLASS_COLORS.length]} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: 'var(--txt3)', fontFamily: 'var(--font2)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={axisCompact}
                  tick={{ fontSize: 11, fill: 'var(--txt3)' }}
                  axisLine={false} tickLine={false} width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font2)', paddingTop: 12 }}
                />
                {classNames.slice(0, 8).map((cls, i) => (
                  <Area
                    key={cls}
                    type="monotone"
                    dataKey={cls}
                    stroke={CLASS_COLORS[i % CLASS_COLORS.length]}
                    strokeWidth={2.5}
                    fill={`url(#grad-${i})`}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Class breakdown bar + Recent payments ─────────────── */}
      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}>

        {/* Class breakdown — current term */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>
            Term {term} — Collection by Class
          </div>
          {byClass.isLoading ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size="sm" /></div>
          ) : (byClass.data?.length ?? 0) === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', fontSize: 12 }}>No fee data for this term</div>
          ) : (
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {byClass.data?.map((c, i) => {
                const total = c.collected + c.outstanding
                const pct   = total > 0 ? Math.round((c.collected / total) * 100) : 0
                return (
                  <div key={c.className}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: CLASS_COLORS[i % CLASS_COLORS.length], display: 'inline-block' }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{c.className}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                        <span style={{ fontSize: 11.5, color: 'var(--success)', fontFamily: 'var(--font3)', fontWeight: 700 }}>{ugxCompact(c.collected)}</span>
                        <span style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 700 }}>{pct}%</span>
                      </div>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg,${CLASS_COLORS[i % CLASS_COLORS.length]},${CLASS_COLORS[(i + 1) % CLASS_COLORS.length]})`,
                        transition: 'width .6s ease',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent payments */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>
            Recent Payments
          </div>
          {recent.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><LoadingSpinner size="sm" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Student', 'Amount', 'Date', 'Receipt'].map(h => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--txt3)', padding: '0.5rem 1rem', textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!recent.data?.length ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 12 }}>No payments yet</td></tr>
                  ) : (
                    recent.data.map(p => <PaymentRow key={p.id} p={p} />)
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
