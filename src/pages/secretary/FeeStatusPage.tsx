import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { csvField } from '../../lib/csv'
import { printElement, PRINT_INK, PRINT_RULE, PRINT_BRAND } from '../../lib/printElement'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { FeeStatus } from '../../types/app'

// Secretary fee status — shows PAID/PARTIAL/UNPAID badges only, no amounts.
// Finance isolation: this query intentionally omits amount_due, amount_paid, balance.

type StudentFeeStatus = {
  studentId:       string
  admissionNumber: string
  firstName:       string
  lastName:        string
  classId:         string | null
  streamId:        string | null
  className:       string
  streamName:      string
  status:          FeeStatus
  pct60:           boolean
}

function useStudentFeeStatus(classId: string, streamId: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['student-fee-status', user?.schoolId, classId, streamId],
    enabled:  !!user,
    queryFn: async (): Promise<StudentFeeStatus[]> => {
      const sid = user!.schoolId

      let studQ = supabase
        .from('students')
        .select('id, admission_number, first_name, last_name, class_id, stream_id')
        .eq('school_id', sid)
        .eq('status', 'active')
        .order('last_name', { ascending: true })
      if (classId)  studQ = studQ.eq('class_id', classId)
      if (streamId) studQ = studQ.eq('stream_id', streamId)

      const [studRes, classRes, streamRes, payRes] = await Promise.all([
        studQ,
        supabase.from('classes').select('id, name').eq('school_id', sid),
        supabase.from('streams').select('id, name').eq('school_id', sid),
        // Only fetch existence (has paid / not paid) — no amounts
        supabase
          .from('fee_payments')
          .select('student_id, amount_paid, amount_due')
          .eq('school_id', sid),
      ])

      if (studRes.error)  throw studRes.error
      if (payRes.error)   throw payRes.error

      const classMap  = new Map<string, string>((classRes.data ?? []).map((c: any) => [c.id, c.name]))
      const streamMap = new Map<string, string>((streamRes.data ?? []).map((s: any) => [s.id, s.name]))

      // Aggregate per student: status only — no individual amounts exposed
      type Agg = { paid: number; due: number }
      const agg = new Map<string, Agg>()
      for (const p of payRes.data ?? []) {
        const sid2 = p.student_id as string
        const prev = agg.get(sid2) ?? { paid: 0, due: 0 }
        prev.paid += Number(p.amount_paid ?? 0)
        prev.due  += Number(p.amount_due  ?? 0)
        agg.set(sid2, prev)
      }

      return (studRes.data ?? []).map((r: any) => {
        const a = agg.get(r.id as string)
        let status: FeeStatus = 'unpaid'
        if (a) {
          if (a.due > 0 && a.paid >= a.due) status = 'paid'
          else if (a.paid > 0)              status = 'partial'
          else                              status = 'unpaid'
        }
        const pct60 = a ? a.due > 0 && a.paid / a.due >= 0.6 : false
        return {
          studentId:       r.id as string,
          admissionNumber: r.admission_number as string,
          firstName:       r.first_name as string,
          lastName:        r.last_name as string,
          classId:         (r.class_id as string) ?? null,
          streamId:        (r.stream_id as string) ?? null,
          className:       classMap.get(r.class_id as string) ?? '—',
          streamName:      streamMap.get(r.stream_id as string) ?? '—',
          status,
          pct60,
        }
      })
    },
    staleTime: 2 * 60_000,
  })
}

const STATUS_CFG: Record<FeeStatus, { label: string; bg: string; color: string }> = {
  paid:    { label: 'Paid',    bg: 'var(--success-bg)', color: 'var(--success)'  },
  partial: { label: 'Partial', bg: 'var(--warning-bg)', color: 'var(--warning)'  },
  unpaid:  { label: 'Unpaid',  bg: 'var(--danger-bg)',  color: 'var(--danger)'   },
}

