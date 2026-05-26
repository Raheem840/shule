import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import type { CurriculumTopic } from '../../types/week9'

function useMyTopics() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-curriculum', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CurriculumTopic[]> => {
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('auth_user_id', user!.id)
        .maybeSingle()

      if (!staffRow) return []

      const { data, error } = await supabase
        .from('curriculum_plan')
        .select('id, school_id, subject_id, class_id, topic_name, ncdc_code, term, year, planned_date, covered_at, covered_by, teacher_id, sequence_order')
        .eq('school_id', user!.schoolId)
        .eq('teacher_id', (staffRow as any).id)
        .order('sequence_order', { ascending: true })

      if (error) throw new Error(error.message)

      return (data ?? []).map((r: any): CurriculumTopic => ({
        id:            r.id,
        schoolId:      r.school_id,
        subjectId:     r.subject_id,
        classId:       r.class_id,
        topicName:     r.topic_name,
        ncdcCode:      r.ncdc_code,
        term:          r.term,
        year:          r.year,
        plannedDate:   r.planned_date,
        coveredAt:     r.covered_at,
        coveredBy:     r.covered_by,
        teacherId:     r.teacher_id,
        sequenceOrder: r.sequence_order,
      }))
    },
    staleTime: 2 * 60_000,
  })
}

function useMarkTopicCovered() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (topicId: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('curriculum_plan')
        .update({ covered_at: new Date().toISOString(), covered_by: user.id })
        .eq('id', topicId)
        .eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['my-curriculum', user?.schoolId, user?.id] }),
  })
}

export function TeacherCurriculumPage() {
  const { data = [], isLoading } = useMyTopics()
  const { success: ok, error: err } = useToast()
  const markCovered = useMarkTopicCovered()
  const [termFilter, setTermFilter] = useState('')

  const filtered = termFilter ? data.filter(t => String(t.term) === termFilter) : data
  const covered  = filtered.filter(t => t.coveredAt != null).length
  const pct      = filtered.length > 0 ? Math.round((covered / filtered.length) * 100) : 0

  async function handleMark(topicId: string) {
    try {
      await markCovered.mutateAsync(topicId)
      ok('Topic marked as covered.')
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Curriculum Plan"
        subtitle="Track topics you've covered in class."
      />

      <div style={{ display: 'flex', gap: 10 }}>
        <select className="sui-input" value={termFilter} onChange={e => setTermFilter(e.target.value)}>
          <option value="">All Terms</option>
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </select>
      </div>

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && filtered.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Coverage</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font3)' }}>{pct}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--brand)', borderRadius: 4, transition: 'width 0.4s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 6 }}>{covered} of {filtered.length} topics covered</div>
        </div>
      )}

      {!isLoading && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Topic', 'NCDC Code', 'Term', 'Planned Date', 'Status', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No curriculum topics assigned to you.</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', background: t.coveredAt ? 'var(--bg)' : 'var(--surface)' }}>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{t.sequenceOrder}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: t.coveredAt ? 'var(--txt3)' : 'var(--txt)', textDecoration: t.coveredAt ? 'line-through' : 'none' }}>
                    {t.topicName}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, fontFamily: 'var(--font3)', color: 'var(--txt3)' }}>{t.ncdcCode ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)' }}>{t.term}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt3)' }}>
                    {t.plannedDate ? new Date(t.plannedDate).toLocaleDateString('en-UG') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {t.coveredAt ? (
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)' }}>
                        Covered {new Date(t.coveredAt).toLocaleDateString('en-UG')}
                      </span>
                    ) : (
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt3)' }}>Pending</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {!t.coveredAt && (
                      <button className="sui-btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                        disabled={markCovered.isPending}
                        onClick={() => handleMark(t.id)}>
                        Mark Covered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
