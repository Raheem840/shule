import { useState, useMemo } from 'react'
import { useDosCurriculumPlan, useMarkTopicCovered } from '../../hooks/useDos'
import { useClasses, useSubjects } from '../../hooks/useClasses'

export function DosCurriculumPage() {
  const currentYear = new Date().getFullYear()
  const [classId,   setClassId]   = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [term,      setTerm]      = useState('')
  const [year,      setYear]      = useState(currentYear)

  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const { data: topics = [], isLoading, isError } = useDosCurriculumPlan(subjectId || null, classId || null)
  const markCovered = useMarkTopicCovered()

  const filtered = term ? topics.filter(t => String(t.term) === term) : topics
  const covered  = filtered.filter(t => t.coveredAt != null).length
  const total    = filtered.length
  const pct      = total > 0 ? Math.round((covered / total) * 100) : 0

  // Build heatmap: group topics by term × subject (if no subject filter) or term × sequence
  const heatmapData = useMemo(() => {
    const terms = ['1', '2', '3']
    return terms.map(t => {
      const tTopics = topics.filter(tp => String(tp.term) === t)
      const covCount = tTopics.filter(tp => tp.coveredAt != null).length
      const pct = tTopics.length > 0 ? (covCount / tTopics.length) : -1
      return { term: t, count: tTopics.length, covCount, pct }
    })
  }, [topics])

  const pctColor = (p: number) => {
    if (p < 0)   return { bg: 'var(--surface2)',           txt: 'var(--txt3)' }
    if (p >= .8) return { bg: 'rgba(16,185,129,.18)',      txt: 'var(--success)' }
    if (p >= .5) return { bg: 'rgba(245,158,11,.18)',      txt: 'var(--warning)' }
    if (p > 0)   return { bg: 'rgba(244,63,94,.14)',       txt: 'var(--danger)' }
    return               { bg: 'rgba(244,63,94,.08)',      txt: 'var(--danger)' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="12" y1="7" x2="12" y2="13"/><line x1="9" y1="10" x2="15" y2="10"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Curriculum Plan</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Track topic coverage across subjects and classes.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        {[
          { label: 'Class', val: classId, set: setClassId, opts: [['','Select class…'],...classes.map(c=>[c.id,c.name])] as [string,string][] },
          { label: 'Subject', val: subjectId, set: setSubjectId, opts: [['','Select subject…'],...subjects.map(s=>[s.id,s.name])] as [string,string][] },
          { label: 'Term', val: term, set: setTerm, opts: [['','All Terms'],['1','Term 1'],['2','Term 2'],['3','Term 3']] as [string,string][] },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ flex: '1 1 140px', minWidth: 130 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>{label}</div>
            <select value={val} onChange={e => set(e.target.value)} className="sui-input" style={{ width: '100%' }}>
              {opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        ))}
        <div style={{ flex: '0 0 88px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Year</div>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: '100%' }}>
            {[currentYear-1,currentYear,currentYear+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {(!classId || !subjectId) && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(139,92,246,.08)', border: '.5px solid rgba(139,92,246,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>Select a class and subject</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Choose from the filters above to view the curriculum plan.</div>
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 56, borderRadius: 10 }} />)}</div>}
      {isError && <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13 }}>Failed to load curriculum data.</div>}

      {!isLoading && !isError && classId && subjectId && (
        <>
          {/* Term heatmap */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 14 }}>Term Coverage Heatmap</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {heatmapData.map(({ term: t, count, covCount, pct: p }) => {
                const { bg, txt } = pctColor(p)
                return (
                  <div key={t} style={{ padding: '16px', borderRadius: 14, background: bg, border: `.5px solid ${txt}25`, textAlign: 'center', cursor: 'pointer', transition: 'all .14s' }}
                    onClick={() => setTerm(term === t ? '' : t)}
                    style={{ padding: '16px', borderRadius: 14, background: term === t ? bg : p >= 0 ? bg : 'var(--surface2)', border: `.5px solid ${term === t ? txt : 'var(--border)'}30`, textAlign: 'center', cursor: 'pointer', transition: 'all .14s', boxShadow: term === t ? `0 4px 16px ${txt}20` : 'none' } as React.CSSProperties}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Term {t}</div>
                    {p >= 0 ? (
                      <>
                        <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: txt, letterSpacing: -1, lineHeight: 1 }}>{Math.round(p * 100)}%</div>
                        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>{covCount}/{count} topics</div>
                        <div style={{ height: 4, borderRadius: 99, background: 'rgba(0,0,0,.08)', margin: '8px 0 0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p * 100}%`, background: txt, borderRadius: 99, transition: 'width .5s' }} />
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>No topics</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Overall progress */}
          {total > 0 && (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{covered} of {total} topics covered {term ? `· Term ${term}` : '· All Terms'}</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font3)', color: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', letterSpacing: -.5 }}>{pct}%</div>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 99, transition: 'width .6s' }} />
              </div>
            </div>
          )}

          {/* Topics table */}
          {total === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--txt3)', fontSize: 13, background: 'var(--surface)', borderRadius: 14, border: '.5px solid var(--border)' }}>No curriculum topics found for this selection.</div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
              <div className="hscroll">
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600 }}>
                  <thead>
                    <tr>
                      {['Topic', 'Term', 'Planned Date', 'Covered At', 'Status'].map(h => (
                        <th key={h} style={{ padding: '11px 14px', background: 'var(--surface2)', fontWeight: 700, fontSize: 10.5, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, borderBottom: '.5px solid var(--border)', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.id} style={{ borderBottom: '.5px solid var(--border)', background: t.coveredAt ? 'rgba(16,185,129,.02)' : 'transparent' }}>
                        <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: t.coveredAt ? 'var(--txt3)' : 'var(--txt)', textDecoration: t.coveredAt ? 'line-through' : 'none', maxWidth: 280 }}>{t.topicName ?? '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--txt2)', whiteSpace: 'nowrap' }}>Term {t.term}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)', whiteSpace: 'nowrap' }}>{t.plannedDate ? new Date(t.plannedDate).toLocaleDateString('en-UG') : '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--font3)', whiteSpace: 'nowrap' }}>{t.coveredAt ? new Date(t.coveredAt).toLocaleDateString('en-UG') : '—'}</td>
                        <td style={{ padding: '11px 14px' }}>
                          {t.coveredAt ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.25)', whiteSpace: 'nowrap' }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>Covered
                            </span>
                          ) : (
                            <button disabled={markCovered.isPending} onClick={() => { void markCovered.mutateAsync(t.id) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 9, border: 'none', background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', color: '#fff', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', boxShadow: '0 2px 8px rgba(139,92,246,.35)', whiteSpace: 'nowrap' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="20 6 9 17 4 12"/></svg>Mark Covered
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
