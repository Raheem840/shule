import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useDosTeacherPerformance, useAssignClassTeacher } from '../../hooks/useDos'
import { useStreams } from '../../hooks/useClasses'
import type { TeacherPerfRow } from '../../types/week9'

// ─── RATE BAR ─────────────────────────────────────────────────────────────
function RateBar({ value }: { value: number }) {
  const color = value >= 70 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: color }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font3)', color }}>{value}%</span>
    </div>
  )
}

// ─── ASSIGN CLASS TEACHER MODAL ────────────────────────────────────────────
function AssignModal({
  teacher,
  onClose,
}: {
  teacher: TeacherPerfRow
  onClose: () => void
}) {
  const { data: allStreams = [] } = useStreams(null)
  const assignMut = useAssignClassTeacher()
  const [streamId, setStreamId] = useState('')
  const [err,      setErr]      = useState('')
  const [success,  setSuccess]  = useState(false)

  const availableStreams = allStreams.filter(s => !s.classTeacherId || s.classTeacherId === teacher.staffId)

  async function confirm() {
    if (!streamId) { setErr('Select a stream first'); return }
    const stream = allStreams.find(s => s.id === streamId)
    if (!stream) return
    setErr('')
    try {
      await assignMut.mutateAsync({
        streamId,
        classId:   stream.classId,
        teacherId: teacher.staffId,
      })
      setSuccess(true)
    } catch (ex: any) {
      setErr(ex.message ?? 'Failed to assign')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        maxWidth: 420, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', margin: '0 0 16px' }}>
          Assign as Class Teacher
        </h2>
        {success ? (
          <div style={{ color: 'var(--success)', fontSize: 14, marginBottom: 16 }}>
            {teacher.name} has been assigned as class teacher.
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
              Assigning <strong>{teacher.name}</strong> as class teacher for a stream.
            </p>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>
              Select Stream
            </label>
            <select className="sui-input" value={streamId} onChange={e => setStreamId(e.target.value)} style={{ width: '100%', marginBottom: 12 }}>
              <option value="">Choose stream…</option>
              {availableStreams.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{err}</div>}
          </>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="sui-btn-outline" onClick={onClose}>{success ? 'Close' : 'Cancel'}</button>
          {!success && (
            <button
              disabled={assignMut.isPending}
              onClick={() => { void confirm() }}
              style={{
                padding: '8px 20px', background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {assignMut.isPending ? 'Assigning…' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── TEACHER DETAIL MODAL ─────────────────────────────────────────────────
function TeacherDetailModal({
  teacher,
  onClose,
}: {
  teacher: TeacherPerfRow
  onClose: () => void
}) {
  const [tab, setTab] = useState<'performance' | 'contact'>('performance')
  const [showAssign, setShowAssign] = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        maxWidth: 540, width: '95vw', maxHeight: '90vh', overflow: 'auto',
        boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', margin: 0 }}>{teacher.name}</h2>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
              {teacher.subjects.length} subject{teacher.subjects.length !== 1 ? 's' : ''} · {teacher.assessmentsThisTerm} assessment{teacher.assessmentsThisTerm !== 1 ? 's' : ''} this term
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowAssign(true)}
              style={{
                padding: '6px 14px', background: 'var(--brand)', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              Assign as Class Teacher
            </button>
            <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--txt3)' }}>✕</button>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
          {(['performance', 'contact'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 12,
                color: tab === t ? 'var(--brand)' : 'var(--txt2)',
                borderBottom: tab === t ? '2px solid var(--brand)' : '2px solid transparent',
                marginBottom: -2, textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Performance tab */}
        {tab === 'performance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 4 }}>Pass Rate</div>
                <RateBar value={teacher.passRate} />
              </div>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 4 }}>Curriculum Coverage</div>
                <RateBar value={teacher.curriculumCoverage} />
              </div>
              <div style={{ flex: 1, minWidth: 120, background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 4 }}>Assessments</div>
                <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
                  {teacher.assessmentsThisTerm}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 8 }}>Classes Assigned</div>
              {teacher.classes.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {teacher.classes.map((cId, i) => (
                    <span key={i} style={{
                      padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'var(--brand-light)', color: 'var(--brand)',
                    }}>
                      {cId.slice(0, 8)}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--txt3)' }}>No classes assigned</span>
              )}
            </div>
          </div>
        )}

        {/* Contact tab */}
        {tab === 'contact' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 4 }}>Staff ID</div>
              <div style={{ fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>
                {teacher.staffId.slice(0, 16)}…
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 700, marginBottom: 4 }}>Subjects</div>
              <div style={{ fontSize: 13, color: 'var(--txt)' }}>
                {teacher.subjects.length > 0
                  ? teacher.subjects.join(', ')
                  : 'No subjects listed'}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAssign && (
        <AssignModal teacher={teacher} onClose={() => setShowAssign(false)} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// DOS TEACHERS PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function DosTeachersPage() {
  const { data = [], isLoading, isError } = useDosTeacherPerformance()
  const [search,   setSearch]   = useState('')
  const [sort,     setSort]     = useState<'name' | 'passRate' | 'coverage'>('passRate')
  const [selected, setSelected] = useState<TeacherPerfRow | null>(null)

  const rows = useMemo(() => {
    let r = data
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(t => t.name.toLowerCase().includes(q))
    }
    return [...r].sort((a, b) => {
      if (sort === 'passRate') return b.passRate - a.passRate
      if (sort === 'coverage') return b.curriculumCoverage - a.curriculumCoverage
      return a.name.localeCompare(b.name)
    })
  }, [data, search, sort])

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({
    count:            rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize:     () => 52,
    overscan:         8,
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Teachers"
        subtitle="Teacher performance — pass rates and curriculum coverage. Click a row for details."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input className="sui-input" placeholder="Search teacher…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ minWidth: 200 }} />
        <select className="sui-input" value={sort} onChange={e => setSort(e.target.value as typeof sort)}>
          <option value="passRate">Sort by Pass Rate</option>
          <option value="coverage">Sort by Curriculum Coverage</option>
          <option value="name">Sort by Name</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load teacher data.</div>}

      {!isLoading && !isError && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Teacher', 'Journals', 'Pass Rate', 'Coverage', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
          </table>
          <div ref={parentRef} style={{ maxHeight: 520, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No teacher data available.</td></tr>
                ) : (
                  <>
                    <tr style={{ height: virtualiser.getVirtualItems()[0]?.start ?? 0 }}><td colSpan={5} /></tr>
                    {virtualiser.getVirtualItems().map(vi => {
                      const t = rows[vi.index]
                      return (
                        <tr
                          key={t.staffId}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => setSelected(t)}
                          className="sui-tr"
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{t.name}</td>
                          <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{t.assessmentsThisTerm}</td>
                          <td style={{ padding: '10px 14px' }}><RateBar value={t.passRate} /></td>
                          <td style={{ padding: '10px 14px' }}><RateBar value={t.curriculumCoverage} /></td>
                          <td style={{ padding: '10px 14px' }}>
                            <button
                              onClick={e => { e.stopPropagation(); setSelected(t) }}
                              style={{
                                padding: '4px 10px', fontSize: 11, border: '1px solid var(--border)',
                                borderRadius: 6, background: 'var(--surface2)', cursor: 'pointer', color: 'var(--txt2)',
                              }}
                            >
                              View
                            </button>
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
              {rows.length} teacher{rows.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {selected && (
        <TeacherDetailModal teacher={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
