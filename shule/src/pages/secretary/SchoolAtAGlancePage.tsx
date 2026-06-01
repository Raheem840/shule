import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../../store/AuthContext'
import { useSecretaryBriefing, type SecretaryBriefingData } from '../../hooks/useSecretaryBriefing'
import { useAcademicYears } from '../../hooks/useAdmin'
import { FeeStatusDonut } from '../../components/shared/FeeStatusDonut'

const EMPTY_BRIEFING: SecretaryBriefingData = {
  studentSummary:   { total: 0, active: 0, suspended: 0, expelled: 0, newThisTerm: 0 },
  staffSummary:     { total: 0, byRole: [] },
  academicOverview: { passRate: 0, subjectsBelowSixty: 0, topSubjects: [], bottomSubjects: [] },
  feeStatusCounts:  { paid: 0, partial: 0, unpaid: 0 },
  attendanceAlerts: [],
  reportCardStatus: { draft: 0, ready: 0, approved: 0, released: 0 },
}

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

const tooltipStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--txt)',
}

async function downloadBriefingPdf(year: number, term: number) {
  const el = document.getElementById('briefing-page')
  if (!el) return
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w      = pdf.internal.pageSize.getWidth()
  const h      = (canvas.height / canvas.width) * w
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
  pdf.save(`SchoolAtAGlance_${year}_T${term}.pdf`)
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      paddingBottom: 8, borderBottom: '2px solid #e2e8f0',
    }}>
      <div style={{
        width: 4, height: 18, borderRadius: 2,
        background: '#0d9488', flexShrink: 0,
      }} />
      <h3 style={{
        margin: 0, fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14,
        color: '#0f172a', letterSpacing: '-0.2px',
      }}>
        {title}
      </h3>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      textAlign: 'center', padding: '12px 16px',
      background: '#f8fafc', borderRadius: 8,
      border: '1px solid #e2e8f0',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono, monospace)', fontWeight: 800,
        fontSize: 22, color: color ?? '#0f172a', lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </div>
    </div>
  )
}

