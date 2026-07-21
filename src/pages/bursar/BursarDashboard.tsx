import { useState } from 'react'
import { csvField } from '../../lib/csv'
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
import { useCurrentTermDefault } from '../../hooks/useCurrentTerm'

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

// ── Chart card ────────────────────────────────────────────────
function ChartCard({
  term, points, classNames, totalCollected, totalOutstanding, collectionPct, isLoading,
}: {
  term: number; points: any[]; classNames: string[]
  totalCollected: number; totalOutstanding: number; collectionPct: number; isLoading: boolean
}) {
  function exportCSV() {
    if (!points.length) return
    const cols = ['Month', ...classNames.slice(0, 8)]
    const rows = points.map(p => cols.map(c => csvField(c === 'Month' ? p.month : (p[c] ?? 0))).join(','))
    const csv  = [cols.map(csvField).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `fee-collection-trend.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = totalCollected + totalOutstanding > 0

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px 0', background: 'linear-gradient(135deg,rgba(13,148,136,.05) 0%,rgba(139,92,246,.03) 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.3, marginBottom: 3 }}>
              Fee Collection Trend
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Monthly payments received per class · all terms</div>
          </div>
          <button
            onClick={exportCSV}
            disabled={!points.length}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, cursor: points.length ? 'pointer' : 'not-allowed', opacity: points.length ? 1 : 0.4, transition: 'all .14s' }}
            onMouseEnter={e => { if (points.length) { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' } }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>

        {/* Stat strip */}
        {hasData && (
          <div style={{ display: 'flex', borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', borderRadius: '10px 10px 0 0', overflow: 'hidden' }}>
            {([
              { label: 'Total Collected',  value: ugxCompact(totalCollected),    color: 'var(--success)' as const, pct: null },
              { label: 'Outstanding',      value: ugxCompact(totalOutstanding),  color: 'var(--danger)'  as const, pct: null },
              { label: `Term ${term} Rate`,value: `${collectionPct}%`,           color: (collectionPct >= 80 ? 'var(--success)' : collectionPct >= 50 ? 'var(--brand)' : 'var(--warning)') as string, pct: collectionPct },
            ] as const).map((s, i) => (
              <div key={s.label} style={{ flex: 1, padding: '12px 16px', background: 'var(--surface)', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 15, color: s.color, lineHeight: 1 }}>{s.value}</div>
                {s.pct !== null && (
                  <div style={{ marginTop: 6, height: 3, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 99, transition: 'width .6s' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart body */}
      <div style={{ padding: '16px 20px 20px' }}>
        {isLoading ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size="md" /></div>
        ) : points.length === 0 ? (
          <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No payment data yet</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Record payments with dates to see the trend</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={points} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <defs>
                {classNames.slice(0, 8).map((cls, i) => (
                  <linearGradient key={cls} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={CLASS_COLORS[i % CLASS_COLORS.length]} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CLASS_COLORS[i % CLASS_COLORS.length]} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--txt3)', fontFamily: 'var(--font2)' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={axisCompact} tick={{ fontSize: 11, fill: 'var(--txt3)' }} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: 'var(--font2)', paddingTop: 14 }} iconType="circle" iconSize={8} />
              {classNames.slice(0, 8).map((cls, i) => (
                <Area key={cls} type="monotone" dataKey={cls}
                  stroke={CLASS_COLORS[i % CLASS_COLORS.length]} strokeWidth={2.5}
                  fill={`url(#grad-${i})`} dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, fill: CLASS_COLORS[i % CLASS_COLORS.length] }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export function BursarDashboard() {
  const [academicYearId, setAcademicYearId] = useState<string | null>(null)

  const { data: academicYears = [] } = useAcademicYears()
  const activeYear = academicYears.find(y => y.isActive) ?? academicYears[0]
  const effectiveYearId = academicYearId ?? activeYear?.id ?? null

  // Defaults to Term 1 until the active academic year loads, then
  // auto-corrects once to whichever term today's date actually falls in —
  // previously stayed hardcoded at Term 1 forever, so the KPI cards
  // silently showed Term 1 collection data even mid-Term-2/3.
  const [term, setTerm] = useCurrentTermDefault(activeYear)

  const kpis      = useBursarKpis(term, effectiveYearId)
  const byClass   = useFeeCollectionByClass(term, effectiveYearId)
  const overTime  = useFeeCollectionOverTime(term, effectiveYearId)
  const recent    = useRecentPayments(10)
  const smsCount  = useSmsCount()

  const K = kpis.data
  const kpisError = kpis.isError
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
      <div className="mob-hero" style={{
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
      <div className="mob-hscroll" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginRight: 4 }}>Term</span>
        {([1, 2, 3] as const).map(t => (
          <button key={t} onClick={() => setTerm(t)} style={{
            padding: '10px 16px', minHeight: 36, border: 'none', borderRadius: 20,
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
      {kpisError && (
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: 13 }}>
          Could not load fee totals. Check your connection and try again.
        </div>
      )}
      <div className="stagger-cards mob-kpi-2col mob-kpi-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard label="Total Expected"  value={K ? ugxCompact(K.expected)    : '—'} sub={K && K.expected >= 1000 ? ugx(K.expected) : `Term ${term}`} accent="brand" />
        <KpiCard label="Total Collected" value={K ? ugxCompact(K.collected)   : '—'} sub={K && K.collected >= 1000 ? ugx(K.collected) : undefined} accent="success" />
        <KpiCard label="Outstanding"     value={K ? ugxCompact(K.outstanding) : '—'} sub={K && K.outstanding >= 1000 ? ugx(K.outstanding) : undefined} accent="danger" />
        <KpiCard label="Fully Unpaid"    value={K ? String(K.unpaidCount) : '—'} sub="students" accent="warning" />
        <KpiCard label="SMS Reminders"   value={smsCount.data != null ? String(smsCount.data) : '—'} sub="queued" accent="violet" />
      </div>

      {/* ── PREMIUM FEE COLLECTION CHART ──────────────────────── */}
      <ChartCard
        term={term}
        points={points}
        classNames={classNames}
        totalCollected={totalCollected}
        totalOutstanding={totalOutstanding}
        collectionPct={collectionPct}
        isLoading={overTime.isLoading}
      />

      {/* ── Class breakdown bar + Recent payments ─────────────── */}
      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}>

        {/* Class breakdown — current term */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>
            Term {term} — Collection by Class
          </div>
          {byClass.isLoading ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingSpinner size="sm" /></div>
          ) : byClass.isError ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', fontSize: 12 }}>Could not load class data</div>
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
          ) : recent.isError ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', fontSize: 12 }}>Could not load recent payments</div>
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
