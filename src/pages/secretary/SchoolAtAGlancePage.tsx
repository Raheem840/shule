import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { useSecretaryBriefing, type SecretaryBriefingData } from '../../hooks/useSecretaryBriefing'
import { useAcademicYears } from '../../hooks/useAdmin'
import { supabase } from '../../lib/supabase'
import { printElement } from '../../lib/printElement'

// ── Fetch school profile ───────────────────────────────────────────────────────
function useSchoolProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['school-profile-glance', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('school_profile')
        .select('school_name, short_name, logo_url, motto, curriculum')
        .eq('id', user!.schoolId)
        .single()
      return data as { school_name: string; short_name: string; logo_url: string | null; motto: string | null; curriculum: string | null } | null
    },
  })
}

// ── SVG Donut ─────────────────────────────────────────────────────────────────
function DonutRing({ segments, size = 120, strokeWidth = 16, label, sublabel }: {
  segments: { value: number; color: string; label: string }[]
  size?: number; strokeWidth?: number; label?: string; sublabel?: string
}) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  const arcs = segments.map(seg => {
    const dash = (seg.value / total) * circ
    const gap  = circ - dash
    const arc  = { dash, gap, offset: circ - offset, ...seg }
    offset    += dash
    return arc
  })

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Background track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
        {arcs.map((arc, i) => arc.value > 0 && (
          <circle key={i}
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={arc.color} strokeWidth={strokeWidth - 1}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={arc.offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }}
          />
        ))}
      </svg>
      {(label || sublabel) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {label && <div style={{ fontWeight: 900, fontSize: size / 4, color: '#0f172a', lineHeight: 1, fontFamily: 'var(--font2)' }}>{label}</div>}
          {sublabel && <div style={{ fontSize: size / 9, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>{sublabel}</div>}
        </div>
      )}
    </div>
  )
}

