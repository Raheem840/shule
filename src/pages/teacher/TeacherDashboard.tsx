import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
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
  exam:    'var(--danger)',
  ca:      'var(--warning)',
  aoi:     'var(--info)',
  general: 'var(--success)',
}

// ── Teacher KPI hooks ─────────────────────────────────────────

function useTeacherKpis() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['teacher-kpis', user?.schoolId, user?.id],
    enabled:  !!user,
    queryFn: async () => {
      // Step 1: Get staff row for this user
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, classes')
        .eq('auth_user_id', user!.id)
        .eq('school_id', user!.schoolId)
        .maybeSingle()

      const staffId      = (staffRow as any)?.id as string | undefined
      const classIdsFromStaff = ((staffRow as any)?.classes ?? []) as string[]

      // A homeroom class_teacher's assignment can live in
      // streams.class_teacher_id instead of staff.classes[] — union both,
      // matching the "my classes" definition used everywhere else
      // (messaging scoping, attendance RLS, useMyAssignedClasses).
      let classIdsFromStreams: string[] = []
      if (staffId) {
        const { data: streamRows } = await supabase
          .from('streams')
          .select('class_id')
          .eq('school_id', user!.schoolId)
          .eq('class_teacher_id', staffId)
        classIdsFromStreams = ((streamRows ?? []) as any[]).map(r => r.class_id as string)
      }
      const classIds  = Array.from(new Set([...classIdsFromStaff, ...classIdsFromStreams]))
      const myClasses = classIds.length

      // Determine current term from the active academic year's real term
      // dates — a fixed month-range guess was wrong for any school whose
      // term calendar didn't match Jan-Apr/May-Aug/Sep-Dec.
      const currentYear = new Date().getFullYear()
      const { data: activeYearRow } = await supabase
        .from('academic_years')
        .select('term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
        .eq('school_id', user!.schoolId)
        .eq('is_active', true)
        .maybeSingle()

      let currentTerm = '1'
      if (activeYearRow) {
        const now = Date.now()
        const ranges = ([1, 2, 3] as const).map(n => {
          const start = (activeYearRow as any)[`term${n}_start`] as string | null
          const end   = (activeYearRow as any)[`term${n}_end`]   as string | null
          return {
            term: String(n),
            start: start ? new Date(start).getTime() : null,
            end:   end   ? new Date(end).getTime()   : null,
          }
        })
        const current = ranges.find(r => r.start !== null && r.end !== null && now >= r.start! && now <= r.end!)
        if (current) {
          currentTerm = current.term
        } else {
          const withEnd = ranges.filter((r): r is { term: string; start: number | null; end: number } => r.end !== null)
          const mostRecentlyEnded = withEnd.filter(r => r.end < now).sort((a, b) => b.end - a.end)[0]
          const nextUpcoming      = withEnd.filter(r => r.end >= now).sort((a, b) => a.end - b.end)[0]
          currentTerm = (mostRecentlyEnded ?? nextUpcoming)?.term ?? '1'
        }
      } else {
        // No active academic year at all — fall back to the old coarse guess
        const month = new Date().getMonth() + 1
        currentTerm = month <= 4 ? '1' : month <= 8 ? '2' : '3'
      }

      // Step 2: Journals this term — teacher_id FK references staff.id, not auth.users.id
      let journalsThisTerm = 0
      if (staffId) {
        const { count: jCount } = await supabase
          .from('exam_journal')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', user!.schoolId)
          .eq('teacher_id', staffId)
          .eq('term', currentTerm)
          .eq('year', currentYear)
        journalsThisTerm = jCount ?? 0
      }

      // Step 3: Topics covered by this teacher — covered_by is written as
      // staff.id (see useMarkCovered in TeacherCurriculumPage.tsx), not the
      // auth user id, so this must filter by staffId, not user.id, or it
      // silently matches zero rows for any teacher with a real staff record.
      let topicsCovered = 0
      if (staffId) {
        const { count: tCount } = await supabase
          .from('curriculum_plan')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', user!.schoolId)
          .eq('covered_by', staffId)
          .not('covered_at', 'is', null)
        topicsCovered = tCount ?? 0
      }

      // Step 4: Students below 80% attendance in my classes
      let belowThresholdCount = 0
      if (classIds.length > 0) {
        const yearStart = `${currentYear}-01-01`
        const { data: attRows } = await supabase
          .from('attendance')
          .select('student_id, status')
          .eq('school_id', user!.schoolId)
          .in('class_id', classIds)
          .gte('date', yearStart)

        // Aggregate per student
        const studentDays = new Map<string, { total: number; present: number }>()
        for (const r of attRows ?? []) {
          const sid  = r.student_id as string
          const curr = studentDays.get(sid) ?? { total: 0, present: 0 }
          curr.total++
          if (r.status === 'present' || r.status === 'late') curr.present++
          studentDays.set(sid, curr)
        }
        for (const { total, present } of studentDays.values()) {
          if (total > 0 && (present / total) < 0.8) belowThresholdCount++
        }
      }

      return { myClasses, journalsThisTerm, topicsCovered, belowThresholdCount, currentTerm }
    },
    staleTime: 5 * 60_000,
  })
}

