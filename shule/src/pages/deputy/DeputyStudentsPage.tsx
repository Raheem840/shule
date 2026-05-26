import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'

// Deputy sees student names, class, stream, status — no financial data.
export function DeputyStudentsPage() {
  const [classId,  setClassId]  = useState('')
  const [streamId, setStreamId] = useState('')
  const [search,   setSearch]   = useState('')

  const { data: classes  = [] } = useClasses()
  const { data: streams  = [] } = useStreams(classId || null)
  const { data: students = [], isLoading } = useStudents(
    { classId: classId || undefined, streamId: streamId || undefined },
    true
  )

  const classMap  = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])
  const streamMap = useMemo(() => new Map(streams.map(s => [s.id, s.name])), [streams])

  const rows = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    )
  }, [students, search])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Students"
        subtitle="Read-only student list."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search name or adm. no…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={classId} onChange={e => { setClassId(e.target.value); setStreamId('') }}>
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

      {!isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Adm No', 'Student', 'Class', 'Stream', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No students match the current filters.</td></tr>
                ) : (
                  <>
                    <tr style={{ height: virtualiser.getVirtualItems()[0]?.start ?? 0 }}><td colSpan={5} /></tr>
                    {virtualiser.getVirtualItems().map(vi => {
                      const s = rows[vi.index]
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)', width: 130 }}>{s.admissionNumber}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
                            {s.firstName} {s.lastName}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                            {s.classId ? classMap.get(s.classId) ?? '—' : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                            {s.streamId ? streamMap.get(s.streamId) ?? '—' : '—'}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                              background: s.status === 'active' ? 'var(--success-bg)' : 'var(--warning-bg)',
                              color:      s.status === 'active' ? 'var(--success)'    : 'var(--warning)',
                            }}>
                              {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ height: virtualiser.getTotalSize() - (virtualiser.getVirtualItems().at(-1)?.end ?? 0) }}><td colSpan={5} /></tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              {rows.length} of {students.length} students
            </div>
          )}
        </div>
      )}
    </div>
  )
}
