import { useNavigate } from 'react-router-dom'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useTeacherEvents } from '../../hooks/useTeacherEvents'

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
      <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>Open →</div>
    </div>
  )
}

export function TeacherDashboard() {
  const { data: events = [] } = useTeacherEvents()
  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter(e => e.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate)).slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Teacher Dashboard
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Your upcoming events, assessments, and teaching tools.
        </div>
      </div>

      <SafeTermProgressTimeline />

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
            Upcoming Events
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(e => (
              <div key={e.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{e.title}</span>
                  <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--txt3)' }}>{e.eventType}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600 }}>
                  {new Date(e.eventDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>Quick Actions</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        <QuickLink label="My Events"     path="/teacher/events"      color="var(--brand)"   />
        <QuickLink label="Exam Journal"  path="/teacher/exams"       color="var(--violet)"  />
        <QuickLink label="Take Attendance" path="/teacher/attendance" color="var(--info)"  />
        <QuickLink label="My Timetable"  path="/teacher/timetable"   color="var(--warning)" />
        <QuickLink label="Messages"      path="/teacher/messages"    color="var(--success)" />
      </div>
    </div>
  )
}
