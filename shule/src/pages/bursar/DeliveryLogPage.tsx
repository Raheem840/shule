import { useState, useMemo } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useSmsReminderLog } from '../../hooks/useSmsReminders'
import type { ReminderLogRow } from '../../hooks/useSmsReminders'

type DeliveryStatus = 'sent' | 'delivered' | 'failed' | 'pending' | ''

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  sent:      { label: 'Sent',      bg: 'var(--info-bg)',    color: 'var(--info)'    },
  delivered: { label: 'Delivered', bg: 'var(--success-bg)', color: 'var(--success)' },
  failed:    { label: 'Failed',    bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
  pending:   { label: 'Pending',   bg: 'var(--warning-bg)', color: 'var(--warning)' },
}

export function DeliveryLogPage() {
  const { data = [], isLoading, isError } = useSmsReminderLog()
  const [statusFilter, setStatus] = useState<DeliveryStatus>('')
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState<'all' | 'sms' | 'whatsapp'>('all')

  const rows = useMemo(() => {
    let r: ReminderLogRow[] = data
    if (statusFilter) r = r.filter(x => x.status === statusFilter)
    if (channel !== 'all') r = r.filter(x => x.channel === channel)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.guardianPhone.includes(q) ||
        `${x.firstName} ${x.lastName}`.toLowerCase().includes(q) ||
        x.message.toLowerCase().includes(q)
      )
    }
    return r
  }, [data, statusFilter, channel, search])

  const counts = useMemo(() => ({
    total:     data.length,
    delivered: data.filter(x => x.status === 'delivered').length,
    failed:    data.filter(x => x.status === 'failed').length,
    pending:   data.filter(x => x.status === 'pending').length,
  }), [data])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Delivery Log"
        subtitle="SMS and WhatsApp message delivery status."
      />

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { key: 'total',     label: 'Total',     val: counts.total,     bg: 'var(--surface2)', color: 'var(--txt2)' },
          { key: 'delivered', label: 'Delivered',  val: counts.delivered, bg: 'var(--success-bg)', color: 'var(--success)' },
          { key: 'failed',    label: 'Failed',     val: counts.failed,    bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
          { key: 'pending',   label: 'Pending',    val: counts.pending,   bg: 'var(--warning-bg)', color: 'var(--warning)' },
        ].map(s => (
          <div key={s.key} style={{
            padding: '6px 14px', borderRadius: 8, border: '1.5px solid var(--border)',
            background: s.bg, color: s.color, fontWeight: 700, fontSize: 12,
          }}>
            {s.label} — {s.val}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search phone, name…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={channel} onChange={e => setChannel(e.target.value as typeof channel)}>
          <option value="all">All Channels</option>
          <option value="sms">SMS</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
        <select className="sui-input" value={statusFilter} onChange={e => setStatus(e.target.value as DeliveryStatus)}>
          <option value="">All Statuses</option>
          <option value="delivered">Delivered</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load delivery log.</div>}

      {!isLoading && !isError && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Recipient', 'Phone', 'Channel', 'Message', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No messages match the current filters.</td></tr>
              ) : rows.map((row, i) => {
                const cfg = STATUS_CFG[row.status] ?? STATUS_CFG['pending']
                return (
                  <tr key={row.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {row.sentAt ? new Date(row.sentAt).toLocaleString('en-UG', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{row.firstName} {row.lastName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt2)' }}>{row.guardianPhone}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                        background: row.channel === 'whatsapp' ? 'var(--success-bg)' : 'var(--info-bg)',
                        color: row.channel === 'whatsapp' ? 'var(--success)' : 'var(--info)',
                      }}>
                        {row.channel.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.message}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
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
