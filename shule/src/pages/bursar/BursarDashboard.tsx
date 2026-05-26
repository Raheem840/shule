import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import {
  useBursarKpis, useFeeCollectionByClass, useRecentPayments, useSmsCount,
  ugx,
} from '../../hooks/useFeePayments'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'

// ── UGX compact formatter for chart axis ──────────────────────
function ugxCompact(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

// ── KPI card ──────────────────────────────────────────────────
function KpiCard({
  label, value, sub, accent,
}: {
  label:   string
  value:   string
  sub?:    string
  accent?: 'brand' | 'danger' | 'warning' | 'violet' | 'info'
}) {
  const colors: Record<string, string> = {
    brand:   'var(--brand)',
    danger:  'var(--danger)',
    warning: 'var(--warning)',
    violet:  'var(--violet)',
    info:    'var(--info)',
  }
  const color = accent ? colors[accent] : 'var(--txt)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '1.25rem 1.5rem',
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{sub}</div>}
    </div>
  )
}

// ── Recent payment row ────────────────────────────────────────
function PaymentRow({ p }: { p: ReturnType<typeof useRecentPayments>['data'] extends (infer T)[] | undefined ? T : never }) {
  return (
    <tr className="sui-tr">
      <td style={{ padding: '0.65rem 1rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
          {p.firstName} {p.lastName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{p.className}</div>
      </td>
      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font3)', fontWeight: 600, color: 'var(--brand)', fontSize: 13 }}>
        {ugx(p.amountPaid)}
      </td>
      <td style={{ padding: '0.65rem 1rem', fontSize: 12, color: 'var(--txt2)' }}>
        {p.paymentDate ?? '—'}
      </td>
      <td style={{ padding: '0.65rem 1rem', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt3)' }}>
        {p.receiptNumber ?? '—'}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()

export function BursarDashboard() {
  const [term, setTerm] = useState<1 | 2 | 3>(1)
  const [year, setYear] = useState(CURRENT_YEAR)

  const kpis      = useBursarKpis(term, year)
  const chartData = useFeeCollectionByClass(term, year)
  const recent    = useRecentPayments(10)
  const smsCount  = useSmsCount()

  const K = kpis.data

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1200 }}>
      <PageHeader
        title="Bursar Dashboard"
        subtitle="Fee collection overview and recent activity"
      />
      <SafeTermProgressTimeline />

      {/* ── Term selector ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: '1.5rem' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Term</span>
        {([1, 2, 3] as const).map(t => (
          <button
            key={t}
            onClick={() => setTerm(t)}
            style={{
              padding: '0.3rem 1rem', border: 'none', borderRadius: 20,
              background: term === t ? 'var(--brand)' : 'var(--surface2)',
              color: term === t ? '#fff' : 'var(--txt2)',
              fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Term {t}
          </button>
        ))}
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          aria-label="Academic year"
          style={{
            marginLeft: 8, width: 80, padding: '0.3rem 0.6rem',
            border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
            background: 'var(--surface)', color: 'var(--txt)',
            fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13,
            outline: 'none',
          }}
        />
      </div>

      {/* ── KPI grid ──────────────────────────────────────── */}
      {kpis.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <LoadingSpinner size="md" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
          <KpiCard
            label="Total Expected"
            value={K ? ugx(K.expected) : '—'}
            sub={`Term ${term} · ${year}`}
            accent="brand"
          />
          <KpiCard
            label="Total Collected"
            value={K ? ugx(K.collected) : '—'}
            accent="brand"
          />
          <KpiCard
            label="Outstanding"
            value={K ? ugx(K.outstanding) : '—'}
            accent="danger"
          />
          <KpiCard
            label="Fully Unpaid"
            value={K ? String(K.unpaidCount) : '—'}
            sub="students"
            accent="warning"
          />
          <KpiCard
            label="Reminders Queued"
            value={smsCount.data != null ? String(smsCount.data) : '—'}
            sub="all time"
            accent="violet"
          />
        </div>
      )}

      {/* ── Chart + Recent payments ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '1.5rem' }}>

        {/* Bar chart */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '1.25rem',
        }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: '1rem' }}>
            Collection by Class — Term {term} {year}
          </div>
          {chartData.isLoading ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner size="md" />
            </div>
          ) : (chartData.data?.length ?? 0) === 0 ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', fontSize: 13 }}>
              No fee data for this term
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData.data} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="className" tick={{ fontSize: 11, fill: 'var(--txt3)', fontFamily: 'var(--font2)' }} />
                <YAxis tickFormatter={ugxCompact} tick={{ fontSize: 11, fill: 'var(--txt3)' }} />
                <Tooltip
                  formatter={(v) => ugx(Number(v))}
                  contentStyle={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'var(--font2)' }} />
                <Bar dataKey="collected"   name="Collected"   fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="outstanding" name="Outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent payments */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)',
          }}>
            Recent Payments
          </div>
          {recent.isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Student', 'Amount', 'Date', 'Receipt'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', fontSize: 10, fontWeight: 700,
                      color: 'var(--txt3)', padding: '0.5rem 1rem',
                      textTransform: 'uppercase', letterSpacing: 0.8,
                      fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.data?.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 12 }}>No payments yet</td></tr>
                ) : (
                  recent.data?.map(p => <PaymentRow key={p.id} p={p} />)
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
