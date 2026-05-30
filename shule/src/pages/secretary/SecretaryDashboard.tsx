import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { FeeStatusDonut } from '../../components/shared/FeeStatusDonut'
import { StudentRegistrationWizard } from './StudentRegistrationWizard'

// ─── Chart colour constants (no CSS vars in Recharts) ──────────────────────
const C = {
  brand:   '#0d9488',
  success: '#10b981',
  warning: '#f59e0b',
  danger:  '#f43f5e',
  info:    '#0ea5e9',
  violet:  '#8b5cf6',
  txt3:    '#94a3b8',
  border:  '#e2e8f0',
}

// ─── Term info helper ───────────────────────────────────────────────────────
interface AcademicYearRow {
  id: string
  name: string
  is_active: boolean
  term1_start: string | null
  term1_end:   string | null
  term2_start: string | null
  term2_end:   string | null
  term3_start: string | null
  term3_end:   string | null
}

interface TermInfo {
  term:       number
  week:       number
  totalWeeks: number
  progress:   number
}

function computeTermInfo(academicYears: AcademicYearRow[]): TermInfo | null {
  const active = academicYears.find(y => y.is_active)
  if (!active) return null
  const today = new Date()
  const terms = [
    { num: 1, start: active.term1_start, end: active.term1_end },
    { num: 2, start: active.term2_start, end: active.term2_end },
    { num: 3, start: active.term3_start, end: active.term3_end },
  ]
  for (const t of terms) {
    if (!t.start || !t.end) continue
    const s = new Date(t.start)
    const e = new Date(t.end)
    if (today >= s && today <= e) {
      const weekNum    = Math.ceil((today.getTime() - s.getTime()) / (7 * 86400000))
      const totalWeeks = Math.ceil((e.getTime() - s.getTime()) / (7 * 86400000))
      const progress   = Math.min(100, Math.round(((today.getTime() - s.getTime()) / (e.getTime() - s.getTime())) * 100))
      return { term: t.num, week: weekNum, totalWeeks, progress }
    }
  }
  return null
}

// ─── Activity formatters ────────────────────────────────────────────────────
function formatActivity(log: { table_name: string; action: string; new_value: any; created_at: string }): string {
  if (log.table_name === 'students' && log.action === 'INSERT') return 'New student enrolled'
  if (log.table_name === 'students' && log.action === 'UPDATE') {
    const status = log.new_value?.status
    if (status === 'suspended') return 'Student suspended'
    if (status === 'expelled') return 'Student expelled'
    return 'Student record updated'
  }
  if (log.table_name === 'report_cards' && log.action === 'UPDATE') {
    const status = log.new_value?.status
    return `Report card ${status ?? 'updated'}`
  }
  if (log.table_name === 'report_cards' && log.action === 'INSERT') return 'Report card generated'
  return `${log.table_name} ${log.action.toLowerCase()}`
}

