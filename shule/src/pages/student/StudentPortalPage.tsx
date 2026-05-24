import { useState, useMemo } from 'react'
import {
  useMyStudentRecord,
  useMyReleasedReportCards,
  useMyExamResults,
  useMyFeeBalance,
  useIsEndOfTermSurveyActive,
} from '../../hooks/useStudentPortal'
import { useAttendanceSummary, useStudentAttendanceHistory } from '../../hooks/useAttendance'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import type { AttendanceDay } from '../../hooks/useAttendance'
import type { ExamResultRow, StudentFeeRecord, PortalReportCard } from '../../hooks/useParentPortal'

// ── Shared styles ──────────────────────────────────────────────
const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 10, fontWeight: 900, letterSpacing: '1px',
  textTransform: 'uppercase', color: 'var(--txt3)', padding: '0.5rem 0.85rem',
  borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
  fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
}
const TD: React.CSSProperties = {
  padding: '0.55rem 0.85rem', borderBottom: '1px solid var(--border)',
  color: 'var(--txt2)', verticalAlign: 'middle', fontSize: 12.5,
}

const ATT_COLOR: Record<string, string> = {
  present: 'var(--success)',
  absent:  'var(--danger)',
  late:    'var(--warning)',
  excused: 'var(--info)',
}

function KpiTile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', padding: '0.9rem 1.1rem', flex: 1, minWidth: 100,
    }}>
      <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: color ?? 'var(--txt)' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── My Results tab ─────────────────────────────────────────────
function MyResultsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useMyExamResults(studentId)

  const grouped = useMemo(() => {
    const map = new Map<string, ExamResultRow[]>()
    for (const r of data) {
      const key = `Term ${r.term} — ${r.year}`
      const arr = map.get(key) ?? []
      arr.push(r)
      map.set(key, arr)
    }
    return map
  }, [data])

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading results…</div>
  }
  if (data.length === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No published results yet.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem' }}>
      {[...grouped.entries()].map(([termLabel, rows]) => (
        <Card key={termLabel} style={{ padding: 0 }}>
          <div style={{
            padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)',
            fontWeight: 800, fontSize: 13, fontFamily: 'var(--font2)', color: 'var(--txt)',
          }}>
            {termLabel}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Subject</th>
                  <th style={TH}>Assessment</th>
                  <th style={TH}>Journal</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Score</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Grade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: r.isAbsent ? 'var(--warning-bg)' : undefined }}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--txt)' }}>{r.subjectName}</td>
                    <td style={TD}>
                      <span style={{ textTransform: 'capitalize', fontSize: 12 }}>
                        {r.assessmentType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ ...TD, fontSize: 12 }}>{r.journalName}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)' }}>
                      {r.isAbsent ? (
                        <span style={{ color: 'var(--warning)', fontSize: 11, fontWeight: 700 }}>ABSENT</span>
                      ) : (
                        <>
                          <span style={{ fontWeight: 700, color: 'var(--txt)' }}>{r.score ?? '—'}</span>
                          <span style={{ color: 'var(--txt3)', fontSize: 11 }}>/{r.totalMarks}</span>
                        </>
                      )}
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      {r.grade ? (
                        <Badge variant={r.grade === 'A' ? 'green' : r.grade === 'E' ? 'red' : 'blue'}>
                          {r.grade}
                        </Badge>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── My Fees tab ────────────────────────────────────────────────
function MyFeesTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useMyFeeBalance(studentId)

  const totals = useMemo(() => ({
    due:  data.reduce((s, r) => s + r.amountDue,  0),
    paid: data.reduce((s, r) => s + r.amountPaid, 0),
    bal:  data.reduce((s, r) => s + r.balance,    0),
  }), [data])

  const fmtAmt = (n: number) => 'UGX ' + n.toLocaleString('en-UG', { minimumFractionDigits: 0 })

  const statusVariant: Record<StudentFeeRecord['status'], 'green' | 'amber' | 'red'> = {
    paid: 'green', partial: 'amber', unpaid: 'red',
  }

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading fees…</div>
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <KpiTile label="Total Charged" value={fmtAmt(totals.due)} />
        <KpiTile label="Total Paid"    value={fmtAmt(totals.paid)} color="var(--success)" />
        <KpiTile label="Balance Due"   value={fmtAmt(totals.bal)}  color={totals.bal > 0 ? 'var(--danger)' : 'var(--success)'} />
      </div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: 13, padding: '2rem' }}>
          No fee records found.
        </div>
      ) : (
        <Card style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Term</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Charged</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Paid</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Balance</th>
                  <th style={{ ...TH, textAlign: 'center' }}>Status</th>
                  <th style={TH}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {data.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...TD, fontWeight: 700, color: 'var(--txt)' }}>{r.termLabel}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12 }}>{fmtAmt(r.amountDue)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--success)' }}>{fmtAmt(r.amountPaid)}</td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12, color: r.balance > 0 ? 'var(--danger)' : 'var(--txt3)' }}>{fmtAmt(r.balance)}</td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <Badge variant={statusVariant[r.status]}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </td>
                    <td style={{ ...TD, fontFamily: 'var(--font3)', fontSize: 11 }}>
                      {r.receiptNumber ?? <span style={{ color: 'var(--txt3)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── My Attendance tab ──────────────────────────────────────────
function MyAttendanceTab({ studentId }: { studentId: string }) {
  const { data: summary, isLoading: summLoading } = useAttendanceSummary(studentId)
  const { data: history = [], isLoading: histLoading } = useStudentAttendanceHistory(studentId)

  if (summLoading || histLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading attendance…</div>
  }

  if (!summary || summary.totalDays === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No attendance records yet.</div>
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <KpiTile label="Total Days"  value={summary.totalDays} />
        <KpiTile label="Present"     value={summary.presentDays} color="var(--success)" />
        <KpiTile label="Absent"      value={summary.absentDays}  color={summary.absentDays > 0 ? 'var(--danger)' : undefined} />
        <KpiTile label="Late"        value={summary.lateDays}    color={summary.lateDays > 0 ? 'var(--warning)' : undefined} />
        <KpiTile label="Excused"     value={summary.excusedDays} color="var(--info)" />
      </div>

      <Card style={{ padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Attendance Rate</span>
          <span style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font2)', color: summary.isBelowThreshold ? 'var(--danger)' : 'var(--success)' }}>
            {summary.rate}%
          </span>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, width: `${summary.rate}%`,
            background: summary.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
            transition: 'width 0.4s',
          }} />
        </div>
        {summary.isBelowThreshold && (
          <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: '0.4rem', fontFamily: 'var(--font2)', fontWeight: 700 }}>
            Your attendance is below 80%. Please speak with your class teacher.
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <Card style={{ padding: 0 }}>
          <div style={{
            padding: '0.65rem 1rem', borderBottom: '1px solid var(--border)',
            fontWeight: 800, fontSize: 12.5, fontFamily: 'var(--font2)', color: 'var(--txt)',
          }}>
            Recent History (last 90 days)
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {history.map((day: AttendanceDay) => (
              <div key={day.date} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>
                  {new Date(day.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span style={{
                  fontSize: 11.5, fontWeight: 800, fontFamily: 'var(--font2)',
                  color: ATT_COLOR[day.status] ?? 'var(--txt3)', textTransform: 'capitalize',
                }}>
                  {day.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── My Report Cards tab ────────────────────────────────────────
function MyReportCardsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useMyReleasedReportCards(studentId)

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading report cards…</div>
  }
  if (data.length === 0) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No released report cards yet.</div>
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {data.map((rc: PortalReportCard) => (
        <Card key={rc.id} style={{ padding: '0.85rem 1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
                Term {rc.term} — {rc.year}
              </div>
              {rc.releasedAt && (
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                  Released {new Date(rc.releasedAt).toLocaleDateString('en-UG')}
                </div>
              )}
            </div>
            {rc.pdfUrl ? (
              <a
                href={rc.pdfUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.4rem 0.9rem', borderRadius: 'var(--r)',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font2)',
                  textDecoration: 'none',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </a>
            ) : (
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>PDF unavailable</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ── Survey tab ─────────────────────────────────────────────────
function SurveyTab() {
  return (
    <div style={{ padding: '2rem 1rem' }}>
      <Card style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--violet-bg)', margin: '0 auto 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" ry="1" />
            <path d="M9 12h6M9 16h4" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)', marginBottom: '0.5rem' }}>
          End-of-Term Survey
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
          Your teacher has opened the end-of-term survey. Your feedback helps improve learning at your school.
          The survey form will be available here soon.
        </div>
      </Card>
    </div>
  )
}

// ── Tab definitions ────────────────────────────────────────────
const BASE_TABS = ['My Results', 'My Fees', 'My Attendance', 'Report Cards'] as const
type BaseTab = typeof BASE_TABS[number]
type TabName = BaseTab | 'Survey'

function TabBar({ tabs, active, onChange }: { tabs: TabName[]; active: TabName; onChange: (t: TabName) => void }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '0.55rem 1.1rem', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font2)', fontWeight: 700,
            color: active === t ? 'var(--brand)' : 'var(--txt3)',
            borderBottom: active === t ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
            ...(t === 'Survey' ? { color: active === t ? 'var(--violet)' : 'var(--txt3)', borderBottom: active === t ? '2px solid var(--violet)' : '2px solid transparent' } : {}),
          }}
        >
          {t}
          {t === 'Survey' && (
            <span style={{
              display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--violet)', marginLeft: '0.35rem', verticalAlign: 'middle',
            }} />
          )}
        </button>
      ))}
    </div>
  )
}

// ── StudentPortalPage ──────────────────────────────────────────
export function StudentPortalPage() {
  const { data: student, isLoading: studentLoading } = useMyStudentRecord()
  const { data: surveyActive } = useIsEndOfTermSurveyActive()

  const tabs: TabName[] = useMemo(() => {
    const base: TabName[] = [...BASE_TABS]
    if (surveyActive) base.push('Survey')
    return base
  }, [surveyActive])

  const [activeTab, setActiveTab] = useState<TabName>('My Results')

  if (studentLoading) {
    return (
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <PageHeader title="My Portal" subtitle="Loading…" />
        <div style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: 13, padding: '3rem' }}>
          Loading your information…
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <PageHeader title="My Portal" subtitle="Account not linked" />
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>
            Your student account has not been linked yet. Please contact the IT administrator.
          </div>
        </Card>
      </div>
    )
  }

  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div style={{ padding: '1.4rem 1.5rem' }}>
      <PageHeader title="My Portal" subtitle={`${student.firstName} ${student.lastName}`} />

      {/* Student info card */}
      <Card style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={`${student.firstName} ${student.lastName}`}
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(13,148,136,0.12)', color: 'var(--brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, fontFamily: 'var(--font2)',
            }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
              {student.firstName} {student.lastName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font3)' }}>{student.admissionNumber}</span>
              <Badge variant={student.status === 'active' ? 'green' : 'red'}>
                {student.status}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <TabBar tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'My Results'   && <MyResultsTab     studentId={student.id} />}
      {activeTab === 'My Fees'      && <MyFeesTab        studentId={student.id} />}
      {activeTab === 'My Attendance'&& <MyAttendanceTab  studentId={student.id} />}
      {activeTab === 'Report Cards' && <MyReportCardsTab studentId={student.id} />}
      {activeTab === 'Survey'       && <SurveyTab />}
    </div>
  )
}