// ── Gauge bar ─────────────────────────────────────────────────────────────────
function GaugeBar({ value, max = 100, color, label, sublabel }: { value: number; max?: number; color: string; label: string; sublabel?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{label}</span>
        {sublabel && <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{sublabel}</span>}
      </div>
      <div style={{ height: 10, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.9s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <div style={{ fontSize: 10, color, fontWeight: 800, textAlign: 'right' }}>{value}{max === 100 ? '%' : `/${max}`}</div>
    </div>
  )
}

// ── Staff role visual pill ─────────────────────────────────────────────────────
const ROLE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  principal:     { label: 'Principal',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  deputy:        { label: 'Deputy',       color: '#0d9488', bg: 'rgba(13,148,136,.1)'  },
  dos:           { label: 'DoS',          color: '#8b5cf6', bg: 'rgba(139,92,246,.1)'  },
  secretary:     { label: 'Secretary',    color: '#0ea5e9', bg: 'rgba(14,165,233,.1)'  },
  bursar:        { label: 'Bursar',       color: '#f43f5e', bg: 'rgba(244,63,94,.1)'   },
  class_teacher: { label: 'Class Teacher',color: '#10b981', bg: 'rgba(16,185,129,.1)'  },
  teacher:       { label: 'Teacher',      color: '#6366f1', bg: 'rgba(99,102,241,.1)'  },
  it_admin:      { label: 'IT Admin',     color: '#94a3b8', bg: 'rgba(148,163,184,.1)' },
}

function StaffBreakdown({ byRole, total: _total }: { byRole: { role: string; count: number }[]; total: number }) {
  if (byRole.length === 0) return (
    <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>No staff data for this period.</div>
  )
  const maxCount = Math.max(...byRole.map(r => r.count), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {byRole.map(r => {
        const cfg = ROLE_CFG[r.role] ?? { label: r.role.replace('_', ' '), color: '#64748b', bg: 'rgba(100,116,139,.1)' }
        const pct = Math.round((r.count / maxCount) * 100)
        return (
          <div key={r.role} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 96, flexShrink: 0 }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap' }}>
                {cfg.label}
              </span>
            </div>
            <div style={{ flex: 1, height: 8, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: cfg.color, transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
            </div>
            <span style={{ width: 24, textAlign: 'right', fontSize: 12.5, fontWeight: 800, color: cfg.color, flexShrink: 0 }}>{r.count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────
function Section({ title, icon, accent = '#0d9488', children }: {
  title: string; icon: string; accent?: string; children: React.ReactNode
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e8edf2',
      overflow: 'hidden', pageBreakInside: 'avoid', breakInside: 'avoid',
      boxShadow: '0 1px 4px rgba(15,23,42,.06)',
    }}>
      {/* Section header strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 18px', borderBottom: '1px solid #f0f4f8',
        background: 'linear-gradient(90deg, rgba(13,148,136,.04), transparent)',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round">
            <path d={icon} />
          </svg>
        </div>
        <h3 style={{
          margin: 0, fontFamily: '"Space Grotesk", sans-serif', fontWeight: 800,
          fontSize: 12.5, color: '#0f172a', letterSpacing: 0.1, textTransform: 'uppercase',
        }}>
          {title}
        </h3>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

// ── KPI chip ──────────────────────────────────────────────────────────────────
function KpiChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 10, background: `${color}09`, border: `1px solid ${color}20` }}>
      <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, fontFamily: '"Space Grotesk", sans-serif' }}>{value}</div>
      <div style={{ fontSize: 9.5, color: '#64748b', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

// ── Pipeline step ─────────────────────────────────────────────────────────────
function PipelineStep({ label, count, total, color, isLast }: { label: string; count: number; total: number; color: string; isLast?: boolean }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', border: `2.5px solid ${color}`,
          background: count > 0 ? `${color}12` : '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color: count > 0 ? color : '#cbd5e1',
          fontFamily: '"JetBrains Mono", monospace',
        }}>
          {count}
        </div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: count > 0 ? '#0f172a' : '#94a3b8', textAlign: 'center' }}>{label}</div>
        <div style={{ fontSize: 9.5, color, fontWeight: 700 }}>{pct}%</div>
      </div>
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, marginBottom: 20 }}>
          <div style={{ width: 16, height: 1, background: '#e2e8f0' }} />
          <svg width="8" height="8" viewBox="0 0 8 8" fill="#e2e8f0"><path d="M0 4h6M4 1l3 3-3 3"/></svg>
        </div>
      )}
    </div>
  )
}

const EMPTY_BRIEFING: SecretaryBriefingData = {
  studentSummary:   { total: 0, active: 0, suspended: 0, expelled: 0, newThisTerm: 0 },
  staffSummary:     { total: 0, byRole: [] },
  academicOverview: { passRate: 0, subjectsBelowSixty: 0, topSubjects: [], bottomSubjects: [] },
  feeStatusCounts:  { paid: 0, partial: 0, unpaid: 0 },
  attendanceAlerts: [],
  reportCardStatus: { draft: 0, ready: 0, approved: 0, released: 0 },
}

// ── Download PDF ──────────────────────────────────────────────────────────────
async function downloadBriefingPdf(schoolName: string, year: number, term: number) {
  const el = document.getElementById('briefing-page')
  if (!el) return
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')
  const canvas = await html2canvas(el, {
    scale: 2.5, useCORS: true, backgroundColor: '#ffffff',
    windowWidth: el.scrollWidth, windowHeight: el.scrollHeight,
  })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w   = pdf.internal.pageSize.getWidth()
  const h   = (canvas.height / canvas.width) * w
  // If content > 1 page, add pages
  const pageH = pdf.internal.pageSize.getHeight()
  if (h <= pageH) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
  } else {
    let yPos = 0
    while (yPos < h) {
      if (yPos > 0) pdf.addPage()
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, -yPos, w, h)
      yPos += pageH
    }
  }
  const safeName = schoolName.replace(/[^a-zA-Z0-9]/g, '_')
  pdf.save(`${safeName}_Term${term}_${year}_Briefing.pdf`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function SchoolAtAGlancePage() {
  const { user }    = useAuth()
  const currentYear = new Date().getFullYear()
  // Term defaults to 1 until the active academic year loads and we can work
  // out which term "today" actually falls in (see the auto-correct effect
  // below) — previously this stayed hardcoded at Term 1 forever, so any data
  // scoped to "the selected term" (enrolment count, fee payments, exam
  // results) silently showed stats for Term 1 even mid-Term-2/3, including
  // filtering out students enrolled after Term 1 already ended.
  const [selectedTerm, setSelectedTerm] = useState(1)
  const [termAutoSet, setTermAutoSet]   = useState(false)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [downloading, setDownloading]   = useState(false)
  const [, setAnimated]                  = useState(false)

  const { data: ayRows = [] }  = useAcademicYears()
  const { data: school }       = useSchoolProfile()
  const { data: briefing, isLoading } = useSecretaryBriefing(selectedTerm, selectedYear)
  const b = briefing ?? EMPTY_BRIEFING

  // Trigger bar animations after mount
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 200)
    return () => clearTimeout(t)
  }, [briefing])

  const activeAy = useMemo(() =>
    (ayRows as any[]).find((y: any) => y.is_active) ?? (ayRows as any[])[0] ?? null,
    [ayRows]
  )

  // Auto-correct the initial term to whichever term "today" falls in (or,
  // between terms, the most recently-ended one) — but only once, so it
  // never clobbers a term the user deliberately picked from the toolbar.
  useEffect(() => {
    if (termAutoSet || !activeAy) return
    const now = Date.now()
    const ranges = [1, 2, 3].map(n => ({
      term:  n,
      start: activeAy[`term${n}_start`] ? new Date(activeAy[`term${n}_start`]).getTime() : null,
      end:   activeAy[`term${n}_end`]   ? new Date(activeAy[`term${n}_end`]).getTime()   : null,
    }))
    const current = ranges.find(r => r.start !== null && r.end !== null && now >= r.start && now <= r.end)
    if (current) {
      setSelectedTerm(current.term)
    } else {
      const withEnd = ranges.filter((r): r is { term: number; start: number; end: number } => r.end !== null)
      const mostRecentlyEnded = withEnd.filter(r => r.end < now).sort((a, b) => b.end - a.end)[0]
      const nextUpcoming      = withEnd.filter(r => r.end >= now).sort((a, b) => a.end - b.end)[0]
      const pick = mostRecentlyEnded ?? nextUpcoming
      if (pick) setSelectedTerm(pick.term)
    }
    setTermAutoSet(true)
  }, [activeAy, termAutoSet])

  const termInfo = useMemo(() => {
    if (!activeAy) return null
    const today = new Date()
    const map: Record<number, { start: string | null; end: string | null }> = {
      1: { start: activeAy.term1_start, end: activeAy.term1_end },
      2: { start: activeAy.term2_start, end: activeAy.term2_end },
      3: { start: activeAy.term3_start, end: activeAy.term3_end },
    }
    const t = map[selectedTerm]
    if (!t.start || !t.end) return null
    const s = new Date(t.start), e = new Date(t.end)
    if (today < s || today > e) return null
    return { week: Math.ceil((today.getTime() - s.getTime()) / (7 * 86400000)), total: Math.ceil((e.getTime() - s.getTime()) / (7 * 86400000)) }
  }, [activeAy, selectedTerm])

  const dateStr    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const preparedBy = user?.name ?? 'Secretary'
  const schoolName = school?.school_name ?? 'School'

  const rcTotal  = b.reportCardStatus.draft + b.reportCardStatus.ready + b.reportCardStatus.approved + b.reportCardStatus.released
  const feeTotal = b.feeStatusCounts.paid + b.feeStatusCounts.partial + b.feeStatusCounts.unpaid

  const feeSegments = [
    { value: b.feeStatusCounts.paid,    color: '#10b981', label: 'Paid'    },
    { value: b.feeStatusCounts.partial, color: '#f59e0b', label: 'Partial' },
    { value: b.feeStatusCounts.unpaid,  color: '#f43f5e', label: 'Unpaid'  },
  ]

  const pendingActions = [
    b.studentSummary.newThisTerm > 0 && `Issue parent portal credentials for ${b.studentSummary.newThisTerm} new student(s)`,
    b.reportCardStatus.ready > 0     && `Follow up on ${b.reportCardStatus.ready} report card(s) awaiting principal approval`,
    b.attendanceAlerts.length > 0    && `Notify class teachers for ${b.attendanceAlerts.length} class(es) with low attendance`,
    b.feeStatusCounts.unpaid > 0     && `Send fee reminders for ${b.feeStatusCounts.unpaid} student(s) with no payment`,
    b.studentSummary.suspended > 0   && `Update parent records for ${b.studentSummary.suspended} suspended student(s)`,
  ].filter(Boolean) as string[]

  async function handleDownload() {
    setDownloading(true)
    try { await downloadBriefingPdf(schoolName, selectedYear, selectedTerm) }
    finally { setDownloading(false) }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="print-hide" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: '12px 0 24px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', margin: 0 }}>School at a Glance</h1>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>End-of-period briefing document · {schoolName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {[
            { value: selectedTerm, set: setSelectedTerm, opts: [[1,'Term 1'],[2,'Term 2'],[3,'Term 3']] },
            { value: selectedYear, set: setSelectedYear, opts: [[currentYear-1,String(currentYear-1)],[currentYear,String(currentYear)],[currentYear+1,String(currentYear+1)]] },
          ].map((sel, i) => (
            <select key={i} value={sel.value} onChange={e => sel.set(Number(e.target.value))}
              style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--txt)', background: 'var(--surface)', cursor: 'pointer' }}>
              {(sel.opts as [number,string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}
          <button onClick={() => printElement('briefing-page')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', cursor: 'pointer' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button onClick={handleDownload} disabled={downloading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--brand-dark))', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? .7 : 1, boxShadow: '0 3px 10px rgba(13,148,136,.35)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {downloading ? 'Generating PDF…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Briefing Document ─────────────────────────────────────────────── */}
      <div id="briefing-page" style={{
        maxWidth: 820, margin: '0 auto', width: '100%',
        background: '#ffffff', borderRadius: 16,
        boxShadow: '0 4px 48px rgba(15,23,42,.10), 0 1px 4px rgba(15,23,42,.05)',
        padding: '40px 44px',
        color: '#0f172a', fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif',
      }}>

        {/* ── Document header ─────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', marginBottom: 36, paddingBottom: 28, borderBottom: '1.5px solid #e8edf2' }}>
          {/* Decorative top bar */}
          <div style={{ height: 4, borderRadius: 99, background: 'linear-gradient(90deg, #0d9488, #0ea5e9, #8b5cf6)', marginBottom: 28 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 8 }}>
            {school?.logo_url && (
              <img src={school.logo_url} alt="logo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10 }} />
            )}
            <div>
              <div style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 900, fontSize: 24, color: '#0f172a', letterSpacing: -.4, lineHeight: 1.1 }}>
                {schoolName}
              </div>
              {school?.motto && (
                <div style={{ fontSize: 11.5, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>{school.motto}</div>
              )}
            </div>
          </div>

          <div style={{ display: 'inline-block', background: 'linear-gradient(135deg, rgba(13,148,136,.08), rgba(14,165,233,.06))', border: '1px solid rgba(13,148,136,.15)', borderRadius: 99, padding: '4px 16px', marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0d9488', letterSpacing: .2 }}>
              School at a Glance — Term {selectedTerm}, {selectedYear}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, fontSize: 11.5, color: '#64748b', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Prepared by <strong style={{ color: '#0f172a' }}>{preparedBy}</strong>
            </span>
            <span style={{ color: '#e2e8f0' }}>·</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {dateStr}
            </span>
            {termInfo && (
              <>
                <span style={{ color: '#e2e8f0' }}>·</span>
                <span>Week <strong style={{ color: '#0f172a' }}>{termInfo.week}</strong> of {termInfo.total}</span>
              </>
            )}
          </div>

          {isLoading && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: '1.5px solid rgba(13,148,136,.3)', borderTopColor: '#0d9488', animation: 'spin .7s linear infinite' }} />
              Loading data…
            </div>
          )}
        </div>

        {/* ── Sections grid ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Row 1: Enrolment + Staff */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Enrolment */}
            <Section title="Enrolment" icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8z" accent="#0d9488">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                <KpiChip label="Total"     value={b.studentSummary.total}       color="#0d9488" />
                <KpiChip label="Active"    value={b.studentSummary.active}      color="#10b981" />
                <KpiChip label="New"       value={b.studentSummary.newThisTerm} color="#0ea5e9" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <KpiChip label="Suspended" value={b.studentSummary.suspended}   color="#f59e0b" />
                <KpiChip label="Expelled"  value={b.studentSummary.expelled}    color="#f43f5e" />
              </div>
              {b.studentSummary.total > 0 && (
                <div style={{ marginTop: 12 }}>
                  <GaugeBar
                    value={Math.round((b.studentSummary.active / b.studentSummary.total) * 100)}
                    label="Active enrolment rate" color="#10b981"
                  />
                </div>
              )}
            </Section>

            {/* Staff */}
            <Section title="Staff Composition" icon="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" accent="#8b5cf6">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <DonutRing
                  size={80} strokeWidth={12}
                  segments={b.staffSummary.byRole.map((r, i) => {
                    const colors = ['#0d9488','#8b5cf6','#0ea5e9','#f59e0b','#f43f5e','#10b981','#6366f1','#94a3b8']
                    return { value: r.count, color: colors[i % colors.length], label: r.role }
                  })}
                  label={String(b.staffSummary.total)}
                  sublabel="total"
                />
                <div style={{ flex: 1 }}>
                  <StaffBreakdown byRole={b.staffSummary.byRole} total={b.staffSummary.total} />
                </div>
              </div>
            </Section>
          </div>

          {/* Row 2: Academic + Fee Collection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Academic */}
            <Section title="Academic Overview" icon="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" accent="#10b981">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                <KpiChip label="Pass Rate"   value={`${b.academicOverview.passRate}%`}      color="#10b981" />
                <KpiChip label="Below 60%"   value={b.academicOverview.subjectsBelowSixty}  color="#f43f5e" />
              </div>
              {b.academicOverview.topSubjects.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Top Subjects</div>
                  {b.academicOverview.topSubjects.slice(0, 4).map(s => (
                    <GaugeBar key={s.name} value={s.passRate} label={s.name} sublabel={`${s.passRate}% pass`} color="#10b981" />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8', paddingTop: 4 }}>No exam results for Term {selectedTerm}, {selectedYear}.</div>
              )}
            </Section>

            {/* Fee Collection */}
            <Section title="Fee Collection" icon="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" accent="#f43f5e">
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 12 }}>
                <DonutRing
                  segments={feeSegments}
                  size={88} strokeWidth={13}
                  label={feeTotal > 0 ? `${Math.round((b.feeStatusCounts.paid / feeTotal) * 100)}%` : '—'}
                  sublabel="paid"
                />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {feeSegments.map(s => {
                    const pct = feeTotal > 0 ? Math.round((s.value / feeTotal) * 100) : 0
                    return (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: '#0f172a' }}>{s.label}</span>
                        <span style={{ fontWeight: 800, fontSize: 12.5, color: s.color, fontFamily: '"JetBrains Mono",monospace' }}>{s.value}</span>
                        <span style={{ fontSize: 10.5, color: '#94a3b8', width: 30, textAlign: 'right' }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* Visual fee bar */}
              {feeTotal > 0 && (
                <div style={{ height: 8, borderRadius: 99, overflow: 'hidden', display: 'flex', gap: 1 }}>
                  {feeSegments.map(s => s.value > 0 && (
                    <div key={s.label} style={{ flex: s.value, background: s.color, transition: 'flex .9s cubic-bezier(.4,0,.2,1)' }} />
                  ))}
                </div>
              )}
            </Section>
          </div>

          {/* Report Card Pipeline */}
          <Section title="Report Card Pipeline" icon="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M9 12h6M9 16h4" accent="#0ea5e9">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
              <PipelineStep label="Draft"    count={b.reportCardStatus.draft}    total={rcTotal} color="#94a3b8" />
              <PipelineStep label="Ready"    count={b.reportCardStatus.ready}    total={rcTotal} color="#0ea5e9" />
              <PipelineStep label="Approved" count={b.reportCardStatus.approved} total={rcTotal} color="#f59e0b" />
              <PipelineStep label="Released" count={b.reportCardStatus.released} total={rcTotal} color="#10b981" isLast />
            </div>
            {rcTotal > 0 && (
              <div style={{ marginTop: 12, height: 6, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden', display: 'flex' }}>
                {[
                  { v: b.reportCardStatus.draft,    c: '#e2e8f0' },
                  { v: b.reportCardStatus.ready,    c: '#0ea5e9' },
                  { v: b.reportCardStatus.approved, c: '#f59e0b' },
                  { v: b.reportCardStatus.released, c: '#10b981' },
                ].map((s, i) => s.v > 0 && (
                  <div key={i} style={{ flex: s.v, background: s.c, transition: 'flex .9s' }} />
                ))}
              </div>
            )}
          </Section>

          {/* Attendance Alerts */}
          {b.attendanceAlerts.length > 0 && (
            <Section title="Attendance Alerts — Below 80%" icon="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" accent="#f59e0b">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                {b.attendanceAlerts.map(a => (
                  <div key={a.classId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 10,
                    background: a.rate < 70 ? 'rgba(244,63,94,.06)' : 'rgba(245,158,11,.06)',
                    border: `1px solid ${a.rate < 70 ? 'rgba(244,63,94,.2)' : 'rgba(245,158,11,.2)'}`,
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{a.className}</span>
                    <span style={{ fontSize: 13, fontWeight: 900, color: a.rate < 70 ? '#f43f5e' : '#f59e0b', fontFamily: '"JetBrains Mono",monospace' }}>
                      {a.rate}%
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Pending Actions */}
          <Section title="Pending Actions" icon="M9 11l3 3L22 4" accent="#6366f1">
            {pendingActions.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(16,185,129,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                  {briefing ? 'No pending actions — great work!' : 'No data recorded for this period.'}
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingActions.map((action, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 10, background: '#fafbfc', border: '1px solid #f0f4f8' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, border: '2px solid #cbd5e1', flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12.5, color: '#0f172a', lineHeight: 1.5 }}>{action}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Document footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid #e8edf2', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: 'linear-gradient(135deg, #0d9488, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 8, fontWeight: 900, color: '#fff' }}>S</span>
              </div>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Shule Management System</span>
            </div>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date().toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Confidential</span>
          </div>

        </div>
      </div>
    </div>
  )
}
