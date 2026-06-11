import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
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
      const { error } = await supabase.from('academic_years').update({ is_active: true }).eq('id', yearId).eq('school_id', user.schoolId)
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
        label:       vals.name,   // label is the real column; name is a generated alias
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

      // Fetch ALL classes for school ordered by level
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, name, level, academic_year_id')
        .eq('school_id', sid)
        .order('level', { ascending: true })
      if (classErr) throw new Error(classErr.message)

      const sorted = ((classes ?? []) as any[]).filter(c => c.level).sort((a: any, b: any) => Number(a.level) - Number(b.level))

      // Map each class id → next class id (by level order, across any year)
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

      const toGraduate = ((students ?? []) as any[]).filter(s => s.class_id === lastClassId).map(s => s.id)
      const toPromote  = ((students ?? []) as any[]).filter(s => s.class_id !== lastClassId)

      if (toGraduate.length > 0) {
        const { error } = await supabase
          .from('students').update({ status: 'graduated', academic_year_id: newYearId })
          .in('id', toGraduate).eq('school_id', sid)
        if (error) throw new Error(error.message)
      }

      // Group by next class and batch-update with new academic_year_id
      const byNextClass = new Map<string, string[]>()
      for (const s of toPromote as any[]) {
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

      // Activate the new academic year
      await supabase.from('academic_years').update({ is_active: false }).eq('school_id', sid)
      const { error: activateErr } = await supabase.from('academic_years').update({ is_active: true }).eq('id', newYearId).eq('school_id', sid)
      if (activateErr) throw new Error(activateErr.message)

      return { graduated: toGraduate.length, promoted: toPromote.length }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['students', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['principal-kpis'] })
      void qc.invalidateQueries({ queryKey: ['academic-years-full', user?.schoolId] })
      void qc.invalidateQueries({ queryKey: ['academic-years', user?.schoolId] })
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
function PromoteModal({ years, activeYear, onClose }: {
  years: AcademicYearRow[]
  activeYear: AcademicYearRow | null
  onClose: () => void
}) {
  const { success: ok, error: err } = useToast()
  const promote = usePromoteAllStudents()
  const [targetYearId, setTargetYearId] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const inactiveYears = years.filter(y => !y.isActive)

  // Gate: term 3 of active year must be completed
  const term3End    = activeYear?.term3End ?? null
  const term3Done   = term3End ? Date.now() > new Date(term3End).getTime() : false
  const term3Label  = term3End ? formatDate(term3End) : 'not set'

  async function handlePromote() {
    if (!targetYearId || !confirmed || !term3Done) return
    try {
      const result = await promote.mutateAsync(targetYearId)
      ok(`Promotion complete. ${result.graduated} graduated · ${result.promoted} promoted. New year activated.`)
      onClose()
    } catch (e: any) { err(e.message) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem',
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, overflow: 'hidden',
        width: 480, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: term3Done
            ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
            : 'linear-gradient(135deg, #475569, #334155)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 13,
              background: 'rgba(255,255,255,.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: -.3 }}>
                Promote All Students
              </div>
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.7)', marginTop: 2 }}>
                End-of-year class advancement
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Term 3 gate */}
          <div style={{
            padding: '12px 14px', borderRadius: 12,
            background: term3Done ? 'rgba(16,185,129,.08)' : 'rgba(245,158,11,.08)',
            border: `1px solid ${term3Done ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.3)'}`,
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            {term3Done ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 1 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: term3Done ? 'var(--success)' : 'var(--warning)', fontFamily: 'var(--font2)' }}>
                {term3Done ? 'Term 3 completed' : 'Term 3 not yet complete'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
                {term3Done
                  ? `Term 3 ended ${term3Label}. Promotion is now available.`
                  : `Promotion is only available after Term 3 ends (${term3Label}). Please wait until the end of Term 3.`}
              </div>
            </div>
          </div>

          {/* Only show the rest if term 3 is done */}
          {term3Done && (
            <>
              <p style={{ fontSize: 13, color: 'var(--txt2)', margin: 0, lineHeight: 1.7 }}>
                This moves all active students to the next class in the <strong>target year's class list</strong>.
                Students in the final class are marked as <strong>graduated</strong>. Streams are cleared.
                The target year becomes the new <strong>active year</strong>.
              </p>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>
                  Target Academic Year *
                </label>
                <select
                  value={targetYearId}
                  onChange={e => setTargetYearId(e.target.value)}
                  className="sui-input"
                  style={{ width: '100%' }}
                >
                  <option value="">— Select year to promote into —</option>
                  {inactiveYears.map(y => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
                {inactiveYears.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6, fontWeight: 600 }}>
                    Create a new academic year first before promoting.
                  </div>
                )}
              </div>

              <label style={{
                display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                padding: '10px 12px', borderRadius: 10,
                background: confirmed ? 'rgba(244,63,94,.06)' : 'var(--surface2)',
                border: `1px solid ${confirmed ? 'rgba(244,63,94,.25)' : 'var(--border)'}`,
                transition: 'all .15s',
              }}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'var(--danger)', width: 15, height: 15 }}
                />
                <span style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6 }}>
                  I understand this action <strong style={{ color: 'var(--danger)' }}>cannot be undone</strong>. All active students will be promoted,
                  final-year students graduated, and the target year activated.
                </span>
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button onClick={onClose} className="sui-btn-outline">Cancel</button>
            {term3Done && (
              <button
                onClick={() => { void handlePromote() }}
                disabled={!confirmed || !targetYearId || promote.isPending}
                style={{
                  padding: '9px 20px', borderRadius: 10, border: 'none', fontWeight: 800,
                  fontSize: 13, cursor: confirmed && targetYearId ? 'pointer' : 'default',
                  fontFamily: 'var(--font2)',
                  background: confirmed && targetYearId
                    ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                    : 'var(--surface2)',
                  color: confirmed && targetYearId ? '#fff' : 'var(--txt3)',
                  boxShadow: confirmed && targetYearId ? '0 4px 14px rgba(220,38,38,.35)' : 'none',
                  transition: 'all .15s',
                  opacity: promote.isPending ? .7 : 1,
                }}
              >
                {promote.isPending ? 'Promoting…' : 'Promote All Students'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Accord-style vertical timeline ────────────────────────────────────────
const TERM_META = [
  { num: 1, color: '#0d9488', grad: 'linear-gradient(135deg,#0d9488,#0f766e)', bg: 'rgba(13,148,136,0.09)' },
  { num: 2, color: '#8b5cf6', grad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', bg: 'rgba(139,92,246,0.09)' },
  { num: 3, color: '#f59e0b', grad: 'linear-gradient(135deg,#f59e0b,#d97706)', bg: 'rgba(245,158,11,0.09)' },
]

function termStatus(start: string | null, end: string | null) {
  if (!start || !end) return 'unknown' as const
  const now = Date.now(), s = new Date(start).getTime(), e = new Date(end).getTime()
  if (now < s) return 'upcoming' as const
  if (now > e) return 'completed' as const
  return 'current' as const
}
function termPct(start: string | null, end: string | null) {
  if (!start || !end) return 0
  const s = new Date(start).getTime(), e = new Date(end).getTime()
  return Math.min(100, Math.max(0, ((Date.now() - s) / (e - s)) * 100))
}
function termWeeks(start: string | null, end: string | null) {
  if (!start || !end) return 0
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (7 * 24 * 60 * 60 * 1000))
}
function breakDays(end: string | null, start: string | null) {
  if (!end || !start) return null
  const d = Math.round((new Date(start).getTime() - new Date(end).getTime()) / 86_400_000)
  return d > 0 ? d : null
}

const TL_CSS = `
  @keyframes tl-node-in { from{opacity:0;transform:scale(0.4)} to{opacity:1;transform:scale(1)} }
  @keyframes tl-card-in { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:none} }
  @keyframes tl-fill    { from{height:0%} to{height:var(--tl-fill)} }
  @keyframes tl-blink   { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes tl-bar     { from{width:0%} to{width:var(--tl-bar)} }
`

function AcademicTimeline({ year }: { year: AcademicYearRow }) {
  const [anim, setAnim] = useState(false)
  useEffect(() => { const t = setTimeout(() => setAnim(true), 60); return () => clearTimeout(t) }, [])

  const terms = [
    { ...TERM_META[0], start: year.term1Start, end: year.term1End },
    { ...TERM_META[1], start: year.term2Start, end: year.term2End },
    { ...TERM_META[2], start: year.term3Start, end: year.term3End },
  ]

  const yearStartMs = year.startDate ? new Date(year.startDate).getTime() : null
  const yearEndMs   = year.endDate   ? new Date(year.endDate).getTime()   : null
  const yearPct = yearStartMs && yearEndMs
    ? Math.min(100, Math.max(0, ((Date.now() - yearStartMs) / (yearEndMs - yearStartMs)) * 100))
    : null

  return (
    <>
      <style>{TL_CSS}</style>
      <div style={{ padding: '24px 28px 28px' }}>

        {/* Year-level header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
            {formatDate(year.startDate)} → {formatDate(year.endDate)}
          </div>
          {year.isActive && yearPct !== null && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 11px', borderRadius: 99, fontSize: 10, fontWeight: 800,
              background: 'rgba(13,148,136,0.1)', color: 'var(--brand)',
              border: '1px solid rgba(13,148,136,0.22)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', animation: 'tl-blink 2s ease infinite' }} />
              {Math.round(yearPct)}% of year elapsed
            </div>
          )}
        </div>

        {/* Timeline body */}
        <div style={{ position: 'relative' }}>

          {/* Spine */}
          <div style={{
            position: 'absolute', left: 23, top: 24, bottom: 0,
            width: 2, background: 'var(--border)', borderRadius: 2,
          }}>
            {/* Animated fill */}
            {year.isActive && yearPct !== null && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', borderRadius: 2,
                background: 'linear-gradient(180deg,#0d9488 0%,#8b5cf6 50%,#f59e0b 100%)',
                height: anim ? `${yearPct}%` : '0%',
                transition: 'height 1.4s cubic-bezier(0.4,0,0.2,1)',
              }} />
            )}
          </div>

          {terms.map((term, i) => {
            const status = termStatus(term.start, term.end)
            const pct    = termPct(term.start, term.end)
            const weeks  = termWeeks(term.start, term.end)
            const bd     = i < 2 ? breakDays(term.end, terms[i + 1].start) : null
            const isDone = status === 'completed'
            const isCur  = status === 'current'

            return (
              <div key={term.num}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, paddingLeft: 56, marginBottom: 8 }}>

                  {/* Node */}
                  <div style={{
                    position: 'absolute', left: 0, width: 48, height: 48, borderRadius: '50%',
                    background: status === 'upcoming' ? 'var(--surface)' : term.grad,
                    border: `2.5px solid ${status === 'upcoming' ? 'var(--border)' : term.color}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    boxShadow: status !== 'upcoming' ? `0 4px 20px ${term.color}45` : '0 2px 8px rgba(0,0,0,0.06)',
                    zIndex: 2,
                    animation: anim ? `tl-node-in 0.5s ${i * 0.11}s both` : 'none',
                  }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: status === 'upcoming' ? 'var(--txt3)' : '#fff', letterSpacing: 0.4, lineHeight: 1 }}>TERM</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: status === 'upcoming' ? 'var(--txt3)' : '#fff', fontFamily: 'var(--font3)', lineHeight: 1.1 }}>{term.num}</span>
                  </div>

                  {/* Card */}
                  <div
                    style={{
                      flex: 1, background: 'var(--surface)',
                      border: `1px solid ${isCur ? term.color + '35' : 'var(--border)'}`,
                      borderLeft: `4px solid ${status === 'upcoming' ? 'var(--border)' : term.color}`,
                      borderRadius: 16, overflow: 'hidden',
                      boxShadow: isCur ? `0 6px 32px ${term.color}18` : '0 2px 10px rgba(0,0,0,0.04)',
                      animation: anim ? `tl-card-in 0.45s ${i * 0.11}s both` : 'none',
                    }}
                  >
                    <div style={{ padding: '14px 18px 14px 20px' }}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 900, fontSize: 16, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
                              Term {term.num}
                            </span>
                            {isCur && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: term.color, animation: 'tl-blink 1.8s ease infinite' }} />
                                <span style={{ fontSize: 9, fontWeight: 900, color: term.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>Live</span>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4, fontSize: 12, color: 'var(--txt3)' }}>
                            <span>{formatDate(term.start)}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                            </svg>
                            <span>{formatDate(term.end)}</span>
                            {weeks > 0 && <span>· {weeks} wks</span>}
                          </div>
                        </div>

                        <span style={{
                          padding: '4px 12px', borderRadius: 99, fontSize: 10, fontWeight: 800,
                          flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.5,
                          background: isCur ? term.bg : isDone ? 'rgba(16,185,129,0.1)' : 'var(--surface2)',
                          color: isCur ? term.color : isDone ? '#10b981' : 'var(--txt3)',
                          border: `1px solid ${isCur ? term.color + '30' : isDone ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
                        }}>
                          {isCur ? 'In Progress' : isDone ? 'Completed' : 'Upcoming'}
                        </span>
                      </div>

                      {/* Progress bar */}
                      {(isCur || isDone) && (
                        <div>
                          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden', position: 'relative' }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              background: term.grad,
                              width: anim ? `${pct}%` : '0%',
                              transition: 'width 1.1s cubic-bezier(0.4,0,0.2,1)',
                              boxShadow: `0 0 10px ${term.color}50`,
                            }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--txt3)', marginTop: 5 }}>
                            <span>{Math.round(pct)}% through</span>
                            {isCur && weeks > 0 && (
                              <span>{Math.ceil(weeks * (1 - pct / 100))} wks remaining</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Break pill */}
                {bd !== null && (
                  <div style={{
                    paddingLeft: 72, marginBottom: 8,
                    animation: anim ? `tl-card-in 0.35s ${i * 0.11 + 0.08}s both` : 'none',
                  }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
                      background: 'var(--surface2)', border: '1px dashed var(--border)',
                      padding: '4px 12px', borderRadius: 99,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                      {bd}-day term break
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function AcademicYearPage() {
  const { data = [], isLoading } = useAcademicYearsFull()
  const { success: ok, error: err } = useToast()
  const setActive    = useSetActiveYear()
  const toggleSurvey = useToggleSurvey()
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [showCreate,   setShowCreate]   = useState(false)
  const [showPromote,  setShowPromote]  = useState(false)

  const activeYear  = data.find(y => y.isActive) ?? null
  const term3Done   = activeYear?.term3End ? Date.now() > new Date(activeYear.term3End).getTime() : false

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
              <div style={{ display:'flex', alignItems:'flex-start', gap:14, position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,.18),transparent 70%)', filter:'blur(50px)', pointerEvents:'none' }} />
        <div style={{ width:46, height:46, borderRadius:15, background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 5px 18px rgba(139,92,246,.45)', flexShrink:0 }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
        </div>
        <div>
          <h1 style={{ fontFamily:'var(--font2)', fontWeight:900, fontSize:22, color:'var(--txt)', margin:0, letterSpacing:-.4 }}>Academic Years</h1>
          <p style={{ fontSize:12.5, color:'var(--txt3)', margin:'2px 0 0' }}>Manage terms, academic periods and surveys</p>
        </div>
      </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setShowPromote(true)}
            title={term3Done ? 'Promote students to next class' : 'Available after Term 3 ends'}
            style={{
              padding: '8px 16px', borderRadius: 10, fontWeight: 700,
              fontSize: 12.5, cursor: 'pointer', fontFamily: 'var(--font2)',
              background: term3Done
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : 'var(--surface2)',
              color: term3Done ? '#fff' : 'var(--txt3)',
              boxShadow: term3Done ? '0 3px 12px rgba(124,58,237,.3)' : 'none',
              transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
              border: term3Done ? 'none' : '1px solid var(--border)',
            }}
          >
            {!term3Done && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            )}
            Promote All Students
            {!term3Done && <span style={{ fontSize: 10, opacity: .7 }}>(Term 3 pending)</span>}
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
                <div style={{ borderTop: `2px solid ${year.isActive ? 'rgba(13,148,136,0.2)' : 'var(--border)'}` }}>
                  <AcademicTimeline year={year} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate  && <CreateYearModal onClose={() => setShowCreate(false)} />}
      {showPromote && <PromoteModal years={data} activeYear={activeYear} onClose={() => setShowPromote(false)} />}
    </div>
  )
}
