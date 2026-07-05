import { useState, useMemo } from 'react'
import {
  useMyStudentRecord,
  useMyReleasedReportCards,
  useMyExamResults,
  useMyFeeBalance,
  useIsEndOfTermSurveyActive,
  useSubmitSurvey,
  useStudentPortalRealtime,
} from '../../hooks/useStudentPortal'
import { useSchoolNotices, useFindBursar, useClassTeachersForClasses } from '../../hooks/useParentPortal'
import { usePortalNotifications, useMarkSingleNotificationRead } from '../../hooks/useNotifications'
import { useAttendanceSummary, useStudentAttendanceHistory } from '../../hooks/useAttendance'
import { useTimetableSlots } from '../../hooks/useTimetableSlots'
import { useStudentSchoolEvents } from '../../hooks/useTeacherEvents'
import { useAuth } from '../../store/AuthContext'
import { Avatar } from '../../components/shared/Avatar'
import { TermPicker } from '../../components/ui/TermPicker'
import { EventTimeline } from '../../components/shared/EventTimeline'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { PortalMessagesTab } from '../../components/shared/PortalMessaging'
import type { AttendanceDay } from '../../hooks/useAttendance'
import type { ExamResultRow, StudentFeeRecord, PortalReportCard } from '../../hooks/useParentPortal'
import type { StaffContact } from '../../hooks/useParentPortal'

// ─── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ w, h, r = 8 }: { w?: string | number; h: number; r?: number }) {
  return (
    <div
      className="shule-skeleton"
      style={{ width: w ?? '100%', height: h, borderRadius: r, flexShrink: 0 }}
    />
  )
}

// ─── Grade badge colors ────────────────────────────────────────────────────────
function gradeColor(g: string): { bg: string; text: string; border: string } {
  switch (g) {
    case 'A': return { bg: 'rgba(16,185,129,.15)', text: 'var(--success)',  border: 'rgba(16,185,129,.3)' }
    case 'B': return { bg: 'rgba(13,148,136,.15)', text: 'var(--brand)',    border: 'rgba(13,148,136,.3)' }
    case 'C': return { bg: 'rgba(14,165,233,.15)', text: 'var(--info)',     border: 'rgba(14,165,233,.3)' }
    case 'D': return { bg: 'rgba(245,158,11,.15)', text: 'var(--warning)',  border: 'rgba(245,158,11,.3)' }
    default:  return { bg: 'rgba(244,63,94,.15)',  text: 'var(--danger)',   border: 'rgba(244,63,94,.3)'  }
  }
}

// ─── Inline styles helpers ─────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  overflow: 'hidden',
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  color: 'var(--txt3)',
  fontFamily: 'var(--font2)',
  marginBottom: '0.75rem',
}

// ─── Circular donut progress ───────────────────────────────────────────────────
function DonutRing({
  pct,
  color,
  size = 80,
  stroke = 7,
  label,
  sublabel,
}: {
  pct: number
  color: string
  size?: number
  stroke?: number
  label: string
  sublabel?: string
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  const cx = size / 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text
          x={cx} y={cx}
          dominantBaseline="middle" textAnchor="middle"
          fontSize={size * 0.22}
          fontWeight={800}
          fontFamily="var(--font2)"
          fill="var(--txt)"
          style={{ transform: `rotate(90deg)`, transformOrigin: `${cx}px ${cx}px` }}
        >
          {label}
        </text>
      </svg>
      {sublabel && (
        <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600 }}>
          {sublabel}
        </span>
      )}
    </div>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, padding: '3rem 1.5rem', textAlign: 'center',
      background: 'linear-gradient(160deg, var(--surface2) 0%, var(--surface) 100%)',
      borderRadius: 20, border: '1px solid var(--border)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,.06)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6, maxWidth: 260 }}>
          {body}
        </div>
      </div>
    </div>
  )
}

