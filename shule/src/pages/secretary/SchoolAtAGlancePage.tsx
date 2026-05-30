import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../../store/AuthContext'
import { useSecretaryBriefing } from '../../hooks/useSecretaryBriefing'
import { useAcademicYears } from '../../hooks/useAdmin'
import { FeeStatusDonut } from '../../components/shared/FeeStatusDonut'

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

async function downloadPdf(year: number, term: number) {
  const el = document.getElementById('briefing-page')
  if (!el) return
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF }       = await import('jspdf')
  const canvas = await html2canvas(el, { scale: 2, useCORS: true })
  const pdf    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w      = pdf.internal.pageSize.getWidth()
  const h      = (canvas.height / canvas.width) * w
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
  pdf.save(`ShuleBriefing_${year}_T${term}.pdf`)
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

  const dateStr  = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const preparedBy = user?.name ?? 'Secretary'

  const rcTotal = briefing
    ? briefing.reportCardStatus.draft + briefing.reportCardStatus.ready +
      briefing.reportCardStatus.approved + briefing.reportCardStatus.released
    : 0

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadPdf(selectedYear, selectedTerm)
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

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            Loading briefing data…
          </div>
        ) : !briefing ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            No data available for the selected period.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* 2. Enrolment Summary */}
            <section className="briefing-section report-section">
              <SectionHeader title="Enrolment Summary" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                <StatBox label="Total"        value={briefing.studentSummary.total}       color="#0d9488" />
                <StatBox label="Active"       value={briefing.studentSummary.active}      color="#10b981" />
                <StatBox label="Suspended"    value={briefing.studentSummary.suspended}   color="#f59e0b" />
                <StatBox label="Expelled"     value={briefing.studentSummary.expelled}    color="#f43f5e" />
                <StatBox label="New This Term" value={briefing.studentSummary.newThisTerm} color="#0ea5e9" />
              </div>
            </section>

            {/* 3. Staff Summary */}
            <section className="briefing-section report-section">
              <SectionHeader title="Staff Summary" />
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 80 }}>
                  <StatBox label="Total Staff" value={briefing.staffSummary.total} color="#8b5cf6" />
                </div>
                {briefing.staffSummary.byRole.length > 0 && (
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart
                        data={briefing.staffSummary.byRole.map(r => ({
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
              </div>
            </section>

            {/* 4. Academic Overview */}
            <section className="briefing-section report-section">
              <SectionHeader title="Academic Overview" />
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minWidth: 200 }}>
                  <StatBox label="Pass Rate"         value={`${briefing.academicOverview.passRate}%`}           color="#10b981" />
                  <StatBox label="Below 60%"         value={briefing.academicOverview.subjectsBelowSixty}       color="#f43f5e" />
                </div>
                {briefing.academicOverview.topSubjects.length > 0 && (
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Top Subjects
                    </div>
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart
                        data={briefing.academicOverview.topSubjects}
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
                )}
              </div>
            </section>

            {/* 5. Fee Collection (counts only) */}
            <section className="briefing-section report-section">
              <SectionHeader title="Fee Collection" />
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <FeeStatusDonut
                  paid={briefing.feeStatusCounts.paid}
                  partial={briefing.feeStatusCounts.partial}
                  unpaid={briefing.feeStatusCounts.unpaid}
                  size={140}
                  showLegend
                />
                <div style={{ flex: 1, minWidth: 180 }}>
                  {(() => {
                    const { paid, partial, unpaid } = briefing.feeStatusCounts
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
                            <div style={{ width: 28, fontSize: 12, fontWeight: 700, color: s.color, textAlign: 'right' }}>
                              {total > 0 ? `${Math.round((s.count / total) * 100)}%` : '—'}
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
              {briefing.attendanceAlerts.length === 0 ? (
                <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                  All classes are above 80% attendance.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {briefing.attendanceAlerts.map(a => (
                    <div key={a.classId} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: a.rate < 70 ? '#fff1f2' : '#fff7ed',
                      borderRadius: 6,
                      border: `1px solid ${a.rate < 70 ? '#fecdd3' : '#fde68a'}`,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{a.className}</span>
                      <span style={{
                        fontSize: 13, fontWeight: 800,
                        color: a.rate < 70 ? C.danger : C.warning,
                      }}>
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
                <PipelineStep label="Draft"    count={briefing.reportCardStatus.draft}    total={rcTotal} color={C.txt3}    />
                <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
                <PipelineStep label="Ready"    count={briefing.reportCardStatus.ready}    total={rcTotal} color={C.info}    />
                <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
                <PipelineStep label="Approved" count={briefing.reportCardStatus.approved} total={rcTotal} color={C.warning} />
                <div style={{ fontSize: 18, color: '#e2e8f0' }}>→</div>
                <PipelineStep label="Released" count={briefing.reportCardStatus.released} total={rcTotal} color={C.success} />
              </div>
            </section>

            {/* 8. Pending Actions */}
            <section className="briefing-section report-section">
              <SectionHeader title="Pending Actions" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  briefing.studentSummary.newThisTerm > 0 && `Issue parent portal credentials for ${briefing.studentSummary.newThisTerm} new student(s)`,
                  briefing.reportCardStatus.ready > 0 && `Follow up on ${briefing.reportCardStatus.ready} report card(s) awaiting principal approval`,
                  briefing.attendanceAlerts.length > 0 && `Notify class teachers for ${briefing.attendanceAlerts.length} class(es) with low attendance`,
                  briefing.feeStatusCounts.unpaid > 0 && `Send fee reminders for ${briefing.feeStatusCounts.unpaid} student(s) with no payment`,
                  briefing.studentSummary.suspended > 0 && `Update parent records for ${briefing.studentSummary.suspended} suspended student(s)`,
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
                  briefing.studentSummary.newThisTerm,
                  briefing.reportCardStatus.ready,
                  briefing.attendanceAlerts.length,
                  briefing.feeStatusCounts.unpaid,
                  briefing.studentSummary.suspended,
                ].every(v => v === 0) && (
                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: 13 }}>
                    No pending actions — great work!
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
        )}
      </div>
    </div>
  )
}
