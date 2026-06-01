import { useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStudents, type StudentFilters } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useGenerateParentAccess, type GeneratedAccess } from '../../hooks/useParentPortal'
import { Avatar } from '../../components/shared/Avatar'
import type { Student } from '../../types/app'

function GenerateAccessModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const { mutateAsync, isPending } = useGenerateParentAccess()
  const [result, setResult] = useState<GeneratedAccess | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(p => ({ ...p, [key]: true }))
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000)
  }

  const handleGenerate = async () => {
    setError(null)
    try {
      const r = await mutateAsync({ id: student.id, admissionNumber: student.admissionNumber })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate access')
    }
  }

  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', padding: '24px', borderRadius: 22, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Parent Portal Access</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{student.firstName} {student.lastName} · {student.admissionNumber}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {!result ? (
          <>
            <p style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: 16 }}>
              This will auto-generate a parent login using the student's admission number. If credentials already exist, they will be returned unchanged.
            </p>
            {error && <div style={{ background: 'rgba(244,63,94,.08)', border: '.5px solid var(--danger)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => void handleGenerate()} disabled={isPending}
                style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.35)' }}>
                {isPending ? 'Generating…' : 'Generate Access'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ background: result.isNew ? 'rgba(16,185,129,.08)' : 'rgba(14,165,233,.08)', border: `.5px solid ${result.isNew ? '#10b981' : '#0ea5e9'}`, borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: result.isNew ? '#065f46' : '#0369a1' }}>
              {result.isNew ? 'New parent account created.' : 'Existing credentials retrieved.'}
            </div>
            {([{ key: 'email', label: 'Email', value: result.email }, { key: 'pw', label: 'Password', value: result.tempPassword }] as const).map(({ key, label, value }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .6 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                  <span style={{ fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>{value}</span>
                  <button onClick={() => copyText(key, value)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied[key] ? '#10b981' : 'var(--brand)' }}>
                    {copied[key] ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.35)' }}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

const statusColors: Record<Student['status'], { bg: string; color: string }> = {
  active:    { bg: 'rgba(16,185,129,.1)',  color: '#065f46' },
  suspended: { bg: 'rgba(245,158,11,.1)', color: '#b45309' },
  expelled:  { bg: 'rgba(244,63,94,.1)',  color: '#be123c' },
}

const LEVEL_CHIP: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: '#f0fdfa', border: '#99f6e4', text: '#0f766e' },
  2: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
  3: { bg: '#fdf4ff', border: '#e9d5ff', text: '#7e22ce' },
  4: { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
  5: { bg: '#fefce8', border: '#fef08a', text: '#a16207' },
  6: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
}

const ROW_HEIGHT = 52

const TH: React.CSSProperties = { textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: .7, textTransform: 'uppercase', color: 'var(--txt2)', padding: '11px 14px', borderBottom: '.5px solid var(--border)', background: 'var(--surface2)', whiteSpace: 'nowrap' }
const TD: React.CSSProperties = { padding: '0 14px', borderBottom: '.5px solid var(--border)', color: 'var(--txt2)', verticalAlign: 'middle', fontSize: 12.5 }

function StudentRow({ student, classes, streams, onView, onPortal, style }: {
  student: Student; classes: { id: string; name: string; level: string | null }[]
  streams: { id: string; name: string }[]; onView: (s: Student) => void; onPortal: (s: Student) => void; style: React.CSSProperties
}) {
  const cls        = classes.find(c => c.id === student.classId)
  const className  = cls?.name ?? '—'
  const streamName = streams.find(s => s.id === student.streamId)?.name ?? '—'
  const levelNum   = cls?.level ? parseInt(cls.level, 10) : null
  const chip       = levelNum ? (LEVEL_CHIP[levelNum] ?? null) : null
  const sc         = statusColors[student.status]

  return (
    <tr style={{ ...style, cursor: 'pointer', display: 'table-row' }} onClick={() => onView(student)}>
      <td style={TD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="sm" />
          <div>
            <div style={{ fontWeight: 700, color: 'var(--txt)', fontSize: 12.5, lineHeight: 1.3 }}>{student.firstName} {student.lastName}</div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)' }}>{student.gender ?? '—'} · {student.dob ? new Date(student.dob).getFullYear() : '—'}</div>
          </div>
        </div>
      </td>
      <td style={TD}><span style={{ fontFamily: 'var(--font3)', fontSize: 11.5, color: 'var(--txt3)' }}>{student.admissionNumber}</span></td>
      <td style={TD}>
        {className !== '—' ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: chip ? chip.bg : 'var(--surface2)', border: `.5px solid ${chip ? chip.border : 'var(--border)'}`, color: chip ? chip.text : 'var(--txt2)', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', whiteSpace: 'nowrap' }}>
            {className}
          </span>
        ) : '—'}
      </td>
      <td style={TD}>{streamName !== '—' ? <span style={{ fontSize: 12.5, color: 'var(--txt2)', fontWeight: 600 }}>{streamName}</span> : <span style={{ color: 'var(--txt3)', fontSize: 12 }}>—</span>}</td>
      <td style={TD}><span style={{ padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>{student.status.charAt(0).toUpperCase() + student.status.slice(1)}</span></td>
      <td style={{ ...TD, width: 140 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--info)', cursor: 'pointer', fontFamily: 'var(--font2)' }} onClick={e => { e.stopPropagation(); onView(student) }}>View</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand)', cursor: 'pointer', fontFamily: 'var(--font2)' }} onClick={e => { e.stopPropagation() }}>Edit</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet)', cursor: 'pointer', fontFamily: 'var(--font2)' }} onClick={e => { e.stopPropagation(); onPortal(student) }}>Portal</span>
        </div>
      </td>
    </tr>
  )
}

interface Props { onRegister: () => void; onImport: () => void; onView: (student: Student) => void }

export function StudentsPage({ onRegister, onImport, onView }: Props) {
  const [search,        setSearch]        = useState('')
  const [classId,       setClassId]       = useState('')
  const [streamId,      setStreamId]      = useState('')
  const [status,        setStatus]        = useState('')
  const [portalStudent, setPortalStudent] = useState<Student | null>(null)

  const filters: StudentFilters = useMemo(() => ({
    ...(classId  ? { classId }  : {}),
    ...(streamId ? { streamId } : {}),
    ...(status   ? { status: status as Student['status'] } : {}),
    ...(search   ? { search } : {}),
  }), [classId, streamId, status, search])

  const { data: students = [], isLoading } = useStudents(filters)
  const { data: classes  = [] }            = useClasses()
  const { data: streams  = [] }            = useStreams(classId || undefined)

  const handleClassChange = useCallback((v: string) => { setClassId(v); setStreamId('') }, [])

  const useVirtual = students.length > 50
  const parentRef  = useRef<HTMLDivElement>(null)
  const virtualiser = useVirtualizer({ count: students.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW_HEIGHT, overscan: 8, enabled: useVirtual })
  const isFiltered = !!(search || classId || streamId || status)

  const selStyle: React.CSSProperties = { padding: '7px 28px 7px 10px', fontSize: 12, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 9, color: 'var(--txt2)', appearance: 'none', outline: 'none', fontFamily: 'var(--font2)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Students</h1>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>{isLoading ? 'Loading…' : `${students.length} student${students.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onImport} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Import Excel
          </button>
          <button onClick={onRegister} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.4)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Register Student
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
        <div style={{ padding: '12px 14px', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 9, padding: '0 10px', height: 34 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission no…"
              style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', width: 200 }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>

          {[
            { value: classId, fn: handleClassChange, opts: [{ value: '', label: 'All Classes' }, ...classes.map(c => ({ value: c.id, label: c.name }))] },
            { value: streamId, fn: setStreamId, opts: [{ value: '', label: 'All Streams' }, ...streams.filter(s => !classId || s.classId === classId).map(s => ({ value: s.id, label: s.name }))] },
            { value: status, fn: setStatus, opts: [{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'expelled', label: 'Expelled' }] },
          ].map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <select value={f.value} onChange={e => f.fn(e.target.value)} style={selStyle}>
                {f.opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
          ))}

          {isFiltered && (
            <button onClick={() => { setSearch(''); setClassId(''); setStreamId(''); setStatus('') }}
              style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', padding: '0 4px' }}>
              Clear filters
            </button>
          )}

          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)' }}>{students.length} result{students.length !== 1 ? 's' : ''}</span>
        </div>

        {useVirtual ? (
          <div ref={parentRef} style={{ height: Math.min(students.length * ROW_HEIGHT + 1, 520), overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  {['Student', 'Adm. No.', 'Class', 'Stream', 'Status', ''].map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody style={{ height: virtualiser.getTotalSize(), position: 'relative', display: 'block' }}>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} style={{ height: ROW_HEIGHT, display: 'table-row' }}>
                        {[140, 100, 70, 60, 70, 60].map((w, j) => (
                          <td key={j} style={TD}><span className="shule-skeleton" style={{ display: 'block', height: 13, width: w }} /></td>
                        ))}
                      </tr>
                    ))
                  : students.length === 0
                  ? <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '40px 24px' }}>No students match your filters</td></tr>
                  : virtualiser.getVirtualItems().map(vRow => (
                      <StudentRow key={students[vRow.index].id} student={students[vRow.index]} classes={classes} streams={streams} onView={onView} onPortal={setPortalStudent}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: ROW_HEIGHT, transform: `translateY(${vRow.start}px)` }} />
                    ))
                }
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hscroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Student', 'Adm. No.', 'Class', 'Stream', 'Status', ''].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>{[140, 100, 70, 60, 70, 60].map((w, j) => <td key={j} style={TD}><span className="shule-skeleton" style={{ display: 'block', height: 13, width: w }} /></td>)}</tr>
                    ))
                  : students.length === 0
                  ? <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '40px 24px' }}>No students registered yet</td></tr>
                  : students.map(s => (
                      <StudentRow key={s.id} student={s} classes={classes} streams={streams} onView={onView} onPortal={setPortalStudent} style={{}} />
                    ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {portalStudent && <GenerateAccessModal student={portalStudent} onClose={() => setPortalStudent(null)} />}
    </div>
  )
}
