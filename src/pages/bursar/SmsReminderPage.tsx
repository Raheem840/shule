import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button }         from '../../components/ui/Button'
import { Badge }          from '../../components/ui/Badge'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useClasses, useStreams } from '../../hooks/useClasses'
import {
  useSmsStudents, useSmsReminderLog, useSendReminders, useRetryReminder,
  type SmsFilters, type SmsStudentRow, type ReminderLogRow,
} from '../../hooks/useSmsReminders'
import { ugx } from '../../hooks/useFeePayments'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { getFriendlyErrorMessage } from '../../lib/errors'
import type { SmsChannel } from '../../types/app'

// ── Status badge variant map ───────────────────────────────────
const STATUS_VARIANT = {
  paid:      'green',
  partial:   'amber',
  unpaid:    'red',
} as const
const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' }

const REMINDER_STATUS_VARIANT = {
  pending:   'muted',
  sent:      'teal',
  delivered: 'green',
  failed:    'red',
} as const

// ── Template variable chips ────────────────────────────────────
const TEMPLATE_VARS = [
  { key: '{student_name}', label: 'Student Name', color: 'var(--brand)' },
  { key: '{balance}',      label: 'Balance',       color: 'var(--warning)' },
  { key: '{school_name}',  label: 'School Name',  color: 'var(--info)' },
  { key: '{term}',         label: 'Term',          color: 'var(--violet)' },
]

// ── Render a message with real data ───────────────────────────
function renderMessage(template: string, student: SmsStudentRow, term: number, schoolName: string) {
  return template
    .replace(/{student_name}/g, `${student.firstName} ${student.lastName}`)
    .replace(/{balance}/g,      ugx(student.balance))
    .replace(/{school_name}/g,  schoolName || 'Your School')
    .replace(/{term}/g,         `Term ${term}`)
}

// The bursar's composed message is addressed to a parent/guardian ("Dear
// X's parent...") — reusing that verbatim for the in-app copy sent to the
// STUDENT's own account read oddly ("Dear Brandon's parent" shown to
// Brandon). Rather than trying to mangle arbitrary free text the bursar
// typed, the student's in-app notification uses its own fixed,
// student-appropriate wording built from the same data.
const STUDENT_FEE_REMINDER_TEMPLATE =
  'Hi {student_name}, you have an outstanding fee balance of {balance} for {term}. Please speak to your parent/guardian about clearing it.'

function renderStudentMessage(student: SmsStudentRow, term: number, schoolName: string) {
  return renderMessage(STUDENT_FEE_REMINDER_TEMPLATE, student, term, schoolName)
}

