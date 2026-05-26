import { useNavigate } from 'react-router-dom'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useTeacherEvents } from '../../hooks/useTeacherEvents'

const QUICK_LINKS = [
  { label: 'My Events',       sub: 'School calendar',      path: '/teacher/events',      accent: 'brand',   icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
  { label: 'Exam Journal',    sub: 'Assessments & marks',  path: '/teacher/exams',       accent: 'violet',  icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6' },
  { label: 'Take Attendance', sub: 'Daily class register', path: '/teacher/attendance',  accent: 'info',    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
  { label: 'My Timetable',    sub: 'Weekly schedule',      path: '/teacher/timetable',   accent: 'warning', icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10' },
  { label: 'Messages',        sub: 'Staff messaging',      path: '/teacher/messages',    accent: 'success', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z' },
] as const

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam:     'var(--danger)',
  ca:       'var(--warning)',
  aoi:      'var(--info)',
  general:  'var(--success)',
}

export function TeacherDashboard() {
  const navigate  = useNavigate()
  const { data: events = [] } = useTeacherEvents()
  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter(e => e.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 3)

  return (
    <div className="stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* Hero */}
      <div className="sui-hero-band">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 23, color: 'var(--txt)', margin: 0, letterSpacing: '-0.4px' }}>
            Teacher Dashboard
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
            Your upcoming events, assessments, and teaching tools.
          </div>
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div>
          <div className="sui-section-head">
            <span className="sui-section-title">Upcoming Events</span>
          </div>
          <div className="stagger-cards" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(e => {
              const accent = EVENT_TYPE_COLORS[e.eventType] ?? 'var(--brand)'
              return (
                <div key={e.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderLeft: `4px solid ${accent}`,
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'box-shadow 0.18s',
                }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{e.title}</span>
                    <span style={{
                      marginLeft: 10, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.5px', color: accent,
                    }}>
                      {e.eventType}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 700, fontFamily: 'var(--font2)' }}>
                    {new Date(e.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <div className="sui-section-head">
          <span className="sui-section-title">Quick Actions</span>
        </div>
        <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
          {QUICK_LINKS.map(link => (
            <div
              key={link.path}
              className="sui-kpi-v2"
              onClick={() => navigate(link.path)}
              style={{ cursor: 'pointer', borderLeft: `4px solid var(--${link.accent === 'brand' ? 'brand' : link.accent})` }}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
