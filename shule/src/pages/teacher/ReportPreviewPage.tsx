import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useExamJournals } from '../../hooks/useExamJournal'
import { useExamResults } from '../../hooks/useExamResults'
import { calcCBC } from '../../types/app'
import { useStudents } from '../../hooks/useStudents'
import { useClasses } from '../../hooks/useClasses'

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--success)', B: 'var(--brand)', C: 'var(--info)', D: 'var(--warning)', E: 'var(--danger)',
}

// Preview student results for a given exam journal (read-only, no PDF generation).
export function ReportPreviewPage() {
  const [journalId, setJournalId] = useState('')

  const { data: journals = [], isLoading: journalsLoading } = useExamJournals({})
  const { data: results  = [], isLoading: resultsLoading  } = useExamResults(journalId || null)
  const { data: students = [] } = useStudents({}, true)
  const { data: classes  = [] } = useClasses()

  const classMap   = new Map(classes.map(c => [c.id, c.name]))
  const studentMap = new Map(students.map(s => [s.id, s]))

  const selectedJournal = journals.find(j => j.id === journalId)
  const isLoading = journalsLoading || (!!journalId && resultsLoading)

  const passed  = results.filter(r => !r.isAbsent && r.score != null && r.score >= (selectedJournal?.passMark ?? 50)).length
  const absent  = results.filter(r => r.isAbsent).length
  const passRate = results.length > 0 ? Math.round((passed / (results.length - absent || 1)) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <PageHeader
        title="Report Preview"
        subtitle="Preview student results for an exam journal."
      />

      <select className="sui-input" value={journalId} onChange={e => setJournalId(e.target.value)}>
        <option value="">Select exam journal…</option>
        {journals.map(j => (
          <option key={j.id} value={j.id}>{j.assessmentType} — Term {j.term} {j.year}</option>
        ))}
      </select>

      {!journalId && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)', fontSize: 13 }}>
          Select an exam journal to preview results.
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && journalId && selectedJournal && results.length > 0 && (
        <>
          {/* Journal metadata */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Type',       value: selectedJournal.assessmentType },
              { label: 'Term',       value: `T${selectedJournal.term} ${selectedJournal.year}` },
              { label: 'Total',      value: selectedJournal.totalMarks },
              { label: 'Pass Mark',  value: selectedJournal.passMark },
              { label: 'Pass Rate',  value: `${passRate}%` },
              { label: 'Absent',     value: absent },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{m.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font3)' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Results table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['Student', 'Adm No', 'Class', 'Score', 'Grade', 'Descriptor'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => {
                  const stu = studentMap.get(r.studentId)
                  const cbc = r.score != null ? calcCBC(0, 0, r.score) : null
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: r.isAbsent ? 'var(--txt3)' : 'var(--txt)' }}>
                        {stu ? `${stu.firstName} ${stu.lastName}` : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>
                        {stu?.admissionNumber ?? '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                        {stu?.classId ? classMap.get(stu.classId) ?? '—' : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font3)', color: 'var(--txt)' }}>
                        {r.isAbsent ? <span style={{ color: 'var(--warning)' }}>ABS</span> : (r.score ?? '—')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {cbc && !r.isAbsent ? (
                          <span style={{ fontSize: 16, fontWeight: 800, color: GRADE_COLOR[cbc.grade] ?? 'var(--txt)' }}>{cbc.grade}</span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>
                        {cbc && !r.isAbsent ? cbc.descriptor : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--txt3)' }}>
              {passed} passed · {absent} absent · {results.length} total
            </div>
          </div>
        </>
      )}

      {!isLoading && journalId && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)', fontSize: 13 }}>
          No marks entered for this journal yet.
        </div>
      )}
    </div>
  )
}
