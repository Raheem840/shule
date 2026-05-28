import { useState } from 'react'
import { PageHeader }      from '../../components/ui/PageHeader'
import { LoadingSpinner }  from '../../components/ui/LoadingSpinner'
import { Badge }           from '../../components/ui/Badge'
import { useClasses }      from '../../hooks/useClasses'
import { useStudents }     from '../../hooks/useStudents'
import { useReportCards }  from '../../hooks/useReportCards'
import { useTeacherRemarks } from '../../hooks/useTeacherRemarks'
import { useExamResults }  from '../../hooks/useExamResults'
import { useExamJournals } from '../../hooks/useExamJournal'
import { calcCBC }         from '../../types/app'
import { Avatar } from '../../components/shared/Avatar'
import type { ReportCardStatus } from '../../types/app'

const CURRENT_YEAR = new Date().getFullYear()

const STATUS_VARIANT: Record<ReportCardStatus, 'muted' | 'amber' | 'teal' | 'green'> = {
  draft:    'muted',
  ready:    'amber',
  approved: 'teal',
  released: 'green',
}
const STATUS_LABEL: Record<ReportCardStatus, string> = {
  draft:    'Draft',
  ready:    'Ready',
  approved: 'Approved',
  released: 'Released',
}

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--success)', B: 'var(--brand)', C: 'var(--info)', D: 'var(--warning)', E: 'var(--danger)',
}

// ── Main page ─────────────────────────────────────────────────
export function ReportPreviewPage() {
  const [classId,  setClassId]  = useState('')
  const [term,     setTerm]     = useState(1)
  const [year,     setYear]     = useState(CURRENT_YEAR)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const { data: classes  = [] }  = useClasses()
  const { data: students = [] }  = useStudents({ classId: classId || undefined })
  const { data: journals = [] }  = useExamJournals({ classId: classId || undefined, term: String(term) })

  const { data: reportCards = [], isLoading: rcLoading } = useReportCards(
    { term, year, classId: classId || undefined },
    !!classId,
  )
  const { data: remarks } = useTeacherRemarks({
    term:    String(term),
    year,
    classId: classId || undefined,
    streamId: null,
  })

  const rcMap     = new Map(reportCards.map(r => [r.studentId, r]))
  const journalIds = journals.map(j => j.id)

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isLoading = !!classId && rcLoading

  const selectStyle = {
    padding: '0.38rem 0.85rem', border: '1.5px solid var(--border)',
    borderRadius: 'var(--r)', background: 'var(--surface)',
    color: 'var(--txt)', fontSize: 13, outline: 'none',
  }

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <PageHeader
        title="Report Card Preview"
        subtitle="Read-only preview of report cards for your class"
      />

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={selectStyle} value={classId} onChange={e => { setClassId(e.target.value) }}>
          <option value="">Select a class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 20, padding: 3 }}>
          {([1, 2, 3] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTerm(t)}
              style={{
                padding: '0.22rem 0.75rem', border: 'none', borderRadius: 20,
                background: term === t ? 'var(--brand)' : 'transparent',
                color: term === t ? '#fff' : 'var(--txt3)',
                fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >T{t}</button>
          ))}
        </div>
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          aria-label="Year"
          style={{ width: 72, padding: '0.28rem 0.6rem', border: '1.5px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--surface)', color: 'var(--txt)', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, outline: 'none' }}
        />
      </div>

      {!classId && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--txt3)', fontSize: 13 }}>
          Select a class above to preview report cards
        </div>
      )}

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <LoadingSpinner size="lg" />
        </div>
      )}

      {!isLoading && classId && students.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)', fontSize: 13 }}>
          No students found in this class.
        </div>
      )}

      {!isLoading && classId && students.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {students.map(stu => {
            const rc           = rcMap.get(stu.id) ?? null
            const remark       = remarks?.get(stu.id)
            const remarkExcerpt = remark ? remark.remarks.slice(0, 100) + (remark.remarks.length > 100 ? '…' : '') : ''
            const isExpanded   = expanded.has(stu.id)

            return (
              <div key={stu.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-lg)', overflow: 'hidden',
              }}>
                {/* Header row */}
                <div
                  style={{
                    padding: '0.85rem 1rem',
                    background: 'var(--surface2)',
                    borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleExpand(stu.id)}
                >
                  <Avatar
                    photoPath={stu.photoUrl}
                    bucket="student-photos"
                    name={`${stu.firstName} ${stu.lastName}`}
                    size="md"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
                      {stu.firstName} {stu.lastName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                      {stu.admissionNumber}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {rc ? (
                      <Badge variant={STATUS_VARIANT[rc.status]} size="sm">{STATUS_LABEL[rc.status]}</Badge>
                    ) : (
                      <Badge variant="muted" size="sm">No Report Card</Badge>
                    )}
                    {rc?.status === 'released' && rc.pdfUrl && (
                      <a
                        href={rc.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          padding: '3px 10px', background: 'var(--brand)', color: '#fff',
                          borderRadius: 'var(--r)', fontSize: 11, fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        Download PDF
                      </a>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {remarkExcerpt && (
                      <div style={{ fontSize: 12, color: 'var(--txt2)', fontStyle: 'italic', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 'var(--r)' }}>
                        Teacher's Remarks: "{remarkExcerpt}"
                      </div>
                    )}

                    {journalIds.length > 0 ? (
                      <ScoresTableForStudent studentId={stu.id} journalIds={journalIds} />
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

// ── Per-student scores fetched in-line ─────────────────────────
function ScoresTableForStudent({ studentId, journalIds }: { studentId: string; journalIds: string[] }) {
  const allJournalFirst = journalIds[0] ?? null
  const { data: results = [], isLoading } = useExamResults(allJournalFirst)

  if (isLoading) return <LoadingSpinner size="sm" />

  // NOTE: useExamResults fetches for one journalId at a time.
  // For preview we show results from the first journal as a sample.
  const myResults = results.filter(r => r.studentId === studentId)

  if (myResults.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--txt3)' }}>No marks entered yet</div>
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: 'var(--surface2)' }}>
          {['Score', 'Grade', 'Descriptor'].map(h => (
            <th key={h} style={{ padding: '5px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {myResults.map(r => {
          const cbc = r.score != null ? calcCBC(0, 0, r.score) : null
          return (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '5px 10px', fontWeight: 700, fontFamily: 'var(--font3)', color: r.isAbsent ? 'var(--warning)' : 'var(--txt)' }}>
                {r.isAbsent ? 'ABS' : (r.score ?? '—')}
              </td>
              <td style={{ padding: '5px 10px' }}>
                {cbc && !r.isAbsent ? (
                  <span style={{ fontWeight: 800, color: GRADE_COLOR[cbc.grade] ?? 'var(--txt)' }}>{cbc.grade}</span>
                ) : '—'}
              </td>
              <td style={{ padding: '5px 10px', color: 'var(--txt2)' }}>
                {cbc && !r.isAbsent ? cbc.descriptor : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
