import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { PageHeader } from '../../components/ui/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useToast } from '../../components/ui/Toast'
import { useToggleSurvey } from '../../hooks/useAdmin'

type AcademicYearRow = {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  surveyActive: boolean
  term1Start: string | null
  term1End:   string | null
  term2Start: string | null
  term2End:   string | null
  term3Start: string | null
  term3End:   string | null
}

function useAcademicYearsFull() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['academic-years-full', user?.schoolId],
    enabled: !!user,
    queryFn: async (): Promise<AcademicYearRow[]> => {
      const { data, error } = await supabase
        .from('academic_years')
        .select('id, name, start_date, end_date, is_active, survey_active, term1_start, term1_end, term2_start, term2_end, term3_start, term3_end')
        .eq('school_id', user!.schoolId)
        .order('start_date', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map((r: any) => ({
        id:          r.id,
        name:        r.name,
        startDate:   r.start_date,
        endDate:     r.end_date,
        isActive:    r.is_active,
        surveyActive: r.survey_active ?? false,
        term1Start:  r.term1_start,
        term1End:    r.term1_end,
        term2Start:  r.term2_start,
        term2End:    r.term2_end,
        term3Start:  r.term3_start,
        term3End:    r.term3_end,
      }))
    },
    staleTime: 5 * 60_000,
  })
}

function useSetActiveYear() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (yearId: string) => {
      if (!user) throw new Error('Not authenticated')
      await supabase.from('academic_years').update({ is_active: false }).eq('school_id', user.schoolId)
      const { error } = await supabase.from('academic_years').update({ is_active: true }).eq('id', yearId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
    },
  })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AcademicYearPage() {
  const { data = [], isLoading } = useAcademicYearsFull()
  const { success: ok, error: err } = useToast()
  const setActive = useSetActiveYear()
  const toggleSurvey = useToggleSurvey()
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleSetActive(yearId: string) {
    try {
      await setActive.mutateAsync(yearId)
      ok('Active year updated.')
    } catch (e: any) { err(e.message) }
  }

  async function handleToggleSurvey(yearId: string, current: boolean) {
    try {
      await toggleSurvey.mutateAsync({ yearId, active: !current })
      ok(`Survey ${!current ? 'opened' : 'closed'}.`)
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Academic Year"
        subtitle="Manage academic years and term dates."
      />

      {isLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size="md" /></div>}

      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)' }}>No academic years configured.</div>
          ) : data.map(year => (
            <div key={year.id} style={{ background: 'var(--surface)', border: `2px solid ${year.isActive ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)' }}>{year.name}</span>
                  {year.isActive && (
                    <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--brand)', color: '#fff' }}>Active</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="sui-btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => setExpanded(prev => prev === year.id ? null : year.id)}>
                    {expanded === year.id ? 'Collapse' : 'View Terms'}
                  </button>
                  {!year.isActive && (
                    <button className="sui-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                      disabled={setActive.isPending}
                      onClick={() => handleSetActive(year.id)}>
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleSurvey(year.id, year.surveyActive)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                      background: year.surveyActive ? 'var(--success-bg)' : 'var(--surface2)',
                      color:      year.surveyActive ? 'var(--success)'    : 'var(--txt3)',
                    }}>
                    Survey {year.surveyActive ? 'Open' : 'Closed'}
                  </button>
                </div>
              </div>

              {/* Year date range */}
              <div style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--txt3)' }}>
                {formatDate(year.startDate)} — {formatDate(year.endDate)}
              </div>

              {/* Term dates */}
              {expanded === year.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Term 1', start: year.term1Start, end: year.term1End },
                    { label: 'Term 2', start: year.term2Start, end: year.term2End },
                    { label: 'Term 3', start: year.term3Start, end: year.term3End },
                  ].map(t => (
                    <div key={t.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--txt)' }}>{formatDate(t.start)}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt3)' }}>to {formatDate(t.end)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
