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

// ── KPI Card — premium v2 with icon + accent stripe ──────────────────────
const KPI_ICONS: Record<string, string> = {
  students:  'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  staff:     'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  pass:      'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  fees:      'M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
  attendance:'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
  approval:  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
}

function KpiCard({
  label, value, sub, danger, badge, onClick, accent = 'brand', iconKey,
}: {
  label: string; value: string | number; sub?: string
  danger?: boolean; badge?: number; onClick?: () => void
  accent?: 'brand' | 'danger' | 'warning' | 'violet' | 'success' | 'info'
  iconKey?: keyof typeof KPI_ICONS
}) {
  const effectiveAccent = danger ? 'danger' : accent
  return (
    <div
      onClick={onClick}
      className={`sui-kpi-v2 sui-kpi-accent-${effectiveAccent}`}
      style={{ flex: 1, minWidth: 150, cursor: onClick ? 'pointer' : 'default' }}
    >
      {iconKey && (
        <div className={`sui-kpi-icon sui-kpi-icon-${effectiveAccent}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={KPI_ICONS[iconKey]} />
          </svg>
        </div>
      )}
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num" style={{ color: danger ? 'var(--danger)' : 'var(--txt)' }}>
        {value}
        {badge != null && badge > 0 && (
          <span style={{
            marginLeft: 8, fontSize: 12, background: 'var(--danger)', color: '#fff',
            borderRadius: 99, padding: '2px 7px', fontWeight: 800, verticalAlign: 'middle',
          }}>
            {badge}
          </span>
        )}
      </div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Quick Actions ─────────────────────────────────────────────────────────
function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Approve Report Cards', path: '/principal/report-cards', color: 'var(--brand)',   bg: 'rgba(13,148,136,0.1)',   border: 'rgba(13,148,136,0.2)'   },
    { label: 'View Audit Log',       path: '/principal/audit',        color: 'var(--txt2)',    bg: 'var(--surface2)',        border: 'var(--border)'          },
    { label: 'Send Announcement',    path: '/principal/messages',     color: 'var(--violet)',  bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)'  },
    { label: 'Fee Summary',          path: '/bursar/dashboard',       color: 'var(--warning)', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)'  },
  ]

  return (
    <div className="mob-hscroll" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {actions.map(a => (
        <button
          key={a.path}
          className="sui-quick-btn"
          onClick={() => navigate(a.path)}
          style={{ background: a.bg, color: a.color, border: `1px solid ${a.border}` }}
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
      <div className="mob-cards">
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
      </div>
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
    <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
          auditEntries.map((e: AuditEntry) => {
            const actionLabel = ({ INSERT: 'Added', UPDATE: 'Changed', DELETE: 'Removed' } as Record<string,string>)[e.action] ?? e.action
            const tableLabel  = e.tableName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            const roleLabel   = ({ principal:'Principal', deputy:'Deputy Principal', dos:'Director of Studies', secretary:'Secretary', bursar:'Bursar', class_teacher:'Class Teacher', teacher:'Teacher', it_admin:'IT Admin' } as Record<string,string>)[e.userRole] ?? e.userRole
            const actionColor = ({ INSERT: 'var(--success)', UPDATE: 'var(--info)', DELETE: 'var(--danger)' } as Record<string,string>)[e.action] ?? 'var(--txt3)'
            return (
              <div key={e.id} style={{
                padding: '10px 16px', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: 12, color: actionColor }}>{actionLabel}</span>
                  <span style={{ fontSize: 12, color: 'var(--txt)', marginLeft: 5 }}>
                    {tableLabel}{e.entityName ? ` — ${e.entityName}` : ''}
                  </span>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 1 }}>by {roleLabel}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                  {new Date(e.createdAt).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            )
          })
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
    <div className="stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Hero band */}
      <div className="sui-hero-band mob-hero mob-hero-principal">
        {/* Desktop parallax ambient orb (CSS-animated, mobile-suppressed) */}
        <span className="sui-hero-orb mob-fab-hide" aria-hidden="true" />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="mob-hero-title" style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 23, color: 'var(--txt)', margin: 0, letterSpacing: '-0.4px' }}>
            School Overview
          </h1>
          <div className="mob-hero-sub" style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
            Full visibility across academics, finance, attendance, and staff.
          </div>
          {/* Mobile-only hero metric */}
          <div className="mob-only mob-hero-stat">
            <div className="mob-hero-stat-num">{kpisLoading ? '—' : kpis?.totalStudents ?? 0}</div>
            <div className="mob-hero-stat-label">Students Enrolled</div>
          </div>
        </div>
      </div>

      {/* Term Progress Timeline */}
      <SafeTermProgressTimeline />

      {/* KPI Cards */}
      <div className="stagger-cards mob-kpi-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {kpisLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sui-kpi-v2" style={{ flex: 1, minWidth: 150 }}>
              <div className="shule-skeleton" style={{ height: 14, width: 80, borderRadius: 4, marginBottom: 8 }} />
              <div className="shule-skeleton" style={{ height: 28, width: 60, borderRadius: 4 }} />
            </div>
          ))
        ) : kpis ? (
          <>
            <KpiCard label="Total Students" value={kpis.totalStudents}
              accent="brand" iconKey="students" />
            <KpiCard label="Total Staff" value={kpis.totalStaff}
              accent="violet" iconKey="staff" />
            <KpiCard label="Pass Rate" value={`${kpis.overallPassRate}%`} sub="This term"
              accent="success" iconKey="pass" />
            <KpiCard label="Fee Collection" value={`${kpis.feeCollectionRate}%`}
              sub="of expected fees" danger={kpis.feeCollectionRate < 80}
              accent="brand" iconKey="fees" />
            <KpiCard label="Attendance" value={`${kpis.attendanceRateThisWeek}%`}
              sub="This week" danger={kpis.attendanceRateThisWeek < 80}
              accent="info" iconKey="attendance" />
            <KpiCard label="Pending Approvals" value={kpis.pendingReportCards}
              badge={kpis.pendingReportCards} danger={kpis.pendingReportCards > 0}
              accent="warning" iconKey="approval"
              onClick={() => navigate('/principal/report-cards')} />
          </>
        ) : null}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="sui-section-head">
          <span className="sui-section-title">Quick Actions</span>
        </div>
        <QuickActions />
      </div>

      {/* Academic + Fee Overview */}
      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div className="sui-section-head" style={{ marginBottom: 16 }}>
            <span className="sui-section-title">Top 5 Classes — Pass Rate</span>
          </div>
          <TopClassesChart />
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 20,
        }}>
          <div className="sui-section-head" style={{ marginBottom: 16 }}>
            <span className="sui-section-title">Fee Collection Summary</span>
          </div>
          <FeeOverviewPanel />
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="sui-section-head">
          <span className="sui-section-title">Recent Activity</span>
        </div>
        <RecentActivity />
      </div>
    </div>
  )
}
