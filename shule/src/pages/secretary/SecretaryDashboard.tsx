import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { useStudents } from '../../hooks/useStudents'
import { useStaff } from '../../hooks/useStaff'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'

// ─── Quick links config ────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Register Student', sub: 'Add new student',     path: '/secretary/students',      accent: 'brand',   icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
  { label: 'Register Staff',   sub: 'Add staff member',    path: '/secretary/staff',         accent: 'violet',  icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { label: 'Report Cards',     sub: 'Generate & release',  path: '/secretary/report-cards',  accent: 'warning', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8' },
] as const

const ACCENT_COLORS: Record<string, string> = {
  brand:   'var(--brand)',
  violet:  'var(--violet)',
  warning: 'var(--warning)',
}

const KPI_META = [
  { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', accent: 'brand'   },
  { icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',                   accent: 'violet'  },
  { icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',           accent: 'warning' },
  { icon: 'M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3',                             accent: 'success' },
]

function useSecretaryKpis() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['secretary-kpis', user?.schoolId],
    enabled:  !!user,
    queryFn: async () => {
      const sid = user!.schoolId
      const [rcRes, parentRes] = await Promise.all([
        supabase
          .from('report_cards')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', sid)
          .in('status', ['draft']),
        supabase
          .from('parent_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', sid),
      ])
      return {
        reportCardsReady:     rcRes.count ?? 0,
        parentPortalsCreated: parentRes.count ?? 0,
      }
    },
    staleTime: 5 * 60_000,
  })
}

function useRecentActivity() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['secretary-recent-activity', user?.schoolId],
    enabled:  !!user,
    queryFn: async () => {
      const sid = user!.schoolId
      const [studRes, staffRes] = await Promise.all([
        supabase
          .from('students')
          .select('id, first_name, last_name, class_id, enrolled_at')
          .eq('school_id', sid)
          .eq('status', 'active')
          .order('enrolled_at', { ascending: false })
          .limit(10),
        supabase
          .from('staff')
          .select('id, first_name, last_name, role, created_at')
          .eq('school_id', sid)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      return {
        recentStudents: (studRes.data ?? []).map((s: any) => ({
          id:         s.id,
          name:       `${s.first_name} ${s.last_name}`,
          enrolledAt: s.enrolled_at as string,
        })),
        recentStaff: (staffRes.data ?? []).map((s: any) => ({
          id:        s.id,
          name:      `${s.first_name} ${s.last_name}`,
          role:      s.role as string,
          createdAt: s.created_at as string,
        })),
      }
    },
    staleTime: 5 * 60_000,
  })
}

function RecentStudentsPanel({ data }: { data: { id: string; name: string; enrolledAt: string }[] }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
        Recently Enrolled Students
      </div>
      {data.length === 0 && (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No students yet.</div>
      )}
      {data.map(s => (
        <div key={s.id} style={{
          padding: '8px 0', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{s.name}</span>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
            {new Date(s.enrolledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

function RecentStaffPanel({ data }: { data: { id: string; name: string; role: string; createdAt: string }[] }) {
  return (
    <div style={{
      flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
        Recently Registered Staff
      </div>
      {data.length === 0 && (
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No staff yet.</div>
      )}
      {data.map(s => (
        <div key={s.id} style={{
          padding: '8px 0', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{s.name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', textTransform: 'capitalize' }}>{s.role.replace('_', ' ')}</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
            {new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECRETARY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function SecretaryDashboard() {
  const navigate = useNavigate()
  const { data: students = [] } = useStudents()
  const { data: staff    = [] } = useStaff()
  const { data: kpis }         = useSecretaryKpis()
  const { data: activity }     = useRecentActivity()

  const activeStudents = students.filter(s => s.status === 'active').length
  const activeStaff    = staff.filter(s => s.isActive !== false).length

  const kpiRows = [
    { label: 'Active Students',       value: activeStudents },
    { label: 'Active Staff',          value: activeStaff    },
    { label: 'Report Cards Ready',    value: kpis?.reportCardsReady ?? '—' },
    { label: 'Parent Portals Created', value: kpis?.parentPortalsCreated ?? '—' },
  ]

  return (
    <div className="stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

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

      {/* 4 KPI Cards */}
      <div className="stagger-cards" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {kpiRows.map((k, i) => (
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
        <div className="stagger-cards" style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {QUICK_LINKS.map(link => (
            <div
              key={link.path}
              className="sui-kpi-v2"
              onClick={() => navigate(link.path)}
              style={{
                cursor: 'pointer', flex: 1, minWidth: 180,
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
              <div style={{ fontSize: 11, color: ACCENT_COLORS[link.accent], fontWeight: 700 }}>Open →</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <RecentStudentsPanel data={activity?.recentStudents ?? []} />
        <RecentStaffPanel data={activity?.recentStaff ?? []} />
      </div>
    </div>
  )
}
