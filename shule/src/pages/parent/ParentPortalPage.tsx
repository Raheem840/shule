import { useState, useMemo } from 'react'
import {
  useParentStudents,
  useStudentReleasedReportCards,
  useStudentExamSummary,
  useStudentFeeBalance,
  useSchoolNotices,
} from '../../hooks/useParentPortal'
import { useAttendanceSummary, useStudentAttendanceHistory } from '../../hooks/useAttendance'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { PageHeader } from '../../components/ui/PageHeader'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'
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

// ── Attendance status colour map ───────────────────────────────
const ATT_COLOR: Record<string, string> = {
  present: 'var(--success)',
  absent:  'var(--danger)',
  late:    'var(--warning)',
  excused: 'var(--info)',
}

// ── KPI tile ───────────────────────────────────────────────────
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

// ── Results tab ────────────────────────────────────────────────
function ResultsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentExamSummary(studentId)

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
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        Loading results…
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        No published results yet.
      </div>
    )
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
          <div className="mob-cards">
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

// ── Fee balance tab ────────────────────────────────────────────
function FeeBalanceTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentFeeBalance(studentId)

  const totals = useMemo(() => ({
    due:  data.reduce((s, r) => s + r.amountDue,  0),
    paid: data.reduce((s, r) => s + r.amountPaid, 0),
    bal:  data.reduce((s, r) => s + r.balance,    0),
  }), [data])

  const fmtAmt = (n: number) =>
    'UGX ' + n.toLocaleString('en-UG', { minimumFractionDigits: 0 })

  const statusVariant: Record<StudentFeeRecord['status'], 'green' | 'amber' | 'red'> = {
    paid:    'green',
    partial: 'amber',
    unpaid:  'red',
  }

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading fees…</div>
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary tiles */}
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
          <div className="mob-cards">
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
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12 }}>
                      {fmtAmt(r.amountDue)}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--success)' }}>
                      {fmtAmt(r.amountPaid)}
                    </td>
                    <td style={{ ...TD, textAlign: 'right', fontFamily: 'var(--font3)', fontSize: 12, color: r.balance > 0 ? 'var(--danger)' : 'var(--txt3)' }}>
                      {fmtAmt(r.balance)}
                    </td>
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

// ── Attendance tab ─────────────────────────────────────────────
function AttendanceTab({ studentId }: { studentId: string }) {
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
      {/* KPI tiles */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <KpiTile label="Total Days"  value={summary.totalDays} />
        <KpiTile label="Present"     value={summary.presentDays} color="var(--success)" />
        <KpiTile label="Absent"      value={summary.absentDays}  color={summary.absentDays > 0 ? 'var(--danger)' : undefined} />
        <KpiTile label="Late"        value={summary.lateDays}    color={summary.lateDays > 0 ? 'var(--warning)' : undefined} />
        <KpiTile label="Excused"     value={summary.excusedDays} color="var(--info)" />
      </div>

      {/* Attendance rate bar */}
      <Card style={{ padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
            Attendance Rate
          </span>
          <span style={{
            fontSize: 16, fontWeight: 900, fontFamily: 'var(--font2)',
            color: summary.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
          }}>
            {summary.rate}%
          </span>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99,
            width: `${summary.rate}%`,
            background: summary.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
            transition: 'width 0.4s',
          }} />
        </div>
        {summary.isBelowThreshold && (
          <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: '0.4rem', fontFamily: 'var(--font2)', fontWeight: 700 }}>
            Below 80% threshold — attendance improvement needed.
          </div>
        )}
      </Card>

      {/* Recent history */}
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
                  color: ATT_COLOR[day.status] ?? 'var(--txt3)',
                  textTransform: 'capitalize',
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

// ── Report cards tab ───────────────────────────────────────────
function ReportCardsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentReleasedReportCards(studentId)

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

