import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useParentStudents,
  useParentPortalRealtime,
  useStudentReleasedReportCards,
  useStudentExamSummary,
  useStudentFeeBalance,
  useSchoolNotices,
  useFindBursar,
  useClassTeachersForClasses,
  useParentTeacherRemarks,
} from '../../hooks/useParentPortal'
import type { StaffContact } from '../../hooks/useParentPortal'
import { useAttendanceSummary, useStudentAttendanceHistory } from '../../hooks/useAttendance'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../../components/shared/Avatar'
import { SafeTermProgressTimeline } from '../../components/shared/TermProgressTimeline'
import { PortalMessagesTab } from '../../components/shared/PortalMessaging'
import { ReportCardCalcExplainer } from '../../components/shared/ReportCardCalcExplainer'
import type { Student } from '../../types/app'
import type { AttendanceDay } from '../../hooks/useAttendance'
import type { ExamResultRow, StudentFeeRecord, PortalReportCard } from '../../hooks/useParentPortal'

// ── Design tokens (all via CSS vars) ─────────────────────────────

const GRADE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  A: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Excellent' },
  B: { color: '#0d9488', bg: 'rgba(13,148,136,0.12)', label: 'Good' },
  C: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', label: 'Average' },
  D: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Below Avg' },
  E: { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',  label: 'Fail' },
}

const ATT_COLORS: Record<string, string> = {
  present: 'var(--success)',
  absent:  'var(--danger)',
  late:    'var(--warning)',
  excused: 'var(--info)',
}

const fmtUGX = (n: number) =>
  'UGX ' + n.toLocaleString('en-UG', { minimumFractionDigits: 0 })

// ── Name → avatar hue ────────────────────────────────────────────
function nameHue(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360
  return h
}

// ── SVG Donut ────────────────────────────────────────────────────
function DonutChart({
  segments, size = 120, thickness = 16,
}: {
  segments: { value: number; color: string }[]
  size?: number
  thickness?: number
}) {
  const r   = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  let offset = 0
  const arcs = segments.map(seg => {
    const len  = (seg.value / total) * circ
    const arc  = { offset, len, color: seg.color }
    offset += len
    return arc
  })

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--border)" strokeWidth={thickness}
      />
      {arcs.map((arc, i) => arc.len > 0 && (
        <circle
          key={i}
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={thickness}
          strokeDasharray={`${arc.len} ${circ - arc.len}`}
          strokeDashoffset={-arc.offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      ))}
    </svg>
  )
}

// ── Skeleton ─────────────────────────────────────────────────────
function Skeleton({ w, h, r = 8 }: { w?: string; h?: number; r?: number }) {
  return (
    <div className="shule-skeleton" style={{
      width: w ?? '100%', height: h ?? 16, borderRadius: r,
    }} />
  )
}

// ── Empty state ──────────────────────────────────────────────────
function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '1rem', padding: '3.5rem 1.5rem', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--brand-light)', border: '1.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--brand)',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 280, lineHeight: 1.6 }}>
          {body}
        </div>
      </div>
    </div>
  )
}