function PipelineStep({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        background: `${color}15`, border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 6px',
        fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, fontSize: 16,
        color,
      }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: '#0f172a', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{pct}%</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHOOL AT A GLANCE PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function SchoolAtAGlancePage() {
  const { user } = useAuth()
  const currentYear = new Date().getFullYear()

  const [selectedTerm, setSelectedTerm] = useState(1)
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [downloading, setDownloading]   = useState(false)

  const { data: ayRows = [] } = useAcademicYears()

  // Find active year to get school name / term info
  const activeAy = useMemo(() => (ayRows as any[]).find((y: any) => y.is_active) ?? (ayRows as any[])[0] ?? null, [ayRows])

  // Compute week
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
    const weekNum = Math.ceil((today.getTime() - s.getTime()) / (7 * 86400000))
    return { week: weekNum }
  }, [activeAy, selectedTerm])

  const { data: briefing, isLoading } = useSecretaryBriefing(selectedTerm, selectedYear)
  // Always show the document structure — use zeros when no real data yet
  const b = briefing ?? EMPTY_BRIEFING

  const dateStr  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const preparedBy = user?.name ?? 'Secretary'

  const rcTotal = b.reportCardStatus.draft + b.reportCardStatus.ready +
    b.reportCardStatus.approved + b.reportCardStatus.released

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadBriefingPdf(selectedYear, selectedTerm)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar (screen only) ─────────────────────────────────────────── */}
      <div className="briefing-toolbar print-hide" style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10,
        padding: '12px 0 20px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20,
            color: 'var(--txt)', margin: 0,
          }}>
            School at a Glance
          </h1>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
            End-of-period briefing document
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedTerm}
            onChange={e => setSelectedTerm(Number(e.target.value))}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--txt)', background: 'var(--surface)',
              fontFamily: 'var(--font)',
            }}
          >
            <option value={1}>Term 1</option>
            <option value={2}>Term 2</option>
            <option value={3}>Term 3</option>
          </select>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)',
              fontSize: 13, color: 'var(--txt)', background: 'var(--surface)',
              fontFamily: 'var(--font)',
            }}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            style={{
              padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: 13, fontWeight: 700,
              color: 'var(--txt)', cursor: 'pointer',
            }}
          >
            Print
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: 'var(--brand)', color: '#fff', fontSize: 13,
              fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer',
              opacity: downloading ? 0.7 : 1,
            }}
          >
            {downloading ? 'Generating…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* ── Briefing document ─────────────────────────────────────────────── */}
      <div id="briefing-page" className="briefing-page" style={{
        maxWidth: 800, margin: '0 auto',
        background: '#ffffff',
        boxShadow: '0 2px 32px rgba(0,0,0,0.10)',
        borderRadius: 12,
        padding: 32,
        color: '#0f172a',
        fontFamily: 'var(--font, system-ui)',
      }}>

        {/* 1. Header */}
        <div style={{ textAlign: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
          <div style={{
            fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 26,
            color: '#0f172a', marginBottom: 4,
          }}>
            Shule Management System
          </div>
          <div style={{
            fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 18,
            color: '#0d9488', marginBottom: 8,
          }}>
            School at a Glance
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span>Prepared by: <strong>{preparedBy}</strong></span>
            <span>·</span>
            <span>{dateStr}</span>
            <span>·</span>
            <span>Term {selectedTerm}, {selectedYear}</span>
            {termInfo && (
              <>
                <span>·</span>
                <span>Week {termInfo.week}</span>
              </>
            )}
          </div>
        </div>

        {isLoading && (
          <div style={{
            textAlign: 'center', padding: '12px 0 4px',
            fontSize: 12, color: '#94a3b8',
          }}>
            Loading data…
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* 2. Enrolment Summary */}
          <section className="briefing-section report-section">
            <SectionHeader title="Enrolment Summary" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <StatBox label="Total"         value={b.studentSummary.total}       color="#0d9488" />
              <StatBox label="Active"        value={b.studentSummary.active}      color="#10b981" />
              <StatBox label="Suspended"     value={b.studentSummary.suspended}   color="#f59e0b" />
              <StatBox label="Expelled"      value={b.studentSummary.expelled}    color="#f43f5e" />
              <StatBox label="New This Term" value={b.studentSummary.newThisTerm} color="#0ea5e9" />
            </div>
          </section>

          {/* 3. Staff Summary */}
          <section className="briefing-section report-section">
            <SectionHeader title="Staff Summary" />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ minWidth: 80 }}>
                <StatBox label="Total Staff" value={b.staffSummary.total} color="#8b5cf6" />
              </div>
              {b.staffSummary.byRole.length > 0 && (
                <div style={{ flex: 1, minWidth: 200 }}>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart
                      data={b.staffSummary.byRole.map(r => ({
                        role: r.role.replace('_', ' '),
                        count: r.count,
                      }))}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 40, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 10, fill: C.txt3 }} />
                      <YAxis type="category" dataKey="role" tick={{ fontSize: 10, fill: '#0f172a' }} width={80} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" fill={C.violet} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {b.staffSummary.byRole.length === 0 && (
                <div style={{ flex: 1, fontSize: 12, color: '#94a3b8', paddingTop: 12 }}>
                  No staff breakdown available for this period.
                </div>
              )}
            </div>
          </section>

          {/* 4. Academic Overview */}
          <section className="briefing-section report-section">
            <SectionHeader title="Academic Overview" />
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 200 }}>
                <StatBox label="Pass Rate"  value={`${b.academicOverview.passRate}%`}         color="#10b981" />
                <StatBox label="Below 60%"  value={b.academicOverview.subjectsBelowSixty}     color="#f43f5e" />
              </div>
              {b.academicOverview.topSubjects.length > 0 ? (
                <div style={{ flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Top Subjects
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <BarChart
                      data={b.academicOverview.topSubjects}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 60, bottom: 0 }}
                    >
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: C.txt3 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#0f172a' }} width={80} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v}%`, 'Pass Rate']} />
                      <Bar dataKey="passRate" fill={C.success} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ flex: 1, fontSize: 12, color: '#94a3b8', paddingTop: 12 }}>
                  No exam results recorded for Term {selectedTerm}, {selectedYear}.
                </div>
              )}
            </div>
          </section>

          {/* 5. Fee Collection (counts only) */}
          <section className="briefing-section report-section">
            <SectionHeader title="Fee Collection" />
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <FeeStatusDonut
                paid={b.feeStatusCounts.paid}
                partial={b.feeStatusCounts.partial}
                unpaid={b.feeStatusCounts.unpaid}
                size={140}
                showLegend
              />
              <div style={{ flex: 1, minWidth: 180 }}>
                {(() => {
                  const { paid, partial, unpaid } = b.feeStatusCounts
                  const total = paid + partial + unpaid
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Paid',    count: paid,    color: C.success },
                        { label: 'Partial', count: partial, color: C.warning },
                        { label: 'Unpaid',  count: unpaid,  color: C.danger  },
                      ].map(s => (
                        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{s.label}</div>
                          <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#f1f5f9', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: 5, background: s.color,
                              width: total > 0 ? `${Math.round((s.count / total) * 100)}%` : '0%',
                            }} />
                          </div>
                          <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: s.color, textAlign: 'right' }}>
                            {total > 0 ? `${Math.round((s.count / total) * 100)}%` : '0%'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </section>

          {/* 6. Attendance Alerts */}
          <section className="briefing-section report-section">
            <SectionHeader title="Attendance Alerts (below 80%)" />
            {b.attendanceAlerts.length === 0 ? (
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                {briefing ? 'All classes are above 80% attendance.' : 'No attendance data recorded for this term.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {b.attendanceAlerts.map(a => (
                  <div key={a.classId} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: a.rate < 70 ? '#fff1f2' : '#fff7ed',
                    borderRadius: 6,
                    border: `1px solid ${a.rate < 70 ? '#fecdd3' : '#fde68a'}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.className}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: a.rate < 70 ? C.danger : C.warning }}>
                      {a.rate}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 7. Report Card Pipeline */}
          <section className="briefing-section report-section">
            <SectionHeader title="Report Card Pipeline" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PipelineStep label="Draft"    count={b.reportCardStatus.draft}    total={rcTotal} color={C.txt3}    />
              <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
              <PipelineStep label="Ready"    count={b.reportCardStatus.ready}    total={rcTotal} color={C.info}    />
              <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
              <PipelineStep label="Approved" count={b.reportCardStatus.approved} total={rcTotal} color={C.warning} />
              <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
              <PipelineStep label="Released" count={b.reportCardStatus.released} total={rcTotal} color={C.success} />
            </div>
          </section>

          {/* 8. Pending Actions */}
          <section className="briefing-section report-section">
            <SectionHeader title="Pending Actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                b.studentSummary.newThisTerm > 0 && `Issue parent portal credentials for ${b.studentSummary.newThisTerm} new student(s)`,
                b.reportCardStatus.ready > 0 && `Follow up on ${b.reportCardStatus.ready} report card(s) awaiting principal approval`,
                b.attendanceAlerts.length > 0 && `Notify class teachers for ${b.attendanceAlerts.length} class(es) with low attendance`,
                b.feeStatusCounts.unpaid > 0 && `Send fee reminders for ${b.feeStatusCounts.unpaid} student(s) with no payment`,
                b.studentSummary.suspended > 0 && `Update parent records for ${b.studentSummary.suspended} suspended student(s)`,
              ].filter(Boolean).map((action, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: 3,
                    border: '1.5px solid #94a3b8',
                    flexShrink: 0, marginTop: 1,
                  }} />
                  <span style={{ fontSize: 13, color: '#0f172a' }}>{action as string}</span>
                </div>
              ))}
              {[
                b.studentSummary.newThisTerm,
                b.reportCardStatus.ready,
                b.attendanceAlerts.length,
                b.feeStatusCounts.unpaid,
                b.studentSummary.suspended,
              ].every(v => v === 0) && (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                  {briefing ? 'No pending actions — great work!' : 'No data yet for this period.'}
                </div>
              )}
            </div>
          </section>

          {/* 9. Footer */}
          <div style={{
            paddingTop: 16, borderTop: '1px solid #e2e8f0',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 10, color: '#94a3b8',
          }}>
            <span>Printed by Shule Management System</span>
            <span>{new Date().toLocaleString('en-GB')}</span>
            <span>Page 1 of 1</span>
          </div>

        </div>
      </div>
    </div>
  )
}
