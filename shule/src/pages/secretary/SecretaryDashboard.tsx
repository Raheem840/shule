import { useNavigate } from 'react-router-dom'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useStudents } from '../../hooks/useStudents'
import { useStaff } from '../../hooks/useStaff'
import { useClasses } from '../../hooks/useClasses'

const QUICK_LINKS = [
  { label: 'Manage Students', sub: 'Enrollment & records', path: '/secretary/students',     accent: 'brand',   icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { label: 'Manage Staff',    sub: 'Registration & docs', path: '/secretary/staff',        accent: 'violet',  icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { label: 'Class List',      sub: 'Classes & streams',   path: '/secretary/classes',      accent: 'info',    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { label: 'Report Cards',    sub: 'Generate & release',  path: '/secretary/report-cards', accent: 'warning', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8' },
  { label: 'Portal Access',   sub: 'Parent credentials',  path: '/secretary/portal-links', accent: 'success', icon: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3' },
  { label: 'Import Data',     sub: 'Bulk upload wizard',  path: '/secretary/import',       accent: 'brand',   icon: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12' },
] as const

const ACCENT_COLORS: Record<string, string> = {
  brand:   'var(--brand)',
  violet:  'var(--violet)',
  info:    'var(--info)',
  warning: 'var(--warning)',
  success: 'var(--success)',
}

const KPI_META = [
  { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', accent: 'brand'   },
  { icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',                   accent: 'violet'  },
  { icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',                                                            accent: 'info'    },
]

export function SecretaryDashboard() {
  const navigate = useNavigate()
  const { data: students = [] } = useStudents()
  const { data: staff    = [] } = useStaff()
  const { data: classes  = [] } = useClasses()

  const activeStudents = students.filter(s => s.status === 'active').length
  const activeStaff    = staff.filter(s => s.isActive !== false).length

  const kpis = [
    { label: 'Active Students', value: activeStudents },
    { label: 'Active Staff',    value: activeStaff    },
    { label: 'Classes',         value: classes.length },
  ]

  return (
    <div className="stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* Hero */}
      <div className="sui-hero-band">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 23, color: 'var(--txt)', margin: 0, letterSpacing: '-0.4px' }}>
            Secretary Dashboard
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
            Student and staff management, report cards, and portal access.
          </div>
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* KPI Cards */}
      <div className="stagger-cards" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {kpis.map((k, i) => (
          <div key={k.label} className={`sui-kpi-v2 sui-kpi-accent-${KPI_META[i].accent}`} style={{ flex: 1, minWidth: 140 }}>
            <div className={`sui-kpi-icon sui-kpi-icon-${KPI_META[i].accent}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={KPI_META[i].icon} />
              </svg>
            </div>
            <div className="sui-kpi-label">{k.label}</div>
            <div className="sui-kpi-num">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <div className="sui-section-head">
          <span className="sui-section-title">Quick Actions</span>
        </div>
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {QUICK_LINKS.map(link => (
            <div
              key={link.path}
              className="sui-kpi-v2"
              onClick={() => navigate(link.path)}
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${ACCENT_COLORS[link.accent]}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className={`sui-kpi-icon sui-kpi-icon-${link.accent}`} style={{ marginBottom: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={link.icon} />
                  </svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>{link.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{link.sub}</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: ACCENT_COLORS[link.accent], fontWeight: 700 }}>
                Open →
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
