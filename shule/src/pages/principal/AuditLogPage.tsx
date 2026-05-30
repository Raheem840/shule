import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { useAuditLog } from '../../hooks/usePrincipal'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import type { AuditEntry } from '../../types/week9'

// ─── Human-readable translations ─────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'Added',
  UPDATE: 'Changed',
  DELETE: 'Removed',
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'var(--success)',
  UPDATE: 'var(--info)',
  DELETE: 'var(--danger)',
}

const TABLE_LABELS: Record<string, string> = {
  students:           'Student Record',
  staff:              'Staff Member',
  exam_journal:       'Exam',
  exam_results:       'Exam Results',
  fee_payments:       'Fee Payment',
  fee_structure:      'Fee Structure',
  classes:            'Class',
  streams:            'Stream',
  subjects:           'Subject',
  departments:        'Department',
  attendance:         'Attendance',
  messages:           'Message',
  notifications:      'Notification',
  report_cards:       'Report Card',
  student_guardians:  'Parent / Guardian',
  parent_accounts:    'Parent Account',
  timetable_slots:    'Timetable',
  school_events:      'School Event',
  discipline_records: 'Discipline Record',
  curriculum_plan:    'Curriculum Plan',
  teacher_remarks:    'Teacher Remarks',
  staff_documents:    'Staff Document',
  academic_years:     'Academic Year',
}

const ROLE_LABELS: Record<string, string> = {
  principal:     'Principal',
  deputy:        'Deputy Principal',
  dos:           'Director of Studies',
  secretary:     'Secretary',
  bursar:        'Bursar',
  class_teacher: 'Class Teacher',
  teacher:       'Teacher',
  it_admin:      'IT Admin',
}

function friendlyAction(action: string) {
  return ACTION_LABELS[action] ?? action
}

function friendlyTable(table: string) {
  return TABLE_LABELS[table] ?? table.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function friendlyRole(role: string) {
  return ROLE_LABELS[role] ?? role
}

function prettifyField(field: string): string {
  const FIELD_LABELS: Record<string, string> = {
    first_name:       'First Name',
    last_name:        'Last Name',
    email:            'Email',
    phone:            'Phone',
    role:             'Role',
    status:           'Status',
    is_active:        'Active',
    is_absent:        'Absent',
    score:            'Score',
    grade:            'Grade',
    amount_paid:      'Amount Paid',
    amount_due:       'Amount Owing',
    balance:          'Balance',
    date_given:       'Exam Date',
    photo_url:        'Profile Photo',
    salary_band:      'Salary Band',
    employment_type:  'Employment Type',
    national_id:      'National ID',
    qualification_level: 'Qualification Level',
    admission_number: 'Admission Number',
    student_type:     'Student Type',
    receipt_number:   'Receipt Number',
    payment_date:     'Payment Date',
    body:             'Message',
    incident_date:    'Incident Date',
    resolution:       'Resolution',
    principal_remarks:'Principal Remarks',
    teacher_notes:    'Teacher Notes',
    department_id:    'Department',
    class_id:         'Class',
    stream_id:        'Stream',
    subject_id:       'Subject',
    academic_year_id: 'Academic Year',
  }
  return FIELD_LABELS[field] ?? field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(value).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }
  return String(value)
}

// Skip internal / noisy fields that mean nothing to a principal
const SKIP_FIELDS = new Set([
  'id', 'school_id', 'created_at', 'updated_at', 'auth_user_id',
  'pdf_url', 'attachment_url', 'temp_password',
])

// ─── Activity badge ───────────────────────────────────────────────────────────
function ActivityBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'var(--txt3)'
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 800,
      background: `${color}18`, color,
    }}>
      {friendlyAction(action)}
    </span>
  )
}

