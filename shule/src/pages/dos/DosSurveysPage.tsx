import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'

type SurveyResponse = {
  id: string
  studentName: string
  className: string
  overallRating: number
  teacherRating: number
  hardestSubject: string | null
  favouriteSubject: string | null
  suggestions: string | null
  submittedAt: string
}

type SurveySummary = {
  total: number
  avgOverall: number
  avgTeacher: number
  hardestSubjects: { name: string; count: number }[]
  favouriteSubjects: { name: string; count: number }[]
}

function useSurveyResponses(term: string, year: number) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['survey-responses', user?.schoolId, term, year],
    enabled: !!user,
    queryFn: async (): Promise<{ responses: SurveyResponse[]; summary: SurveySummary }> => {
      const { data, error } = await supabase
        .from('student_surveys')
        .select(`
          id, overall_rating, teacher_rating,
          hardest_subject_id, favourite_subject_id,
          suggestions, created_at, term, year,
          student_id
        `)
        .eq('school_id', user!.schoolId)
        .eq('term', term)
        .eq('year', year)
        .order('created_at', { ascending: false })

      // student_surveys may not exist yet
      if (error?.code === '42P01') {
        return { responses: [], summary: { total: 0, avgOverall: 0, avgTeacher: 0, hardestSubjects: [], favouriteSubjects: [] } }
      }
      if (error) throw error

      const rows = data ?? []
      const responses: SurveyResponse[] = rows.map((r: any) => ({
        id:               r.id,
        studentName:      `Student ${r.student_id?.slice(0, 8) ?? 'Unknown'}`,
        className:        '—',
        overallRating:    r.overall_rating ?? 0,
        teacherRating:    r.teacher_rating ?? 0,
        hardestSubject:   r.hardest_subject_id ?? null,
        favouriteSubject: r.favourite_subject_id ?? null,
        suggestions:      r.suggestions ?? null,
        submittedAt:      r.created_at,
      }))

      const total      = responses.length
      const avgOverall = total > 0 ? Math.round((responses.reduce((s, r) => s + r.overallRating, 0) / total) * 10) / 10 : 0
      const avgTeacher = total > 0 ? Math.round((responses.reduce((s, r) => s + r.teacherRating, 0) / total) * 10) / 10 : 0

      function topItems(items: (string | null)[]): { name: string; count: number }[] {
        const counts: Record<string, number> = {}
        for (const i of items) { if (i) counts[i] = (counts[i] ?? 0) + 1 }
        return Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }))
      }

      return {
        responses,
        summary: {
          total,
          avgOverall,
          avgTeacher,
          hardestSubjects:   topItems(responses.map(r => r.hardestSubject)),
          favouriteSubjects: topItems(responses.map(r => r.favouriteSubject)),
        },
      }
    },
    staleTime: 5 * 60_000,
  })
}

function Stars({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ color: i <= Math.round(value) ? '#f59e0b' : 'var(--border)', fontSize: 14 }}>★</span>
      ))}
    </div>
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '16px 20px', minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function DosSurveysPage() {
  const currentYear = new Date().getFullYear()
  const [term, setTerm]   = useState('2')
  const [year, setYear]   = useState(currentYear)

  const { data, isLoading } = useSurveyResponses(term, year)
  const responses = data?.responses ?? []
  const summary   = data?.summary

  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: responses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  })

  function exportExcel() {
    const header = 'Student,Class,Overall Rating,Teacher Rating,Hardest Subject,Favourite Subject,Suggestions,Submitted\n'
    const rows = responses.map(r =>
      `"${r.studentName}","${r.className}","${r.overallRating}","${r.teacherRating}","${r.hardestSubject ?? ''}","${r.favouriteSubject ?? ''}","${(r.suggestions ?? '').replace(/"/g, '""')}","${r.submittedAt}"`
    ).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `surveys-term${term}-${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
            Survey Responses
          </h1>
          <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
            End-of-term student satisfaction surveys
          </div>
        </div>
        <button className="sui-btn-outline" onClick={exportExcel} style={{ fontSize: 13 }}>
          Export CSV
        </button>
      </div>

      {/* Term / Year selectors */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: 120 }}>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 3 }}>Year</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="sui-input" style={{ width: 100 }}>
            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading survey data…</div>}

      {!isLoading && summary && (
        <>
          {/* Summary KPIs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <KpiCard label="Total Responses" value={summary.total} />
            <KpiCard label="Avg Overall Rating" value={summary.avgOverall} sub="out of 5" />
            <KpiCard label="Avg Teacher Rating" value={summary.avgTeacher} sub="out of 5" />
          </div>

          {/* Top subjects */}
          {(summary.hardestSubjects.length > 0 || summary.favouriteSubjects.length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {summary.hardestSubjects.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)', marginBottom: 12 }}>
                    Most Difficult Subjects
                  </div>
                  {summary.hardestSubjects.map(({ name, count }) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                      borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--txt)' }}>{name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
              {summary.favouriteSubjects.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)', marginBottom: 12 }}>
                    Most Favourite Subjects
                  </div>
                  {summary.favouriteSubjects.map(({ name, count }) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                      borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--txt)' }}>{name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Responses table */}
          {responses.length === 0 ? (
            <div style={{
              padding: 40, textAlign: 'center', color: 'var(--txt3)',
              background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)',
            }}>
              No survey responses for Term {term} {year}. Toggle the survey in Academic Year settings to collect responses.
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Student', 'Class', 'Overall', 'Teacher', 'Hardest', 'Favourite', 'Suggestions'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', background: 'var(--surface2)',
                        fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
              </table>
              <div ref={parentRef} style={{ overflowY: 'auto', maxHeight: 520 }}>
                <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
                  {virtualizer.getVirtualItems().map(vRow => {
                    const r = responses[vRow.index]
                    return (
                      <div
                        key={r.id}
                        style={{
                          position: 'absolute', top: 0, left: 0, width: '100%',
                          transform: `translateY(${vRow.start}px)`,
                          height: 56, display: 'flex', alignItems: 'center',
                          borderBottom: '1px solid var(--border)', padding: '0 14px',
                        }}
                      >
                        <div style={{ flex: 1.5, fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{r.studentName}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)' }}>{r.className}</div>
                        <div style={{ flex: 1 }}><Stars value={r.overallRating} /></div>
                        <div style={{ flex: 1 }}><Stars value={r.teacherRating} /></div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)' }}>{r.hardestSubject ?? '—'}</div>
                        <div style={{ flex: 1, fontSize: 12, color: 'var(--txt2)' }}>{r.favouriteSubject ?? '—'}</div>
                        <div style={{ flex: 2, fontSize: 11, color: 'var(--txt3)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.suggestions ?? '—'}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
