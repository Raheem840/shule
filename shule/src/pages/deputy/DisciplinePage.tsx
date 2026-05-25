import { useState, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDisciplineRecords, useAddDisciplineRecord } from '../../hooks/useDeputy'
import type { DisciplineRecord, DisciplineNature } from '../../types/week9'

const NATURE_OPTS: DisciplineNature[] = ['lateness','absenteeism','misconduct','violence','other']
const NATURE_COLOR: Record<DisciplineNature, string> = {
  lateness:    'var(--warning)',
  absenteeism: 'var(--info)',
  misconduct:  'var(--danger)',
  violence:    'var(--danger)',
  other:       'var(--txt3)',
}

function NatureBadge({ nature }: { nature: DisciplineNature }) {
  const color = NATURE_COLOR[nature]
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      background: `${color}20`, color, textTransform: 'capitalize',
    }}>
      {nature}
    </span>
  )
}

function AddModal({ onClose }: { onClose: () => void }) {
  const { mutateAsync, isPending } = useAddDisciplineRecord()
  const [studentId,    setStudentId]    = useState('')
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0,10))
  const [nature,       setNature]       = useState<DisciplineNature>('misconduct')
  const [resolution,   setResolution]   = useState('')
  const [notes,        setNotes]        = useState('')
  const [err,          setErr]          = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId.trim() || !resolution.trim()) { setErr('Student ID and resolution are required'); return }
    try {
      await mutateAsync({ studentId: studentId.trim(), incidentDate, nature, resolution, notes: notes || null })
      onClose()
    } catch (ex: any) {
      setErr(ex.message ?? 'Failed to save')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <form
        onSubmit={submit}
        style={{
          background: 'var(--surface)', borderRadius: 20, padding: 32,
          maxWidth: 480, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>
          Add Discipline Record
        </h2>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
            Student ID / Admission Number
          </label>
          <input className="sui-input" value={studentId} onChange={e => setStudentId(e.target.value)}
            placeholder="STU-2025-001" style={{ width: '100%' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
              Date
            </label>
            <input type="date" className="sui-input" value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
              Nature
            </label>
            <select className="sui-input" value={nature} onChange={e => setNature(e.target.value as DisciplineNature)}
              style={{ width: '100%' }}>
              {NATURE_OPTS.map(n => <option key={n} value={n} style={{ textTransform: 'capitalize' }}>{n}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
            Resolution / Action Taken ★
          </label>
          <textarea className="sui-input" value={resolution} onChange={e => setResolution(e.target.value)}
            rows={2} placeholder="E.g. Parent notified, detention issued" style={{ width: '100%', resize: 'vertical' }} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
            Notes (optional)
          </label>
          <textarea className="sui-input" value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} style={{ width: '100%', resize: 'vertical' }} />
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="sui-btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={isPending}
            style={{
              padding: '8px 20px', background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {isPending ? 'Saving…' : 'Save Record'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function DisciplinePage() {
  const { data: records = [], isLoading } = useDisciplineRecords()
  const [showModal, setShowModal] = useState(false)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState<DisciplineNature | ''>('')

  const filtered = records.filter(r => {
    if (filter && r.nature !== filter) return false
    if (search && !r.studentId.toLowerCase().includes(search.toLowerCase()) &&
        !r.resolution.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  })

  function exportCsv() {
    const header = 'Date,Nature,Student ID,Resolution\n'
    const rows = records.map(r =>
      `"${r.incidentDate}","${r.nature}","${r.studentId}","${r.resolution}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'discipline-records.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            Discipline Records
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sui-btn-outline" onClick={exportCsv} style={{ fontSize: 13 }}>Export CSV</button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '8px 18px', background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            + Add Record
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          placeholder="Search student or resolution…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sui-input"
          style={{ width: 280 }}
        />
        <select value={filter} onChange={e => setFilter(e.target.value as DisciplineNature | '')}
          className="sui-input" style={{ width: 160 }}>
          <option value="">All Types</option>
          {NATURE_OPTS.map(n => <option key={n} value={n} style={{ textTransform: 'capitalize' }}>{n}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading records…</div>}

      {!isLoading && filtered.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--txt3)',
          background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
        }}>
          No discipline records found.
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Nature', 'Student', 'Resolution', 'Notes'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 560 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const r: DisciplineRecord = filtered[vRow.index]
                return (
                  <div
                    key={r.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      height: 64, display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)', padding: '0 14px',
                    }}
                  >
                    <div style={{ flex: 1, fontSize: 12, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
                      {new Date(r.incidentDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                    </div>
                    <div style={{ flex: 1 }}><NatureBadge nature={r.nature} /></div>
                    <div style={{ flex: 1.5, fontSize: 12, color: 'var(--txt)', fontFamily: 'var(--font3)' }}>
                      {r.studentId}
                    </div>
                    <div style={{ flex: 2, fontSize: 12, color: 'var(--txt2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.resolution}
                    </div>
                    <div style={{ flex: 1.5, fontSize: 11, color: 'var(--txt3)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes ?? '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && <AddModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
