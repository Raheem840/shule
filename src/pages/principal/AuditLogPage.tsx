import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuditLog } from '../../hooks/usePrincipal'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { getStaffAttachmentUrl } from '../../lib/storage'
import { useToast } from '../../components/ui/Toast'
import type { AuditEntry } from '../../types/week9'

// ─── Translation maps ─────────────────────────────────────────────────────────

const ACTION_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  INSERT: { label: 'Added',   color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: 'M12 5v14M5 12h14' },
  UPDATE: { label: 'Changed', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)',  icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
  DELETE: { label: 'Removed', color: '#f43f5e', bg: 'rgba(244,63,94,0.12)',   icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' },
}

const TABLE_LABELS: Record<string, string> = {
  students: 'Student', staff: 'Staff Member', exam_journal: 'Exam',
  exam_results: 'Exam Results', fee_payments: 'Fee Payment', fee_structure: 'Fee Structure',
  classes: 'Class', streams: 'Stream', subjects: 'Subject', departments: 'Department',
  attendance: 'Attendance', messages: 'Message', notifications: 'Notification',
  report_cards: 'Report Card', student_guardians: 'Guardian', parent_accounts: 'Parent Account',
  timetable_slots: 'Timetable', school_events: 'School Event', discipline_records: 'Discipline Record',
  curriculum_plan: 'Curriculum', teacher_remarks: 'Remarks', staff_documents: 'Document',
  academic_years: 'Academic Year',
}

const ROLE_LABELS: Record<string, string> = {
  principal: 'Principal', deputy: 'Deputy Principal', dos: 'Director of Studies',
  secretary: 'Secretary', bursar: 'Bursar', class_teacher: 'Class Teacher',
  teacher: 'Teacher', it_admin: 'IT Admin',
}

const SKIP_FIELDS = new Set([
  'id','school_id','created_at','updated_at','auth_user_id','pdf_url',
  'attachment_url','temp_password','photo_url',
])