// ── Results tab ───────────────────────────────────────────────────
function ResultsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentExamSummary(studentId)

  const grouped = useMemo(() => {
    const map = new Map<string, ExamResultRow[]>()
    for (const r of data) {
      const key = `Term ${r.term} · ${r.year}`
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return map
  }, [data])

  if (isLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
              <Skeleton w="140px" h={16} />
            </div>
            {[0, 1, 2].map(j => (
              <div key={j} style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '1rem' }}>
                <Skeleton w="35%" h={13} />
                <Skeleton w="20%" h={13} />
                <Skeleton w="15%" h={13} />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>}
        title="No results yet"
        body="Exam results will appear here once they are published by teachers."
      />
    )
  }

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {[...grouped.entries()].map(([termLabel, rows]) => (
        <div key={termLabel} style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          {/* Term header */}
          <div style={{
            padding: '0.85rem 1.25rem',
            background: 'linear-gradient(90deg, var(--brand-light) 0%, var(--surface) 100%)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
          }}>
            <div style={{ width: 3, height: 18, borderRadius: 99, background: 'var(--brand)' }} />
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>
              {termLabel}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--font2)', fontWeight: 700,
              color: 'var(--txt3)', background: 'var(--surface2)',
              padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)',
            }}>
              {rows.length} subject{rows.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Subject rows */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((r, i) => {
              const gcfg = r.grade ? (GRADE_CONFIG[r.grade] ?? null) : null
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1.25rem',
                  borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.15s',
                }}>
                  {/* Subject name */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 2 }}>
                      {r.subjectName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                      {r.assessmentType.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'right', minWidth: 64 }}>
                    {r.isAbsent ? (
                      <span style={{
                        fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
                        color: 'var(--warning)', background: 'rgba(245,158,11,0.12)',
                        padding: '2px 8px', borderRadius: 99,
                      }}>ABSENT</span>
                    ) : (
                      <span style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>
                        {r.score ?? '—'}
                        <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 400 }}>/{r.totalMarks}</span>
                      </span>
                    )}
                  </div>

                  {/* Grade badge */}
                  {gcfg ? (
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: gcfg.bg, border: `1.5px solid ${gcfg.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14,
                      color: gcfg.color, flexShrink: 0,
                    }}>
                      {r.grade}
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Fee Balance tab ───────────────────────────────────────────────
function FeeBalanceTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentFeeBalance(studentId)

  const totals = useMemo(() => ({
    due:  data.reduce((s, r) => s + r.amountDue,  0),
    paid: data.reduce((s, r) => s + r.amountPaid, 0),
    bal:  data.reduce((s, r) => s + r.balance,    0),
  }), [data])

  const pctPaid = totals.due > 0 ? Math.round((totals.paid / totals.due) * 100) : 0

  const statusConfig: Record<StudentFeeRecord['status'], { color: string; bg: string; label: string }> = {
    paid:    { color: 'var(--success)', bg: 'rgba(16,185,129,0.1)',  label: 'Paid' },
    partial: { color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)',  label: 'Partial' },
    unpaid:  { color: 'var(--danger)',  bg: 'rgba(244,63,94,0.1)',   label: 'Unpaid' },
  }

  if (isLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, minWidth: 140, background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '1.1rem' }}>
              <Skeleton w="60%" h={24} r={6} />
              <div style={{ marginTop: 8 }}><Skeleton w="80%" h={12} /></div>
            </div>
          ))}
        </div>
        <Skeleton h={180} r={16} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>}
        title="No fee records"
        body="Your child's fee payment history will appear here once records are added."
      />
    )
  }

  // Group rows by term label
  const byTerm = useMemo(() => {
    const map = new Map<string, typeof data>()
    for (const r of data) {
      const list = map.get(r.termLabel) ?? []
      list.push(r)
      map.set(r.termLabel, list)
    }
    return map
  }, [data])

  // Circular ring progress
  const ringR = 46
  const ringCirc = 2 * Math.PI * ringR
  const ringFill = (pctPaid / 100) * ringCirc

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Overview hero card */}
      <div className="portal-hero-card" style={{
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Circular progress ring */}
        <div style={{ position: 'relative', width: 112, height: 112, flexShrink: 0 }}>
          <svg width={112} height={112} style={{ transform: 'rotate(-90deg)' }}>
            <circle cx={56} cy={56} r={ringR} fill="none" stroke="var(--border)" strokeWidth={10} />
            <circle
              cx={56} cy={56} r={ringR}
              fill="none"
              stroke={pctPaid >= 100 ? 'var(--success)' : pctPaid >= 50 ? 'var(--warning)' : 'var(--danger)'}
              strokeWidth={10}
              strokeDasharray={`${ringFill} ${ringCirc - ringFill}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.8s ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', lineHeight: 1 }}>
              {pctPaid}%
            </span>
            <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginTop: 2 }}>
              paid
            </span>
          </div>
        </div>

        {/* Stat grid */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 160 }}>
          {[
            { label: 'Total Charged', value: fmtUGX(totals.due), color: 'var(--txt)' },
            { label: 'Amount Paid',   value: fmtUGX(totals.paid), color: 'var(--success)' },
            { label: 'Balance Due',   value: fmtUGX(totals.bal),  color: totals.bal > 0 ? 'var(--danger)' : 'var(--success)' },
          ].map(stat => (
            <div key={stat.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>{stat.label}</span>
              <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 13.5, color: stat.color }}>
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-term breakdown — grouped */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {Array.from(byTerm.entries()).map(([termLabel, rows]) => {
          const termDue  = rows.reduce((s, r) => s + r.amountDue,  0)
          const termPaid = rows.reduce((s, r) => s + r.amountPaid, 0)
          const termBal  = rows.reduce((s, r) => s + r.balance,    0)
          const termPct  = termDue > 0 ? Math.round((termPaid / termDue) * 100) : 0
          const termColor = termBal <= 0 ? 'var(--success)' : termPaid > 0 ? 'var(--warning)' : 'var(--danger)'

          return (
            <div key={termLabel} style={{
              background: 'var(--surface)', borderRadius: 16,
              border: '1px solid var(--border)',
              overflow: 'hidden',
              boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
            }}>
              {/* Term header */}
              <div style={{
                padding: '0.75rem 1.1rem',
                background: 'var(--surface2)',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>
                  {termLabel}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Term progress bar */}
                  <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${termPct}%`, background: termColor, borderRadius: 99, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 12, color: termColor }}>
                    {termPct}%
                  </span>
                </div>
              </div>

              {/* Fee item rows */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((r, idx) => {
                  const scfg = statusConfig[r.status]
                  return (
                    <div key={r.id} className="portal-fee-row" style={{
                      padding: '0.75rem 1.1rem',
                      borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                    }}>
                      {/* Status dot */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: scfg.color, flexShrink: 0,
                        boxShadow: `0 0 0 3px ${scfg.bg}`,
                      }} />

                      {/* Fee name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
                          {r.feeName}
                        </div>
                        {r.receiptNumber && (
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>
                            Receipt: {r.receiptNumber}
                          </div>
                        )}
                      </div>

                      {/* Amounts */}
                      <div className="portal-fee-amounts" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginBottom: 1 }}>Charged</div>
                          <div style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 12, color: 'var(--txt2)' }}>{fmtUGX(r.amountDue)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginBottom: 1 }}>Paid</div>
                          <div style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 12, color: 'var(--success)' }}>{fmtUGX(r.amountPaid)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginBottom: 1 }}>Balance</div>
                          <div style={{ fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 12, color: scfg.color }}>{fmtUGX(r.balance)}</div>
                        </div>
                      </div>

                      {/* Badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, fontFamily: 'var(--font2)',
                        color: scfg.color, background: scfg.bg,
                        padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                      }}>
                        {scfg.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Term totals footer */}
              <div className="portal-term-footer" style={{
                padding: '0.6rem 1.1rem',
                background: 'var(--surface2)',
                borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', rowGap: '0.4rem',
              }}>
                {[
                  { l: 'Total Charged', v: fmtUGX(termDue),  c: 'var(--txt2)' },
                  { l: 'Total Paid',    v: fmtUGX(termPaid), c: 'var(--success)' },
                  { l: 'Outstanding',   v: fmtUGX(termBal),  c: termBal > 0 ? 'var(--danger)' : 'var(--txt3)' },
                ].map(s => (
                  <div key={s.l} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginBottom: 1 }}>{s.l}</div>
                    <div style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 12.5, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Attendance tab ────────────────────────────────────────────────
function AttendanceTab({ studentId }: { studentId: string }) {
  const { data: summary, isLoading: summLoading } = useAttendanceSummary(studentId)
  const { data: history = [], isLoading: histLoading } = useStudentAttendanceHistory(studentId)

  if (summLoading || histLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Skeleton w="120px" h={120} r={99} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} h={14} />)}
          </div>
        </div>
        <Skeleton h={200} r={16} />
      </div>
    )
  }

  if (!summary || summary.totalDays === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        title="No attendance records"
        body="Attendance data will appear here once teachers start recording daily attendance."
      />
    )
  }

  const donutSegs = [
    { value: summary.presentDays, color: 'var(--success)' },
    { value: summary.absentDays,  color: 'var(--danger)' },
    { value: summary.lateDays,    color: 'var(--warning)' },
    { value: summary.excusedDays, color: 'var(--info)' },
  ]

  const statRows = [
    { label: 'Present', value: summary.presentDays, color: 'var(--success)' },
    { label: 'Absent',  value: summary.absentDays,  color: 'var(--danger)' },
    { label: 'Late',    value: summary.lateDays,     color: 'var(--warning)' },
    { label: 'Excused', value: summary.excusedDays,  color: 'var(--info)' },
  ]

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Hero card */}
      <div className="portal-hero-card" style={{
        background: 'var(--surface)', borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: '1.5rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Donut + rate */}
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          <DonutChart segments={donutSegs} size={120} thickness={14} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
              color: summary.isBelowThreshold ? 'var(--danger)' : 'var(--success)', lineHeight: 1,
            }}>
              {summary.rate}%
            </span>
            <span style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600, marginTop: 2 }}>
              rate
            </span>
          </div>
        </div>

        {/* Stat breakdown */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem', minWidth: 160 }}>
          <div style={{
            fontSize: 12, fontFamily: 'var(--font2)', fontWeight: 700, color: 'var(--txt3)',
            marginBottom: 2,
          }}>
            {summary.totalDays} school days recorded
          </div>
          {statRows.map(s => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--txt2)', fontFamily: 'var(--font2)', flex: 1 }}>{s.label}</span>
              <span style={{ fontFamily: 'var(--font3)', fontWeight: 800, fontSize: 14, color: s.color }}>{s.value}</span>
            </div>
          ))}
          {summary.isBelowThreshold && (
            <div style={{
              marginTop: 4, fontSize: 11.5, color: 'var(--danger)',
              fontFamily: 'var(--font2)', fontWeight: 700,
              background: 'rgba(244,63,94,0.08)', borderRadius: 8,
              padding: '0.4rem 0.65rem', borderLeft: '3px solid var(--danger)',
            }}>
              Below 80% threshold — improvement needed
            </div>
          )}
        </div>
      </div>

      {/* Dot grid calendar */}
      {history.length > 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.85rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '0.6rem',
          }}>
            <div style={{ width: 3, height: 18, borderRadius: 99, background: 'var(--brand)' }} />
            <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>
              Recent Days
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)',
            }}>
              last {Math.min(history.length, 60)} days
            </span>
          </div>

          {/* Dot grid */}
          <div style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {history.slice(0, 60).map((day: AttendanceDay) => (
                <div
                  key={day.date}
                  title={`${new Date(day.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })} — ${day.status}`}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: ATT_COLORS[day.status] ?? 'var(--border)',
                    opacity: 0.85,
                    cursor: 'default',
                    transition: 'transform 0.1s',
                  }}
                />
              ))}
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
              {[
                { label: 'Present', color: 'var(--success)' },
                { label: 'Absent',  color: 'var(--danger)' },
                { label: 'Late',    color: 'var(--warning)' },
                { label: 'Excused', color: 'var(--info)' },
              ].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />
                  <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent history list */}
          <div style={{ borderTop: '1px solid var(--border)', maxHeight: 260, overflowY: 'auto' }}>
            {history.slice(0, 30).map((day: AttendanceDay, i) => (
              <div key={day.date} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.55rem 1.25rem',
                borderBottom: i < 29 ? '1px solid var(--border)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'var(--surface2)',
              }}>
                <span style={{ fontSize: 12.5, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>
                  {new Date(day.date).toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', textTransform: 'capitalize',
                  color: ATT_COLORS[day.status] ?? 'var(--txt3)',
                  background: `${ATT_COLORS[day.status] ?? 'var(--border)'}18`,
                  padding: '2px 10px', borderRadius: 99,
                }}>
                  {day.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Report Cards tab ──────────────────────────────────────────────
const REPORT_GRADIENTS = [
  'linear-gradient(135deg, #0d9488 0%, #0ea5e9 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #0d9488 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #f43f5e 100%)',
  'linear-gradient(135deg, #10b981 0%, #0d9488 100%)',
]

function ReportCardsTab({ studentId }: { studentId: string }) {
  const { data = [], isLoading } = useStudentReleasedReportCards(studentId)

  if (isLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[0, 1].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <Skeleton h={60} r={0} />
            <div style={{ padding: '1rem' }}>
              <Skeleton w="40%" h={16} />
              <div style={{ marginTop: 12 }}><Skeleton h={40} r={8} /></div>
              <div style={{ marginTop: 12 }}><Skeleton w="30%" h={32} r={8} /></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
        title="No Report Cards Released"
        body="Report cards will appear here once the school releases them."
      />
    )
  }

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      {data.map((rc: PortalReportCard, idx) => (
        <div key={rc.id} style={{
          background: 'var(--surface)', borderRadius: 18,
          border: '1px solid var(--border)', overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}>
          {/* Gradient top strip */}
          <div style={{
            background: REPORT_GRADIENTS[idx % REPORT_GRADIENTS.length],
            padding: '0.9rem 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 14, color: '#fff' }}>
                Term {rc.term} · {rc.year}
              </span>
            </div>
            {rc.releasedAt && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font2)' }}>
                {new Date(rc.releasedAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>

          <div style={{ padding: '1rem 1.25rem' }}>
            {/* Principal remarks */}
            {rc.principalRemarks && (
              <div style={{
                background: 'var(--brand-light)', borderRadius: 10,
                borderLeft: '3px solid var(--brand)',
                padding: '0.7rem 0.9rem', marginBottom: '1rem',
              }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font2)', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Principal's Remarks
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.55, fontStyle: 'italic' }}>
                  "{rc.principalRemarks}"
                </div>
              </div>
            )}

            {/* Download button */}
            {rc.pdfUrl ? (
              <a
                href={rc.pdfUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.75rem 1.25rem', borderRadius: 10, width: '100%',
                  background: 'var(--brand)', color: '#fff',
                  fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font2)',
                  textDecoration: 'none', transition: 'background 0.15s, transform 0.1s',
                  boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </a>
            ) : (
              <span style={{
                fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font2)',
                background: 'var(--surface2)', padding: '0.4rem 0.8rem',
                borderRadius: 8, border: '1px solid var(--border)',
              }}>
                PDF not available
              </span>
            )}
          </div>

          <ReportCardCalcExplainer />
        </div>
      ))}
    </div>
  )
}

// ── Event type pill ───────────────────────────────────────────────
function EventTypePill({ eventType }: { eventType: string | null }) {
  if (!eventType) return null
  let color = 'var(--info)'
  let bg    = 'rgba(14,165,233,0.12)'
  if (eventType === 'pta_meeting') { color = 'var(--brand)'; bg = 'rgba(13,148,136,0.12)' }
  else if (eventType === 'fee_reminder') { color = 'var(--warning)'; bg = 'rgba(245,158,11,0.12)' }
  const label = eventType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 800, fontFamily: 'var(--font2)',
      color, background: bg,
      padding: '2px 8px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {label}
    </span>
  )
}

// ── Notices tab ───────────────────────────────────────────────────
function NoticesTab() {
  const { data: notices = [], isLoading } = useSchoolNotices()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (isLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
            <Skeleton w="80%" h={14} />
            <div style={{ marginTop: 8 }}><Skeleton w="40%" h={11} /></div>
          </div>
        ))}
      </div>
    )
  }

  if (notices.length === 0) {
    return (
      <EmptyState
        icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 17H2a3 3 0 000 6h20a3 3 0 000-6z"/><path d="M17 11V5a2 2 0 00-4 0v6"/><path d="M5 11V5a2 2 0 014 0v6"/><path d="M11 11V5"/></svg>}
        title="No school announcements"
        body="School events and notices visible to parents will appear here."
      />
    )
  }

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {notices.map((n, idx) => {
        const isOpen = expanded.has(n.id)
        const isNew  = idx < 2  // treat first 2 as unread indicator

        return (
          <div key={n.id} style={{
            background: 'var(--surface)', borderRadius: 14,
            border: isNew ? '1.5px solid var(--brand)' : '1px solid var(--border)',
            overflow: 'hidden', boxShadow: isNew ? '0 0 0 3px rgba(13,148,136,0.07)' : 'none',
            transition: 'box-shadow 0.2s',
          }}>
            <button
              onClick={() => toggle(n.id)}
              style={{
                width: '100%', padding: '0.9rem 1.1rem',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left',
              }}
            >
              {isNew && (
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--brand)', flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title — prominent */}
                <div style={{
                  fontSize: 13.5, color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 800,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap',
                  lineHeight: 1.4, marginBottom: 3,
                }}>
                  {n.title}
                </div>
                {/* Body — secondary */}
                {n.body && (
                  <div style={{
                    fontSize: 12.5, color: 'var(--txt2)',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: isOpen ? 'normal' : 'nowrap',
                    lineHeight: 1.5, marginBottom: 4,
                  }}>
                    {n.body}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                  {new Date(n.createdAt).toLocaleDateString('en-UG', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </div>
              </div>
              <EventTypePill eventType={n.eventType} />
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--txt3)" strokeWidth="2.5"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Messages tab (parent ↔ bursar / class teacher(s)) ──────────────────────
// Shows the bursar plus ONE contact per distinct class among the parent's
// children — a parent with two children in different classes sees two
// class-teacher contacts, each labeled with the child(ren) they teach.
// Shares PortalMessagesTab/PortalChatThread with StudentPortalPage rather
// than a second copy of the same chat UI.
const EMPTY_TEACHER_MAP = new Map<string, StaffContact>()

function MessagesTab({ children }: { children: Student[] }) {
  const { user } = useAuth()
  const { data: bursar,      isLoading: bursarLoad   } = useFindBursar()
  const classIds = useMemo(() => children.map(c => c.classId), [children])
  const { data: teacherMap = EMPTY_TEACHER_MAP, isLoading: teacherLoad } = useClassTeachersForClasses(classIds)

  const contacts: StaffContact[] = useMemo(() => {
    const list: StaffContact[] = []
    if (bursar) list.push({ ...bursar, role: 'bursar' })

    // Group child names by teacher authUserId first, so a teacher shared by
    // multiple children gets one contact with a combined label — no mutation
    // of already-built contact objects.
    const namesByTeacher = new Map<string, { teacher: StaffContact; names: string[] }>()
    for (const child of children) {
      if (!child.classId) continue
      const teacher = teacherMap.get(child.classId)
      if (!teacher) continue
      const entry = namesByTeacher.get(teacher.authUserId)
      if (entry) entry.names.push(child.firstName)
      else namesByTeacher.set(teacher.authUserId, { teacher, names: [child.firstName] })
    }
    for (const { teacher, names } of namesByTeacher.values()) {
      list.push({ ...teacher, contextLabel: names.join(' & ') })
    }
    return list
  }, [bursar, teacherMap, children])

  return <PortalMessagesTab contacts={contacts} isLoading={bursarLoad || teacherLoad} myId={user!.id} />
}


// ── Teacher Remarks tab ───────────────────────────────────────────────────
function RemarksTab({ studentId }: { studentId: string }) {
  const { data: remarks = [], isLoading } = useParentTeacherRemarks(studentId)

  if (isLoading) {
    return (
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[0,1,2].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    )
  }

  if (remarks.length === 0) {
    return (
      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(13,148,136,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)' }}>No Remarks Yet</div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 260 }}>Your child's teacher hasn't added any remarks for this term yet.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {remarks.map(r => (
        <div key={r.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
          <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg,rgba(13,148,136,.06),rgba(14,165,233,.04))', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 11 }}>
                {r.teacherName.split(' ').map(w => w[0]).slice(0,2).join('')}
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{r.teacherName}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt3)' }}>Class Teacher</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>Term {r.term} · {r.year}</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)' }}>{new Date(r.createdAt).toLocaleDateString('en-UG', { day: '2-digit', month: 'short' })}</div>
            </div>
          </div>
          <div style={{ padding: '14px 16px', fontSize: 13.5, color: 'var(--txt)', lineHeight: 1.65, fontStyle: 'italic' }}>
            "{r.remarks}"
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────
const TABS = ['Results', 'Fee Balance', 'Attendance', 'Report Cards', 'Notices', 'Remarks', 'Messages'] as const
type TabName = typeof TABS[number]

const TAB_ICONS: Record<TabName, React.ReactNode> = {
  Results: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  'Fee Balance': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
    </svg>
  ),
  Attendance: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  'Report Cards': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  Notices: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  ),
  Remarks: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Messages: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  ),
}

function TabBar({ active, onChange }: { active: TabName; onChange: (t: TabName) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  return (
    <div className="mob-tab-sticky" style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 1rem',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      <div
        ref={scrollRef}
        className="portal-tab-scroll mob-tab-row"
        style={{
          display: 'flex', gap: 0, overflowX: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => onChange(t)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.75rem 0.9rem',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12.5, fontFamily: 'var(--font2)', fontWeight: 700,
              color: active === t ? 'var(--brand)' : 'var(--txt3)',
              borderBottom: active === t ? '2px solid var(--brand)' : '2px solid transparent',
              marginBottom: -1, transition: 'color 0.15s', whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <span style={{ opacity: active === t ? 1 : 0.6 }}>{TAB_ICONS[t]}</span>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Child selector card ───────────────────────────────────────────
function ChildCard({
  child, isSelected, onClick, classes, streams: _streams,
}: {
  child: Student
  isSelected: boolean
  onClick: () => void
  classes: { id: string; name: string }[]
  streams: { id: string; name: string }[]
}) {
  const hue       = nameHue(`${child.firstName} ${child.lastName}`)
  const className = classes.find(c => c.id === child.classId)?.name ?? '—'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
        padding: '0.85rem 1rem', borderRadius: 16, cursor: 'pointer',
        border: isSelected ? '2px solid var(--brand)' : '1.5px solid var(--border)',
        background: isSelected ? 'var(--surface)' : 'rgba(255,255,255,0.35)',
        boxShadow: isSelected ? '0 4px 16px rgba(13,148,136,0.18)' : 'none',
        transition: 'all 0.2s', minWidth: 100, flexShrink: 0,
        transform: isSelected ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%', overflow: 'hidden',
        border: isSelected ? '2.5px solid var(--brand)' : '2px solid var(--border)',
        flexShrink: 0,
      }}>
        <Avatar
          photoPath={child.photoUrl}
          bucket="student-photos"
          name={`${child.firstName} ${child.lastName}`}
          size="lg"
          style={{
            width: '100%', height: '100%',
            background: `hsl(${hue}, 60%, 50%)`,
          }}
        />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 12.5, fontWeight: 800, fontFamily: 'var(--font2)',
          color: isSelected ? 'var(--brand)' : 'var(--txt)', lineHeight: 1.2,
        }}>
          {child.firstName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginTop: 1 }}>
          {className}
        </div>
      </div>
    </button>
  )
}

// ── Selected child hero ───────────────────────────────────────────
function ChildHeroCard({
  child, classes, streams,
}: {
  child: Student
  classes: { id: string; name: string }[]
  streams: { id: string; name: string }[]
}) {
  const className  = classes.find(c => c.id === child.classId)?.name ?? '—'
  const streamName = streams.find(s => s.id === child.streamId)?.name ?? null
  const hue        = nameHue(`${child.firstName} ${child.lastName}`)

  const { data: summary } = useAttendanceSummary(child.id)
  const { data: results = [] } = useStudentExamSummary(child.id)
  const { data: fees = [] } = useStudentFeeBalance(child.id)
  const { data: reportCards = [] } = useStudentReleasedReportCards(child.id)

  const latestGrade = useMemo(() => {
    if (!results.length) return null
    return results.find(r => r.grade)?.grade ?? null
  }, [results])

  const totalBalance = useMemo(
    () => fees.reduce((s, r) => s + r.balance, 0),
    [fees]
  )

  const kpis = [
    {
      label: 'Attendance',
      value: summary ? `${summary.rate}%` : '—',
      color: summary?.isBelowThreshold ? 'var(--danger)' : 'var(--success)',
    },
    {
      label: 'Top Grade',
      value: latestGrade ?? '—',
      color: latestGrade ? (GRADE_CONFIG[latestGrade]?.color ?? 'var(--txt)') : 'var(--txt3)',
    },
    {
      label: 'Balance',
      value: fees.length === 0 ? 'Not billed' : totalBalance > 0 ? fmtUGX(totalBalance) : 'Cleared',
      color: fees.length === 0 ? 'var(--txt3)' : totalBalance > 0 ? 'var(--danger)' : 'var(--success)',
    },
    {
      label: 'Reports',
      value: String(reportCards.length),
      color: 'var(--brand)',
    },
  ]

  return (
    <div className="mob-child-card" style={{
      margin: '0 1rem 0',
      background: 'var(--surface)', borderRadius: 20,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
      overflow: 'hidden',
    }}>
      {/* Coloured top strip — becomes a full gradient hero on mobile */}
      <div
        className="mob-child-hero"
        style={{
          height: 5,
          background: `linear-gradient(90deg, hsl(${hue},60%,48%) 0%, var(--brand) 100%)`,
          ['--child-hue' as any]: String(hue),
        }}
      >
        {/* Glow blob — only visible inside the mobile gradient hero */}
        <div className="mob-child-hero-blob" />
        {/* Name overlay — only rendered visually on mobile via CSS */}
        <div className="mob-child-hero-overlay">
          <div className="mob-child-hero-name">{child.firstName} {child.lastName}</div>
          <div className="mob-child-hero-meta">
            <span className="mob-child-hero-pill">{className}{streamName ? ` · ${streamName}` : ''}</span>
            <span className={`mob-child-hero-status ${child.status === 'active' ? 'is-active' : 'is-inactive'}`}>
              {child.status.charAt(0).toUpperCase() + child.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="mob-child-body" style={{ padding: '1.25rem', display: 'flex', gap: '1.1rem', alignItems: 'flex-start' }}>
        {/* Big avatar — overlaps the gradient hero on mobile */}
        <div className="mob-child-avatar" style={{
          width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          border: `3px solid hsl(${hue},60%,60%)`,
          boxShadow: `0 4px 14px hsl(${hue},60%,50%,0.3)`,
        }}>
          <Avatar
            photoPath={child.photoUrl}
            bucket="student-photos"
            name={`${child.firstName} ${child.lastName}`}
            size="lg"
            style={{ width: '100%', height: '100%', background: `hsl(${hue},60%,50%)` }}
          />
        </div>

        {/* Admission number — mobile-only, sits under the avatar */}
        <div className="mob-child-admno">{child.admissionNumber}</div>

        {/* Info block — hidden on mobile (lives in the gradient hero instead) */}
        <div className="mob-child-info" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', lineHeight: 1.2 }}>
            {child.firstName} {child.lastName}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 3 }}>
            {child.admissionNumber}
          </div>
          <div style={{ marginTop: 6, display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{
              fontSize: 11.5, fontFamily: 'var(--font2)', fontWeight: 700,
              color: 'var(--txt2)', background: 'var(--surface2)',
              padding: '2px 8px', borderRadius: 99, border: '1px solid var(--border)',
            }}>
              {className}{streamName ? ` · ${streamName}` : ''}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)',
              color: child.status === 'active' ? 'var(--success)' : 'var(--danger)',
              background: child.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
              padding: '2px 8px', borderRadius: 99,
            }}>
              {child.status.charAt(0).toUpperCase() + child.status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="portal-kpi-grid" style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        borderTop: '1px solid var(--border)',
      }}>
        {kpis.map((kpi, i) => (
          <div key={kpi.label} style={{
            padding: '0.75rem 0.5rem', textAlign: 'center',
            borderRight: i < kpis.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 15,
              color: kpi.color, lineHeight: 1,
            }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginTop: 3 }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Parent greeting hero ──────────────────────────────────────────
function HeroHeader({ parentName, childCount, noticeCount }: {
  parentName: string
  childCount: number
  noticeCount: number
}) {
  return (
    <div style={{
      background: 'linear-gradient(145deg, #0f172a 0%, #134e4a 100%)',
      padding: '1.5rem 1.25rem 2.5rem',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Abstract circles */}
      <div style={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', background: 'rgba(13,148,136,0.15)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -20, left: -20, width: 100, height: 100,
        borderRadius: '50%', background: 'rgba(14,165,233,0.1)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Greeting */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--font2)', fontWeight: 600, marginBottom: 4 }}>
          PARENT PORTAL
        </div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', lineHeight: 1.2, marginBottom: 8 }}>
          Welcome back,<br />{parentName.split(' ')[0]}
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'rgba(255,255,255,0.12)', borderRadius: 99,
            padding: '4px 12px', backdropFilter: 'blur(8px)',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font2)', fontWeight: 700 }}>
              {childCount} {childCount === 1 ? 'child' : 'children'}
            </span>
          </div>
          {noticeCount > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              background: 'rgba(13,148,136,0.3)', borderRadius: 99,
              padding: '4px 12px', border: '1px solid rgba(13,148,136,0.5)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)' }} />
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font2)', fontWeight: 700 }}>
                {noticeCount} notice{noticeCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Portal Closed gate ────────────────────────────────────────────
function PortalClosedGate({ schoolName }: { schoolName: string }) {
  const [contacted, setContacted] = useState(false)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg)', padding: '2rem 1.5rem', textAlign: 'center',
    }}>
      {/* Decorative background orbs */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.12),transparent 68%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.09),transparent 70%)', filter: 'blur(50px)' }} />
      </div>

      <div style={{ position: 'relative', maxWidth: 420, width: '100%' }}>
        {/* Big icon */}
        <div style={{
          width: 96, height: 96, borderRadius: 28, margin: '0 auto 24px',
          background: 'linear-gradient(145deg, var(--surface2), var(--surface))',
          border: '1.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,.08)',
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>

        {/* Title */}
        <div style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
          color: 'var(--txt)', lineHeight: 1.25, marginBottom: 14,
        }}>
          Parent Portal is Currently Closed
        </div>

        {/* Body text */}
        <div style={{
          fontSize: 14.5, color: 'var(--txt2)', lineHeight: 1.7,
          marginBottom: 28, maxWidth: 360, margin: '0 auto 28px',
        }}>
          The school administration has temporarily closed the parent portal.
          Please check back later or contact the school office for information
          about your child.
        </div>

        {/* Contact button */}
        <button
          onClick={() => setContacted(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '13px 28px', borderRadius: 14,
            background: contacted ? 'var(--surface2)' : 'linear-gradient(135deg, var(--brand), var(--brand-dark))',
            color: contacted ? 'var(--txt3)' : '#fff',
            border: contacted ? '1px solid var(--border)' : 'none',
            fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 14,
            cursor: 'pointer',
            boxShadow: contacted ? 'none' : '0 4px 18px rgba(13,148,136,.38)',
            transition: 'all .2s',
          }}
        >
          {contacted ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Message noted
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.12 1.18 2 2 0 012.1 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>
              Contact School
            </>
          )}
        </button>

        {/* School name footer */}
        {schoolName && (
          <div style={{ marginTop: 32, fontSize: 12.5, color: 'var(--txt3)', fontFamily: 'var(--font2)', fontWeight: 600 }}>
            {schoolName}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export function ParentPortalPage() {
  const { user } = useAuth()

  // ── Portal-open gate ──
  const { data: portalData, isLoading: portalCheckLoading } = useQuery({
    queryKey: ['portal-open', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('school_profile')
        .select('parent_portal_open, school_name')
        .eq('id', user!.schoolId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return {
        open: (data?.parent_portal_open ?? true) as boolean,
        schoolName: (data?.school_name ?? '') as string,
      }
    },
  })

  const { data: children = [], isLoading } = useParentStudents()
  const { data: classes  = [] } = useClasses()
  const { data: notices  = [] } = useSchoolNotices()

  useParentPortalRealtime(useMemo(() => children.map(c => c.id), [children]))

  const [activeChildId, setActiveChildId] = useState<string | null>(null)
  const [activeTab, setActiveTab]         = useState<TabName>('Results')

  const selectedChild = useMemo(() => {
    if (!children.length) return null
    return children.find(c => c.id === activeChildId) ?? children[0]
  }, [children, activeChildId])

  const { data: streams = [] } = useStreams(selectedChild?.classId)

  // When selected child changes, reset tab
  useEffect(() => {
    setActiveTab('Results')
  }, [activeChildId])

  // ── Portal closed gate — show before any other content ──
  if (!portalCheckLoading && portalData && !portalData.open) {
    return <PortalClosedGate schoolName={portalData.schoolName} />
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ background: 'linear-gradient(145deg, #0f172a 0%, #134e4a 100%)', padding: '1.5rem 1.25rem 2.5rem' }}>
          <Skeleton w="50%" h={14} />
          <div style={{ marginTop: 10 }}><Skeleton w="65%" h={24} r={6} /></div>
          <div style={{ marginTop: 12, display: 'flex', gap: '0.5rem' }}>
            <Skeleton w="90px" h={26} r={99} />
            <Skeleton w="80px" h={26} r={99} />
          </div>
        </div>
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '-1rem' }}>
          <Skeleton h={120} r={20} />
          <Skeleton h={200} r={16} />
        </div>
      </div>
    )
  }

  // ── No children ──
  if (children.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
        <HeroHeader parentName={user?.name ?? 'Parent'} childCount={0} noticeCount={notices.length} />
        <div style={{ padding: '1rem', marginTop: '-1rem' }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20,
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <EmptyState
              icon={
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              }
              title="No students linked"
              body="No students are linked to your account yet. Please contact the school secretary to set up your access."
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* Hero header */}
      <HeroHeader
        parentName={user?.name ?? 'Parent'}
        childCount={children.length}
        noticeCount={notices.length}
      />

      {/* Content floats up over the hero */}
      <div style={{ marginTop: '-1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

        {/* Child selector (horizontal scroll) — only when multiple */}
        {children.length > 1 && (
          <div style={{
            padding: '0 1rem',
          }}>
            <div style={{
              background: 'var(--surface)', borderRadius: 20,
              border: '1px solid var(--border)',
              padding: '1rem',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}>
              <div style={{
                fontSize: 10.5, fontFamily: 'var(--font2)', fontWeight: 700,
                color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.6px',
                marginBottom: '0.75rem',
              }}>
                Select child
              </div>
              <div style={{
                display: 'flex', gap: '0.75rem', overflowX: 'auto',
                paddingBottom: '0.25rem', scrollbarWidth: 'none',
              }}>
                {children.map(child => (
                  <ChildCard
                    key={child.id}
                    child={child}
                    isSelected={child.id === (selectedChild?.id ?? children[0]?.id)}
                    onClick={() => setActiveChildId(child.id)}
                    classes={classes}
                    streams={streams}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Selected child hero */}
        {selectedChild && (
          <ChildHeroCard
            child={selectedChild}
            classes={classes}
            streams={streams}
          />
        )}

        {/* Term progress — parent-only events (visible_to_parents), no journal dates */}
        {selectedChild && (
          <div style={{ padding: '0 1rem' }}>
            <SafeTermProgressTimeline classId={selectedChild.classId} includeJournalEvents={false} />
          </div>
        )}

        {/* Tab content area */}
        {selectedChild && (
          <div className="portal-content-shell" style={{
            background: 'var(--surface)', borderRadius: '16px 16px 0 0',
            border: '1px solid var(--border)', borderBottom: 'none',
            minHeight: '60vh', overflow: 'hidden',
          }}>
            <TabBar active={activeTab} onChange={setActiveTab} />

            {activeTab === 'Results'      && <ResultsTab     studentId={selectedChild.id} />}
            {activeTab === 'Fee Balance'  && <FeeBalanceTab  studentId={selectedChild.id} />}
            {activeTab === 'Attendance'   && <AttendanceTab  studentId={selectedChild.id} />}
            {activeTab === 'Report Cards' && <ReportCardsTab studentId={selectedChild.id} />}
            {activeTab === 'Notices'      && <NoticesTab />}
            {activeTab === 'Remarks'      && <RemarksTab     studentId={selectedChild.id} />}
            {activeTab === 'Messages'     && <MessagesTab    children={children} />}
          </div>
        )}
      </div>
    </div>
  )
}
