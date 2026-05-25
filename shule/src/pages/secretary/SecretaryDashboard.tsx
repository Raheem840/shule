import { useNavigate } from 'react-router-dom'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useStudents } from '../../hooks/useStudents'
import { useStaff } from '../../hooks/useStaff'
import { useClasses } from '../../hooks/useClasses'

function QuickLink({ label, path, color }: { label: string; path: string; color: string }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(path)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '20px 24px', cursor: 'pointer',
        borderLeft: `4px solid ${color}`,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.07)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>Click to manage →</div>
    </div>
  )
}

export function SecretaryDashboard() {
  const { data: students = [] } = useStudents()
  const { data: staff    = [] } = useStaff()
  const { data: classes  = [] } = useClasses()

  const activeStudents = students.filter(s => s.status === 'active').length
  const activeStaff    = staff.filter(s => s.isActive !== false).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Secretary Dashboard
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Student and staff management, report cards, and portal access.
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Active Students', value: activeStudents },
          { label: 'Active Staff',    value: activeStaff    },
          { label: 'Classes',         value: classes.length },
        ].map(k => (
          <div key={k.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '16px 24px', flex: 1, minWidth: 140,
          }}>
            <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 32, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>Quick Actions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        <QuickLink label="Manage Students"    path="/secretary/students"     color="var(--brand)"   />
        <QuickLink label="Manage Staff"       path="/secretary/staff"        color="var(--violet)"  />
        <QuickLink label="Class List"         path="/secretary/classes"      color="var(--info)"    />
        <QuickLink label="Report Cards"       path="/secretary/report-cards" color="var(--warning)" />
        <QuickLink label="Portal Access"      path="/secretary/portal-links" color="var(--success)" />
        <QuickLink label="Import Data"        path="/secretary/import"       color="var(--txt2)"    />
      </div>
    </div>
  )
}
