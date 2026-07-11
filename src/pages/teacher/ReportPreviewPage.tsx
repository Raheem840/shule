import { useState } from 'react'
import { useClasses }        from '../../hooks/useClasses'
import { useStudents }       from '../../hooks/useStudents'
import { useReportCards }    from '../../hooks/useReportCards'
import { useTeacherRemarks } from '../../hooks/useTeacherRemarks'
import { useExamResultsForJournals } from '../../hooks/useExamResults'
import { useExamJournals }   from '../../hooks/useExamJournal'
import type { ExamJournal } from '../../types/app'
import { calcCBC }           from '../../types/app'
import { Avatar }            from '../../components/shared/Avatar'
import type { ReportCardStatus } from '../../types/app'

const CURRENT_YEAR = new Date().getFullYear()

const STATUS_META: Record<ReportCardStatus, { color: string; bg: string; label: string }> = {
  draft:    { color: '#64748b', bg: 'var(--surface2)',           label: 'Draft'    },
  ready:    { color: '#f59e0b', bg: 'rgba(245,158,11,.1)',       label: 'Ready'    },
  approved: { color: '#0d9488', bg: 'rgba(13,148,136,.1)',       label: 'Approved' },
  released: { color: '#10b981', bg: 'rgba(16,185,129,.1)',       label: 'Released' },
}

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--success)', B: 'var(--brand)', C: 'var(--info)', D: 'var(--warning)', E: 'var(--danger)',
}