// ── Child info card ────────────────────────────────────────────
function ChildInfoCard({ student, classes, streams }: {
  student: Student
  classes: { id: string; name: string }[]
  streams: { id: string; name: string }[]
}) {
  const className  = classes.find(c => c.id === student.classId)?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? '—'
  return (
    <Card style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Avatar
          photoPath={student.photoUrl}
          bucket="student-photos"
          name={`${student.firstName} ${student.lastName}`}
          size="lg"
        />
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
            {student.firstName} {student.lastName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2, display: 'flex', gap: '0.75rem' }}>
            <span style={{ fontFamily: 'var(--font3)' }}>{student.admissionNumber}</span>
            <span>{className}{streamName !== '—' ? ` · ${streamName}` : ''}</span>
            <Badge variant={student.status === 'active' ? 'green' : 'red'}>
              {student.status}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ── Notices tab ────────────────────────────────────────────────
function NoticesTab() {
  const { data: notices = [], isLoading } = useSchoolNotices()
  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 16 }}>Loading notices…</div>
  if (notices.length === 0) {
    return (
      <div style={{ color: 'var(--txt3)', padding: 32, textAlign: 'center',
        background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
        No school notices at this time.
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {notices.map(n => (
        <div key={n.id} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '14px 18px',
        }}>
          <div style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.5 }}>{n.body}</div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>
            {new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab button ─────────────────────────────────────────────────
const TABS = ['Results', 'Fee Balance', 'Attendance', 'Report Cards', 'Notices'] as const
type TabName = typeof TABS[number]

function TabBar({ active, onChange }: { active: TabName; onChange: (t: TabName) => void }) {
  return (
    <div style={{
      display: 'flex', gap: 0, borderBottom: '1px solid var(--border)',
      marginBottom: '0.5rem',
    }}>
      {TABS.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{
            padding: '0.55rem 1.1rem', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font2)', fontWeight: 700,
            color: active === t ? 'var(--brand)' : 'var(--txt3)',
            borderBottom: active === t ? '2px solid var(--brand)' : '2px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

// ── ParentPortalPage ───────────────────────────────────────────
export function ParentPortalPage() {
  const { data: children = [], isLoading } = useParentStudents()

  const [activeChildId, setActiveChildId] = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<TabName>('Results')

  const selectedChild = useMemo(() => {
    if (!children.length) return null
    return children.find(c => c.id === activeChildId) ?? children[0]
  }, [children, activeChildId])

  if (isLoading) {
    return (
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <PageHeader title="Parent Portal" subtitle="Loading…" />
        <div style={{ textAlign: 'center', color: 'var(--txt3)', fontSize: 13, padding: '3rem' }}>
          Loading your children's information…
        </div>
      </div>
    )
  }

  if (children.length === 0) {
    return (
      <div style={{ padding: '1.4rem 1.5rem' }}>
        <PageHeader title="Parent Portal" subtitle="No students linked" />
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>
            No students are linked to your account. Please contact the school secretary.
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="sui-page-enter" style={{ padding: '1.4rem 1.5rem' }}>
      <PageHeader
        title="Parent Portal"
        subtitle={`${children.length} child${children.length !== 1 ? 'ren' : ''} linked`}
        action={
          children.length > 1 ? (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={selectedChild?.id ?? ''}
                onChange={e => setActiveChildId(e.target.value)}
                style={{
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r)', fontSize: 12.5, fontFamily: 'var(--font2)',
                  color: 'var(--txt)', padding: '0.4rem 2rem 0.4rem 0.75rem',
                  appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {children.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </option>
                ))}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
                style={{ position: 'absolute', right: '0.5rem', pointerEvents: 'none' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          ) : null
        }
      />

      {selectedChild && (
        <>
          <ChildInfoCard
            student={selectedChild}
            classes={[]}
            streams={[]}
          />
          <TabBar active={activeTab} onChange={setActiveTab} />
          {activeTab === 'Results'      && <ResultsTab     studentId={selectedChild.id} />}
          {activeTab === 'Fee Balance'  && <FeeBalanceTab  studentId={selectedChild.id} />}
          {activeTab === 'Attendance'   && <AttendanceTab  studentId={selectedChild.id} />}
          {activeTab === 'Report Cards' && <ReportCardsTab studentId={selectedChild.id} />}
          {activeTab === 'Notices'      && <NoticesTab />}
        </>
      )}
    </div>
  )
}
