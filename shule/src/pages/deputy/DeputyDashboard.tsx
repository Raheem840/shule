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

function KpiCard({
  label, value, sub, accent = 'brand',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'brand' | 'danger' | 'warning' | 'info' | 'success'
}) {
  return (
    <div style={{
      flex: 1, minWidth: 150,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontSize: 30, fontWeight: 900, fontFamily: 'var(--font2)',
        color: accent === 'brand' ? 'var(--txt)' : `var(--${accent})`,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function RecentDisciplinePanel() {
  const { data: records = [], isLoading } = useRecentDiscipline()

  return (
    <div style={{
      flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
        Recent Discipline
      </div>
      {isLoading && (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading…</div>
      )}
      {!isLoading && records.length === 0 && (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No recent records.</div>
      )}
      {!isLoading && records.map(r => (
        <div key={r.id} style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '10px 0', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{
            padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
            background: `${NATURE_COLOR[r.nature]}20`,
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
  )
}

function AttendanceAlertsPanel() {
  const { data: classSummaries = [], isLoading } = useDeputyOverview()

  // We don't have per-student data here — show classes below threshold instead
  const below = classSummaries
    .filter(c => c.isBelowThreshold)
    .sort((a, b) => a.attendanceRate - b.attendanceRate)
    .slice(0, 5)

  return (
    <div style={{
      flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
        Attendance Alerts
      </div>
      {isLoading && (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading…</div>
      )}
      {!isLoading && below.length === 0 && (
        <div style={{ color: 'var(--success)', fontSize: 13 }}>
          All classes above 80% — no alerts.
        </div>
      )}
      {!isLoading && below.map(c => (
        <div key={c.classId} style={{
          padding: '10px 0', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{c.className}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{c.level ?? 'All levels'}</div>
          </div>
          <span style={{
            padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800,
            background: 'var(--danger-bg)', color: 'var(--danger)',
            fontFamily: 'var(--font3)',
          }}>
            {c.attendanceRate}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPUTY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function DeputyDashboard() {
  const { data: kpis, isLoading: kpisLoading } = useDeputyKpis()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
          color: 'var(--txt)', margin: 0,
        }}>
          Deputy Principal — Dashboard
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Attendance overview, discipline records, and timetable management.
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <KpiCard
          label="Discipline Incidents"
          value={kpisLoading ? '—' : (kpis?.disciplineIncidents ?? 0)}
          sub="Total recorded"
          accent="warning"
        />
        <KpiCard
          label="Students Below 80%"
          value={kpisLoading ? '—' : (kpis?.studentsBelowThreshold ?? 0)}
          sub="Attendance threshold"
          accent={kpis && kpis.studentsBelowThreshold > 0 ? 'danger' : 'brand'}
        />
        <KpiCard
          label="Active Class Teachers"
          value={kpisLoading ? '—' : (kpis?.activeClassTeachers ?? 0)}
          sub="Assigned to streams"
          accent="success"
        />
        <div style={{
          flex: 1, minWidth: 150,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 6 }}>
            Pending Timetable Items
          </div>
          <div style={{
            fontSize: 30, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt3)',
          }}>
            —
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>Coming soon</div>
        </div>
      </div>

      {/* Side-by-side panels */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <RecentDisciplinePanel />
        <AttendanceAlertsPanel />
      </div>
    </div>
  )
}
