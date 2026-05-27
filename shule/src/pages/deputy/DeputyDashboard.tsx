import { useDeputyKpis, useRecentDiscipline, useDeputyOverview } from '../../hooks/useDeputy'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import type { DisciplineNature } from '../../types/week9'

const NATURE_COLOR: Record<DisciplineNature, string> = {
  lateness:    'var(--warning)',
  absenteeism: 'var(--info)',
  misconduct:  'var(--danger)',
  violence:    'var(--danger)',
  other:       'var(--txt3)',
}

// Icon helpers
function IconDiscipline() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M10 2L2 7v6l8 5 8-5V7l-8-5z"/>
    </svg>
  )
}
function IconAttendance() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="10" cy="10" r="8"/>
      <path d="M10 6v4l3 3"/>
    </svg>
  )
}
function IconTeachers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 17a8 8 0 00-16 0"/>
    </svg>
  )
}
function IconTimetable() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="14" height="13" rx="2"/>
      <path d="M3 8h14M7 4V2M13 4V2"/>
    </svg>
  )
}

// Premium KPI card using existing sui-kpi-v2 CSS class
function KpiCard({
  label, value, sub, icon, accent = 'brand', loading = false,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  accent?: 'brand' | 'danger' | 'warning' | 'info' | 'success' | 'violet'
  loading?: boolean
}) {
  return (
    <div className={`sui-kpi-v2 sui-kpi-accent-${accent}`} style={{ flex: 1, minWidth: 160 }}>
      <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>{icon}</div>
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num sui-count-reveal">
        {loading ? <span style={{ opacity: 0.3 }}>—</span> : value}
      </div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
    </div>
  )
}

function RecentDisciplinePanel() {
  const { data: records = [], isLoading } = useRecentDiscipline()

  return (
    <div className="sui-glass-panel" style={{ flex: 1 }}>
      <div className="sui-glass-panel-header">
        <div className="sui-section-head" style={{ margin: 0 }}>
          <span className="sui-section-title">Recent Discipline</span>
        </div>
        {records.length > 0 && (
          <span className="badge badge-amber">{records.length}</span>
        )}
      </div>
      <div style={{ padding: '8px 0' }}>
        {isLoading && (
          <div style={{ padding: '16px 20px', color: 'var(--txt3)', fontSize: 13 }}>Loading…</div>
        )}
        {!isLoading && records.length === 0 && (
          <div style={{ padding: '20px', color: 'var(--txt3)', fontSize: 13 }}>No recent records.</div>
        )}
        {!isLoading && records.map((r, i) => (
          <div
            key={r.id}
            className="sui-feed-row sui-feed-slide"
            style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 20px',
              borderBottom: i < records.length - 1 ? '1px solid var(--border)' : 'none',
              animationDelay: `${i * 0.05}s`,
            }}
          >
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
              background: `${NATURE_COLOR[r.nature]}22`,
              color: NATURE_COLOR[r.nature],
              textTransform: 'capitalize', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {r.nature}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', marginBottom: 1 }}>
                {r.studentName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                {new Date(r.incidentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AttendanceAlertsPanel() {
  const { data: classSummaries = [], isLoading } = useDeputyOverview()

  const below = classSummaries
    .filter(c => c.isBelowThreshold)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 5)

  return (
    <div className="sui-glass-panel" style={{ flex: 1 }}>
      <div className="sui-glass-panel-header">
        <div className="sui-section-head" style={{ margin: 0 }}>
          <span className="sui-section-title">Attendance Alerts</span>
        </div>
        {below.length > 0 && (
          <span className="badge badge-red">{below.length} below 80%</span>
        )}
      </div>
      <div style={{ padding: '8px 0' }}>
        {isLoading && (
          <div style={{ padding: '16px 20px', color: 'var(--txt3)', fontSize: 13 }}>Loading…</div>
        )}
        {!isLoading && below.length === 0 && (
          <div style={{
            padding: '20px', color: 'var(--success)', fontSize: 13,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width={16} height={16} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="10" cy="10" r="8"/>
              <path d="M7 10l2 2 4-4"/>
            </svg>
            All classes above 80% — no alerts.
          </div>
        )}
        {!isLoading && below.map((c, i) => (
          <div
            key={c.classId}
            className="sui-feed-row"
            style={{
              padding: '10px 20px',
              borderBottom: i < below.length - 1 ? '1px solid var(--border)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{c.className}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.level ?? 'All levels'}</div>
            </div>
            <span style={{
              padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800,
              background: 'var(--danger-bg)', color: 'var(--danger)',
              fontFamily: 'var(--font3)',
            }}>
              {c.attendanceRate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPUTY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function DeputyDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDeputyKpis()
  const incidentCount = kpisLoading ? '—' : (kpis?.disciplineIncidents ?? 0)
  const belowCount    = kpisLoading ? '—' : (kpis?.studentsBelowThreshold ?? 0)
  const teacherCount  = kpisLoading ? '—' : (kpis?.activeClassTeachers ?? 0)

  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero band ── */}
      <div className="sui-hero-band">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
              margin: '0 0 4px', lineHeight: 1.2,
            }}>
              <span className="gradient-text">Deputy Principal</span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0 }}>
              Attendance oversight, discipline records & timetable management.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 99,
            background: 'var(--success-bg)', color: 'var(--success)',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}/>
            Live
          </div>
        </div>
      </div>

      {/* ── Term timeline ── */}
      <SafeTermProgressTimeline />

      {/* ── KPI Cards ── */}
      <div className="stagger-cards" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          label="Discipline Incidents"
          value={incidentCount}
          sub="Total recorded this term"
          icon={<IconDiscipline />}
          accent="warning"
          loading={kpisLoading}
        />
        <KpiCard
          label="Students Below 80%"
          value={belowCount}
          sub="Attendance threshold"
          icon={<IconAttendance />}
          accent={typeof belowCount === 'number' && belowCount > 0 ? 'danger' : 'success'}
          loading={kpisLoading}
        />
        <KpiCard
          label="Active Class Teachers"
          value={teacherCount}
          sub="Assigned to streams"
          icon={<IconTeachers />}
          accent="brand"
          loading={kpisLoading}
        />
        <KpiCard
          label="Timetable Gaps"
          value="—"
          sub="Coming soon"
          icon={<IconTimetable />}
          accent="violet"
          loading={false}
        />
      </div>

      {/* ── Side-by-side panels ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <RecentDisciplinePanel />
        <AttendanceAlertsPanel />
      </div>
    </div>
  )
}