function relativeTime(isoString: string): string {
  const diff  = Date.now() - new Date(isoString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

// ─── Batch data hook ────────────────────────────────────────────────────────
function useSecretaryDashData() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['secretary-dash', user?.schoolId],
    enabled: !!user,
    staleTime: 3 * 60_000,
    queryFn: async () => {
      const sid = user!.schoolId
      const currentYear = new Date().getFullYear()

      const [
        studentsRes,
        staffRes,
        rcRes,
        parentRes,
        academicRes,
        journalRes,
        feeRes,
        activityRes,
        ayRes,
        schoolRes,
      ] = await Promise.all([
        supabase.from('students')
          .select('id, status, class_id, enrolled_at')
          .eq('school_id', sid),
        supabase.from('staff')
          .select('id, role, is_active')
          .eq('school_id', sid),
        supabase.from('report_cards')
          .select('id, status, generated_at')
          .eq('school_id', sid),
        supabase.from('parent_accounts')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', sid),
        supabase.from('exam_results')
          .select('student_id, score, exam_journal_id, term, year')
          .eq('school_id', sid),
        supabase.from('exam_journal')
          .select('id, pass_mark, term, year')
          .eq('school_id', sid),
        supabase.from('fee_payments')
          .select('student_id, amount_paid, amount_due')
          .eq('school_id', sid),
        supabase.from('audit_log')
          .select('id, table_name, action, record_id, new_value, created_at')
          .eq('school_id', sid)
          .in('table_name', ['students', 'report_cards'])
          .order('created_at', { ascending: false })
          .limit(20)
          .then(r => {
            if (r.error?.code === '42P01') return { data: [], error: null }
            return r
          }),
        supabase.from('academic_years')
          .select('id, name, is_active, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
          .eq('school_id', sid)
          .order('start_date', { ascending: false }),
        supabase.from('school_profile')
          .select('id, school_name, short_name')
          .eq('id', sid)
          .single(),
      ])

      // Students
      const students = studentsRes.data ?? []
      const activeStudents  = students.filter((s: any) => s.status === 'active').length
      const flaggedStudents = students.filter((s: any) => ['suspended', 'expelled'].includes(s.status))

      // Staff
      const staffRows   = staffRes.data ?? []
      const activeStaff = staffRows.filter((s: any) => s.is_active).length

      // Report cards
      const rcs = rcRes.data ?? []
      const readyCards = rcs.filter((r: any) => r.status === 'ready')
      const stuckCards = readyCards.filter((r: any) => {
        const gen = new Date(r.generated_at).getTime()
        return Date.now() - gen > 3 * 86400000
      })

      // Parent portals
      const parentPortals = parentRes.count ?? 0

      // Enrollment trend (current year, by month)
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const monthCounts = Array(12).fill(0)
      for (const s of students) {
        const d = new Date((s as any).enrolled_at)
        if (d.getFullYear() === currentYear) {
          monthCounts[d.getMonth()]++
        }
      }
      // Cumulative
      let cum = 0
      const enrollmentTrend = months.map((m, i) => {
        cum += monthCounts[i]
        return { month: m, count: cum }
      })

      // Fee status counts
      const payments = feeRes.data ?? []
      const statusMap = new Map<string, 'paid' | 'partial' | 'unpaid'>()
      for (const p of payments) {
        const row  = p as any
        const due  = Number(row.amount_due ?? 0)
        const paid = Number(row.amount_paid ?? 0)
        let st: 'paid' | 'partial' | 'unpaid'
        if (due <= 0)       st = 'paid'
        else if (paid >= due) st = 'paid'
        else if (paid > 0)    st = 'partial'
        else                  st = 'unpaid'
        const cur = statusMap.get(row.student_id)
        if (!cur) { statusMap.set(row.student_id, st); continue }
        if (cur === 'paid'    && st !== 'paid')    statusMap.set(row.student_id, st)
        else if (cur === 'partial' && st === 'unpaid') statusMap.set(row.student_id, st)
      }
      let feePaid = 0, feePartial = 0, feeUnpaid = 0
      for (const v of statusMap.values()) {
        if (v === 'paid')    feePaid++
        else if (v === 'partial') feePartial++
        else                      feeUnpaid++
      }
      const feeStatusCounts = { paid: feePaid, partial: feePartial, unpaid: feeUnpaid }

      // Academic snapshot — last 6 term/year combos
      const journals   = journalRes.data ?? []
      const examResults = academicRes.data ?? []
      const journalMap  = new Map<string, number>()
      for (const j of journals) journalMap.set((j as any).id, (j as any).pass_mark ?? 50)

      // Group results by "term-year"
      const termGroupMap = new Map<string, { pass: number; total: number; scores: number[] }>()
      for (const r of examResults) {
        const row = r as any
        const key = `T${row.term} ${row.year}`
        if (!termGroupMap.has(key)) termGroupMap.set(key, { pass: 0, total: 0, scores: [] })
        const entry = termGroupMap.get(key)!
        const pm    = journalMap.get(row.exam_journal_id) ?? 50
        entry.total++
        entry.scores.push(row.score ?? 0)
        if ((row.score ?? 0) >= pm) entry.pass++
      }
      const termKeys = Array.from(termGroupMap.keys()).slice(-6)
      const academicSnapshot = termKeys.map(key => {
        const g    = termGroupMap.get(key)!
        const avg  = g.scores.length > 0 ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : 0
        const rate = g.total > 0 ? Math.round((g.pass / g.total) * 100) : 0
        return { label: key, avgScore: avg, passRate: rate }
      })

      // Activity feed
      const activityFeed = (activityRes.data ?? []).map((log: any) => ({
        id:          log.id,
        description: formatActivity({ table_name: log.table_name, action: log.action, new_value: log.new_value, created_at: log.created_at }),
        time:        relativeTime(log.created_at),
        tableName:   log.table_name as string,
        action:      log.action as string,
      }))

      return {
        activeStudents,
        activeStaff,
        readyCardsCount: readyCards.length,
        parentPortals,
        stuckCards: stuckCards.length,
        flaggedStudents: flaggedStudents.length,
        enrollmentTrend,
        academicSnapshot,
        feeStatusCounts,
        activityFeed,
        academicYears: (ayRes.data ?? []) as AcademicYearRow[],
        schoolName: (schoolRes.data as any)?.school_name ?? 'School',
      }
    },
  })
}

// ─── Tooltip style shared ───────────────────────────────────────────────────
const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--txt)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
}