// ─── My Results tab ────────────────────────────────────────────────────────────
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
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} h={72} r={14} />)}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="2" />
          </svg>
        }
        title="No Results Yet"
        body="Your results will appear here once teachers publish them."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {[...grouped.entries()].map(([termLabel, rows]) => {
        const validScores = rows.filter(r => !r.isAbsent && r.score != null && r.totalMarks)
        const avg = validScores.length
          ? Math.round(validScores.reduce((s, r) => s + ((r.score! / r.totalMarks!) * 100), 0) / validScores.length)
          : null

        return (
          <div key={termLabel}>
            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                {termLabel}
              </span>
              {avg != null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font3)',
                  background: avg >= 70 ? 'rgba(16,185,129,.12)' : avg >= 50 ? 'rgba(14,165,233,.12)' : 'rgba(244,63,94,.12)',
                  color: avg >= 70 ? 'var(--success)' : avg >= 50 ? 'var(--info)' : 'var(--danger)',
                  border: `1px solid ${avg >= 70 ? 'rgba(16,185,129,.25)' : avg >= 50 ? 'rgba(14,165,233,.25)' : 'rgba(244,63,94,.25)'}`,
                  borderRadius: 99, padding: '2px 10px',
                }}>
                  Avg {avg}%
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r, i) => {
                const pct = r.isAbsent || !r.score || !r.totalMarks ? 0 : Math.round((r.score / r.totalMarks) * 100)
                const gCol = r.grade ? gradeColor(r.grade) : null

                return (
                  <div key={i} style={{
                    ...card,
                    padding: '0.9rem 1.1rem',
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      {/* Subject + type */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.subjectName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font2)',
                            background: 'var(--surface2)', color: 'var(--txt3)',
                            border: '1px solid var(--border)',
                            borderRadius: 6, padding: '1px 7px', textTransform: 'capitalize',
                          }}>
                            {r.assessmentType.replace(/_/g, ' ')}
                          </span>
                          {r.journalName && (
                            <span style={{ fontSize: 11, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                              {r.journalName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score + grade */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        {r.isAbsent ? (
                          <span style={{
                            fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
                            background: 'rgba(245,158,11,.12)', color: 'var(--warning)',
                            border: '1px solid rgba(245,158,11,.25)', borderRadius: 8, padding: '3px 10px',
                          }}>
                            ABSENT
                          </span>
                        ) : (
                          <>
                            <span style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font3)', color: 'var(--txt)', lineHeight: 1 }}>
                              {r.score ?? '—'}
                              <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 400 }}>/{r.totalMarks}</span>
                            </span>
                            {r.grade && gCol && (
                              <span style={{
                                fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
                                background: gCol.bg, color: gCol.text,
                                border: `1px solid ${gCol.border}`,
                                borderRadius: 7, padding: '2px 10px',
                              }}>
                                {r.grade}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {!r.isAbsent && (
                      <div style={{ background: 'var(--surface2)', borderRadius: 99, height: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${pct}%`,
                          background: pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--brand)' : pct >= 50 ? 'var(--info)' : 'var(--danger)',
                          transition: 'width 0.5s cubic-bezier(.4,0,.2,1)',
                        }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── My Fees tab ───────────────────────────────────────────────────────────────
function MyFeesTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useMyFeeBalance(studentId)

  const totals = useMemo(() => ({
    due:  data.reduce((s, r) => s + r.amountDue,  0),
    paid: data.reduce((s, r) => s + r.amountPaid, 0),
    bal:  data.reduce((s, r) => s + r.balance,    0),
  }), [data])

  const paidPct = totals.due > 0 ? Math.round((totals.paid / totals.due) * 100) : 0
  const fmtAmt = (n: number) => 'UGX ' + n.toLocaleString('en-UG')

  const statusMeta: Record<StudentFeeRecord['status'], { bg: string; text: string; border: string; label: string }> = {
    paid:    { bg: 'rgba(16,185,129,.12)', text: 'var(--success)', border: 'rgba(16,185,129,.25)', label: 'Paid' },
    partial: { bg: 'rgba(245,158,11,.12)', text: 'var(--warning)', border: 'rgba(245,158,11,.25)', label: 'Partial' },
    unpaid:  { bg: 'rgba(244,63,94,.12)',  text: 'var(--danger)',  border: 'rgba(244,63,94,.25)',  label: 'Unpaid' },
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton h={100} r={16} />
        {[1, 2].map(i => <Skeleton key={i} h={80} r={14} />)}
      </div>
    )
  }

  if (!isLoading && data.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{
          ...card,
          padding: '2rem 1.5rem', textAlign: 'center',
          background: 'linear-gradient(160deg, var(--surface2) 0%, var(--surface) 100%)',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18, margin: '0 auto 1rem',
            background: 'rgba(148,163,184,.12)', border: '1.5px solid rgba(148,163,184,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt2)', marginBottom: 6 }}>No Fee Records Yet</div>
          <div style={{ fontSize: 12.5, color: 'var(--txt3)', lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
            The bursar hasn't recorded any fee payments for you yet. Check back later or contact the school office.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary + gauge */}
      <div className="portal-hero-card" style={{
        ...card,
        background: 'linear-gradient(145deg, #0f172a 0%, #1a2744 100%)',
        border: 'none', padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <DonutRing
            pct={paidPct}
            color={paidPct >= 100 ? 'var(--success)' : paidPct >= 50 ? 'var(--warning)' : 'var(--danger)'}
            size={88} stroke={8}
            label={`${paidPct}%`}
            sublabel="Paid"
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Total Charged</div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font3)', color: '#fff', marginTop: 1 }}>{fmtAmt(totals.due)}</div>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,.08)' }} />
            <div style={{ display: 'flex', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Paid</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font3)', color: 'var(--success)', marginTop: 1 }}>{fmtAmt(totals.paid)}</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Balance</div>
                <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font3)', color: totals.bal > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 1 }}>{fmtAmt(totals.bal)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Per-term breakdown */}
      {(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={sectionLabel}>Term Breakdown</div>
          {data.map(r => {
            const meta = statusMeta[r.status]
            const termPct = r.amountDue > 0 ? Math.round((r.amountPaid / r.amountDue) * 100) : 0
            return (
              <div key={r.id} style={{
                ...card,
                borderLeft: `3px solid ${meta.text}`,
                padding: '0.9rem 1.1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                    {r.termLabel}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font2)',
                    background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`,
                    borderRadius: 99, padding: '2px 10px',
                  }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Due</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--txt)', marginTop: 1 }}>{fmtAmt(r.amountDue)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Paid</div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--success)', marginTop: 1 }}>{fmtAmt(r.amountPaid)}</div>
                  </div>
                  {r.balance > 0 && (
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Balance</div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--danger)', marginTop: 1 }}>{fmtAmt(r.balance)}</div>
                    </div>
                  )}
                  {r.receiptNumber && (
                    <div style={{ marginLeft: 'auto' }}>
                      <div style={{ fontSize: 9, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Receipt</div>
                      <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font3)', color: 'var(--txt2)', marginTop: 1 }}>{r.receiptNumber}</div>
                    </div>
                  )}
                </div>
                {/* Progress fill */}
                <div style={{ background: 'var(--surface2)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 99, width: `${termPct}%`,
                    background: meta.text, transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Attendance tab ────────────────────────────────────────────────────────────
const ATT_META: Record<string, { color: string; label: string; dot: string }> = {
  present: { color: 'var(--success)', label: 'Present', dot: 'var(--success)' },
  absent:  { color: 'var(--danger)',  label: 'Absent',  dot: 'var(--danger)' },
  late:    { color: 'var(--warning)', label: 'Late',    dot: 'var(--warning)' },
  excused: { color: 'var(--info)',    label: 'Excused', dot: 'var(--info)' },
}

function MyAttendanceTab({ studentId }: { studentId: string }) {
  const { data: summary, isLoading: summLoad } = useAttendanceSummary(studentId)
  const { data: history = [], isLoading: histLoad } = useStudentAttendanceHistory(studentId)

  if (summLoad || histLoad) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Skeleton h={110} r={16} />
        <Skeleton h={56} r={14} />
        <Skeleton h={200} r={14} />
      </div>
    )
  }

  if (!summary || summary.totalDays === 0) {
    return (
      <EmptyState
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        }
        title="No Attendance Records"
        body="Attendance records will appear here once they are entered."
      />
    )
  }

  const rateColor = summary.isBelowThreshold ? 'var(--danger)' : summary.rate >= 90 ? 'var(--success)' : 'var(--warning)'

  // Build last-30-day dot grid from history
  const last30 = history.slice(0, 30).reverse()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hero attendance card */}
      <div className="portal-hero-card" style={{
        ...card,
        background: 'linear-gradient(145deg, #0f172a 0%, #1a2744 100%)',
        border: 'none', padding: '1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <DonutRing
            pct={summary.rate}
            color={rateColor}
            size={90} stroke={8}
            label={`${summary.rate}%`}
            sublabel="Rate"
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font2)', marginBottom: 10 }}>
              {summary.totalDays} school days recorded
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { k: 'presentDays', label: 'Present', color: 'var(--success)' },
                { k: 'absentDays',  label: 'Absent',  color: 'var(--danger)'  },
                { k: 'lateDays',    label: 'Late',    color: 'var(--warning)' },
                { k: 'excusedDays', label: 'Excused', color: 'var(--info)'    },
              ].map(({ k, label, color }) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', fontFamily: 'var(--font2)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font3)', color, marginLeft: 'auto' }}>
                    {(summary as any)[k]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {summary.isBelowThreshold && (
          <div style={{
            marginTop: '1rem', padding: '0.6rem 0.85rem',
            background: 'rgba(244,63,94,.15)', borderRadius: 10,
            border: '1px solid rgba(244,63,94,.3)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: 12, color: 'var(--danger)', fontFamily: 'var(--font2)', fontWeight: 700 }}>
              Attendance below 80% — please speak with your class teacher.
            </span>
          </div>
        )}
      </div>

      {/* Dot calendar grid */}
      {last30.length > 0 && (
        <div style={{ ...card, padding: '1rem 1.1rem' }}>
          <div style={{ ...sectionLabel, marginBottom: '0.75rem' }}>Recent Days (Last 30)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {last30.map((day: AttendanceDay) => {
              const meta = ATT_META[day.status] ?? { dot: 'var(--border)', label: day.status }
              return (
                <div
                  key={day.date}
                  title={`${new Date(day.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })} — ${meta.label}`}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: meta.dot, flexShrink: 0,
                    cursor: 'default',
                  }}
                />
              )
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            {Object.entries(ATT_META).map(([k, { dot, label }]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot }} />
                <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History list */}
      {history.length > 0 && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            padding: '0.75rem 1.1rem', borderBottom: '1px solid var(--border)',
            ...sectionLabel, marginBottom: 0,
          }}>
            Full History
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {history.map((day: AttendanceDay) => {
              const meta = ATT_META[day.status] ?? { color: 'var(--txt3)', label: day.status, dot: 'var(--txt3)' }
              return (
                <div key={day.date} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.55rem 1.1rem', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>
                    {new Date(day.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: meta.dot }} />
                    <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)', color: meta.color, textTransform: 'capitalize' }}>
                      {day.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Report Cards tab ──────────────────────────────────────────────────────────
function MyReportCardsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useMyReleasedReportCards(studentId)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2].map(i => <Skeleton key={i} h={110} r={16} />)}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        }
        title="No Report Cards"
        body="Your report cards will appear here once your school releases them."
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {data.map((rc: PortalReportCard) => (
        <div key={rc.id} style={{ ...card, overflow: 'hidden' }}>
          {/* Gradient header */}
          <div style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 100%)',
            padding: '0.85rem 1.1rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'var(--font2)', color: '#fff' }}>
                Term {rc.term} · {rc.year}
              </div>
              {rc.releasedAt && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', marginTop: 2, fontFamily: 'var(--font2)' }}>
                  Released {new Date(rc.releasedAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>

            {rc.pdfUrl ? (
              <a
                href={rc.pdfUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '0.75rem 1rem', borderRadius: 10, width: '100%',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 12, fontWeight: 700, fontFamily: 'var(--font2)',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(13,148,136,.4)',
                  transition: 'opacity 0.15s',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </a>
            ) : (
              <span style={{
                fontSize: 11, color: 'rgba(255,255,255,.35)', fontFamily: 'var(--font2)',
                background: 'rgba(255,255,255,.06)', borderRadius: 8, padding: '0.35rem 0.7rem',
                border: '1px solid rgba(255,255,255,.1)',
              }}>
                PDF unavailable
              </span>
            )}
          </div>

          {/* Principal remarks */}
          {rc.principalRemarks && (
            <div style={{
              padding: '0.9rem 1.1rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--brand-light)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, fontFamily: 'var(--font2)',
                textTransform: 'uppercase', letterSpacing: '0.8px',
                color: 'var(--brand-dark)', marginBottom: 6,
              }}>
                Principal's Remarks
              </div>
              <blockquote style={{
                margin: 0, padding: '0 0 0 0.85rem',
                borderLeft: '3px solid var(--brand)',
                fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65,
                fontStyle: 'italic',
              }}>
                {rc.principalRemarks}
              </blockquote>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Star rating widget ────────────────────────────────────────────────────────
const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(0)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 6, lineHeight: 1, transition: 'transform 0.1s' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={n <= active ? '#f59e0b' : 'var(--surface2)'}
              stroke={n <= active ? '#d97706' : 'var(--border)'}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
      {value > 0 && (
        <span style={{
          fontSize: 13, color: 'var(--txt2)', marginLeft: 4,
          fontFamily: 'var(--font2)', fontWeight: 700,
        }}>
          {STAR_LABELS[value]}
        </span>
      )}
    </div>
  )
}

// ─── Survey tab ────────────────────────────────────────────────────────────────
function SurveyTab({ studentId }: { studentId: string }) {
  const { data: surveyMeta, isLoading: surveyLoading } = useIsEndOfTermSurveyActive()
  const submitSurvey = useSubmitSurvey()
  const [rating,    setRating]    = useState(0)
  const [enjoyed,   setEnjoyed]   = useState('')
  const [improve,   setImprove]   = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating) { setError('Please select a star rating before submitting.'); return }
    setError('')
    try {
      await submitSurvey.mutateAsync({
        studentId,
        academicYearId: surveyMeta?.academicYearId ?? null,
        term:           surveyMeta?.currentTerm    ?? null,
        year:           surveyMeta?.currentYear    ?? null,
        rating,
        suggestions: [enjoyed.trim(), improve.trim()].filter(Boolean).join('\n\n') || null,
      })
      setSubmitted(true)
    } catch (err: any) {
      setError(err.message ?? 'Survey temporarily unavailable — please try again.')
    }
  }

  if (surveyLoading) {
    return (
      <div style={{ ...card, padding: '3rem 1.5rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading survey status…</div>
      </div>
    )
  }

  if (!surveyMeta?.isActive) {
    return (
      <div style={{
        ...card, padding: '3rem 1.5rem', textAlign: 'center',
        background: 'linear-gradient(160deg, var(--surface2) 0%, var(--surface) 100%)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 1.25rem',
          background: 'rgba(148,163,184,.12)', border: '2px solid rgba(148,163,184,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt2)', marginBottom: 8 }}>
          Survey Not Yet Open
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.65, maxWidth: 320, margin: '0 auto' }}>
          The end-of-term survey hasn't been opened yet. Your school administrator will
          announce when it's available. Check back later.
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div style={{
        ...card,
        padding: '3rem 1.5rem', textAlign: 'center',
        background: 'linear-gradient(160deg, var(--brand-light) 0%, var(--surface) 100%)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1.25rem',
          background: 'rgba(16,185,129,.15)', border: '2px solid rgba(16,185,129,.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--success)', marginBottom: 8 }}>
          Thank you!
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.65, maxWidth: 300, margin: '0 auto' }}>
          Your survey has been submitted. Your feedback helps improve learning at your school.
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...card, padding: '1.5rem' }}>
      {/* Survey header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: '1.75rem',
        paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: 'rgba(139,92,246,.12)', border: '1px solid rgba(139,92,246,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="1.8">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
            End-of-Term Survey
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3, lineHeight: 1.5 }}>
            Your honest feedback helps the school improve every term.
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 10 }}>
            How would you rate this term overall?
          </div>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)', display: 'block', marginBottom: 8 }}>
            What did you enjoy most this term?
          </label>
          <textarea
            value={enjoyed}
            onChange={e => setEnjoyed(e.target.value)}
            placeholder="Share what you enjoyed…"
            className="sui-input"
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font1)' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)', display: 'block', marginBottom: 8 }}>
            What would you like improved next term?
          </label>
          <textarea
            value={improve}
            onChange={e => setImprove(e.target.value)}
            placeholder="Share what could be better…"
            className="sui-input"
            rows={3}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font1)' }}
          />
        </div>

        {error && (
          <div style={{
            fontSize: 12.5, color: 'var(--danger)', fontWeight: 600, fontFamily: 'var(--font2)',
            background: 'rgba(244,63,94,.08)', border: '1px solid rgba(244,63,94,.2)',
            borderRadius: 10, padding: '0.6rem 0.9rem',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="sui-btn-primary"
          disabled={submitSurvey.isPending || surveyMeta?.currentTerm === null}
          style={{ width: '100%' }}
        >
          {submitSurvey.isPending ? 'Submitting…' : 'Submit Survey'}
        </button>
      </form>
    </div>
  )
}

// ─── Notices tab ───────────────────────────────────────────────────────────────
function EventsTab({ classId }: { classId: string | null }) {
  const { data: events = [], isLoading } = useStudentSchoolEvents(classId)
  return (
    <EventTimeline
      events={events}
      isLoading={isLoading}
      canDelete={() => false}
      canEdit={() => false}
      canJournal={false}
      emptyTitle="No Events Yet"
      emptyBody="School events shared with students will appear here."
    />
  )
}

function NoticesTab() {
  const { data: personal = [], isLoading: pLoad } = usePortalNotifications()
  const { data: school   = [], isLoading: sLoad } = useSchoolNotices()
  const markRead = useMarkSingleNotificationRead()
  const [expanded, setExpanded] = useState<string | null>(null)

  type Item = { id: string; body: string; createdAt: string; link: string | null; isPersonal: boolean; isRead: boolean }

  const items = useMemo<Item[]>(() => {
    if (personal.length > 0) {
      return personal.map(n => ({
        id: n.id, body: n.body, createdAt: n.createdAt,
        link: n.link, isPersonal: true, isRead: !!n.readAt,
      }))
    }
    return school.map(n => ({
      id: n.id, body: n.body ?? n.title, createdAt: n.createdAt,
      link: n.link, isPersonal: false, isRead: true,
    }))
  }, [personal, school])

  if (pLoad || sLoad) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => <Skeleton key={i} h={60} r={14} />)}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        }
        title="No Notices"
        body="You have no school notices at this time. Check back later."
      />
    )
  }

  function toggle(item: Item) {
    const isOpening = expanded !== item.id
    setExpanded(isOpening ? item.id : null)
    if (isOpening && item.isPersonal && !item.isRead) {
      void markRead.mutateAsync(item.id)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => {
        const isOpen  = expanded === item.id
        const preview = item.body.length > 90 ? item.body.slice(0, 90) + '…' : item.body

        return (
          <div
            key={item.id}
            onClick={() => toggle(item)}
            style={{
              ...card,
              padding: '0.9rem 1.1rem', cursor: 'pointer',
              borderColor: item.isPersonal && !item.isRead ? 'var(--brand)' : 'var(--border)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              boxShadow: isOpen ? '0 4px 20px rgba(0,0,0,.08)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13.5, color: 'var(--txt)', lineHeight: 1.55,
                  fontWeight: item.isRead ? 400 : 700,
                }}>
                  {isOpen ? item.body : preview}
                </div>
                {isOpen && item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 12, color: 'var(--brand)', marginTop: 8, display: 'inline-flex',
                      alignItems: 'center', gap: 4, fontFamily: 'var(--font2)', fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    View details
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </a>
                )}
              </div>
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                {item.isPersonal && !item.isRead && (
                  <div style={{ position: 'relative', width: 8, height: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', position: 'absolute' }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', position: 'absolute', animation: 'ping 1.5s cubic-bezier(0,0,.2,1) infinite', opacity: 0.6 }} />
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: 'var(--txt3)', whiteSpace: 'nowrap', fontFamily: 'var(--font2)' }}>
                  {new Date(item.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                {/* Chevron */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"
                  style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Timetable tab ─────────────────────────────────────────────────────────────
const DAYS_TT: [number, string, string][] = [
  [1,'Mon','Monday'],[2,'Tue','Tuesday'],[3,'Wed','Wednesday'],
  [4,'Thu','Thursday'],[5,'Fri','Friday'],[6,'Sat','Saturday'],[7,'Sun','Sunday'],
]
const SUBJ_PALETTE = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#f43f5e','#8b5cf6','#ec4899','#0d9488']
function sColor(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJ_PALETTE[Math.abs(h) % SUBJ_PALETTE.length]
}

function MyTimetableTab({ classId, streamId }: { classId: string | null; streamId: string | null }) {
  const { user } = useAuth()
  const [term, setTerm] = useState('1')
  const [year, setYear] = useState(new Date().getFullYear())
  const [mobileDay, setMobileDay] = useState<number>(() => {
    const d = new Date().getDay()
    return d === 0 ? 7 : d >= 1 && d <= 6 ? d : 1
  })

  const { data: slots = [], isLoading } = useTimetableSlots({
    classId: classId ?? undefined,
    streamId: streamId ?? undefined,
    term, year, published: true,
  })

  const periodDefs = useMemo(() => {
    if (!user?.schoolId) return null
    try {
      const r = localStorage.getItem(`shule:period-cfg:${user.schoolId}`)
      if (r) return JSON.parse(r)
    } catch { /**/ }
    return null
  }, [user?.schoolId])

  const today    = new Date().getDay()
  const todayCol = today === 0 ? 7 : today >= 1 && today <= 6 ? today : null

  const slotMap = useMemo(() => {
    const m = new Map<string, typeof slots[number]>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  const periodNums = useMemo(() => {
    if (periodDefs) return (periodDefs as { num: number; type: string }[]).filter(d => d.type === 'class').map(d => d.num)
    if (slots.length === 0) return [1, 2, 3, 4, 5, 6, 7, 8]
    const nums = [...new Set(slots.map(s => s.periodNumber))].sort((a, b) => a - b)
    const min = nums[0], max = nums[nums.length - 1]
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }, [slots, periodDefs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Term / year selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <TermPicker value={term} onChange={setTerm} />
        </div>
        <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ flex: '0 0 5rem', minWidth: 0 }} />
      </div>

      {!classId && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          }
          title="No Class Assigned"
          body="Your class has not been assigned yet. Contact the Secretary."
        />
      )}

      {classId && isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} h={64} r={12} />)}
        </div>
      )}

      {classId && !isLoading && slots.length === 0 && (
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          }
          title="No Timetable Published"
          body={`The timetable for Term ${term} ${year} hasn't been published yet.`}
        />
      )}

      {classId && !isLoading && slots.length > 0 && (
        <>
          {/* Day pill tabs */}
          <div style={{
            display: 'flex', gap: 5, overflowX: 'auto', padding: '2px 0',
          }}>
            {DAYS_TT.map(([d, short, _full]) => {
              const isToday = d === todayCol
              const isActive = mobileDay === d
              return (
                <button
                  key={d}
                  onClick={() => setMobileDay(d)}
                  style={{
                    flex: '0 0 auto',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 10,
                    border: isActive ? 'none' : '1px solid var(--border)',
                    background: isActive
                      ? 'linear-gradient(145deg, var(--brand), var(--brand-dark))'
                      : 'var(--surface)',
                    color: isActive ? '#fff' : isToday ? 'var(--brand)' : 'var(--txt3)',
                    fontSize: 12, fontWeight: 800, fontFamily: 'var(--font2)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? '0 3px 10px rgba(13,148,136,.35)' : undefined,
                    position: 'relative',
                  }}
                >
                  {short}
                  {isToday && (
                    <div style={{
                      position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)',
                      width: 4, height: 4, borderRadius: '50%',
                      background: isActive ? 'rgba(255,255,255,.7)' : 'var(--brand)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected day label */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', fontFamily: 'var(--font2)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {DAYS_TT.find(([d]) => d === mobileDay)?.[2]}
            {mobileDay === todayCol && (
              <span style={{ marginLeft: 6, color: 'var(--brand)', fontWeight: 700 }}>· Today</span>
            )}
          </div>

          {/* Periods */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {periodNums.map(p => {
              const slot = slotMap.get(`${mobileDay}-${p}`)
              const col  = slot ? sColor(slot.subjectId) : 'var(--txt3)'

              return (
                <div key={p} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '0.8rem 1rem', borderRadius: 14,
                  border: slot ? `1px solid ${col}30` : '1px solid var(--border)',
                  background: slot ? `${col}08` : 'var(--surface)',
                  transition: 'all 0.14s',
                }}>
                  {/* Period badge */}
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: slot ? `${col}18` : 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: slot ? col : 'var(--txt3)', fontFamily: 'var(--font2)' }}>
                      P{p}
                    </span>
                  </div>

                  {slot ? (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 800, color: col,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontFamily: 'var(--font2)',
                      }}>
                        {slot.subjectName ?? '—'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                        {slot.teacherName ?? '—'}
                        {slot.startTime && (
                          <span style={{ fontFamily: 'var(--font3)', color: col, marginLeft: 8, fontWeight: 600 }}>
                            {slot.startTime} – {slot.endTime}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--txt3)', fontStyle: 'italic' }}>
                      Free period
                    </span>
                  )}

                  {mobileDay === todayCol && slot && (
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand)', flexShrink: 0 }} title="Today" />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Messages tab (student ↔ bursar / class teacher) ───────────────────────────
// A student has exactly one class, so this is simpler than the parent portal's
// per-child version — just two contacts (bursar + own class teacher). Shares
// the PortalMessagesTab/PortalChatThread component with ParentPortalPage
// rather than a second copy of the same chat UI.
function StudentMessagesTab({ classId }: { classId: string | null }) {
  const { user } = useAuth()
  const { data: bursar, isLoading: bursarLoad } = useFindBursar()
  const { data: teacherMap = new Map<string, StaffContact>(), isLoading: teacherLoad } = useClassTeachersForClasses([classId])

  const contacts: StaffContact[] = useMemo(() => {
    const list: StaffContact[] = []
    if (bursar) list.push({ ...bursar, role: 'bursar' })
    const teacher = classId ? teacherMap.get(classId) : undefined
    if (teacher) list.push(teacher)
    return list
  }, [bursar, teacherMap, classId])

  return <PortalMessagesTab contacts={contacts} isLoading={bursarLoad || teacherLoad} myId={user!.id} />
}


// ─── Tab definitions ───────────────────────────────────────────────────────────
const BASE_TABS = ['Timetable', 'My Results', 'My Fees', 'My Attendance', 'Report Cards'] as const
type BaseTab = typeof BASE_TABS[number]
type TabName = BaseTab | 'Survey' | 'Notices' | 'Events' | 'Messages'

const TAB_ICONS: Record<TabName, React.ReactNode> = {
  'Timetable': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" />
    </svg>
  ),
  'My Results': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  'My Fees': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  'My Attendance': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  'Report Cards': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  'Notices': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  ),
  'Survey': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  ),
  'Events': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  'Messages': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
}

// ─── StudentPortalPage ─────────────────────────────────────────────────────────
export function StudentPortalPage() {
  const { data: student, isLoading: studentLoading } = useMyStudentRecord()
  useStudentPortalRealtime(student?.id ?? null)
  const { data: surveyMeta } = useIsEndOfTermSurveyActive()
  const { data: fees = [] } = useMyFeeBalance(student?.id ?? '')
  const { data: attendance } = useAttendanceSummary(student?.id ?? '')
  const { data: results = [] } = useMyExamResults(student?.id ?? '')

  const tabs: TabName[] = useMemo(() => {
    const base: TabName[] = [...BASE_TABS]
    base.push('Events')
    base.push('Notices')
    base.push('Messages')
    base.push('Survey')  // always show; SurveyTab handles inactive state
    return base
  }, [])

  const [activeTab, setActiveTab] = useState<TabName>('My Results')

  // Quick KPIs for hero
  const totalBal = fees.reduce((s, r) => s + r.balance, 0)
  const validScores = results.filter(r => !r.isAbsent && r.score != null && r.totalMarks)
  const passRate = validScores.length
    ? Math.round((validScores.filter(r => ((r.score! / r.totalMarks!) * 100) >= 50).length / validScores.length) * 100)
    : null

  if (studentLoading) {
    return (
      <div style={{ padding: '0' }}>
        {/* Hero skeleton */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 100%)',
          padding: '1.5rem 1.5rem 0',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div className="shule-skeleton" style={{ width: 72, height: 72, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,.08)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <div className="shule-skeleton" style={{ width: '60%', height: 20, borderRadius: 6, background: 'rgba(255,255,255,.08)' }} />
              <div className="shule-skeleton" style={{ width: '35%', height: 14, borderRadius: 6, background: 'rgba(255,255,255,.06)' }} />
            </div>
          </div>
          <div className="shule-skeleton" style={{ width: '100%', height: 44, borderRadius: 12, background: 'rgba(255,255,255,.06)', marginBottom: '1rem' }} />
        </div>
        <div style={{ padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => <Skeleton key={i} h={72} r={14} />)}
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div style={{ padding: '1.5rem' }}>
        <EmptyState
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          }
          title="Account Not Linked"
          body="Your student account has not been linked yet. Please contact the IT administrator."
        />
      </div>
    )
  }

  if (student.status === 'suspended') {
    return (
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          maxWidth: 420, width: '100%',
          background: 'var(--surface)', border: '1px solid var(--warning)',
          borderRadius: 20, padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(245,158,11,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 20, color: 'var(--warning)', marginBottom: 8 }}>
            Account Suspended
          </div>
          <div style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6 }}>
            Your account has been suspended. Please contact the school administration for more information.
          </div>
        </div>
      </div>
    )
  }

  if (student.status === 'expelled') {
    return (
      <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          maxWidth: 420, width: '100%',
          background: 'var(--surface)', border: '1px solid var(--danger)',
          borderRadius: 20, padding: '2rem', textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(244,63,94,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 20, color: 'var(--danger)', marginBottom: 8 }}>
            Access Revoked
          </div>
          <div style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.6 }}>
            Your portal access has been revoked. Please contact the school administration.
          </div>
        </div>
      </div>
    )
  }

  const fullName = `${student.firstName} ${student.lastName}`

  return (
    <div className="sui-page-enter">
      {/* ── Premium Hero ── */}
      <div style={{
        background: 'linear-gradient(145deg, #051018 0%, #0c2236 40%, #0d3d52 100%)',
        padding: '0 0 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative glow blobs */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,.25) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 40, left: '40%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '1.5rem 1.5rem 0' }}>
          {/* Student identity */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                photoPath={student.photoUrl}
                bucket="student-photos"
                name={fullName}
                size="xl"
                style={{
                  border: '3px solid rgba(13,148,136,.5)',
                  boxShadow: '0 8px 32px rgba(0,0,0,.5), 0 0 0 6px rgba(13,148,136,.1)',
                }}
              />
              {/* Status dot */}
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 16, height: 16, borderRadius: '50%',
                background: student.status === 'active' ? 'var(--success)' : 'var(--danger)',
                border: '2.5px solid #051018',
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <h1 style={{
                margin: 0, fontSize: 'clamp(19px, 4vw, 27px)',
                fontWeight: 900, fontFamily: 'var(--font2)',
                color: '#fff', lineHeight: 1.15, letterSpacing: -.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fullName}
              </h1>

              {/* Class badge */}
              {student.className && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginTop: 5, marginBottom: 6,
                  padding: '3px 10px', borderRadius: 8,
                  background: 'rgba(13,148,136,.25)', border: '1px solid rgba(13,148,136,.4)',
                  fontSize: 11.5, fontWeight: 800, color: '#5eead4',
                  fontFamily: 'var(--font2)',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                  {student.className}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 10.5, fontFamily: 'var(--font3)', fontWeight: 700,
                  color: 'rgba(255,255,255,.4)',
                  background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                  borderRadius: 6, padding: '2px 8px',
                }}>
                  {student.admissionNumber}
                </span>
                {student.studentType && (
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, fontFamily: 'var(--font2)',
                    background: student.studentType === 'boarder' ? 'rgba(139,92,246,.2)' : 'rgba(14,165,233,.2)',
                    color: student.studentType === 'boarder' ? '#c4b5fd' : '#7dd3fc',
                    border: `1px solid ${student.studentType === 'boarder' ? 'rgba(139,92,246,.3)' : 'rgba(14,165,233,.3)'}`,
                    borderRadius: 99, padding: '2px 9px', textTransform: 'capitalize',
                  }}>
                    {student.studentType === 'boarder' ? 'Boarder' : 'Day Scholar'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Premium KPI chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {passRate != null && (
              <div style={{
                flex: '1 1 0', minWidth: 80,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                backdropFilter: 'blur(8px)', borderRadius: 14, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 3 }}>Pass Rate</div>
                <div style={{ fontSize: 'clamp(15px, 4vw, 22px)', fontWeight: 900, fontFamily: 'var(--font2)', color: passRate >= 70 ? '#6ee7b7' : passRate >= 50 ? '#fde68a' : '#fda4af', lineHeight: 1, letterSpacing: -.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{passRate}%</div>
              </div>
            )}
            {attendance && (
              <div style={{
                flex: '1 1 0', minWidth: 80,
                background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                backdropFilter: 'blur(8px)', borderRadius: 14, padding: '10px 14px',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 3 }}>Attendance</div>
                <div style={{ fontSize: 'clamp(15px, 4vw, 22px)', fontWeight: 900, fontFamily: 'var(--font2)', color: attendance.isBelowThreshold ? '#fda4af' : '#6ee7b7', lineHeight: 1, letterSpacing: -.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attendance.rate}%</div>
              </div>
            )}
            <div style={{
              flex: '1 1 0', minWidth: 80,
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              backdropFilter: 'blur(8px)', borderRadius: 14, padding: '10px 14px',
            }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', fontFamily: 'var(--font2)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 3 }}>Balance</div>
              <div style={{
                fontSize: fees.length === 0 ? 13 : 'clamp(15px, 4vw, 22px)', fontWeight: 900, fontFamily: 'var(--font2)',
                color: fees.length === 0 ? 'rgba(255,255,255,.35)' : totalBal > 0 ? '#fda4af' : '#6ee7b7',
                lineHeight: 1, letterSpacing: fees.length === 0 ? 0 : -.5,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fees.length === 0 ? '—' : totalBal > 0 ? `${(totalBal / 1000).toFixed(0)}k` : 'Clear'}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="portal-tab-scroll mob-tab-row mob-stu-tab-row" style={{
            display: 'flex', gap: 2, overflowX: 'auto',
            scrollbarWidth: 'none',
            borderBottom: '1px solid rgba(255,255,255,.08)',
          }}>
            {tabs.map(t => {
              const isActive = activeTab === t
              const isSurvey = t === 'Survey'
              return (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  style={{
                    flex: '0 0 auto',
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '0.55rem 0.9rem',
                    border: 'none',
                    borderBottom: isActive ? '2.5px solid var(--brand)' : '2.5px solid transparent',
                    background: 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,.4)',
                    fontSize: 12, fontWeight: isActive ? 800 : 600, fontFamily: 'var(--font2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    marginBottom: -1,
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.65 }}>
                    {TAB_ICONS[t]}
                  </span>
                  {t}
                  {isSurvey && surveyMeta?.isActive && (
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--violet)', boxShadow: '0 0 6px rgba(139,92,246,.5)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="portal-tab-body" style={{ padding: '1.25rem', background: 'var(--bg)', minHeight: '60vh' }}>
        <SafeTermProgressTimeline classId={student.classId} />
        {activeTab === 'Timetable'      && <MyTimetableTab   classId={student.classId} streamId={student.streamId ?? null} />}
        {activeTab === 'My Results'     && <MyResultsTab     studentId={student.id} />}
        {activeTab === 'My Fees'        && <MyFeesTab        studentId={student.id} />}
        {activeTab === 'My Attendance'  && <MyAttendanceTab  studentId={student.id} />}
        {activeTab === 'Report Cards'   && <MyReportCardsTab studentId={student.id} />}
        {activeTab === 'Events'         && <EventsTab classId={student.classId} />}
        {activeTab === 'Notices'        && <NoticesTab />}
        {activeTab === 'Messages'       && <StudentMessagesTab classId={student.classId} />}
        {activeTab === 'Survey'         && <SurveyTab studentId={student.id} />}
      </div>

      {/* Ping animation for notice dot */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