// ── KPI card component ────────────────────────────────────────
const KPI_ICONS: Record<string, string> = {
  brand:   'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  violet:  'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  warning: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  info:    'M4 19.5A2.5 2.5 0 016.5 17H20',
}

function KpiCard({
  label, value, sub, accent, onClick,
}: {
  label: string; value: string | number; sub?: string
  accent: 'brand' | 'violet' | 'warning' | 'info'
  onClick?: () => void
}) {
  return (
    <div
      className={`sui-kpi-v2 sui-kpi-accent-${accent}`}
      onClick={onClick}
      style={{ flex: 1, minWidth: 140, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={KPI_ICONS[accent]} />
        </svg>
      </div>
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num">{value}</div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export function TeacherDashboard() {
  const navigate  = useNavigate()
  const { data: events = [] } = useTeacherEvents()
  const { data: kpis, isLoading: kpisLoading } = useTeacherKpis()

  const today    = new Date().toISOString().slice(0, 10)
  const upcoming = events
    .filter(e => e.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, 3)

  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

      {/* Hero */}
      <div className="sui-hero-band mob-hero mob-hero-teacher">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="mob-hero-title" style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 23, color: 'var(--txt)', margin: 0, letterSpacing: '-0.4px' }}>
            Teacher Dashboard
          </h1>
          <div className="mob-hero-sub" style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
            Your upcoming events, assessments, and teaching tools.
          </div>
          {/* Mobile-only hero metric */}
          <div className="mob-only mob-hero-stat">
            <div className="mob-hero-stat-num">{kpis?.journalsThisTerm ?? '—'}</div>
            <div className="mob-hero-stat-label">Journals · Term {kpis?.currentTerm ?? ''}</div>
          </div>
        </div>
      </div>

      {/* Mobile-only quick-action pill row */}
      <div className="mob-only mob-quick-actions">
        <button className="mob-quick-btn mob-qa-info" onClick={() => navigate('/teacher/attendance')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span className="mob-quick-btn-label">Attendance</span>
        </button>
        <button className="mob-quick-btn mob-qa-violet" onClick={() => navigate('/teacher/exams')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6"/></svg>
          <span className="mob-quick-btn-label">Marks</span>
        </button>
        <button className="mob-quick-btn mob-qa-success" onClick={() => navigate('/teacher/curriculum')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M3 12h18M3 19h12"/></svg>
          <span className="mob-quick-btn-label">Curriculum</span>
        </button>
        <button className="mob-quick-btn mob-qa-brand" onClick={() => navigate('/teacher/events')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          <span className="mob-quick-btn-label">Events</span>
        </button>
        <button className="mob-quick-btn mob-qa-warning" onClick={() => navigate('/teacher/timetable')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          <span className="mob-quick-btn-label">Timetable</span>
        </button>
      </div>

      <SafeTermProgressTimeline />

      {/* ── KPI Cards ───────────────────────────────────────── */}
      {kpisLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem' }}>
          <LoadingSpinner size="md" />
        </div>
      ) : kpis && (
        <div className="stagger-cards sui-kpi-grid mob-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <KpiCard
            label="My Classes"
            value={kpis.myClasses}
            sub="assigned classes"
            accent="brand"
          />
          <KpiCard
            label="Journals This Term"
            value={kpis.journalsThisTerm}
            sub={`Term ${kpis.currentTerm}`}
            accent="violet"
            onClick={() => navigate('/teacher/exams')}
          />
          <KpiCard
            label="Below 80% Attendance"
            value={kpis.belowThresholdCount}
            sub="students at risk"
            accent="warning"
            onClick={() => navigate('/teacher/attendance')}
          />
          <KpiCard
            label="Topics Covered"
            value={kpis.topicsCovered}
            sub="curriculum plan"
            accent="info"
            onClick={() => navigate('/teacher/curriculum')}
          />
        </div>
      )}

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
                <div key={e.id} className="sui-glass-card" style={{
                  borderLeft: `4px solid ${accent}`,
                  padding: '12px 16px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
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
