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

function useCreateAcademicYear() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vals: {
      name: string
      startDate: string; endDate: string
      term1Start: string; term1End: string
      term2Start: string; term2End: string
      term3Start: string; term3End: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('academic_years').insert({
        school_id:   user.schoolId,
        name:        vals.name,
        start_date:  vals.startDate,
        end_date:    vals.endDate,
        is_active:   false,
        survey_active: false,
        term1_start: vals.term1Start, term1_end: vals.term1End,
        term2_start: vals.term2Start, term2_end: vals.term2End,
        term3_start: vals.term3Start, term3_end: vals.term3End,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
    },
  })
}

function usePromoteAllStudents() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (newYearId: string) => {
      if (!user) throw new Error('Not authenticated')
      const sid = user.schoolId

      // Fetch classes ordered by level to build progression map
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', sid)
        .order('level', { ascending: true })
      if (classErr) throw new Error(classErr.message)

      const sorted = (classes ?? []).filter((c: any) => c.level)
      // Map each class id → next class id
      const nextClassMap = new Map<string, string | null>()
      for (let i = 0; i < sorted.length; i++) {
        nextClassMap.set(sorted[i].id, sorted[i + 1]?.id ?? null)
      }

      const lastClassId = sorted[sorted.length - 1]?.id ?? null

      // Fetch all active students
      const { data: students, error: stuErr } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('school_id', sid)
        .eq('status', 'active')
      if (stuErr) throw new Error(stuErr.message)

      // Graduate S6 (last class) students, promote the rest
      const toGraduate  = (students ?? []).filter((s: any) => s.class_id === lastClassId).map((s: any) => s.id)
      const toPromote   = (students ?? []).filter((s: any) => s.class_id !== lastClassId)

      if (toGraduate.length > 0) {
        const { error } = await supabase
          .from('students').update({ status: 'graduated' })
          .in('id', toGraduate).eq('school_id', sid)
        if (error) throw new Error(error.message)
      }

      // Batch-update each group that moves to the same next class
      const byNextClass = new Map<string, string[]>()
      for (const s of toPromote) {
        const nextId = nextClassMap.get(s.class_id) ?? null
        if (!nextId) continue
        if (!byNextClass.has(nextId)) byNextClass.set(nextId, [])
        byNextClass.get(nextId)!.push(s.id)
      }
      for (const [nextClassId, ids] of byNextClass) {
        const { error } = await supabase
          .from('students').update({ class_id: nextClassId, stream_id: null, academic_year_id: newYearId })
          .in('id', ids).eq('school_id', sid)
        if (error) throw new Error(error.message)
      }

      return { graduated: toGraduate.length, promoted: toPromote.length }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis'] })
    },
  })
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Create Year Modal ──────────────────────────────────────────────────────
function CreateYearModal({ onClose }: { onClose: () => void }) {
  const { success: ok, error: err } = useToast()
  const create = useCreateAcademicYear()
  const year = new Date().getFullYear() + 1

  const [vals, setVals] = useState({
    name:       String(year),
    startDate:  `${year}-01-01`,
    endDate:    `${year}-12-31`,
    term1Start: `${year}-01-20`,
    term1End:   `${year}-04-20`,
    term2Start: `${year}-05-06`,
    term2End:   `${year}-08-10`,
    term3Start: `${year}-09-01`,
    term3End:   `${year}-12-05`,
  })

  function set(key: keyof typeof vals) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setVals(v => ({ ...v, [key]: e.target.value }))
  }

  async function handleCreate() {
    try {
      await create.mutateAsync(vals)
      ok('Academic year created.')
      onClose()
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 520, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, margin: '0 0 20px', color: 'var(--txt)' }}>
          Create Academic Year
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FieldRow label="Year Name">
            <input className="sui-input" value={vals.name} onChange={set('name')} placeholder="e.g. 2027" />
          </FieldRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FieldRow label="Start Date">
              <input type="date" className="sui-input" value={vals.startDate} onChange={set('startDate')} />
            </FieldRow>
            <FieldRow label="End Date">
              <input type="date" className="sui-input" value={vals.endDate} onChange={set('endDate')} />
            </FieldRow>
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt2)', marginTop: 4 }}>Term Dates</div>
          {(['term1', 'term2', 'term3'] as const).map((t, i) => (
            <div key={t} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FieldRow label={`Term ${i + 1} Start`}>
                <input type="date" className="sui-input" value={vals[`${t}Start`]} onChange={set(`${t}Start`)} />
              </FieldRow>
              <FieldRow label={`Term ${i + 1} End`}>
                <input type="date" className="sui-input" value={vals[`${t}End`]} onChange={set(`${t}End`)} />
              </FieldRow>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className="sui-btn-outline">Cancel</button>
          <button onClick={handleCreate} className="sui-btn-primary" disabled={create.isPending || !vals.name.trim()}>
            {create.isPending ? 'Creating…' : 'Create Year'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

// ── Promote All Modal ──────────────────────────────────────────────────────
function PromoteModal({ years, onClose }: { years: AcademicYearRow[]; onClose: () => void }) {
  const { success: ok, error: err } = useToast()
  const promote = usePromoteAllStudents()
  const [targetYearId, setTargetYearId] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const inactiveYears = years.filter(y => !y.isActive)

  async function handlePromote() {
    if (!targetYearId) return
    try {
      const result = await promote.mutateAsync(targetYearId)
      ok(`Promotion complete. ${result.graduated} graduated · ${result.promoted} promoted.`)
      onClose()
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 28,
        width: 440, maxWidth: '90vw',
      }}>
        <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, margin: '0 0 8px', color: 'var(--txt)' }}>
          Promote All Students
        </h3>
        <p style={{ fontSize: 13, color: 'var(--txt2)', margin: '0 0 20px', lineHeight: 1.6 }}>
          This moves all active students to the next class level. Students in the final class
          (S6/Form 6) are marked as graduated. Streams are cleared — the secretary will
          re-assign streams for the new year.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 6 }}>
            Target Academic Year
          </label>
          <select
            value={targetYearId}
            onChange={e => setTargetYearId(e.target.value)}
            className="sui-input"
            style={{ width: '100%' }}
          >
            <option value="">Select a year…</option>
            {inactiveYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
          {inactiveYears.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>
              Create a new academic year first before promoting.
            </div>
          )}
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 20 }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span style={{ fontSize: 13, color: 'var(--txt2)' }}>
            I understand this cannot be undone automatically. All active students will be promoted.
          </span>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="sui-btn-outline">Cancel</button>
          <button
            onClick={handlePromote}
            disabled={!confirmed || !targetYearId || promote.isPending}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: confirmed && targetYearId ? 'var(--danger)' : 'var(--surface2)',
              color: confirmed && targetYearId ? '#fff' : 'var(--txt3)',
              fontWeight: 700, fontSize: 13, cursor: confirmed && targetYearId ? 'pointer' : 'default',
            }}
          >
            {promote.isPending ? 'Promoting…' : 'Promote All'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function AcademicYearPage() {
  const { data = [], isLoading } = useAcademicYearsFull()
  const { success: ok, error: err } = useToast()
  const setActive   = useSetActiveYear()
  const toggleSurvey = useToggleSurvey()
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [showPromote,  setShowPromote]  = useState(false)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          title="Academic Year"
          subtitle="Manage academic years and term dates."
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sui-btn-outline" style={{ fontSize: 13 }} onClick={() => setShowPromote(true)}>
            Promote All Students
          </button>
          <button className="sui-btn-primary" style={{ fontSize: 13 }} onClick={() => setShowCreate(true)}>
            + New Year
          </button>
        </div>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <LoadingSpinner size="md" />
        </div>
      )}

      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--txt3)' }}>No academic years configured.</div>
          ) : data.map(year => (
            <div key={year.id} style={{
              background: 'var(--surface)',
              border: `2px solid ${year.isActive ? 'var(--brand)' : 'var(--border)'}`,
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)' }}>{year.name}</span>
                  {year.isActive && (
                    <span style={{ padding: '2px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'var(--brand)', color: '#fff' }}>
                      Active
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    className="sui-btn-ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => setExpanded(prev => prev === year.id ? null : year.id)}
                  >
                    {expanded === year.id ? 'Collapse' : 'View Terms'}
                  </button>
                  {!year.isActive && (
                    <button
                      className="sui-btn-primary"
                      style={{ fontSize: 12, padding: '6px 14px' }}
                      disabled={setActive.isPending}
                      onClick={() => handleSetActive(year.id)}
                    >
                      Set Active
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleSurvey(year.id, year.surveyActive)}
                    style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', border: 'none',
                      background: year.surveyActive ? 'var(--success-bg)' : 'var(--surface2)',
                      color:      year.surveyActive ? 'var(--success)'    : 'var(--txt3)',
                    }}
                  >
                    Survey {year.surveyActive ? 'Open' : 'Closed'}
                  </button>
                </div>
              </div>

              <div style={{ padding: '0 20px 12px', fontSize: 12, color: 'var(--txt3)' }}>
                {formatDate(year.startDate)} — {formatDate(year.endDate)}
              </div>

              {expanded === year.id && (
                <div style={{
                  borderTop: '1px solid var(--border)', padding: '16px 20px',
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
                }}>
                  {[
                    { label: 'Term 1', start: year.term1Start, end: year.term1End },
                    { label: 'Term 2', start: year.term2Start, end: year.term2End },
                    { label: 'Term 3', start: year.term3Start, end: year.term3End },
                  ].map(t => (
                    <div key={t.label} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', marginBottom: 6 }}>
                        {t.label}
                      </div>
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

      {showCreate  && <CreateYearModal onClose={() => setShowCreate(false)} />}
      {showPromote && <PromoteModal years={data} onClose={() => setShowPromote(false)} />}
    </div>
  )
}