// ─── Expanded detail panel ────────────────────────────────────────────────────
function DetailPanel({ entry }: { entry: AuditEntry }) {
  const { action, oldData, newData } = entry

  if (action === 'INSERT' && newData) {
    const fields = Object.entries(newData).filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== '')
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--success)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          New record details
        </div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--txt3)', minWidth: 160, flexShrink: 0 }}>{prettifyField(k)}</span>
            <span style={{ color: 'var(--txt)', fontWeight: 600 }}>{formatValue(v)}</span>
          </div>
        ))}
        {fields.length === 0 && <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No details available.</span>}
      </div>
    )
  }

  if (action === 'DELETE' && oldData) {
    const fields = Object.entries(oldData).filter(([k, v]) => !SKIP_FIELDS.has(k) && v !== null && v !== '')
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--danger)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Deleted record
        </div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--txt3)', minWidth: 160, flexShrink: 0 }}>{prettifyField(k)}</span>
            <span style={{ color: 'var(--txt)', fontWeight: 600 }}>{formatValue(v)}</span>
          </div>
        ))}
        {fields.length === 0 && <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No details available.</span>}
      </div>
    )
  }

  if (action === 'UPDATE') {
    // Show only fields that actually changed
    const changed: Array<{ field: string; before: unknown; after: unknown }> = []
    const combined = { ...(oldData ?? {}), ...(newData ?? {}) }
    for (const k of Object.keys(combined)) {
      if (SKIP_FIELDS.has(k)) continue
      const before = oldData?.[k]
      const after  = newData?.[k]
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        changed.push({ field: k, before, after })
      }
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--info)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          What changed
        </div>
        {changed.length === 0 && (
          <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No tracked fields were changed.</span>
        )}
        {changed.map(({ field, before, after }) => (
          <div key={field} style={{
            display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8,
            fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: 'var(--txt3)', fontWeight: 600 }}>{prettifyField(field)}</span>
            <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>
              {formatValue(before)}
            </span>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>
              {formatValue(after)}
            </span>
          </div>
        ))}
        {changed.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 8, fontSize: 10, color: 'var(--txt3)', marginTop: -4 }}>
            <span />
            <span>Before</span>
            <span>After</span>
          </div>
        )}
      </div>
    )
  }

  return <span style={{ color: 'var(--txt3)', fontSize: 12 }}>No additional details.</span>
}

// ─── What changed summary (for the table row) ─────────────────────────────────
function ChangeSummary({ entry }: { entry: AuditEntry }) {
  const { action, oldData, newData } = entry
  if (action === 'INSERT' && newData) {
    const fields = Object.keys(newData).filter(k => !SKIP_FIELDS.has(k)).slice(0, 3)
    return <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{fields.map(prettifyField).join(', ')}{Object.keys(newData).length > 3 ? '…' : ''}</span>
  }
  if (action === 'DELETE') {
    return <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Record deleted</span>
  }
  if (action === 'UPDATE') {
    const changed = Object.keys({ ...(oldData ?? {}), ...(newData ?? {}) })
      .filter(k => !SKIP_FIELDS.has(k) && JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k]))
    if (changed.length === 0) return <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>
    return <span style={{ fontSize: 12, color: 'var(--txt2)' }}>{changed.slice(0, 3).map(prettifyField).join(', ')}{changed.length > 3 ? '…' : ''}</span>
  }
  return <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>
}

// ─── Activity Log Tab ─────────────────────────────────────────────────────────
const ACTION_FILTER_OPTS = [
  { value: '',       label: 'All activity' },
  { value: 'INSERT', label: 'Added' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'DELETE', label: 'Removed' },
]