export function friendlyRole(role: string) { return ROLE_LABELS[role] ?? role }
export function friendlyTable(table: string) {
  return TABLE_LABELS[table] ?? table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
export { ACTION_META }

// A staff row UPDATE that only touches last_login_at is a login stamp, not a
// real profile edit — used by both the full Activity Log and the Dashboard's
// "Recent Audit Log" widget so neither misrepresents a routine login as an edit.
export function isLoginStampOnly(entry: AuditEntry): boolean {
  if (entry.action !== 'UPDATE' || entry.tableName !== 'staff') return false
  const keys = Array.from(new Set([...Object.keys(entry.oldData ?? {}), ...Object.keys(entry.newData ?? {})]))
  const changed = keys.filter(k => JSON.stringify(entry.oldData?.[k]) !== JSON.stringify(entry.newData?.[k]))
  return changed.length === 1 && changed[0] === 'last_login_at'
}
function prettifyField(field: string): string {
  const MAP: Record<string, string> = {
    first_name:'First Name', last_name:'Last Name', email:'Email', phone:'Phone',
    role:'Role', status:'Status', is_active:'Active', is_absent:'Absent',
    score:'Score', grade:'Grade', amount_paid:'Amount Paid', amount_due:'Amount Owing',
    balance:'Balance', date_given:'Exam Date',
    employment_type:'Employment Type', national_id:'National ID',
    admission_number:'Admission Number', student_type:'Student Type',
    receipt_number:'Receipt Number', payment_date:'Payment Date',
    body:'Message', incident_date:'Incident Date', resolution:'Resolution',
    principal_remarks:'Principal Remarks', teacher_notes:'Teacher Notes',
    department_id:'Department', class_id:'Class', stream_id:'Stream',
    subject_id:'Subject', academic_year_id:'Academic Year',
    qualification_level:'Qualification Level',
  }
  return MAP[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'string' && v.match(/^\d{4}-\d{2}-\d{2}T/))
    return new Date(v).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  return String(v)
}

// ─── Narrative sentence builder ───────────────────────────────────────────────
function buildNarrative(action: string, table: string, entityName: string | null, role: string, entry?: AuditEntry): string {
  const actor  = friendlyRole(role)
  const entity = entityName ? ` — ${entityName}` : ''

  // Staff row updates that only touch last_login_at are login stamps, not edits —
  // show them distinctly instead of the generic "updated a staff profile" message.
  if (entry && isLoginStampOnly(entry)) {
    return `${actor} logged in${entity}`
  }

  const key    = `${action}:${table}`
  const map: Record<string, string> = {
    'INSERT:students':           `${actor} enrolled a new student${entity}`,
    'UPDATE:students':           `${actor} updated a student record${entity}`,
    'DELETE:students':           `${actor} removed a student${entity}`,
    'INSERT:staff':              `${actor} registered a new staff member${entity}`,
    'UPDATE:staff':              `${actor} updated a staff profile${entity}`,
    'DELETE:staff':              `${actor} removed a staff member${entity}`,
    'INSERT:exam_journal':       `${actor} created a new exam${entity}`,
    'UPDATE:exam_journal':       `${actor} updated exam details${entity}`,
    'DELETE:exam_journal':       `${actor} deleted an exam${entity}`,
    'INSERT:exam_results':       `${actor} recorded exam marks${entity}`,
    'UPDATE:exam_results':       `${actor} updated exam marks${entity}`,
    'INSERT:fee_payments':       `Bursar recorded a fee payment${entity}`,
    'UPDATE:fee_payments':       `Bursar updated a payment record${entity}`,
    'DELETE:fee_payments':       `Bursar removed a payment record${entity}`,
    'INSERT:fee_structure':      `Bursar added a new fee item${entity}`,
    'UPDATE:fee_structure':      `Bursar updated fee structure${entity}`,
    'INSERT:report_cards':       `${actor} generated a report card${entity}`,
    'UPDATE:report_cards':       `${actor} updated a report card${entity}`,
    'INSERT:attendance':         `${actor} recorded attendance`,
    'UPDATE:attendance':         `${actor} corrected an attendance record`,
    'INSERT:discipline_records': `${actor} logged a discipline incident${entity}`,
    'UPDATE:discipline_records': `${actor} updated a discipline record${entity}`,
    'DELETE:discipline_records': `${actor} removed a discipline record${entity}`,
    'INSERT:timetable_slots':    `${actor} added a timetable slot`,
    'UPDATE:timetable_slots':    `${actor} updated the timetable`,
    'DELETE:timetable_slots':    `${actor} removed a timetable slot`,
    'INSERT:curriculum_plan':    `${actor} added a curriculum topic`,
    'UPDATE:curriculum_plan':    `${actor} updated the curriculum plan`,
    'INSERT:school_events':      `${actor} added a school event${entity}`,
    'UPDATE:school_events':      `${actor} updated a school event${entity}`,
    'INSERT:student_guardians':  `${actor} added a parent/guardian${entity}`,
    'UPDATE:student_guardians':  `${actor} updated guardian details${entity}`,
    'DELETE:student_guardians':  `${actor} removed a guardian${entity}`,
    'INSERT:parent_accounts':    `${actor} created a parent account${entity}`,
    'UPDATE:parent_accounts':    `${actor} updated a parent account${entity}`,
    'INSERT:teacher_remarks':    `${actor} wrote teacher remarks${entity}`,
    'UPDATE:teacher_remarks':    `${actor} updated teacher remarks${entity}`,
    'INSERT:staff_documents':    `${actor} uploaded a document${entity}`,
    'DELETE:staff_documents':    `${actor} removed a document${entity}`,
    'INSERT:classes':            `${actor} created a class${entity}`,
    'UPDATE:classes':            `${actor} updated a class${entity}`,
    'INSERT:streams':            `${actor} added a stream${entity}`,
    'INSERT:subjects':           `${actor} added a subject${entity}`,
    'INSERT:departments':        `${actor} created a department${entity}`,
    'UPDATE:departments':        `${actor} updated a department${entity}`,
  }
  return map[key] ?? `${actor} ${(ACTION_META[action]?.label ?? action).toLowerCase()}d ${friendlyTable(table).toLowerCase()}${entity}`
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ entry }: { entry: AuditEntry }) {
  const { action, oldData, newData } = entry

  if (action === 'DELETE' && oldData) {
    const fields = Object.entries(oldData).filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== '')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>Deleted record</div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'var(--txt3)', minWidth: 160, flexShrink: 0 }}>{prettifyField(k)}</span>
            <span style={{ color: 'var(--txt)', fontWeight: 600 }}>{formatValue(v)}</span>
          </div>
        ))}
      </div>
    )
  }

  if (action === 'INSERT' && newData) {
    const fields = Object.entries(newData).filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== '')
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>New record</div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span style={{ color: 'var(--txt3)', minWidth: 160, flexShrink: 0 }}>{prettifyField(k)}</span>
            <span style={{ color: 'var(--txt)', fontWeight: 600 }}>{formatValue(v)}</span>
          </div>
        ))}
        {fields.length === 0 && <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No details recorded.</span>}
      </div>
    )
  }

  if (action === 'UPDATE') {
    const keys = Array.from(new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData ?? {})]))
    const changed = keys.filter(k => !SKIP_FIELDS.has(k) && JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]))
    if (changed.length === 0) return <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No significant fields were changed.</span>
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, padding: '0 0 8px', borderBottom: '1px solid var(--border)', marginBottom: 8, minWidth: 400 }}>
          <span>Field</span><span style={{ color: '#f43f5e' }}>Before</span><span style={{ color: '#10b981' }}>After</span>
        </div>
        {changed.map(k => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', minWidth: 400 }}>
            <span style={{ color: 'var(--txt3)', fontWeight: 600 }}>{prettifyField(k)}</span>
            <span style={{ color: '#f43f5e', textDecoration: 'line-through', opacity: 0.8 }}>{formatValue(oldData?.[k])}</span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>{formatValue(newData?.[k])}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────
const ACTION_FILTER: Array<{ value: string; label: string }> = [
  { value: '', label: 'All activity' },
  { value: 'INSERT', label: 'Added' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'DELETE', label: 'Removed' },
]
const ROLE_FILTER: Array<{ value: string; label: string }> = [
  { value: '', label: 'All staff' },
  { value: 'principal',     label: 'Principal' },
  { value: 'deputy',        label: 'Deputy Principal' },
  { value: 'dos',           label: 'Director of Studies' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'it_admin',      label: 'IT Admin' },
]

function ActivityLogTab() {
  const [actionFilter, setActionFilter] = useState('')
  const [roleFilter,   setRoleFilter]   = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  const { data: entries = [], isLoading } = useAuditLog({
    limit: 200, role: roleFilter || undefined,
    action: actionFilter || undefined,
    dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
  })

  async function exportExcel() {
    if (!entries.length) return
    const { default: ExcelJS } = await import('exceljs')
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Shule Management System'
    wb.created = new Date()
    const ws = wb.addWorksheet('Audit Log')

    const lastCol = 'F'
    const dateRange = dateFrom && dateTo
      ? `${dateFrom} to ${dateTo}`
      : dateFrom ? `From ${dateFrom}` : dateTo ? `To ${dateTo}` : 'All dates'
    const title = `Audit Log — ${dateRange}`

    ws.mergeCells(`A1:${lastCol}1`)
    const titleCell = ws.getCell('A1')
    titleCell.value = title
    titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28

    ws.mergeCells(`A2:${lastCol}2`)
    const dateCell = ws.getCell('A2')
    dateCell.value = `Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
    dateCell.font = { name: 'Calibri', italic: true, size: 9, color: { argb: 'FF64748B' } }
    dateCell.alignment = { horizontal: 'right' }
    ws.getRow(2).height = 14

    const headers = ['Date / Time', 'Activity', 'Area', 'Done By (Role)', 'Record', 'Action']
    const headerRow = ws.addRow(headers)
    headerRow.height = 20
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF0D9488' } } }
    })

    const ACTION_ARGB: Record<string, string> = {
      INSERT: 'FF10B981',
      UPDATE: 'FF0EA5E9',
      DELETE: 'FFF43F5E',
    }

    entries.forEach((e: AuditEntry, i) => {
      const narrative = buildNarrative(e.action, e.tableName, e.entityName, e.userRole, e)
      const dataRow = ws.addRow([
        new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        narrative,
        friendlyTable(e.tableName),
        friendlyRole(e.userRole),
        e.entityName ?? '—',
        ACTION_META[e.action]?.label ?? e.action,
      ])
      dataRow.height = 16
      dataRow.eachCell((cell, colNum) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' } }
        cell.font = { name: 'Calibri', size: 10 }
        cell.alignment = { vertical: 'middle' }
        // Action column: colour by type
        if (colNum === 6) {
          const argb = ACTION_ARGB[e.action] ?? 'FF64748B'
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb } }
        }
      })
    })

    const colWidths = [18, 44, 18, 22, 22, 12]
    ws.columns.forEach((col, i) => { col.width = colWidths[i] ?? 14 })

    const buf  = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split('T')[0]}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    const header = 'Activity,Area,Done By,Record,Date\n'
    const rows = entries.map((e: AuditEntry) =>
      `"${buildNarrative(e.action, e.tableName, e.entityName, e.userRole, e)}","${friendlyTable(e.tableName)}","${friendlyRole(e.userRole)}","${e.entityName ?? ''}","${new Date(e.createdAt).toLocaleString('en-GB')}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'activity-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="sui-glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>

          {/* Action pills */}
          <div style={{ display: 'flex', flex: 1, gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            {ACTION_FILTER.map(o => {
              const meta = o.value ? ACTION_META[o.value] : null
              const active = actionFilter === o.value
              return (
                <button
                  key={o.value}
                  onClick={() => setActionFilter(o.value)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
                    fontFamily: 'var(--font2)',
                    background: active ? (meta?.bg ?? 'var(--brand)') : 'var(--surface2)',
                    color: active ? (meta?.color ?? 'var(--brand)') : 'var(--txt3)',
                    border: active ? `1.5px solid ${meta?.color ?? 'var(--brand)'}40` : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    boxShadow: active ? `0 2px 8px ${meta?.color ?? 'var(--brand)'}20` : 'none',
                  }}
                >
                  {o.label}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>Done by</div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="sui-input" style={{ width: '100%', minWidth: 140, fontSize: 12 }}>
                {ROLE_FILTER.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>From</div>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: '100%', minWidth: 130, fontSize: 12 }} />
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>To</div>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: '100%', minWidth: 130, fontSize: 12 }} />
            </div>
            <button onClick={() => exportExcel()} disabled={!entries.length} className="sui-btn-outline" style={{ fontSize: 11.5, height: 38, minWidth: 90, opacity: entries.length ? 1 : 0.5 }}>Export Excel</button>
            <button onClick={exportCsv} disabled={!entries.length} className="sui-btn-outline" style={{ fontSize: 11.5, height: 38, minWidth: 90, opacity: entries.length ? 1 : 0.5 }}>CSV</button>
          </div>
        </div>
      </div>

      {/* ── Feed ─────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="shule-skeleton" style={{ height: 60, borderRadius: i === 0 ? '14px 14px 0 0' : i === 5 ? '0 0 14px 14px' : 0 }} />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 24px', gap: 12,
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No activity found</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Try adjusting the filters above.</div>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="sui-glass-panel" style={{ overflow: 'hidden' }}>
          {entries.map((e: AuditEntry, idx) => {
            const meta      = ACTION_META[e.action] ?? ACTION_META['UPDATE']
            const narrative = buildNarrative(e.action, e.tableName, e.entityName, e.userRole, e)
            const isExpanded = expanded === e.id
            const isLast    = idx === entries.length - 1

            return (
              <div key={e.id}>
                {/* ── Row ── */}
                <div
                  onClick={() => setExpanded(x => x === e.id ? null : e.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr auto',
                    alignItems: 'center',
                    gap: 0,
                    padding: '14px 20px',
                    borderBottom: (!isLast || isExpanded) ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                    background: isExpanded ? 'var(--surface2)' : 'transparent',
                  }}
                  onMouseEnter={ev => { if (!isExpanded) ev.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={ev => { if (!isExpanded) ev.currentTarget.style.background = 'transparent' }}
                >
                  {/* Action icon */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                    background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={meta.icon} />
                    </svg>
                  </div>

                  {/* Narrative + meta */}
                  <div style={{ paddingLeft: 14, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--txt)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {narrative}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                      <span style={{
                        display: 'inline-block', padding: '1px 7px', borderRadius: 6,
                        background: meta.bg, color: meta.color,
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>{meta.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>·</span>
                      <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{friendlyTable(e.tableName)}</span>
                    </div>
                  </div>

                  {/* Timestamp + role + chevron */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, paddingLeft: 16, flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {new Date(e.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', fontWeight: 600 }}>
                      {friendlyRole(e.userRole)}
                    </div>
                  </div>
                </div>

                {/* ── Expanded detail ── */}
                {isExpanded && (
                  <div style={{
                    padding: '16px 20px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    background: 'var(--surface2)',
                    overflowX: 'auto',
                  }}>
                    <DetailPanel entry={e} />
                  </div>
                )}
              </div>
            )
          })}

          {/* Footer count */}
          <div style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--txt3)', fontWeight: 600,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{entries.length} entries</span>
            {entries.length >= 200 && <span style={{ color: 'var(--warning)' }}>Showing latest 200 — use date filters to narrow results</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Message Log Tab ──────────────────────────────────────────────────────────
type MessageLogRow = {
  id: string; fromName: string; toName: string | null
  body: string; sentAt: string; attachmentUrl: string | null
}

function useMessageLog(dateFrom: string, dateTo: string) {
  const { user } = useAuth()

  // messages.from_user_id/to_user_id can be a staff, parent, OR student
  // auth_user_id (parent/student messaging was enabled in a later migration
  // than this name-map originally supported) — resolve against all three
  // tables, not just staff, or non-staff senders show as "Unknown".
  const { data: userNames = {}, isSuccess: staffNamesReady } = useQuery({
    queryKey: ['user-name-map', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<Record<string, string>> => {
      const [{ data: staff }, { data: parents }, { data: students }] = await Promise.all([
        supabase.from('staff').select('auth_user_id, first_name, last_name')
          .eq('school_id', user!.schoolId).not('auth_user_id', 'is', null),
        supabase.from('parent_accounts').select('auth_user_id, full_name')
          .eq('school_id', user!.schoolId).not('auth_user_id', 'is', null),
        supabase.from('students').select('auth_user_id, first_name, last_name')
          .eq('school_id', user!.schoolId).not('auth_user_id', 'is', null),
      ])
      const map: Record<string, string> = {}
      for (const s of staff ?? [])    if (s.auth_user_id) map[s.auth_user_id] = `${s.first_name} ${s.last_name}`
      for (const p of parents ?? [])  if (p.auth_user_id) map[p.auth_user_id] = `${p.full_name} (Parent)`
      for (const s of students ?? []) if (s.auth_user_id) map[s.auth_user_id] = `${s.first_name} ${s.last_name} (Student)`
      return map
    },
    staleTime: 5 * 60_000,
  })

  return useQuery({
    queryKey: ['message-log', user?.schoolId, dateFrom, dateTo],
    queryFn: async (): Promise<MessageLogRow[]> => {
      let q = supabase
        .from('messages')
        .select('id, from_user_id, to_user_id, is_announcement, body, sent_at, attachment_url')
        .eq('school_id', user!.schoolId)
        .order('sent_at', { ascending: false })
        .limit(200)
      if (dateFrom) q = q.gte('sent_at', dateFrom)
      if (dateTo)   q = q.lte('sent_at', dateTo + 'T23:59:59')
      const { data, error } = await q
      if (error?.code === '42P01') return []
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id:            r.id,
        fromName:      userNames[r.from_user_id] ?? 'Unknown',
        toName:        r.is_announcement ? 'All staff (announcement)' : (userNames[r.to_user_id] ?? 'Unknown'),
        body:          r.body ?? '',
        sentAt:        r.sent_at,
        attachmentUrl: r.attachment_url ?? null,
      }))
    },
    enabled: !!user && staffNamesReady,
    staleTime: 60_000,
  })
}

function MessageLogTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const { data: rows = [], isLoading } = useMessageLog(dateFrom, dateTo)
  const { error: toastErr } = useToast()

  // staff-attachments is a private bucket — the stored value is a path, not
  // a browsable URL, so opening an attachment means resolving a short-lived
  // signed URL on click rather than linking straight to it.
  async function openAttachment(path: string) {
    const signed = await getStaffAttachmentUrl(path)
    if (signed) window.open(signed, '_blank', 'noopener,noreferrer')
    else toastErr('Could not open this attachment — it may have been removed.')
  }

  function exportCsv() {
    const header = 'From,To,Sent At,Message Preview,Attachment\n'
    const lines = rows.map(r =>
      `"${r.fromName}","${r.toName ?? ''}","${r.sentAt}","${r.body.slice(0, 60).replace(/"/g, '""')}","${r.attachmentUrl ? 'Yes' : 'No'}"`
    ).join('\n')
    const blob = new Blob([header + lines], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'message-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div className="sui-glass-panel" style={{ padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>From date</div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: '100%', maxWidth: 150, fontSize: 12 }} />
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>To date</div>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: '100%', maxWidth: 150, fontSize: 12 }} />
          </div>
          <button className="sui-btn-outline" onClick={exportCsv} style={{ fontSize: 11.5, height: 38 }}>Export CSV</button>
        </div>
      </div>

      {/* ── Feed ─────────────────────────────────────────────── */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: i === 0 ? '14px 14px 0 0' : i === 4 ? '0 0 14px 14px' : 0 }} />
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px 24px', gap: 12,
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16, background: 'var(--surface2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>No messages found</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Try a different date range.</div>
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div className="sui-glass-panel" style={{ overflow: 'hidden', overflowX: 'auto' }}>
          {rows.map((r, idx) => {
            const isExpanded = expanded === r.id
            const isLast = idx === rows.length - 1
            return (
              <div key={r.id} style={{ minWidth: 540 }}>
                <div
                  onClick={() => setExpanded(x => x === r.id ? null : r.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 180px 160px 32px',
                    alignItems: 'center', gap: 12, padding: '12px 20px',
                    borderBottom: (!isLast || isExpanded) ? '1px solid var(--border)' : 'none',
                    cursor: 'pointer', transition: 'background 0.12s',
                    background: isExpanded ? 'var(--surface2)' : 'transparent',
                  }}
                  onMouseEnter={ev => { if (!isExpanded) ev.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={ev => { if (!isExpanded) ev.currentTarget.style.background = 'transparent' }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.body.slice(0, 80)}{r.body.length > 80 ? '…' : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      <span style={{ fontWeight: 700, color: 'var(--txt2)' }}>{r.fromName}</span>
                      <span style={{ margin: '0 5px' }}>→</span>
                      <span>{r.toName}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {new Date(r.sentAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>
                    {r.attachmentUrl && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: 'var(--surface2)', color: 'var(--txt3)', border: '1px solid var(--border)',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                        File
                      </span>
                    )}
                  </div>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    background: 'var(--surface2)',
                  }}>
                    <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.65 }}>{r.body}</div>
                    {r.attachmentUrl && (
                      <button type="button" onClick={() => void openAttachment(r.attachmentUrl!)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand)', fontSize: 12, fontWeight: 700, padding: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                        View attachment
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{
            padding: '10px 20px', borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--txt3)', fontWeight: 600,
          }}>
            {rows.length} messages {rows.length >= 200 && '— showing latest 200'}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<'activity' | 'messages'>('activity')

  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero Band */}
      <div style={{
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
        padding: '28px 28px 24px', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.08)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.20)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.4 }}>Activity Log</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, margin: '0 0 20px', fontWeight: 500 }}>
            A complete record of everything that has been added, changed, or removed — and who did it.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'Activity Log', value: activeTab === 'activity' ? 'Active' : '—' },
              { label: 'Message Log', value: activeTab === 'messages' ? 'Active' : '—' },
              { label: 'Audit Trail', value: 'Live' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', border: '.5px solid rgba(255,255,255,.28)', borderRadius: 12, padding: '10px 16px', minWidth: 80 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="sui-tab-list-pill" style={{ alignSelf: 'flex-start' }}>
        {([
          { key: 'activity', label: 'Activity Log' },
          { key: 'messages', label: 'Message Log' },
        ] as const).map(t => (
          <button
            key={t.key}
            className={`sui-tab-pill${activeTab === t.key ? ' on' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {activeTab === 'activity' ? <ActivityLogTab /> : <MessageLogTab />}
    </div>
  )
}
