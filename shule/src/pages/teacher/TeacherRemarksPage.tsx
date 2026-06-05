import { useState, useEffect, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTeacherRemarks, useSaveRemarks } from '../../hooks/useTeacherRemarks'
import { useStudents } from '../../hooks/useStudents'
import type { Student } from '../../types/app'

const CURRENT_YEAR = new Date().getFullYear()
const MAX_CHARS = 200

function RemarkRow({ student, value, saved, onChange }: {
  student: Student; value: string; saved: boolean
  onChange: (studentId: string, text: string) => void
}) {
  const remaining = MAX_CHARS - value.length
  const ini = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div style={{ padding: '12px 16px', borderBottom: '.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9, background: saved ? 'rgba(16,185,129,.03)' : 'transparent', transition: 'background .15s' }}>
      {/* Student info + saved indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(145deg,rgba(13,148,136,.18),rgba(13,148,136,.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 900, color: 'var(--brand)', flexShrink: 0, fontFamily: 'var(--font2)', border: '.5px solid rgba(13,148,136,.2)' }}>{ini}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.firstName} {student.lastName}</div>
            <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>{student.admissionNumber}</div>
          </div>
        </div>
        {saved ? (
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        ) : value.length > 0 ? (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />
        ) : null}
      </div>
      {/* Textarea */}
      <div>
        <textarea value={value} onChange={e => onChange(student.id, e.target.value.slice(0, MAX_CHARS))} rows={2}
          placeholder="Write a remark for this student…"
          style={{ width: '100%', padding: '9px 12px', border: `.5px solid ${value.length === 0 ? 'rgba(245,158,11,.5)' : 'var(--border)'}`, borderRadius: 10, fontSize: 13, resize: 'vertical', background: 'var(--surface)', color: 'var(--txt)', lineHeight: 1.55, outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s', fontFamily: 'inherit' }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--brand)')}
          onBlur={e => (e.currentTarget.style.borderColor = value.length === 0 ? 'rgba(245,158,11,.5)' : 'var(--border)')}
        />
        <div style={{ fontSize: 10, color: remaining < 20 ? 'var(--danger)' : 'var(--txt3)', textAlign: 'right', marginTop: 3 }}>{remaining} left</div>
      </div>
    </div>
  )
}

export function TeacherRemarksPage() {
  const [term,     setTerm]     = useState('')
  const [classId,  setClassId]  = useState('')
  const [streamId, setStreamId] = useState('')
  const [remarks,  setRemarks]  = useState<Map<string, string>>(new Map())
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set())

  const classes                = useMyAssignedClasses()
  const { data: streams = [] } = useStreams(classId || null)
  const { data: students = [], isLoading: studentsLoading } = useStudents({ classId: classId || undefined, streamId: streamId || undefined, status: 'active' })
  const { data: savedRemarks, isLoading: remarksLoading } = useTeacherRemarks({ term: term || null, classId: classId || null, streamId: streamId || null, year: CURRENT_YEAR })
  const saveRemarks = useSaveRemarks()

  useEffect(() => {
    if (!savedRemarks) return
    setRemarks(prev => {
      const next = new Map(prev)
      for (const [sid, remark] of savedRemarks) {
        if (!dirtyIds.has(sid)) next.set(sid, remark.remarks)
      }
      return next
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRemarks])

  const handleChange = (studentId: string, text: string) => {
    setRemarks(prev => new Map(prev).set(studentId, text))
    setDirtyIds(prev => new Set(prev).add(studentId))
  }

  async function handleSaveAll() {
    if (!classId || !term) return
    const rows = students.filter(s => (remarks.get(s.id) ?? '').trim().length > 0).map(s => ({ studentId: s.id, remarks: remarks.get(s.id)!.trim() }))
    await saveRemarks.mutateAsync({ term, year: CURRENT_YEAR, classId, streamId: streamId || null, rows })
    setDirtyIds(new Set())
  }

  const savedSet      = new Set<string>(savedRemarks?.keys() ?? [])
  const withRemarks   = students.filter(s => (remarks.get(s.id) ?? '').trim().length > 0).length
  const withoutRemarks = students.length - withRemarks
  const ready         = !!term && !!classId && students.length > 0
  const isLoading     = studentsLoading || remarksLoading

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirt = useVirtualizer({ count: students.length, getScrollElement: () => parentRef.current, estimateSize: () => 90, overscan: 8 })

  const canSave = ready && !saveRemarks.isPending

  function exportCsv() {
    const header = 'Name,Admission No,Class,Stream,Term,Remarks\n'
    const rows = students.map(s => {
      const cls  = classes.find(c => c.id === classId)?.name ?? ''
      const strm = streams.find(st => st.id === streamId)?.name ?? ''
      const rem  = (remarks.get(s.id) ?? '').replace(/"/g, '""')
      return `"${s.firstName} ${s.lastName}","${s.admissionNumber}","${cls}","${strm}","Term ${term}","${rem}"`
    }).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `remarks-T${term}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Teacher Remarks</h1>
              <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Write a remark for each student before report cards are generated.</p>
            </div>
          </div>
          {ready && students.length > 0 && (
            <button onClick={exportCsv}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all .15s', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          )}
          <button disabled={!canSave} onClick={() => { void handleSaveAll() }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 11, border: 'none', background: canSave ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'var(--surface2)', color: canSave ? '#fff' : 'var(--txt3)', fontWeight: 700, fontSize: 13.5, cursor: canSave ? 'pointer' : 'default', boxShadow: canSave ? '0 4px 14px rgba(13,148,136,.4)' : 'none', transition: 'all .18s', flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            {saveRemarks.isPending ? 'Saving…' : 'Save All Remarks'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        {[
          { label: 'Term', val: term, set: setTerm, opts: [['','Select term'],['1','Term 1'],['2','Term 2'],['3','Term 3']] as [string,string][] },
          { label: 'Class', val: classId, set: setClassId, opts: [['','Select class'],...classes.map(c => [c.id, c.name])] as [string,string][] },
          { label: 'Stream', val: streamId, set: setStreamId, opts: [['','All streams'],...streams.map(s => [s.id, s.name])] as [string,string][], disabled: !classId },
        ].map(({ label, val, set, opts, disabled }) => (
          <div key={label} style={{ flex: '1 1 130px', minWidth: 120 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} disabled={disabled} className="sui-input" style={{ width: '100%', opacity: disabled ? .5 : 1 }}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* Progress */}
      {ready && !isLoading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', padding: '14px 18px', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>With Remarks</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--success)', letterSpacing: -1 }}>{withRemarks}</div>
          </div>
          <div style={{ flex: '1 1 140px', padding: '14px 18px', background: 'var(--surface)', border: `.5px solid ${withoutRemarks > 0 ? 'rgba(245,158,11,.3)' : 'var(--border)'}`, borderRadius: 14, background: withoutRemarks > 0 ? 'rgba(245,158,11,.04)' : 'var(--surface)' } as React.CSSProperties}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Missing</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: withoutRemarks > 0 ? 'var(--warning)' : 'var(--success)', letterSpacing: -1 }}>{withoutRemarks}</div>
          </div>
          <div style={{ flex: '2 1 200px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7 }}>Completion</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{students.length > 0 ? Math.round((withRemarks / students.length) * 100) : 0}%</div>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: students.length > 0 ? `${(withRemarks / students.length) * 100}%` : '0%', background: 'var(--brand)', borderRadius: 99, transition: 'width .5s' }} />
            </div>
          </div>
        </div>
      )}

      {saveRemarks.isError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 13 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {(saveRemarks.error as Error).message}
        </div>
      )}

      {!ready && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(145deg,rgba(13,148,136,.12),rgba(13,148,136,.04))', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>Select a term and class to get started</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Choose from the filters above to load your students.</div>
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 12 }} />)}</div>}

      {ready && !isLoading && students.length === 0 && (
        <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>No active students found in this class.</div>
      )}

      {ready && !isLoading && students.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)' }}>
            {['Student & Remarks', 'Chars'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7 }}>{h}</div>
            ))}
          </div>
          <div ref={parentRef} style={{ maxHeight: 560, overflowY: 'auto' }}>
            <div style={{ height: rowVirt.getTotalSize(), position: 'relative' }}>
              {rowVirt.getVirtualItems().map(vRow => {
                const student = students[vRow.index]
                const value   = remarks.get(student.id) ?? ''
                const isSaved = savedSet.has(student.id) && !dirtyIds.has(student.id)
                return (
                  <div key={student.id} style={{ position: 'absolute', top: vRow.start, left: 0, right: 0, height: vRow.size }}>
                    <RemarkRow student={student} value={value} saved={isSaved} onChange={handleChange} />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