const ROLE_FILTER_OPTS = [
  { value: '',              label: 'All staff' },
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
  const [roleFilter,   setRoleFilter]   = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)

  const { data: entries = [], isLoading } = useAuditLog({
    limit:    200,
    role:     roleFilter  || undefined,
    action:   actionFilter || undefined,
    dateFrom: dateFrom    || undefined,
    dateTo:   dateTo      || undefined,
  })

  function exportCsv() {
    const header = 'Activity,Area,Done By,Record,Date\n'
    const rows   = entries.map((e: AuditEntry) =>
      `"${friendlyAction(e.action)}","${friendlyTable(e.tableName)}","${friendlyRole(e.userRole)}","${e.entityName ?? ''}","${new Date(e.createdAt).toLocaleString('en-GB')}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'activity-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Activity type</label>
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="sui-input" style={{ width: 140 }}>
              {ACTION_FILTER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Done by</label>
            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="sui-input" style={{ width: 170 }}>
              {ROLE_FILTER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>From date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>To date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
        </div>
        <button onClick={exportCsv} className="sui-btn-outline" style={{ fontSize: 13 }}>
          Export CSV
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading activity log…</div>}

      {!isLoading && entries.length === 0 && (
        <div style={{
          color: 'var(--txt3)', padding: 32, textAlign: 'center',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          fontSize: 13,
        }}>
          No activity found for the selected filters.
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden', maxHeight: 600, overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Activity', 'Area', 'Done by', 'What changed', 'When'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 11, color: 'var(--txt2)',
                    textAlign: 'left', whiteSpace: 'nowrap',
                    position: 'sticky', top: 0, zIndex: 1,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e: AuditEntry) => (
                <>
                  <tr
                    key={e.id}
                    className="sui-tr"
                    onClick={() => setExpanded(exp => exp === e.id ? null : e.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <ActivityBadge action={e.action} />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, color: 'var(--txt)', fontWeight: 600 }}>
                        {friendlyTable(e.tableName)}
                      </div>
                      {e.entityName && (
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                          {e.entityName}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                      {friendlyRole(e.userRole)}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <ChangeSummary entry={e} />
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {new Date(e.createdAt).toLocaleString('en-GB', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={5} style={{ padding: '0 14px 14px' }}>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 10,
                          padding: '14px 16px', marginTop: 4,
                        }}>
                          <DetailPanel entry={e} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Message Log Tab ──────────────────────────────────────────────────────────
type MessageLogRow = {
  id: string
  fromName: string
  fromRole: string
  toName: string | null
  body: string
  sentAt: string
  attachmentUrl: string | null
}

function useMessageLog(dateFrom: string, dateTo: string, fromRole: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['message-log', user?.schoolId, dateFrom, dateTo, fromRole],
    enabled: !!user,
    queryFn: async (): Promise<MessageLogRow[]> => {
      let q = supabase
        .from('messages')
        .select('id, from_user_id, to_user_id, body, sent_at, attachment_url')
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
        fromName:      r.from_user_id?.slice(0, 8) ?? 'Unknown',
        fromRole:      '—',
        toName:        r.to_user_id ? r.to_user_id.slice(0, 8) : 'Announcement (all staff)',
        body:          r.body ?? '',
        sentAt:        r.sent_at,
        attachmentUrl: r.attachment_url ?? null,
      }))
    },
    staleTime: 60_000,
  })
}

function MessageLogTab() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')
  const [fromRole, setFromRole] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: rows = [], isLoading } = useMessageLog(dateFrom, dateTo, fromRole)

  function exportCsv() {
    const header = 'From,To,Sent At,Preview,Attachment\n'
    const lines = rows.map(r =>
      `"${r.fromName}","${r.toName ?? ''}","${r.sentAt}","${r.body.slice(0, 60).replace(/"/g, '""')}","${r.attachmentUrl ? 'Yes' : 'No'}"`
    ).join('\n')
    const blob = new Blob([header + lines], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'message-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>From date</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>To date</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Role</label>
            <select value={fromRole} onChange={e => setFromRole(e.target.value)} className="sui-input" style={{ width: 170 }}>
              {ROLE_FILTER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <button className="sui-btn-outline" onClick={exportCsv} style={{ fontSize: 13 }}>
          Export CSV
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading messages…</div>}

      {!isLoading && rows.length === 0 && (
        <div style={{
          color: 'var(--txt3)', padding: 32, textAlign: 'center',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
          fontSize: 13,
        }}>
          No messages found for this period.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'hidden', maxHeight: 600, overflowY: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['From', 'To', 'Sent At', 'Message preview', ''].map((h, i) => (
                  <th key={i} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 11, color: 'var(--txt2)', textAlign: 'left',
                    position: 'sticky', top: 0, zIndex: 1,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <>
                  <tr
                    key={r.id}
                    className="sui-tr"
                    onClick={() => setExpanded(e => e === r.id ? null : r.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font3)' }}>{r.fromName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{r.toName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {new Date(r.sentAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{
                      padding: '10px 14px', fontSize: 13, color: 'var(--txt)',
                      maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.body.slice(0, 80)}{r.body.length > 80 ? '…' : ''}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.attachmentUrl && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" title="Has attachment">
                          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                        </svg>
                      )}
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={5} style={{ padding: '0 14px 12px' }}>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 8,
                          padding: '12px 16px', fontSize: 13, color: 'var(--txt)', lineHeight: 1.6,
                        }}>
                          {r.body}
                          {r.attachmentUrl && (
                            <div style={{ marginTop: 8 }}>
                              <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--brand)', fontSize: 12, fontWeight: 600 }}>
                                View attachment
                              </a>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function AuditLogPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          Activity Log
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          A record of everything that has been added, changed, or removed in the system — and who did it.
        </div>
      </div>

      <Tabs.Root defaultValue="activity">
        <Tabs.List style={{
          display: 'flex', borderBottom: '2px solid var(--border)',
          marginBottom: 20, gap: 4,
        }}>
          {[
            { value: 'activity', label: 'Activity Log' },
            { value: 'msg',      label: 'Message Log'  },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer', color: 'var(--txt3)',
                borderBottom: '2px solid transparent', marginBottom: -2,
              }}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="activity"><ActivityLogTab /></Tabs.Content>
        <Tabs.Content value="msg"><MessageLogTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