export function FeeStatusPage() {
  const [classId,    setClassId]    = useState('')
  const [streamId,   setStreamId]   = useState('')
  const [statusFilter, setStatus]   = useState<FeeStatus | ''>('')
  const [search,     setSearch]     = useState('')
  const [above60,    setAbove60]    = useState(false)

  const { data: classes = [] } = useClasses()
  const { data: streams = [] } = useStreams(classId || null)
  const { data: school }       = useSchoolSettings()
  const { data = [], isLoading, isError } = useStudentFeeStatus(classId, streamId)

  const rows = useMemo(() => {
    let r = data
    if (statusFilter) r = r.filter(x => x.status === statusFilter)
    if (above60)      r = r.filter(x => x.pct60)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.firstName.toLowerCase().includes(q) ||
        x.lastName.toLowerCase().includes(q)  ||
        x.admissionNumber.toLowerCase().includes(q)
      )
    }
    return r
  }, [data, statusFilter, above60, search])

  const counts = useMemo(() => ({
    paid:    data.filter(x => x.status === 'paid').length,
    partial: data.filter(x => x.status === 'partial').length,
    unpaid:  data.filter(x => x.status === 'unpaid').length,
  }), [data])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count:           rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize:    () => 52,
    overscan:        10,
  })

  // Human-readable summary of the active filters — shown on the printout so
  // it's clear what the list represents without needing the on-screen UI.
  const filterSummary = [
    statusFilter ? STATUS_CFG[statusFilter].label : null,
    above60 ? '≥60% paid' : null,
    classId ? (classes.find(c => c.id === classId)?.name ?? null) : null,
    streamId ? (streams.find(s => s.id === streamId)?.name ?? null) : null,
    search.trim() ? `matching "${search.trim()}"` : null,
  ].filter(Boolean).join(' · ') || 'All students'

  // Export/print always act on `rows` — the currently filtered list — not
  // the unfiltered `data`, so "what you see is what you get" out.
  function handleExportCsv() {
    const header = ['Admission No', 'Student', 'Class', 'Stream', 'Status'].map(csvField).join(',') + '\n'
    const body = rows.map(r => [
      r.admissionNumber, `${r.firstName} ${r.lastName}`, r.className, r.streamName, STATUS_CFG[r.status].label,
    ].map(csvField).join(',')).join('\n')
    const blob = new Blob([header + body], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fee-status-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, position: 'relative', overflow: 'hidden', flexWrap: 'wrap' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Fee Status</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Student payment status — paid, partial, or unpaid. No amounts shown.</p>
          </div>
        </div>
        {!isLoading && !isError && rows.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, position: 'relative' }}>
            <button
              onClick={handleExportCsv}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
            <button
              onClick={() => printElement('fee-status-printable')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              Print
            </button>
          </div>
        )}
      </div>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['paid', 'partial', 'unpaid'] as FeeStatus[]).map(s => {
          const cfg = STATUS_CFG[s]
          return (
            <button key={s} onClick={() => setStatus(prev => prev === s ? '' : s)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${statusFilter === s ? cfg.color : 'var(--border)'}`,
                background: statusFilter === s ? cfg.bg : 'var(--surface)',
                color: statusFilter === s ? cfg.color : 'var(--txt2)',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
              {cfg.label} — {counts[s]}
            </button>
          )
        })}

        {/* ≥60% paid filter */}
        <button
          onClick={() => setAbove60(v => !v)}
          style={{
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 12,
            background: above60
              ? 'linear-gradient(135deg,#10b981,#059669)'
              : 'var(--surface)',
            color:  above60 ? '#fff' : 'var(--success)',
            border: above60 ? '1.5px solid transparent' : '1.5px solid rgba(16,185,129,.4)',
            boxShadow: above60 ? '0 2px 12px rgba(16,185,129,.30)' : 'none',
            transition: 'all .18s cubic-bezier(.34,1.56,.64,1)',
          }}
        >
          ≥ 60% Paid
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search student…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={classId}
          onChange={e => { setClassId(e.target.value); setStreamId('') }}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {streams.length > 0 && (
          <select className="sui-input" value={streamId} onChange={e => setStreamId(e.target.value)}>
            <option value="">All Streams</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load fee status data.</div>}

      {!isLoading && !isError && (
        <>
        <div ref={parentRef} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 560, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 130 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 110 }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Adm No', 'Student', 'Class', 'Stream', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No students match the current filters.</td></tr>
              ) : virtualiser.getVirtualItems().map(vi => {
                const row = rows[vi.index]
                const cfg = STATUS_CFG[row.status]
                return (
                  <tr key={row.studentId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{row.admissionNumber}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.firstName} {row.lastName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{row.className}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{row.streamName}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && (
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)', background: 'var(--surface)', borderRadius: '0 0 14px 14px' }}>
            Showing {rows.length} of {data.length} students
          </div>
        )}

        {/* Hidden on screen, rendered only inside #print-root when printing
            (see printElement/the .printing-report CSS) — the virtualized
            on-screen table only ever has the visible rows in the DOM, so it
            can't be cloned directly; this renders every filtered row as a
            plain table matching the same columns. */}
        {rows.length > 0 && (
          <div id="fee-status-printable" className="print-only">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: `3px solid ${PRINT_BRAND}`, paddingBottom: 12, marginBottom: 14 }}>
              {school?.logoUrl ? (
                <img src={school.logoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, background: PRINT_BRAND, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                  {(school?.shortName || school?.schoolName || 'S').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: PRINT_INK, letterSpacing: -0.3 }}>
                  {school?.schoolName ?? 'School'}
                </div>
                {school?.motto && (
                  <div style={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic', marginTop: 1 }}>{school.motto}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: PRINT_BRAND }}>Fee Status</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                  {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              Filter: <strong style={{ color: PRINT_INK }}>{filterSummary}</strong> — {rows.length} student{rows.length !== 1 ? 's' : ''}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Adm No', 'Student', 'Class', 'Stream', 'Status'].map((h, i) => (
                    <th key={h} style={{
                      border: 'none', padding: '5px 8px', textAlign: 'left', fontSize: 9.5, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: 0.5, color: '#fff', background: PRINT_BRAND,
                      borderRadius: i === 0 ? '5px 0 0 5px' : i === 4 ? '0 5px 5px 0' : 0,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.studentId} style={{ background: i % 2 === 1 ? '#f8fafc' : 'transparent' }}>
                    <td style={{ padding: '5px 8px', fontSize: 10.5, borderBottom: `1px solid ${PRINT_RULE}`, fontFamily: 'var(--font3)', color: '#475569' }}>{row.admissionNumber}</td>
                    <td style={{ padding: '5px 8px', fontSize: 10.5, borderBottom: `1px solid ${PRINT_RULE}`, fontWeight: 600, color: PRINT_INK }}>{row.firstName} {row.lastName}</td>
                    <td style={{ padding: '5px 8px', fontSize: 10.5, borderBottom: `1px solid ${PRINT_RULE}`, color: '#475569' }}>{row.className}</td>
                    <td style={{ padding: '5px 8px', fontSize: 10.5, borderBottom: `1px solid ${PRINT_RULE}`, color: '#475569' }}>{row.streamName}</td>
                    <td style={{ padding: '5px 8px', fontSize: 10.5, borderBottom: `1px solid ${PRINT_RULE}`, fontWeight: 700, color: PRINT_INK }}>{STATUS_CFG[row.status].label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: `1px solid ${PRINT_RULE}`, marginTop: 10, paddingTop: 8, fontSize: 9.5, color: '#94a3b8', textAlign: 'center' }}>
              Generated by Shule — {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  )
}