// ── Student row in preview table ─────────────────────────────
function PreviewRow({
  row, selected, onToggle,
}: {
  row: SmsStudentRow; selected: boolean; onToggle: () => void
}) {
  return (
    <tr className="sui-tr" style={{ background: selected ? 'var(--brand-light)' : undefined }}>
      <td style={{ padding: '0.5rem 0.75rem', width: 36 }}>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select ${row.firstName} ${row.lastName}`}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--brand)' }}
          />
        </label>
      </td>
      <td style={{ padding: '0.5rem 0.75rem' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{row.firstName} {row.lastName}</div>
        <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{row.className}</div>
      </td>
      <td style={{ padding: '0.5rem 0.75rem', fontSize: 12, color: 'var(--txt2)' }}>{row.guardianName}</td>
      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt2)' }}>{row.guardianPhone}</td>
      <td style={{ padding: '0.5rem 0.75rem' }}>
        <Badge variant={STATUS_VARIANT[row.status]} size="sm">{STATUS_LABEL[row.status]}</Badge>
      </td>
      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'var(--font3)', fontWeight: 700, fontSize: 13, color: 'var(--danger)' }}>
        {ugx(row.balance)}
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()

export function SmsReminderPage() {
  const [smsFilters, setSmsFilters] = useState<SmsFilters>({
    balanceStatus: 'all',
    minBalance: 0,
    term: 1,
    year: CURRENT_YEAR,
  })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [message,  setMessage]  = useState(
    'Dear {student_name}\'s parent, your child has an outstanding fee balance of {balance} for {term}. Kindly clear this balance as soon as possible. Thank you.'
  )
  const [channels, setChannels] = useState<Set<SmsChannel>>(new Set(['sms', 'in_app']))
  const [showPreview, setShowPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: schoolSettings } = useSchoolSettings()
  const schoolName = schoolSettings?.schoolName || schoolSettings?.shortName || 'Your School'

  const { data: classes } = useClasses()
  const { data: streams } = useStreams(smsFilters.classId ?? null)
  const { data: students, isLoading: loadingStudents, isError: studentsError, error: studentsErrorObj } = useSmsStudents(smsFilters)
  const { data: logData, isLoading: loadingLog } = useSmsReminderLog()
  const sendReminders = useSendReminders()
  const retryReminder = useRetryReminder()

  const logParentRef = useRef<HTMLDivElement>(null)
  const logVirtualizer = useVirtualizer({
    count:           (logData ?? []).length,
    getScrollElement: () => logParentRef.current,
    estimateSize:    () => 52,
    overscan:        8,
  })

  // ── Selection helpers ────────────────────────────────────────
  const allIds       = (students ?? []).map(s => s.studentId)
  const allSelected  = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  const someSelected = allIds.some(id => selectedIds.has(id)) && !allSelected

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(allIds))
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  // ── Channel selection — any combination, at least one required ──
  function toggleChannel(ch: SmsChannel) {
    setChannels(prev => {
      const next = new Set(prev)
      if (next.has(ch)) {
        if (next.size === 1) return prev // must keep at least one channel selected
        next.delete(ch)
      } else {
        next.add(ch)
      }
      return next
    })
  }

  // ── Insert template variable at cursor ───────────────────────
  function insertVar(varKey: string) {
    const ta = textareaRef.current
    if (!ta) { setMessage(m => m + varKey); return }
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const next  = message.slice(0, start) + varKey + message.slice(end)
    setMessage(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + varKey.length, start + varKey.length)
    })
  }

  // ── Send ─────────────────────────────────────────────────────
  async function handleSend() {
    const toSend = (students ?? []).filter(s => selectedIds.has(s.studentId))
    if (!toSend.length || !message.trim() || channels.size === 0) return

    // One reminder row per selected channel per student — the hook routes
    // each to its own delivery path and delivery-log entry. studentMessage
    // is only used for the in_app channel's copy to the student's own
    // account — SMS/WhatsApp (guardian's phone) and the parent's in-app
    // copy both use the bursar's composed parent-facing message.
    const reminders = toSend.flatMap(s => [...channels].map(channel => ({
      studentId:      s.studentId,
      guardianPhone:  s.guardianPhone,
      channel,
      message:        renderMessage(message, s, smsFilters.term, schoolName),
      studentMessage: renderStudentMessage(s, smsFilters.term, schoolName),
    })))

    try {
      await sendReminders.mutateAsync(reminders)
    } catch (e) {
      console.error('Failed to queue reminders:', e)
      return
    }
    setSelectedIds(new Set())
  }

  // ── Character count ───────────────────────────────────────────
  const charCount = message.length
  const smsPages  = Math.ceil(charCount / 160) || 1
  const overLimit = charCount > 160

  // ── First selected student for preview ───────────────────────
  const firstSelected = (students ?? []).find(s => selectedIds.has(s.studentId))

  const thStyle = {
    textAlign: 'left' as const, fontSize: 10, fontWeight: 700 as const,
    color: 'var(--txt3)', padding: '0.5rem 0.75rem',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
  }

  return (
    <div style={{ padding: '1.5rem 2rem', maxWidth: 1300, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(16,185,129,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>SMS Reminders</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Send fee reminders to parents via SMS, WhatsApp, or in-app notification — pick any combination</p>
        </div>
      </div>

      <div className="mob-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

        {/* ── LEFT: Filters + Preview table ───────────────── */}
        <div>
          {/* Filter bar */}
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
            marginBottom: '1rem',
          }}>
            {/* Term pills */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
              {([1, 2, 3] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setSmsFilters(f => ({ ...f, term: t }))}
                  style={{
                    padding: '0.2rem 0.75rem', minHeight: 36, border: 'none', borderRadius: 20,
                    background: smsFilters.term === t ? 'var(--brand)' : 'transparent',
                    color: smsFilters.term === t ? '#fff' : 'var(--txt3)',
                    fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  }}
                >T{t}</button>
              ))}
            </div>

            <input
              type="number"
              value={smsFilters.year}
              onChange={e => setSmsFilters(f => ({ ...f, year: Number(e.target.value) }))}
              aria-label="Year"
              style={{ width: 72, padding: '0.28rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, outline: 'none' }}
            />

            <select
              value={smsFilters.classId ?? ''}
              onChange={e => setSmsFilters(f => ({ ...f, classId: e.target.value || undefined, streamId: undefined }))}
              aria-label="Filter class"
              style={{ padding: '0.3rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 12 }}
            >
              <option value="">All Classes</option>
              {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              value={smsFilters.streamId ?? ''}
              onChange={e => setSmsFilters(f => ({ ...f, streamId: e.target.value || undefined }))}
              aria-label="Filter stream"
              disabled={!smsFilters.classId}
              style={{ padding: '0.3rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 12, opacity: smsFilters.classId ? 1 : 0.5 }}
            >
              <option value="">All Streams</option>
              {(streams ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            <select
              value={smsFilters.balanceStatus}
              onChange={e => setSmsFilters(f => ({ ...f, balanceStatus: e.target.value as SmsFilters['balanceStatus'] }))}
              aria-label="Balance status filter"
              style={{ padding: '0.3rem 0.75rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 12 }}
            >
              <option value="all">All Students</option>
              <option value="both">Unpaid + Partial</option>
              <option value="unpaid">Unpaid Only</option>
              <option value="partial">Partial Only</option>
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>Min balance</span>
              <input
                type="number"
                value={smsFilters.minBalance}
                onChange={e => setSmsFilters(f => ({ ...f, minBalance: Number(e.target.value) }))}
                aria-label="Minimum balance"
                style={{ width: 90, padding: '0.28rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontSize: 12, outline: 'none' }}
              />
            </div>
          </div>

          {/* Preview table */}
          <div className="mob-cards" style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', overflow: 'hidden',
          }}>
            {loadingStudents ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : studentsError ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)', fontSize: 13 }}>
                {(studentsErrorObj as Error | null)?.message ?? 'Could not load students. Check your connection.'}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 44 }}>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 36, minHeight: 36, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={el => { if (el) el.indeterminate = someSelected }}
                          onChange={toggleAll}
                          aria-label="Select all students"
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--brand)' }}
                        />
                      </label>
                    </th>
                    {['Student', 'Parent', 'Phone', 'Status', 'Balance'].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(students ?? []).length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 13 }}>
                      No students match the filters.
                    </td></tr>
                  ) : (
                    (students ?? []).map(s => (
                      <PreviewRow
                        key={s.studentId}
                        row={s}
                        selected={selectedIds.has(s.studentId)}
                        onToggle={() => toggleOne(s.studentId)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {selectedIds.size > 0 && !studentsError && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--txt3)' }}>
              {selectedIds.size} student{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* ── RIGHT: Message composer ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: '1.25rem',
            display: 'flex', flexDirection: 'column', gap: '1rem',
          }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)' }}>
              Compose Message
            </div>

            {/* Channel toggle — pick any combination of SMS, WhatsApp, and
                In-App. At least one must stay selected. */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['sms', 'whatsapp', 'in_app'] as const).map(ch => {
                const active = channels.has(ch)
                return (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    aria-pressed={active}
                    style={{
                      flex: 1, padding: '0.4rem 0.75rem', border: 'none',
                      borderRadius: 'var(--r)', cursor: 'pointer',
                      background: active ? 'var(--brand)' : 'var(--surface2)',
                      color: active ? '#fff' : 'var(--txt2)',
                      fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : 'In-App'}
                  </button>
                )
              })}
            </div>

            {/* Template chips */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                Insert variable
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TEMPLATE_VARS.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVar(v.key)}
                    style={{
                      padding: '8px 12px', minHeight: 36, border: `1px solid ${v.color}`,
                      borderRadius: 20, background: 'transparent',
                      color: v.color, fontSize: 11, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'var(--font3)',
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                aria-label="Message text"
                style={{
                  width: '100%', padding: '0.65rem 0.85rem',
                  border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
                  background: 'var(--surface)', color: 'var(--txt)',
                  fontSize: 13, fontFamily: 'var(--font1)',
                  resize: 'vertical', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginTop: 4,
                fontSize: 11, color: overLimit ? 'var(--danger)' : 'var(--txt3)',
              }}>
                <span>{charCount} characters</span>
                <span>{smsPages} SMS{smsPages > 1 ? ' (multi-part)' : ''}</span>
              </div>
            </div>

            {/* Preview */}
            {firstSelected && (
              <div>
                <button
                  onClick={() => setShowPreview(p => !p)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--brand)', fontWeight: 700, padding: 0 }}
                >
                  {showPreview ? 'Hide preview' : 'Preview with real data'} →
                </button>
                {showPreview && (
                  <div style={{ marginTop: 6, padding: '0.65rem 0.85rem', background: 'var(--surface2)', borderRadius: 'var(--r)', fontSize: 13, color: 'var(--txt)', lineHeight: 1.6, border: '1px solid var(--border)' }}>
                    {renderMessage(message, firstSelected, smsFilters.term, schoolName)}
                  </div>
                )}
              </div>
            )}

            {/* Send button */}
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              disabled={selectedIds.size === 0 || !message.trim() || channels.size === 0 || sendReminders.isPending || studentsError}
            >
              {sendReminders.isPending
                ? 'Sending…'
                : `Send to ${selectedIds.size} parent${selectedIds.size !== 1 ? 's' : ''}`}
            </Button>

            {sendReminders.isSuccess && !studentsError && (
              <div style={{ padding: '0.6rem 0.85rem', background: 'var(--success-bg)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--success)', fontWeight: 600 }}>
                Reminders queued successfully
                {channels.has('in_app') ? ' — in-app notifications were sent immediately' : ''}
                {(channels.has('sms') || channels.has('whatsapp')) ? `, ${[channels.has('sms') && 'SMS', channels.has('whatsapp') && 'WhatsApp'].filter(Boolean).join(' + ')} will follow when the worker runs.` : '.'}
              </div>
            )}
            {sendReminders.isError && (
              <div style={{ padding: '0.6rem 0.85rem', background: 'var(--danger-bg)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>
                {getFriendlyErrorMessage(sendReminders.error)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delivery log ─────────────────────────────────────── */}
      <div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: '0.75rem' }}>
          Delivery Log
        </div>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden',
        }}>
          {/* Scroll wrapper for both header + rows so they stay aligned on mobile */}
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Student', 'Phone', 'Channel', 'Message', 'Status', 'Sent At', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', fontSize: 10, fontWeight: 700,
                    color: 'var(--txt3)', padding: '0.5rem 0.85rem',
                    textTransform: 'uppercase', letterSpacing: 0.8,
                    fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
                    background: 'var(--surface2)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>

          {/* Virtualised log rows */}
          <div ref={logParentRef} style={{ height: 320, overflowY: 'auto' }}>
            {loadingLog ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <LoadingSpinner size="md" />
              </div>
            ) : (logData ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 13 }}>
                No reminders sent yet.
              </div>
            ) : (
              <div style={{ height: logVirtualizer.getTotalSize(), position: 'relative' }}>
                <table style={{ width: '100%', minWidth: 620, borderCollapse: 'collapse' }}>
                  <tbody>
                    {logVirtualizer.getVirtualItems().map(vr => {
                      const r: ReminderLogRow = (logData ?? [])[vr.index]
                      return (
                        <tr
                          key={r.id}
                          className="sui-tr"
                          style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vr.start}px)`, height: vr.size }}
                        >
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{r.firstName} {r.lastName}</div>
                          </td>
                          <td style={{ padding: '0.5rem 0.85rem', fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt2)' }}>{r.guardianPhone}</td>
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <Badge variant={r.channel === 'whatsapp' ? 'green' : r.channel === 'in_app' ? 'violet' : 'muted'} size="sm">
                              {r.channel === 'whatsapp' ? 'WA' : r.channel === 'in_app' ? 'In-App' : 'SMS'}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.5rem 0.85rem', fontSize: 12, color: 'var(--txt2)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {r.message.slice(0, 60)}{r.message.length > 60 ? '…' : ''}
                          </td>
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            <Badge variant={REMINDER_STATUS_VARIANT[r.status]} size="sm">
                              {r.status}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.5rem 0.85rem', fontSize: 12, color: 'var(--txt3)' }}>
                            {r.sentAt ? new Date(r.sentAt).toLocaleDateString() : r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ padding: '0.5rem 0.85rem' }}>
                            {r.status === 'failed' && (
                              <button
                                onClick={() => retryReminder.mutate(r.id)}
                                disabled={retryReminder.isPending}
                                style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                Retry
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>{/* /overflowX scroll wrapper */}
        </div>
      </div>
    </div>
  )
}
