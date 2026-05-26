import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useDisciplineRecords, useAddDisciplineRecord,
  useUpdateDisciplineRecord, useDeleteDisciplineRecord,
} from '../../hooks/useDeputy'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'
import { PageHeader } from '../../components/ui/PageHeader'
import type { DisciplineRecord, DisciplineNature } from '../../types/week9'

const NATURE_OPTS: DisciplineNature[] = ['lateness', 'absenteeism', 'misconduct', 'violence', 'other']
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

// ─── STUDENT TYPEAHEAD ────────────────────────────────────────────────────
function StudentTypeahead({
  value,
  onChange,
}: {
  value: { id: string; name: string } | null
  onChange: (s: { id: string; name: string; classId: string | null } | null) => void
}) {
  const { data: allStudents = [] } = useStudents()
  const [query, setQuery] = useState(value?.name ?? '')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allStudents.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.admissionNumber.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [allStudents, query])

  function select(s: typeof allStudents[number]) {
    onChange({ id: s.id, name: `${s.firstName} ${s.lastName}`, classId: s.classId ?? null })
    setQuery(`${s.firstName} ${s.lastName}`)
    setOpen(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
    if (!e.target.value.trim()) onChange(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="sui-input"
        value={query}
        onChange={handleChange}
        onFocus={() => query.trim() && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by name or admission number…"
        style={{ width: '100%' }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {matches.map(s => (
            <div
              key={s.id}
              onMouseDown={() => select(s)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                display: 'flex', gap: 8, alignItems: 'center',
                borderBottom: '1px solid var(--border)',
              }}
              className="sui-tr"
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
                {s.firstName} {s.lastName}
              </span>
              <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                {s.admissionNumber}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ADD / EDIT MODAL ─────────────────────────────────────────────────────
function RecordModal({
  initial,
  onClose,
}: {
  initial: DisciplineRecord | null
  onClose: () => void
}) {
  const addMut    = useAddDisciplineRecord()
  const updateMut = useUpdateDisciplineRecord()
  const isEdit    = !!initial

  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; classId: string | null } | null>(
    initial ? { id: initial.studentId, name: initial.studentName ?? initial.studentId, classId: initial.classId } : null
  )
  const [classId,      setClassId]      = useState(initial?.classId ?? '')
  const [incidentDate, setIncidentDate] = useState(initial?.incidentDate ?? new Date().toISOString().slice(0, 10))
  const [nature,       setNature]       = useState<DisciplineNature>(initial?.nature ?? 'misconduct')
  const [resolution,   setResolution]   = useState(initial?.resolution ?? '')
  const [notes,        setNotes]        = useState(initial?.notes ?? '')
  const [err,          setErr]          = useState('')
  const { data: classes = [] } = useClasses()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedStudent || !resolution.trim()) {
      setErr('Student and resolution are required')
      return
    }
    setErr('')
    try {
      if (isEdit) {
        await updateMut.mutateAsync({
          id: initial!.id, incidentDate, nature, resolution, notes: notes || null,
        })
      } else {
        await addMut.mutateAsync({
          studentId:    selectedStudent.id,
          classId:      classId || selectedStudent.classId,
          incidentDate, nature, resolution, notes: notes || null,
        })
      }
      onClose()
    } catch (ex: any) {
      setErr(ex.message ?? 'Failed to save')
    }
  }

  const isPending = addMut.isPending || updateMut.isPending

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <form
        onSubmit={e => { void submit(e) }}
        style={{
          background: 'var(--surface)', borderRadius: 20, padding: 32,
          maxWidth: 500, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflow: 'auto',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>
          {isEdit ? 'Edit Discipline Record' : 'Add Discipline Record'}
        </h2>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
            Student ★
          </label>
          {isEdit ? (
            <div className="sui-input" style={{ color: 'var(--txt2)', cursor: 'default' }}>
              {initial?.studentName ?? initial?.studentId}
            </div>
          ) : (
            <StudentTypeahead
              value={selectedStudent}
              onChange={s => {
                setSelectedStudent(s)
                if (s?.classId) setClassId(s.classId)
              }}
            />
          )}
        </div>

        {!isEdit && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
              Class (auto-filled from student)
            </label>
            <select className="sui-input" value={classId} onChange={e => setClassId(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select class…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
              Incident Date ★
            </label>
            <input type="date" className="sui-input" value={incidentDate}
              onChange={e => setIncidentDate(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
              Nature ★
            </label>
            <select className="sui-input" value={nature} onChange={e => setNature(e.target.value as DisciplineNature)} style={{ width: '100%' }}>
              {NATURE_OPTS.map(n => (
                <option key={n} value={n} style={{ textTransform: 'capitalize' }}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>
            Resolution / Action Taken ★
          </label>
          <textarea className="sui-input" value={resolution} onChange={e => setResolution(e.target.value)}
            rows={3} placeholder="E.g. Parent notified, detention issued" style={{ width: '100%', resize: 'vertical' }} />
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
            {isPending ? 'Saving…' : isEdit ? 'Update Record' : 'Save Record'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────────────────────
function DeleteModal({ record, onClose }: { record: DisciplineRecord; onClose: () => void }) {
  const deleteMut = useDeleteDisciplineRecord()
  const [err, setErr] = useState('')

  async function confirm() {
    try {
      await deleteMut.mutateAsync(record.id)
      onClose()
    } catch (ex: any) {
      setErr(ex.message ?? 'Failed to delete')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 32,
        maxWidth: 420, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', marginTop: 0, marginBottom: 12 }}>
          Delete Record?
        </h2>
        <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 20 }}>
          This will permanently delete the discipline record for{' '}
          <strong>{record.studentName ?? record.studentId}</strong> on {new Date(record.incidentDate).toLocaleDateString('en-GB')}.
        </p>
        {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="sui-btn-outline" onClick={onClose}>Cancel</button>
          <button
            disabled={deleteMut.isPending}
            onClick={() => { void confirm() }}
            style={{
              padding: '8px 20px', background: 'var(--danger)', color: '#fff',
              border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>
            {deleteMut.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCIPLINE PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function DisciplinePage() {
  const [classFilter, setClassFilter] = useState('')
  const [search,      setSearch]      = useState('')
  const [natureFilter, setNature]     = useState<DisciplineNature | ''>('')
  const [modal,       setModal]       = useState<'add' | 'edit' | 'delete' | null>(null)
  const [selected,    setSelected]    = useState<DisciplineRecord | null>(null)

  const { data: records = [], isLoading } = useDisciplineRecords({ classId: classFilter || undefined })
  const { data: classes = [] } = useClasses()

  const filtered = useMemo(() => {
    let r = records
    if (natureFilter) r = r.filter(x => x.nature === natureFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        (x.studentName ?? x.studentId).toLowerCase().includes(q) ||
        x.resolution.toLowerCase().includes(q)
      )
    }
    return r
  }, [records, natureFilter, search])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count:            filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 60,
    overscan:         5,
  })

  function exportCsv() {
    const header = 'Date,Nature,Student,Class,Resolution\n'
    const rows = filtered.map(r =>
      `"${r.incidentDate}","${r.nature}","${r.studentName ?? r.studentId}","${r.className ?? ''}","${r.resolution}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'discipline-records.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function openEdit(r: DisciplineRecord) {
    setSelected(r)
    setModal('edit')
  }

  function openDelete(r: DisciplineRecord) {
    setSelected(r)
    setModal('delete')
  }

  function closeModal() {
    setModal(null)
    setSelected(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader title="Discipline Records" subtitle={`${filtered.length} record${filtered.length !== 1 ? 's' : ''}`} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sui-btn-outline" onClick={exportCsv} style={{ fontSize: 13 }}>Export CSV</button>
          <button
            onClick={() => setModal('add')}
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
          style={{ width: 260 }}
        />
        <select className="sui-input" style={{ width: 180 }} value={classFilter}
          onChange={e => setClassFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="sui-input" style={{ width: 160 }} value={natureFilter}
          onChange={e => setNature(e.target.value as DisciplineNature | '')}>
          <option value="">All Types</option>
          {NATURE_OPTS.map(n => (
            <option key={n} value={n}>{n.charAt(0).toUpperCase() + n.slice(1)}</option>
          ))}
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
                {['Date', 'Nature', 'Student', 'Class', 'Resolution', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '10px 14px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 11, color: 'var(--txt3)',
                    textAlign: 'left', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 520 }}>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map(vRow => {
                const r: DisciplineRecord = filtered[vRow.index]
                return (
                  <div
                    key={r.id}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%',
                      transform: `translateY(${vRow.start}px)`,
                      height: 60, display: 'flex', alignItems: 'center',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    }}
                    onClick={() => openEdit(r)}
                    className="sui-tr"
                  >
                    <div style={{ flex: '0 0 100px', padding: '0 14px', fontSize: 12, color: 'var(--txt3)' }}>
                      {new Date(r.incidentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </div>
                    <div style={{ flex: '0 0 110px', padding: '0 14px' }}>
                      <NatureBadge nature={r.nature} />
                    </div>
                    <div style={{ flex: 1.5, padding: '0 14px', fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>
                      {r.studentName ?? r.studentId.slice(0, 8) + '…'}
                    </div>
                    <div style={{ flex: 1, padding: '0 14px', fontSize: 12, color: 'var(--txt2)' }}>
                      {r.className ?? '—'}
                    </div>
                    <div style={{
                      flex: 2, padding: '0 14px', fontSize: 12, color: 'var(--txt2)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {r.resolution}
                    </div>
                    <div style={{ flex: '0 0 80px', padding: '0 14px', display: 'flex', gap: 6 }}>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(r) }}
                        title="Edit"
                        style={{
                          padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)',
                          borderRadius: 6, background: 'var(--surface2)', cursor: 'pointer',
                          color: 'var(--txt2)',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openDelete(r) }}
                        title="Delete"
                        style={{
                          padding: '4px 8px', fontSize: 11, border: '1px solid var(--danger)',
                          borderRadius: 6, background: 'var(--danger-bg)', cursor: 'pointer',
                          color: 'var(--danger)',
                        }}
                      >
                        Del
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
            {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {modal === 'add'    && <RecordModal initial={null}     onClose={closeModal} />}
      {modal === 'edit'   && <RecordModal initial={selected} onClose={closeModal} />}
      {modal === 'delete' && selected && <DeleteModal record={selected} onClose={closeModal} />}
    </div>
  )
}
