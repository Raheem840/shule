import { useState, useMemo } from 'react'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Badge } from '../../components/ui/Badge'
import { useToast } from '../../components/ui/Toast'
import { useSmsReminderLog, useRetryReminder } from '../../hooks/useSmsReminders'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import type { ReminderLogRow } from '../../hooks/useSmsReminders'

type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'pending' | ''
type ChannelFilter  = 'all' | 'sms' | 'whatsapp' | 'in_app'

const STATUS_CFG = {
  sent:      { variant: 'teal'  as const, label: 'Sent'      },
  delivered: { variant: 'green' as const, label: 'Delivered' },
  failed:    { variant: 'red'   as const, label: 'Failed'    },
  pending:   { variant: 'amber' as const, label: 'Pending'   },
}

// ── useRetryAllFailed ─────────────────────────────────────────
function useRetryAllFailed() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return 0
      const { error } = await supabase
        .from('sms_reminders')
        .update({ status: 'pending' })
        .in('id', ids)
        .eq('school_id', user!.schoolId)
      if (error) throw error
      return ids.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sms-log', user?.schoolId] }),
  })
}

export function DeliveryLogPage() {
  const { success: toastOk, error: toastErr } = useToast()
  const { data = [], isLoading, isError } = useSmsReminderLog()
  const retryOne  = useRetryReminder()
  const retryAll  = useRetryAllFailed()

  const [statusFilter, setStatus]  = useState<DeliveryStatus>('')
  const [channel,      setChannel] = useState<ChannelFilter>('all')
  const [search,       setSearch]  = useState('')
  const [dateFrom,     setDateFrom]= useState('')
  const [dateTo,       setDateTo]  = useState('')

  const rows: ReminderLogRow[] = useMemo(() => {
    let r = data
    if (statusFilter)      r = r.filter(x => x.status === statusFilter)
    if (channel !== 'all') r = r.filter(x => x.channel === channel)
    if (dateFrom)          r = r.filter(x => (x.sentAt ?? x.createdAt) >= dateFrom)
    if (dateTo)            r = r.filter(x => (x.sentAt ?? x.createdAt) <= dateTo + 'T23:59:59')
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.guardianPhone.includes(q) ||
        `${x.firstName} ${x.lastName}`.toLowerCase().includes(q) ||
        x.message.toLowerCase().includes(q)
      )
    }
    return r
  }, [data, statusFilter, channel, dateFrom, dateTo, search])

  const counts = useMemo(() => ({
    total:     data.length,
    delivered: data.filter(x => x.status === 'delivered').length,
    failed:    data.filter(x => x.status === 'failed').length,
    pending:   data.filter(x => x.status === 'pending').length,
  }), [data])

  const failedIds   = rows.filter(r => r.status === 'failed').map(r => r.id)
  const anyFiltered = !statusFilter && !channel && !search && !dateFrom && !dateTo
  const allFailedIds = data.filter(r => r.status === 'failed').map(r => r.id)

  async function handleRetryAll() {
    const ids = anyFiltered ? allFailedIds : failedIds
    if (!ids.length) return
    try {
      const n = await retryAll.mutateAsync(ids)
      toastOk(`${n} failed reminder${n !== 1 ? 's' : ''} re-queued`)
    } catch (e: any) {
      toastErr(e.message)
    }
  }

  const inputStyle = {
    padding: '0.38rem 0.85rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)',
    background: 'var(--surface)', color: 'var(--txt)', fontSize: 13,
    fontFamily: 'var(--font1)', outline: 'none',
  }

  const thStyle = {
    padding: '0.6rem 0.85rem', textAlign: 'left' as const,
    fontSize: 10, fontWeight: 700 as const, color: 'var(--txt3)',
    textTransform: 'uppercase' as const, letterSpacing: 0.8,
    fontFamily: 'var(--font2)', borderBottom: '1px solid var(--border)',
    background: 'var(--surface2)',
  }
  const tdStyle = { padding: '0.6rem 0.85rem' }

  return (
    <div className="sui-page-enter" style={{ padding: '1.5rem 2rem', maxWidth: 1200 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:14, flexWrap:'wrap', position:'relative', overflow:'hidden', marginBottom:20 }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(16,185,129,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#10b981,#059669)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(16,185,129,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 014.11 8.11 19.79 19.79 0 011.07 4.5 2 2 0 013.04 2.3h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.09 9.91"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Delivery Log</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>SMS and WhatsApp message delivery status</p>
        </div>
        {allFailedIds.length > 0 && (
          <button type="button" onClick={handleRetryAll} disabled={retryAll.isPending}
            style={{ padding:'10px 16px', minHeight:44, border:'.5px solid var(--danger)', borderRadius:10, background:'rgba(244,63,94,.08)', color:'var(--danger)', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
            {retryAll.isPending ? 'Retrying…' : `Retry All Failed (${allFailedIds.length})`}
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem' }}>
        {[
          { key: 'total',     label: 'Total',     val: counts.total,     bg: 'var(--surface2)',   color: 'var(--txt2)'   },
          { key: 'delivered', label: 'Delivered',  val: counts.delivered, bg: 'var(--success-bg)', color: 'var(--success)'},
          { key: 'failed',    label: 'Failed',     val: counts.failed,    bg: 'var(--danger-bg)',  color: 'var(--danger)' },
          { key: 'pending',   label: 'Pending',    val: counts.pending,   bg: 'var(--warning-bg)', color: 'var(--warning)'},
        ].map(s => (
          <div key={s.key} style={{
            padding: '5px 12px', borderRadius: 8,
            border: '1.5px solid var(--border)',
            background: s.bg, color: s.color, fontWeight: 700, fontSize: 12,
          }}>
            {s.label} — {s.val}
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          style={{ ...inputStyle, flex: 1, minWidth: 180 }}
          placeholder="Search name, phone, message…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={inputStyle} value={channel} onChange={e => setChannel(e.target.value as ChannelFilter)}>
          <option value="all">All Channels</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="in_app">In-App</option>
        </select>
        <select style={inputStyle} value={statusFilter} onChange={e => setStatus(e.target.value as DeliveryStatus)}>
          <option value="">All Statuses</option>
          <option value="delivered">Delivered</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>From</span>
          <input style={{ ...inputStyle, width: '100%', maxWidth: 140 }} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>To</span>
          <input style={{ ...inputStyle, width: '100%', maxWidth: 140 }} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <LoadingSpinner size="md" />
        </div>
      )}
      {isError && (
        <div style={{ padding: '1rem', background: 'var(--danger-bg)', borderRadius: 'var(--r)', color: 'var(--danger)', fontSize: 13 }}>
          Failed to load delivery log.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="mob-cards" style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', overflow: 'hidden', overflowX: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr>
                {['Date', 'Student', 'Phone', 'Channel', 'Message', 'Status', 'Delivered At', ''].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
                    No messages match the current filters.
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const cfg = STATUS_CFG[row.status] ?? STATUS_CFG.pending
                const sentStr      = row.sentAt     ? new Date(row.sentAt).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'short' }) : '—'
                const deliveredStr = row.status === 'delivered' && row.sentAt ? sentStr : '—'
                return (
                  <tr key={row.id ?? i} className="sui-tr">
                    <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {row.createdAt ? new Date(row.createdAt).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, fontSize: 13, color: 'var(--txt)' }}>
                      {row.firstName} {row.lastName}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>
                      {row.guardianPhone}
                    </td>
                    <td style={tdStyle}>
                      <Badge variant={row.channel === 'whatsapp' ? 'green' : row.channel === 'in_app' ? 'violet' : 'muted'} size="sm">
                        {row.channel === 'whatsapp' ? 'WhatsApp' : row.channel === 'in_app' ? 'In-App' : 'SMS'}
                      </Badge>
                    </td>
                    <td style={{
                      ...tdStyle, fontSize: 12, color: 'var(--txt2)',
                      maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      <span title={row.message}>{row.message.slice(0, 80)}{row.message.length > 80 ? '…' : ''}</span>
                    </td>
                    <td style={tdStyle}>
                      <Badge variant={cfg.variant} size="sm">{cfg.label}</Badge>
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {deliveredStr}
                    </td>
                    <td style={tdStyle}>
                      {row.status === 'failed' && (
                        <button
                          onClick={() => retryOne.mutate(row.id)}
                          disabled={retryOne.isPending}
                          style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                            background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', minHeight: 36,
                          }}
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
          {rows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              Showing {rows.length} of {data.length} messages
            </div>
          )}
        </div>
      )}
    </div>
  )
}