function ScoresTable({ studentId, journalIds, journalsById }: {
  studentId: string; journalIds: string[]; journalsById: Map<string, ExamJournal>
}) {
  // Fetches across ALL of the class's journals for this term, not just the
  // first one — a class always has more than one subject's journal, and the
  // previous single-journal fetch meant every subject but the first silently
  // never appeared in this preview.
  const { data: results = [], isLoading } = useExamResultsForJournals(journalIds)
  if (isLoading) return <div className="shule-skeleton" style={{ height: 40, borderRadius: 8 }} />
  const myResults = results.filter(r => r.studentId === studentId)
  if (myResults.length === 0) return <div style={{ fontSize: 12, color: 'var(--txt3)', padding: '8px 0' }}>No marks entered yet</div>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr>
          {['Subject', 'Score', 'Grade', 'Descriptor'].map(h => (
            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {myResults.map(r => {
          const journal = journalsById.get(r.examJournalId)
          // A single result's raw score is only a valid CBC exam grade when
          // it's an end-of-term (out-of-80) journal — a CA result's score is
          // 0-3 per competency and would produce a nonsensical grade if fed
          // into calcCBC's examScore param directly (the exact CA-percentage
          // bug class fixed elsewhere this session, applied here too).
          const isEndOfTerm = journal?.assessmentType === 'end_of_term'
          const cbc = isEndOfTerm && r.score != null ? calcCBC(0, 0, r.score) : null
          return (
            <tr key={r.id} style={{ borderBottom: '.5px solid var(--border)' }}>
              <td style={{ padding: '6px 10px', color: 'var(--txt2)' }}>{journal?.name ?? '—'}</td>
              <td style={{ padding: '6px 10px', fontWeight: 700, fontFamily: 'var(--font3)', color: r.isAbsent ? 'var(--warning)' : 'var(--txt)' }}>{r.isAbsent ? 'ABS' : (r.score ?? '—')}</td>
              <td style={{ padding: '6px 10px' }}>{cbc && !r.isAbsent ? <span style={{ fontWeight: 800, fontSize: 14, color: GRADE_COLOR[cbc.grade] ?? 'var(--txt)' }}>{cbc.grade}</span> : '—'}</td>
              <td style={{ padding: '6px 10px', color: 'var(--txt2)' }}>{cbc && !r.isAbsent ? cbc.descriptor : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function ReportPreviewPage() {
  const [classId,  setClassId]  = useState('')
  const [term,     setTerm]     = useState(1)
  const [year,     setYear]     = useState(CURRENT_YEAR)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: classes  = [] } = useClasses()
  const { data: students = [] } = useStudents({ classId: classId || undefined })
  const { data: journals = [] } = useExamJournals({ classId: classId || undefined, term: String(term) })
  const { data: reportCards = [], isLoading: rcLoading } = useReportCards({ term: String(term), year, classId: classId || undefined }, !!classId)
  const { data: remarks } = useTeacherRemarks({ term: String(term), year, classId: classId || undefined, streamId: null })

  const rcMap       = new Map(reportCards.map(r => [r.studentId, r]))
  const journalIds  = journals.map(j => j.id)
  const journalsById = new Map(journals.map(j => [j.id, j]))
  const isLoading  = !!classId && rcLoading

  const toggle = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const releasedCount = reportCards.filter(r => r.status === 'released').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* Header */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.18),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Report Card Preview</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Read-only preview of your students' report cards.</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 180px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Class</div>
          <select value={classId} onChange={e => setClassId(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            <option value="">Select a class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Term</div>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 10, padding: 3, border: '.5px solid var(--border)' }}>
            {([1, 2, 3] as const).map(t => (
              <button key={t} onClick={() => setTerm(t)}
                style={{ padding: '6px 14px', border: 'none', borderRadius: 8, background: term === t ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'transparent', color: term === t ? '#fff' : 'var(--txt3)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', transition: 'all .15s', boxShadow: term === t ? '0 2px 8px rgba(13,148,136,.35)' : 'none' }}>
                T{t}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: '0 0 88px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Year</div>
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="sui-input" style={{ width: '100%' }} />
        </div>
        {classId && reportCards.length > 0 && (
          <div style={{ padding: '8px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.25)', flexShrink: 0 }}>
            {releasedCount}/{reportCards.length} released
          </div>
        )}
      </div>

      {!classId && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(13,148,136,.08)', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>Select a class</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Choose a class above to preview report cards for this term.</div>
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 64, borderRadius: 14 }} />)}</div>}

      {!isLoading && classId && students.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>No students found in this class.</div>
      )}

      {!isLoading && classId && students.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {students.map(stu => {
            const rc      = rcMap.get(stu.id) ?? null
            const remark  = remarks?.get(stu.id)
            const excerpt = remark ? remark.remarks.slice(0, 120) + (remark.remarks.length > 120 ? '…' : '') : ''
            const isOpen  = expanded.has(stu.id)
            const meta    = rc ? STATUS_META[rc.status] : null

            return (
              <div key={stu.id} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, overflow: 'hidden', transition: 'box-shadow .14s' }}>
                <div onClick={() => toggle(stu.id)} style={{ padding: '14px 18px', background: isOpen ? 'rgba(13,148,136,.02)' : 'var(--surface2)', borderBottom: isOpen ? '.5px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer' }}>
                  <Avatar photoPath={stu.photoUrl} bucket="student-photos" name={`${stu.firstName} ${stu.lastName}`} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stu.firstName} {stu.lastName}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginTop: 1 }}>{stu.admissionNumber}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {meta ? (
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, border: `.5px solid ${meta.color}30` }}>{meta.label}</span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt3)', border: '.5px solid var(--border)' }}>No Card</span>
                    )}
                    {rc?.status === 'released' && rc.pdfUrl && (
                      <a href={rc.pdfUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', borderRadius: 9, fontSize: 11, fontWeight: 700, textDecoration: 'none', boxShadow: '0 2px 8px rgba(13,148,136,.35)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        PDF
                      </a>
                    )}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5" style={{ transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {excerpt && (
                      <div style={{ fontSize: 12.5, color: 'var(--txt2)', fontStyle: 'italic', padding: '10px 14px', background: 'var(--surface2)', borderRadius: 10, borderLeft: '3px solid var(--brand)' }}>
                        "{excerpt}"
                      </div>
                    )}
                    {journalIds.length > 0 ? (
                      <ScoresTable studentId={stu.id} journalIds={journalIds} journalsById={journalsById} />
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No exam journals for Term {term} {year}</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
