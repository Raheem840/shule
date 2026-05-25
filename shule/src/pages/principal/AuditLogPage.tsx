import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { useAuditLog } from '../../hooks/usePrincipal'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import type { AuditEntry } from '../../types/week9'

const ACTION_OPTS = ['', 'INSERT', 'UPDATE', 'DELETE']
const ROLE_OPTS   = ['', 'principal', 'deputy', 'dos', 'secretary', 'bursar', 'class_teacher', 'teacher', 'it_admin']

function ActionBadge({ action }: { action: string }) {
  const color = action === 'DELETE'
    ? 'var(--danger)' : action === 'INSERT'
    ? 'var(--success)' : 'var(--info)'
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800,
      background: `${color}20`, color, textTransform: 'uppercase',
    }}>
      {action}
    </span>
  )
}

function DataCell({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return <span style={{ color: 'var(--txt3)', fontSize: 11 }}>—</span>
  return (
    <span style={{ fontFamily: 'var(--font3)', fontSize: 10, color: 'var(--txt3)' }}>
      {Object.keys(data).slice(0, 3).join(', ')}{Object.keys(data).length > 3 ? '…' : ''}
    </span>
  )
}

// ─── DB Events Tab ────────────────────────────────────────────────────────────
function DbEventsTab() {
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
    const header = 'Action,Table,User Role,Timestamp\n'
    const rows   = entries.map((e: AuditEntry) =>
      `"${e.action}","${e.tableName}","${e.userRole}","${e.createdAt}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'audit-log.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={exportCsv} className="sui-btn-outline" style={{ fontSize: 13 }}>
          Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Action</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="sui-input" style={{ width: 110 }}>
            {ACTION_OPTS.map(o => <option key={o} value={o}>{o || 'All'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Role</label>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="sui-input" style={{ width: 140 }}>
            {ROLE_OPTS.map(o => <option key={o} value={o}>{o || 'All Roles'}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: 150 }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: 150 }} />
        </div>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading audit log…</div>}

      {!isLoading && entries.length === 0 && (
        <div style={{ color: 'var(--txt3)', padding: 32, textAlign: 'center',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          No audit log entries found.
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Action', 'Table', 'Role', 'Changed Fields', 'Timestamp'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left', whiteSpace: 'nowrap',
                    position: 'sticky', top: 0, zIndex: 1 }}>{h}</th>
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
                    <td style={{ padding: '10px 14px' }}><ActionBadge action={e.action} /></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--txt)', fontWeight: 600 }}>{e.tableName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{e.userRole}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <DataCell data={e.newData ?? e.oldData} />
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
                      <td colSpan={5} style={{ padding: '0 14px 12px' }}>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px',
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 12,
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>Before</div>
                            <pre style={{ margin: 0, fontSize: 11, color: 'var(--txt2)', whiteSpace: 'pre-wrap' }}>
                              {e.oldData ? JSON.stringify(e.oldData, null, 2) : '—'}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--txt3)', marginBottom: 4 }}>After</div>
                            <pre style={{ margin: 0, fontSize: 11, color: 'var(--txt2)', whiteSpace: 'pre-wrap' }}>
                              {e.newData ? JSON.stringify(e.newData, null, 2) : '—'}
                            </pre>
                          </div>
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
        toName:        r.to_user_id ? r.to_user_id.slice(0, 8) : 'Announcement',
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

  function exportExcel() {
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
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="sui-input" style={{ width: 150 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Role</label>
            <select value={fromRole} onChange={e => setFromRole(e.target.value)} className="sui-input" style={{ width: 140 }}>
              {ROLE_OPTS.map(o => <option key={o} value={o}>{o || 'All Roles'}</option>)}
            </select>
          </div>
        </div>
        <button className="sui-btn-outline" onClick={exportExcel} style={{ fontSize: 13, alignSelf: 'flex-end' }}>
          Export CSV
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading messages…</div>}

      {!isLoading && rows.length === 0 && (
        <div style={{ color: 'var(--txt3)', padding: 32, textAlign: 'center',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)' }}>
          No messages found for this period.
        </div>
      )}

      {!isLoading && rows.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['From', 'To', 'Sent At', 'Preview', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                    position: 'sticky', top: 0, zIndex: 1 }}>{h}</th>
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
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--txt)',
                      maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.body.slice(0, 60)}{r.body.length > 60 ? '…' : ''}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {r.attachmentUrl && (
                        <span style={{ fontSize: 16 }} title="Has attachment">📎</span>
                      )}
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr key={`${r.id}-detail`}>
                      <td colSpan={5} style={{ padding: '0 14px 12px' }}>
                        <div style={{
                          background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', fontSize: 13,
                          color: 'var(--txt)', lineHeight: 1.6,
                        }}>
                          {r.body}
                          {r.attachmentUrl && (
                            <div style={{ marginTop: 8 }}>
                              <a href={r.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--brand)', fontSize: 12 }}>
                                📎 View Attachment
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
          Audit Log
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          System activity and message history across the school.
        </div>
      </div>

      <Tabs.Root defaultValue="db">
        <Tabs.List style={{
          display: 'flex', borderBottom: '2px solid var(--border)',
          marginBottom: 20, gap: 4,
        }}>
          {[
            { value: 'db',  label: 'DB Events' },
            { value: 'msg', label: 'Message Log' },
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

        <Tabs.Content value="db"><DbEventsTab /></Tabs.Content>
        <Tabs.Content value="msg"><MessageLogTab /></Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
