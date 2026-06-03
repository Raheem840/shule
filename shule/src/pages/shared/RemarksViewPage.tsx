/**
 * RemarksViewPage — Read-only teacher remarks browser.
 * Available at /principal/remarks, /deputy/remarks, /dos/remarks.
 * Shows all teacher remarks for a selected term+year, grouped by class.
 * No writing — use TeacherRemarksPage for that.
 */
import { useState, useMemo } from 'react'
import { useStudents } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useAllTeacherRemarks } from '../../hooks/useTeacherRemarks'
import { useStaff } from '../../hooks/useStaff'

export function RemarksViewPage() {
  const currentYear = new Date().getFullYear()
  const [term,        setTerm]        = useState('1')
  const [year,        setYear]        = useState(currentYear)
  const [filterClass, setFilterClass] = useState('')
  const [filterStream, setFilterStream] = useState('')
  const [search,      setSearch]      = useState('')

  const { data: allStudents = [], isLoading: studentsLoading } = useStudents()
  const { data: classes = [] }  = useClasses()
  const { data: streams = [] }  = useStreams()
  const { data: staff = [] }    = useStaff()
  const { data: remarksMap = new Map(), isLoading: remarksLoading } = useAllTeacherRemarks({ term, year })

  // Build lookup maps
  const classMap  = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])
  const streamMap = useMemo(() => new Map(streams.map(s => [s.id, s.name])), [streams])
  const staffMap  = useMemo(() => new Map(staff.map(s => [s.id, `${s.firstName} ${s.lastName}`])), [staff])

  // Filter students to those that have remarks OR match class/stream filter
  const filteredStudents = useMemo(() => {
    let list = allStudents
    if (filterClass)  list = list.filter(s => s.classId  === filterClass)
    if (filterStream) list = list.filter(s => s.streamId === filterStream)
    if (search) {
      const t = search.toLowerCase()
      list = list.filter(s =>
        s.firstName.toLowerCase().includes(t) ||
        s.lastName.toLowerCase().includes(t) ||
        s.admissionNumber.toLowerCase().includes(t)
      )
    }
    // Only show students that actually have remarks for this term+year (unless search/filter active)
    if (!filterClass && !filterStream && !search) {
      list = list.filter(s => remarksMap.has(s.id))
    }
    return list
  }, [allStudents, filterClass, filterStream, search, remarksMap])

  const filteredStreams = filterClass
    ? streams.filter(s => s.classId === filterClass)
    : streams

  const totalWithRemarks = filteredStudents.filter(s => remarksMap.has(s.id)).length
  const isLoading = studentsLoading || remarksLoading

  return (
    <div className="sui-page-enter" style={{ padding: '0 0 80px' }}>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 60%, #5b21b6 100%)',
        padding: '32px 28px 36px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)', letterSpacing: -.4 }}>Teacher Remarks</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,.75)' }}>Read-only view of all teacher remarks per student</p>
            </div>
          </div>
          {/* Term/Year selectors */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: .7 }}>Term</label>
              <select value={term} onChange={e => setTerm(e.target.value)}
                style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                <option value="1" style={{ color: '#000' }}>Term 1</option>
                <option value="2" style={{ color: '#000' }}>Term 2</option>
                <option value="3" style={{ color: '#000' }}>Term 3</option>
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', textTransform: 'uppercase', letterSpacing: .7 }}>Year</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || currentYear)}
                style={{ padding: '7px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,.3)', background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 13, fontWeight: 700, outline: 'none', width: 80, fontFamily: 'var(--font3)', backdropFilter: 'blur(8px)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
              <div style={{ padding: '8px 18px', borderRadius: 99, background: 'rgba(255,255,255,.18)', fontSize: 13, fontWeight: 800, color: '#fff', border: '1px solid rgba(255,255,255,.25)' }}>
                {remarksLoading ? '—' : totalWithRemarks} with remarks
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Filters ───────────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '16px 18px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search student name or admission no…"
            className="sui-input"
            style={{ flex: '1 1 200px', minWidth: 160 }}
          />
          <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterStream('') }} className="sui-input" style={{ flex: '0 0 auto' }}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filterClass && filteredStreams.length > 0 && (
            <select value={filterStream} onChange={e => setFilterStream(e.target.value)} className="sui-input" style={{ flex: '0 0 auto' }}>
              <option value="">All Streams</option>
              {filteredStreams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          {(filterClass || filterStream || search) && (
            <button onClick={() => { setFilterClass(''); setFilterStream(''); setSearch('') }}
              style={{ padding: '8px 14px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
              Clear
            </button>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3,4].map(i => <div key={i} className="shule-skeleton" style={{ height: 90, borderRadius: 14 }} />)}
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(139,92,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>
              {remarksMap.size === 0 ? 'No remarks recorded yet' : 'No students match your filters'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
              {remarksMap.size === 0
                ? `Teachers haven't submitted remarks for Term ${term}, ${year} yet.`
                : 'Try adjusting your search or class filter.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredStudents.map(s => {
              const remarks = remarksMap.get(s.id) ?? []
              const hasRemark = remarks.length > 0
              const cName = classMap.get(s.classId ?? '') ?? '—'
              const sName = streamMap.get(s.streamId ?? '') ?? null

              return (
                <div key={s.id} style={{
                  background: 'var(--surface)', border: `.5px solid ${hasRemark ? 'var(--border)' : 'var(--border)'}`,
                  borderRadius: 16, overflow: 'hidden',
                  boxShadow: hasRemark ? '0 2px 12px rgba(0,0,0,.05)' : 'none',
                  opacity: hasRemark ? 1 : .55,
                }}>
                  {/* Student row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: hasRemark ? '.5px solid var(--border)' : 'none' }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                      background: s.gender === 'female' ? 'rgba(236,72,153,.15)' : 'rgba(14,165,233,.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, fontFamily: 'var(--font2)',
                      color: s.gender === 'female' ? '#ec4899' : '#0ea5e9',
                    }}>
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>{s.firstName} {s.lastName}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                        {s.admissionNumber} · {cName}{sName ? ` · ${sName}` : ''}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {hasRemark ? (
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(139,92,246,.1)', color: '#8b5cf6', border: '.5px solid rgba(139,92,246,.2)' }}>
                          {remarks.length} remark{remarks.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', color: 'var(--txt3)', border: '.5px solid var(--border)' }}>
                          No remarks
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remarks */}
                  {hasRemark && (
                    <div style={{ padding: '12px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {remarks.map((r, i) => {
                        const teacherName = staffMap.get(r.teacherId) ?? 'Unknown Teacher'
                        return (
                          <div key={r.id ?? i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(139,92,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, fontWeight: 900, color: '#8b5cf6', fontFamily: 'var(--font2)' }}>
                              {teacherName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '10px 14px', border: '.5px solid var(--border)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', marginBottom: 5 }}>{teacherName}</div>
                              <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{r.remarks || <span style={{ color: 'var(--txt3)', fontStyle: 'italic' }}>No text entered.</span>}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
