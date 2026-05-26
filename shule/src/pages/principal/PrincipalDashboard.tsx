import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useBandwidth } from '../../store/BandwidthContext'
import {
  usePrincipalKpis,
  useTopClasses,
  useSchoolFeeSummary,
  useAuditLog,
} from '../../hooks/usePrincipal'
import { useDisciplineRecords } from '../../hooks/useDeputy'
import type { AuditEntry } from '../../types/week9'

// ── KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, danger, badge, onClick,
}: {
  label: string; value: string | number; sub?: string
  danger?: boolean; badge?: number; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
        borderRadius: 14, padding: '16px 20px', minWidth: 150, flex: 1,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        transition: onClick ? 'box-shadow 0.15s' : undefined,
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)',
        color: danger ? 'var(--danger)' : 'var(--txt)',
      }}>
        {value}
        {badge != null && badge > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 12, background: 'var(--danger)', color: '#fff',
            borderRadius: 99, padding: '2px 7px', fontWeight: 800,
          }}>
            {badge}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────
function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Approve Report Cards', path: '/principal/report-cards', color: 'var(--brand)' },
    { label: 'View Audit Log',       path: '/principal/audit',        color: 'var(--txt2)'  },
    { label: 'Send Announcement',    path: '/principal/messages',     color: 'var(--violet)' },
    { label: 'Fee Summary',          path: '/bursar/dashboard',       color: 'var(--warning)' },
  ]

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {actions.map(a => (
        <button
          key={a.path}
          onClick={() => navigate(a.path)}
          style={{
            padding: '10px 18px', borderRadius: 10, border: `1px solid ${a.color}30`,
            background: `${a.color}10`, color: a.color, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = `${a.color}20`)}
          onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = `${a.color}10`)}
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}

// ── Top Classes Bar Chart ──────────────────────────────────────────────────
function TopClassesChart() {
  const { data: classes = [], isLoading } = useTopClasses()
  const { isLowBandwidth } = useBandwidth()

  if (isLoading) return <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading class data…</div>
  if (classes.length === 0) return <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No class performance data yet.</div>

  if (isLowBandwidth) {
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Class', 'Pass Rate', 'Avg Score'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--txt3)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((c: any) => (
            <tr key={c.className}>
              <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--txt)' }}>{c.className}</td>
              <td style={{ padding: '4px 8px', color: 'var(--brand)' }}>{c.passRate}%</td>
              <td style={{ padding: '4px 8px', color: 'var(--txt2)' }}>{c.avgScore ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={classes} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="className" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip formatter={(v) => [`${Number(v)}%`, 'Pass Rate']} />
        <Bar dataKey="passRate" fill="var(--brand)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Fee Overview Panel ─────────────────────────────────────────────────────
function FeeOverviewPanel() {
  const { data: fee, isLoading } = useSchoolFeeSummary()

  if (isLoading) return <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading fee data…</div>

  const rows = fee ? [
    { label: 'Total Expected',  value: `UGX ${fee.totalExpected.toLocaleString()}`,   color: 'var(--txt)'     },
    { label: 'Total Collected', value: `UGX ${fee.totalCollected.toLocaleString()}`,  color: 'var(--success)' },
    { label: 'Outstanding',     value: `UGX ${fee.outstanding.toLocaleString()}`,     color: 'var(--danger)'  },
    { label: 'Overdue Count',   value: fee.overdueCount,                              color: fee.overdueCount > 0 ? 'var(--warning)' : 'var(--txt3)' },
  ] : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => (
        <div key={r.label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, color: 'var(--txt2)', fontWeight: 600 }}>{r.label}</span>
          <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 14, color: r.color }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Recent Activity ────────────────────────────────────────────────────────
function RecentActivity() {
  const { data: auditEntries = [] } = useAuditLog({ limit: 10 })
  const { data: discipline  = [] } = useDisciplineRecords()
  const recentDiscipline = discipline.slice(0, 5)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Audit log */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: 'var(--txt)',
          borderBottom: '1px solid var(--border)' }}>
          Recent Audit Log
        </div>
        {auditEntries.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--txt3)', fontSize: 12, textAlign: 'center' }}>
            No audit entries yet.
          </div>
        ) : (
          auditEntries.map((e: AuditEntry) => (
            <div key={e.id} style={{
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--txt)' }}>{e.action}</span>
                <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 6 }}>on {e.tableName}</span>
                <div style={{ fontSize: 10, color: 'var(--txt3)' }}>by {e.userRole}</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                {new Date(e.createdAt).toLocaleString('en-GB', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent discipline */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: 'var(--txt)',
          borderBottom: '1px solid var(--border)' }}>
          Recent Discipline Records
        </div>
        {recentDiscipline.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--txt3)', fontSize: 12, textAlign: 'center' }}>
            No discipline records.
          </div>
        ) : (
          recentDiscipline.map(r => (
            <div key={r.id} style={{
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>
                {r.nature.charAt(0).toUpperCase() + r.nature.slice(1)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                {r.incidentDate} · {r.resolution.slice(0, 60)}{r.resolution.length > 60 ? '…' : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PRINCIPAL DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function PrincipalDashboard() {
  const navigate = useNavigate()
  const { data: kpis, isLoading: kpisLoading } = usePrincipalKpis()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          School Overview
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Full visibility across academics, finance, attendance, and staff.
        </div>
      </div>

      {/* Term Progress Timeline */}
      <SafeTermProgressTimeline />

      {/* Section 1 — KPI Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {kpisLoading ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading KPIs…</div>
        ) : kpis ? (
          <>
            <KpiCard label="Total Students"      value={kpis.totalStudents} />
            <KpiCard label="Total Staff"         value={kpis.totalStaff} />
            <KpiCard label="Pass Rate"           value={`${kpis.overallPassRate}%`}
              sub="This term" />
            <KpiCard label="Fee Collection"      value={`${kpis.feeCollectionRate}%`}
              danger={kpis.feeCollectionRate < 80} sub="of expected fees" />
            <KpiCard label="Attendance"          value={`${kpis.attendanceRateThisWeek}%`}
              sub="This week" danger={kpis.attendanceRateThisWeek < 80} />
            <KpiCard
              label="Pending Approvals" value={kpis.pendingReportCards}
              badge={kpis.pendingReportCards}
              danger={kpis.pendingReportCards > 0}
              onClick={() => navigate('/principal/report-cards')}
            />
          </>
        ) : null}
      </div>

      {/* Section 2 — Quick Actions */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Quick Actions</div>
        <QuickActions />
      </div>

      {/* Section 3 — Academic + Fee Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>
            Top 5 Classes — Pass Rate
          </div>
          <TopClassesChart />
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>
            Fee Collection Summary
          </div>
          <FeeOverviewPanel />
        </div>
      </div>

      {/* Section 4 — Recent Activity */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
          Recent Activity
        </div>
        <RecentActivity />
      </div>
    </div>
  )
}
