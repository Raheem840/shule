import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useDosCurriculumPlan } from '../../hooks/useDos'
import { useClasses, useSubjects } from '../../hooks/useClasses'

export function DosCurriculumPage() {
  const [classId,   setClassId]   = useState('')
  const [subjectId, setSubjectId] = useState('')

  const { data: classes  = [] } = useClasses()
  const { data: subjects = [] } = useSubjects()
  const { data: topics   = [], isLoading, isError } = useDosCurriculumPlan(
    subjectId || null,
    classId   || null
  )

  const covered   = topics.filter(t => t.coveredAt != null).length
  const total     = topics.length
  const pct       = total > 0 ? Math.round((covered / total) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Curriculum Plan"
        subtitle="Track topic coverage across subjects and classes."
      />

      {/* Selectors */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <select className="sui-input" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="sui-input" value={subjectId} onChange={e => setSubjectId(e.target.value)}>
          <option value="">Select subject…</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {(!classId || !subjectId) && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)', fontSize: 13 }}>
          Select a class and subject to view the curriculum plan.
        </div>
      )}

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}
      {isError   && <div style={{ color: 'var(--danger)', padding: 16 }}>Failed to load curriculum data.</div>}

      {!isLoading && !isError && total > 0 && (
        <>
          {/* Progress summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Coverage Progress</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', borderRadius: 4, transition: 'width 0.5s' }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>{covered} of {total} topics covered</div>
          </div>

          {/* Topics table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Topic', 'NCDC Code', 'Term', 'Planned', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topics.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{t.sequenceOrder}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{t.topicName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{t.ncdcCode ?? '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{t.term}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt3)' }}>
                      {t.plannedDate ? new Date(t.plannedDate).toLocaleDateString('en-UG') : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {t.coveredAt ? (
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>Covered</span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt3)' }}>Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isLoading && !isError && classId && subjectId && total === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)', fontSize: 13 }}>
          No curriculum topics found for this class and subject.
        </div>
      )}
    </div>
  )
}