// ─── Attention dot ──────────────────────────────────────────────────────────
function Dot({ color }: { color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: '50%',
      background: color, flexShrink: 0, marginTop: 2,
    }} />
  )
}

// ─── KPI Tile ───────────────────────────────────────────────────────────────
interface KpiTileProps {
  label:   string
  value:   number | string
  accent:  string
  iconPath: string
}

function KpiTile({ label, value, accent, iconPath }: KpiTileProps) {
  const accentVar = `var(--${accent})`
  return (
    <div className={`sui-kpi-v2 sui-kpi-accent-${accent}`} style={{ flex: 1, minWidth: 140 }}>
      <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </div>
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num" style={{ color: accentVar }}>{value}</div>
    </div>
  )
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: 12,
    }}>
      <span style={{
        fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13,
        color: 'var(--txt)', letterSpacing: '-0.2px',
      }}>
        {title}
      </span>
      {action}
    </div>
  )
}

// ─── Panel wrapper ──────────────────────────────────────────────────────────
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="sui-glass-panel"
      style={{ padding: 20, ...style }}
    >
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SECRETARY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
export function SecretaryDashboard() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const { data, isLoading } = useSecretaryDashData()
  const [showWizard, setShowWizard] = useState(false)

  const termInfo = useMemo(() => {
    if (!data?.academicYears?.length) return null
    return computeTermInfo(data.academicYears)
  }, [data?.academicYears])

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const firstName = user?.name?.split(' ')[0] ?? 'Secretary'
  const hour      = today.getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 320 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="sui-spinner" />
          <div style={{ marginTop: 12, color: 'var(--txt3)', fontSize: 13 }}>Loading dashboard…</div>
        </div>
      </div>
    )
  }

  const d = data!

  const attentionItems: { label: string; color: string; count: number }[] = []
  if (d.stuckCards > 0) attentionItems.push({ label: `${d.stuckCards} report card${d.stuckCards > 1 ? 's' : ''} stuck in "Ready" for 3+ days`, color: C.warning, count: d.stuckCards })
  if (d.flaggedStudents > 0) attentionItems.push({ label: `${d.flaggedStudents} student${d.flaggedStudents > 1 ? 's' : ''} suspended or expelled`, color: C.danger, count: d.flaggedStudents })
  if (d.feeStatusCounts.unpaid > 0) attentionItems.push({ label: `${d.feeStatusCounts.unpaid} student${d.feeStatusCounts.unpaid > 1 ? 's' : ''} with unpaid fees`, color: C.danger, count: d.feeStatusCounts.unpaid })
  if (d.feeStatusCounts.partial > 0) attentionItems.push({ label: `${d.feeStatusCounts.partial} student${d.feeStatusCounts.partial > 1 ? 's' : ''} with partial payment`, color: C.warning, count: d.feeStatusCounts.partial })

  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── [1] Greeting hero band ─────────────────────────────────────────── */}
      <div className="sui-hero-band" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 4 }}>
                {greeting}, {firstName}
              </div>
              <h1 style={{
                fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
                color: 'var(--txt)', margin: 0, letterSpacing: '-0.5px',
              }}>
                {d.schoolName}
              </h1>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>{dateStr}</div>
            </div>
            {termInfo && (
              <div style={{
                background: 'rgba(13,148,136,0.08)',
                border: '1px solid rgba(13,148,136,0.2)',
                borderRadius: 10,
                padding: '8px 14px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>Term {termInfo.term}</div>
                <div style={{
                  fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16,
                  color: 'var(--brand)',
                }}>
                  Week {termInfo.week}
                </div>
                <div style={{ fontSize: 10, color: 'var(--txt3)' }}>of {termInfo.totalWeeks}</div>
              </div>
            )}
          </div>

          {termInfo && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--txt3)' }}>
                <span>Term progress</span>
                <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{termInfo.progress}%</span>
              </div>
              <div style={{
                height: 6, borderRadius: 6,
                background: 'rgba(13,148,136,0.12)',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${termInfo.progress}%`,
                  height: '100%',
                  borderRadius: 6,
                  background: 'linear-gradient(90deg, var(--brand), var(--brand-dark))',
                  transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── [2] 4 KPI tiles ───────────────────────────────────────────────── */}
      <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        <KpiTile label="Active Students"    value={d.activeStudents}    accent="brand"   iconPath="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        <KpiTile label="Active Staff"       value={d.activeStaff}       accent="violet"  iconPath="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
        <KpiTile label="Report Cards Ready" value={d.readyCardsCount}   accent="warning" iconPath="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8" />
        <KpiTile label="Parent Portals"     value={d.parentPortals}     accent="success" iconPath="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" />
      </div>

      {/* ── [3] Attention + Academic Snapshot ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '40% 1fr', gap: 14, flexWrap: 'wrap' }}>
        {/* Attention panel */}
        <Panel>
          <SectionHead title="Attention Needed" />
          {attentionItems.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '24px 0', gap: 8,
            }}>
              <div style={{ fontSize: 28 }}>✓</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 600 }}>
                All clear — nothing needs attention
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {attentionItems.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: item.color === C.danger ? 'rgba(244,63,94,0.04)' : 'rgba(245,158,11,0.04)',
                  border: `1px solid ${item.color}22`,
                  borderRadius: 8,
                }}>
                  <Dot color={item.color} />
                  <span style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Academic snapshot chart */}
        <Panel>
          <SectionHead title="Academic Snapshot" action={
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Last 6 terms</span>
          } />
          {d.academicSnapshot.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--txt3)', padding: '32px 0', fontSize: 13 }}>
              No exam data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={d.academicSnapshot} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.brand}   stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.brand}   stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="gradPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.success} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={C.success} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.txt3 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: C.txt3 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="avgScore" name="Avg Score"
                  stroke={C.brand} fill="url(#gradAvg)" strokeWidth={2} dot={{ r: 3, fill: C.brand }} />
                <Area type="monotone" dataKey="passRate" name="Pass Rate %"
                  stroke={C.success} fill="url(#gradPass)" strokeWidth={2} dot={{ r: 3, fill: C.success }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* ── [4] Enrollment Trend + Fee Status ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 1fr', gap: 14 }}>
        {/* Enrollment trend */}
        <Panel>
          <SectionHead title="Enrollment Trend" action={
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{new Date().getFullYear()}</span>
          } />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d.enrollmentTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.txt3 }} />
              <YAxis tick={{ fontSize: 10, fill: C.txt3 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone" dataKey="count" name="Students"
                stroke={C.brand} strokeWidth={2.5}
                dot={{ r: 3, fill: C.brand, stroke: 'none' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        {/* Fee status */}
        <Panel>
          <SectionHead title="Fee Status" action={
            <button
              onClick={() => navigate('/secretary/fee-status')}
              style={{
                fontSize: 11, color: 'var(--brand)', fontWeight: 700,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              View all →
            </button>
          } />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <FeeStatusDonut
              paid={d.feeStatusCounts.paid}
              partial={d.feeStatusCounts.partial}
              unpaid={d.feeStatusCounts.unpaid}
              size={140}
              showLegend
            />
          </div>
        </Panel>
      </div>

      {/* ── [5] Recent Activity Feed ──────────────────────────────────────── */}
      <Panel>
        <SectionHead title="Recent Activity" />
        {d.activityFeed.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            No recent activity
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {d.activityFeed.slice(0, 10).map((item, i) => {
              const isStudent = item.tableName === 'students'
              const iconColor = item.action === 'INSERT' ? C.success : item.description.includes('suspend') ? C.warning : item.description.includes('expel') ? C.danger : C.info
              return (
                <div
                  key={item.id ?? i}
                  className="sui-feed-slide"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 0',
                    borderBottom: i < d.activityFeed.length - 1 ? '1px solid var(--border)' : 'none',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: `${iconColor}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2"
                      width="13" height="13" strokeLinecap="round" strokeLinejoin="round">
                      {isStudent
                        ? <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
                        : <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8" />
                      }
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{item.description}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>{item.time}</div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* ── [6] Quick actions row ─────────────────────────────────────────── */}
      <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          {
            label: 'Register Student',
            sub: 'Enrol a new student',
            accent: C.brand,
            iconPath: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6',
            onClick: () => setShowWizard(true),
          },
          {
            label: 'Morning Brief',
            sub: 'School at a glance',
            accent: C.violet,
            iconPath: 'M3 3h18v3H3zM3 10h18M3 17h12M20 17l-3 3-3-3',
            onClick: () => navigate('/secretary/briefing'),
          },
          {
            label: 'Reports',
            sub: 'Generate & export',
            accent: C.warning,
            iconPath: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8',
            onClick: () => navigate('/secretary/reports'),
          },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              background: 'var(--surface)',
              border: `1px solid var(--border)`,
              borderLeft: `4px solid ${btn.accent}`,
              borderRadius: 12,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'box-shadow 0.18s, transform 0.18s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
              ;(e.currentTarget as HTMLButtonElement).style.transform = 'none'
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: `${btn.accent}15`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={btn.accent} strokeWidth="2"
                width="16" height="16" strokeLinecap="round" strokeLinejoin="round">
                <path d={btn.iconPath} />
              </svg>
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13,
                color: 'var(--txt)',
              }}>
                {btn.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{btn.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Student registration wizard ───────────────────────────────────── */}
      <StudentRegistrationWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => setShowWizard(false)}
      />
    </div>
  )
}
