import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useClasses, useSubjects } from '../../hooks/useClasses'
import { TermPicker } from '../../components/ui/TermPicker'

// ─── Types ────────────────────────────────────────────────────────────────────
type Topic = {
  id: string
  subjectId: string; classId: string
  topic: string; ncdcCode: string | null
  term: string; year: number
  plannedDate: string | null
  coveredAt: string | null
  coveredBy: string | null
  seq: number
}

// ─── Data hooks ───────────────────────────────────────────────────────────────
function useMyStaffRecord() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-staff-record', user?.schoolId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('staff').select('id, subjects, classes')
        .eq('auth_user_id', user!.id).eq('school_id', user!.schoolId).maybeSingle()
      return data as { id: string; subjects: string[]; classes: string[] } | null
    },
    staleTime: 5 * 60_000,
  })
}

function useTopicsForSelection(params: { subjectId: string; classId: string; term: string; year: number } | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['teacher-curriculum', user?.schoolId, params?.subjectId, params?.classId, params?.term, params?.year],
    enabled: !!user && !!params?.subjectId && !!params?.classId && !!params?.term && !!params?.year,
    queryFn: async (): Promise<Topic[]> => {
      const { data, error } = await supabase
        .from('curriculum_plan')
        .select('id, subject_id, class_id, topic, term, year, expected_date, covered_at, covered_by')
        .eq('school_id', user!.schoolId)
        .eq('subject_id', params!.subjectId)
        .eq('class_id',   params!.classId)
        .eq('term',       params!.term)
        .eq('year',       params!.year)
        .order('expected_date', { ascending: true, nullsFirst: false })
      if (error?.code === '42P01') return []
      if (error) throw new Error(error.message)
      return (data ?? []).map((r: any, i: number) => ({
        id: r.id, subjectId: r.subject_id, classId: r.class_id,
        topic: r.topic, ncdcCode: null, term: r.term, year: r.year,
        plannedDate: r.expected_date ?? null, coveredAt: r.covered_at ?? null,
        coveredBy: r.covered_by ?? null, seq: i + 1,
      }))
    },
    staleTime: 30_000,
  })
}

function useAddTopic() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { subjectId: string; classId: string; topic: string; term: string; year: number; plannedDate?: string | null }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan').insert({
        school_id: user.schoolId, subject_id: input.subjectId, class_id: input.classId,
        topic: input.topic, term: input.term, year: input.year,
        expected_date: input.plannedDate ?? null, covered: false,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teacher-curriculum'] }),
  })
}

function useDeleteTopic() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan').delete()
        .eq('id', id).eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teacher-curriculum'] }),
  })
}

function useMarkCovered() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan')
        .update({ covered: true, covered_at: new Date().toISOString(), covered_by: user.staffId ?? user.id })
        .eq('id', id).eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
      const { data: dosStaff } = await supabase.from('staff').select('auth_user_id')
        .eq('school_id', user.schoolId).eq('role', 'dos').maybeSingle()
      if ((dosStaff as any)?.auth_user_id) {
        try {
          await supabase.from('notifications').insert({
            school_id: user.schoolId, user_id: (dosStaff as any).auth_user_id,
            type: 'general', title: 'Curriculum Update',
            body: 'A curriculum topic has been marked as covered.',
            link: '/dos/curriculum', read: false, read_at: null,
          })
        } catch (_e) {
          // notification failure is non-fatal
        }
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teacher-curriculum'] }),
  })
}

function useUnmarkCovered() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase.from('curriculum_plan')
        .update({ covered: false, covered_at: null, covered_by: null })
        .eq('id', id).eq('school_id', user.schoolId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teacher-curriculum'] }),
  })
}

// ─── Progress Arc ─────────────────────────────────────────────────────────────
function ProgressArc({ pct, size = 110, stroke = 10 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#0d9488'
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface2)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .95s cubic-bezier(.4,0,.2,1), stroke .4s ease', filter: `drop-shadow(0 0 7px ${color}88)` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font3)', color, lineHeight: 1 }}>{pct}%</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', marginTop: 2, letterSpacing: .3, textTransform: 'uppercase' }}>done</span>
      </div>
    </div>
  )
}

// ─── iOS-style segmented term picker ─────────────────────────────────────────

// ─── Topic card ───────────────────────────────────────────────────────────────
function TopicCard({ topic, onMark, onUnmark, onDelete, busy }: {
  topic: Topic
  onMark: (id: string) => void
  onUnmark: (id: string) => void
  onDelete: (id: string) => void
  busy: boolean
}) {
  const covered = !!topic.coveredAt
  const [confirmDel, setConfirmDel] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px',
      background: covered ? 'rgba(16,185,129,.025)' : 'var(--surface)',
      borderRadius: 14,
      border: `.5px solid ${covered ? 'rgba(16,185,129,.2)' : 'var(--border)'}`,
      borderLeft: `3px solid ${covered ? 'var(--success)' : 'var(--brand)'}`,
      boxShadow: covered ? 'none' : '0 1px 5px rgba(0,0,0,.05)',
      opacity: covered ? 0.82 : 1,
      transition: 'all .22s cubic-bezier(.4,0,.2,1)',
    }}>
      {/* Checkbox — min 36px tap target */}
      <button
        onClick={() => covered ? onUnmark(topic.id) : onMark(topic.id)}
        disabled={busy}
        aria-label={covered ? 'Mark as not covered' : 'Mark as covered'}
        style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0, marginTop: 1,
          border: `2px solid ${covered ? 'var(--success)' : 'var(--brand)'}`,
          background: covered ? 'var(--success)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: busy ? 'wait' : 'pointer',
          boxShadow: covered ? '0 3px 10px rgba(16,185,129,.38)' : 'none',
          transition: 'all .22s cubic-bezier(.32,.72,0,1)',
          padding: 0,
        }}>
        {covered
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : busy
            ? <div style={{ width: 9, height: 9, borderRadius: '50%', border: '2px solid rgba(13,148,136,.3)', borderTop: '2px solid var(--brand)', animation: 'cuSpin .7s linear infinite' }} />
            : null
        }
      </button>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
          color: covered ? 'var(--txt3)' : 'var(--txt)',
          textDecoration: covered ? 'line-through' : 'none',
          textDecorationColor: 'rgba(148,163,184,.55)',
          wordBreak: 'break-word',
        }}>
          {topic.topic}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>#{topic.seq}</span>
          {topic.plannedDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--txt3)' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              {new Date(topic.plannedDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {covered && topic.coveredAt && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 99, fontSize: 10.5, fontWeight: 700, background: 'rgba(16,185,129,.12)', color: 'var(--success)', border: '.5px solid rgba(16,185,129,.22)' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              {new Date(topic.coveredAt).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>

      {/* Delete */}
      {!covered && (
        confirmDel ? (
          <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
            <button onClick={() => { onDelete(topic.id); setConfirmDel(false) }}
              style={{ height: 30, padding: '0 10px', borderRadius: 8, border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Remove
            </button>
            <button onClick={() => setConfirmDel(false)}
              style={{ width: 30, height: 30, borderRadius: 8, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDel(true)} aria-label="Remove topic"
            style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', flexShrink: 0, opacity: 0.35, transition: 'all .14s' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(244,63,94,.09)'; e.currentTarget.style.color = 'var(--danger)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '0.35'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--txt3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        )
      )}
    </div>
  )
}

// ─── Sticky frosted-glass quick-add bar ──────────────────────────────────────
function QuickAddBar({ subjectId, classId, term, year }: {
  subjectId: string; classId: string; term: string; year: number
}) {
  const addMut = useAddTopic()
  const { success: ok, error: err } = useToast()
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState('')
  const [showDate, setShowDate] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submit() {
    const t = topic.trim()
    if (!t) return
    try {
      await addMut.mutateAsync({ subjectId, classId, topic: t, term, year, plannedDate: date || null })
      ok('Topic added')
      setTopic(''); setDate(''); setShowDate(false)
      inputRef.current?.focus()
    } catch (e: any) { err(e?.message ?? 'Failed to add') }
  }

  return (
    <div style={{
      position: 'sticky', bottom: 0, zIndex: 20,
      background: 'rgba(248,250,252,.92)',
      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
      borderTop: '1px solid var(--border)',
      padding: showDate ? '12px 14px 18px' : '10px 14px 14px',
      transition: 'padding .2s cubic-bezier(.4,0,.2,1)',
    }}>
      {showDate && (
        <div style={{ marginBottom: 10, animation: 'cuFadeUp .18s ease both' }}>
          <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>
            Planned date (optional)
          </label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="sui-input" style={{ width: '100%' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Input row */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--surface)', borderRadius: 14, padding: '0 12px', height: 50,
          border: `.5px solid ${topic ? 'var(--brand)' : 'var(--border)'}`,
          boxShadow: topic ? '0 0 0 3px rgba(13,148,136,.1)' : 'none',
          transition: 'all .18s',
        }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, background: 'rgba(13,148,136,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
          <input
            ref={inputRef}
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && void submit()}
            placeholder="Add a curriculum topic…"
            style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontSize: 14, fontWeight: 500, color: 'var(--txt)', fontFamily: 'inherit', minWidth: 0 }}
          />
          <button onClick={() => setShowDate(p => !p)} title="Set planned date"
            style={{ width: 28, height: 28, borderRadius: 9, border: `.5px solid ${showDate ? 'var(--brand)' : 'var(--border)'}`, background: showDate ? 'rgba(13,148,136,.1)' : 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showDate ? 'var(--brand)' : 'var(--txt3)', flexShrink: 0, transition: 'all .14s' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </button>
        </div>
        {/* Send button */}
        <button onClick={() => void submit()} disabled={!topic.trim() || addMut.isPending}
          style={{
            width: 50, height: 50, borderRadius: 14, border: 'none', flexShrink: 0,
            background: topic.trim() ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'var(--surface2)',
            color: topic.trim() ? '#fff' : 'var(--txt3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: topic.trim() ? 'pointer' : 'default',
            boxShadow: topic.trim() ? '0 4px 18px rgba(13,148,136,.42)' : 'none',
            transition: 'all .2s cubic-bezier(.32,.72,0,1)',
            transform: topic.trim() ? 'scale(1.03)' : 'scale(.95)',
          }}>
          {addMut.isPending
            ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,.35)', borderTop: '2.5px solid #fff', animation: 'cuSpin .7s linear infinite' }} />
            : <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          }
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER CURRICULUM PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function TeacherCurriculumPage() {
  const YEAR = new Date().getFullYear()
  const { data: staffRecord }       = useMyStaffRecord()
  const { data: allClasses = [] }   = useClasses()
  const { data: allSubjects = [] }  = useSubjects()
  const { success: ok, error: err } = useToast()

  const markMut   = useMarkCovered()
  const unmarkMut = useUnmarkCovered()
  const deleteMut = useDeleteTopic()

  const mySubjectIds = staffRecord?.subjects ?? []
  const myClassIds   = staffRecord?.classes  ?? []
  // No "fall back to everything when unassigned" — a teacher with no
  // assignments yet should see the "ask the DoS" warning below, not every
  // subject/class in the school.
  const mySubjects   = allSubjects.filter(s => mySubjectIds.includes(s.id))
  const myClasses    = allClasses.filter(c => myClassIds.includes(c.id))

  const [subjectId, setSubjectId] = useState('')
  const [classId,   setClassId]   = useState('')
  const [term,      setTerm]      = useState('1')
  const [year,      setYear]      = useState(YEAR)
  const [filter,    setFilter]    = useState<'all' | 'pending' | 'covered'>('all')

  const selectionReady = !!subjectId && !!classId

  const { data: topics = [], isLoading } = useTopicsForSelection(
    selectionReady ? { subjectId, classId, term, year } : null
  )

  const coveredCount = topics.filter(t => t.coveredAt != null).length
  const pendingCount = topics.length - coveredCount
  const pct          = topics.length > 0 ? Math.round((coveredCount / topics.length) * 100) : 0

  const visibleTopics = filter === 'covered'
    ? topics.filter(t => t.coveredAt)
    : filter === 'pending'
      ? topics.filter(t => !t.coveredAt)
      : topics

  const subjectName = allSubjects.find(s => s.id === subjectId)?.name ?? ''
  const className   = allClasses.find(c => c.id === classId)?.name   ?? ''

  async function mark(id: string) {
    try { await markMut.mutateAsync(id); ok('Covered — DoS notified') }
    catch (e: any) { err(e.message) }
  }
  async function unmark(id: string) {
    try { await unmarkMut.mutateAsync(id) }
    catch (e: any) { err(e.message) }
  }
  async function del(id: string) {
    try { await deleteMut.mutateAsync(id) }
    catch (e: any) { err(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* Keyframes */}
      <style>{`
        @keyframes cuSpin    { to { transform: rotate(360deg) } }
        @keyframes cuFadeUp  { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cuTopicIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }
        @keyframes cuOrb     { 0%,100% { transform:scale(1) translateY(0) } 50% { transform:scale(1.06) translateY(-6px) } }
      `}</style>

      {/* ── Hero header ──────────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', overflow: 'hidden', paddingBottom: 20, marginBottom: 2 }}>
        <div style={{ position: 'absolute', top: -44, right: -28, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.2),transparent 66%)', filter: 'blur(44px)', pointerEvents: 'none', animation: 'cuOrb 7s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', top: 8, left: -50, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.13),transparent 70%)', filter: 'blur(32px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, position: 'relative' }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px rgba(13,148,136,.46)', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="13" y2="11"/>
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: -.5, background: 'linear-gradient(135deg,var(--txt) 35%,var(--brand) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Curriculum Plan
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '3px 0 0', lineHeight: 1.45 }}>
              Draft your term topics · tick as covered · DoS sees progress live
            </p>
          </div>
        </div>
      </div>

      {/* ── Selection card ───────────────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '16px 16px 18px', boxShadow: '0 2px 14px rgba(0,0,0,.05)', marginBottom: 14 }}>
        {/* Subject + Class grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
              Subject
            </label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="sui-input"
              style={{ width: '100%', fontWeight: subjectId ? 700 : 400, color: subjectId ? 'var(--txt)' : 'var(--txt3)' }}>
              <option value="">Choose…</option>
              {mySubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {mySubjects.length === 0 && allSubjects.length > 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--warning)', marginTop: 4 }}>No subjects assigned — ask the DoS.</div>
            )}
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Class
            </label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="sui-input"
              style={{ width: '100%', fontWeight: classId ? 700 : 400, color: classId ? 'var(--txt)' : 'var(--txt3)' }}>
              <option value="">Choose…</option>
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {myClasses.length === 0 && allClasses.length > 0 && (
              <div style={{ fontSize: 10.5, color: 'var(--warning)', marginTop: 4 }}>No classes assigned — ask the DoS.</div>
            )}
          </div>
        </div>
        {/* Term segmented control */}
        <TermPicker value={term} onChange={setTerm} />
        {/* Year — minimal */}
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0 }}>Year</span>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value) || YEAR)}
            min={2020} max={2040} className="sui-input"
            style={{ width: 86, textAlign: 'center', fontFamily: 'var(--font3)', fontWeight: 700 }} />
        </div>
      </div>

      {/* ── Empty / prompt state ─────────────────────────────────────────────── */}
      {!selectionReady && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 24px 52px', gap: 18, animation: 'cuFadeUp .3s ease both' }}>
          {/* Decorative concentric rings */}
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px dashed rgba(13,148,136,.22)', animation: 'cuSpin 16s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', border: '1.5px dashed rgba(14,165,233,.18)', animation: 'cuSpin 11s linear infinite reverse' }} />
            <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: 'rgba(13,148,136,.07)', border: '.5px solid rgba(13,148,136,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
              {!subjectId ? 'Pick a subject & class' : 'Now pick a class'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6, maxWidth: 290 }}>
              Choose what you teach above, then plan and track your term curriculum.
            </div>
          </div>
          {/* Status chips */}
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: subjectId ? subjectName : 'Subject', done: !!subjectId },
              { label: classId ? className : 'Class', done: !!classId },
              { label: `Term ${term}`, done: true },
            ].map(({ label, done }, i) => (
              <span key={i} style={{ padding: '5px 13px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: done ? 'rgba(16,185,129,.1)' : 'var(--surface2)', color: done ? 'var(--success)' : 'var(--txt3)', border: `.5px solid ${done ? 'rgba(16,185,129,.24)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 5 }}>
                {done && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Plan content ─────────────────────────────────────────────────────── */}
      {selectionReady && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12, animation: 'cuFadeUp .22s ease both' }}>

          {/* Progress card */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, padding: '16px 16px', boxShadow: '0 2px 14px rgba(0,0,0,.05)' }}>
            {/* Context breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: topics.length > 0 ? 16 : 0, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 99, background: 'rgba(13,148,136,.1)', border: '.5px solid rgba(13,148,136,.2)', fontSize: 12, fontWeight: 800, color: 'var(--brand)', fontFamily: 'var(--font2)' }}>
                {subjectName}
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt2)' }}>{className}</span>
              <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginLeft: 'auto' }}>T{term} · {year}</span>
            </div>

            {/* Progress ring + stats */}
            {topics.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <ProgressArc pct={pct} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Covered</div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font3)', color: 'var(--success)', lineHeight: 1 }}>{coveredCount}</span>
                        <span style={{ fontSize: 11, color: 'var(--txt3)' }}>/ {topics.length}</span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>Pending</div>
                      <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font3)', color: pendingCount > 0 ? 'var(--txt2)' : 'var(--success)', lineHeight: 1 }}>{pendingCount}</div>
                    </div>
                  </div>
                  {/* Bar */}
                  <div style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, transition: 'width .85s cubic-bezier(.4,0,.2,1)', background: pct >= 70 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--brand)' }} />
                  </div>
                  {pct === 100 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: 'rgba(16,185,129,.1)', border: '.5px solid rgba(16,185,129,.22)', width: 'fit-content' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--success)' }}>Full term covered!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Topic list card */}
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column', flex: 1 }}>

            {/* List header + filter tabs */}
            <div style={{ padding: '11px 14px 0', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>
                  {isLoading ? 'Loading…' : topics.length === 0 ? 'No topics yet' : `${topics.length} topic${topics.length !== 1 ? 's' : ''}`}
                </span>
                {topics.length > 0 && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Tap circle to toggle</span>}
              </div>
              {topics.length > 0 && (
                <div style={{ display: 'flex', gap: 3, paddingBottom: 0 }}>
                  {(['all', 'pending', 'covered'] as const).map(f => {
                    const count = f === 'all' ? topics.length : f === 'covered' ? coveredCount : pendingCount
                    const on = filter === f
                    return (
                      <button key={f} onClick={() => setFilter(f)}
                        style={{
                          padding: '6px 13px', borderRadius: '9px 9px 0 0', border: 'none', cursor: 'pointer',
                          background: on ? 'var(--surface)' : 'transparent',
                          color: on ? 'var(--brand)' : 'var(--txt3)',
                          fontSize: 12, fontWeight: on ? 800 : 600, fontFamily: 'var(--font2)',
                          transition: 'all .16s', display: 'flex', alignItems: 'center', gap: 5,
                          borderBottom: on ? '.5px solid var(--surface)' : 'none',
                          marginBottom: on ? -0.5 : 0,
                        }}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                        <span style={{ padding: '1px 5px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: on ? 'rgba(13,148,136,.12)' : 'rgba(148,163,184,.18)', color: on ? 'var(--brand)' : 'var(--txt3)' }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Topics */}
            <div style={{ flex: 1, padding: '10px 10px 6px', display: 'flex', flexDirection: 'column', gap: 7, overflowY: 'auto' }}>
              {isLoading
                ? [1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 64, borderRadius: 14 }} />)
                : visibleTopics.length === 0
                  ? (
                    <div style={{ padding: '38px 20px', textAlign: 'center', animation: 'cuFadeUp .25s ease both' }}>
                      <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(13,148,136,.07)', border: '.5px solid rgba(13,148,136,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8">
                          {filter === 'covered'
                            ? <><polyline points="20 6 9 17 4 12"/><circle cx="12" cy="12" r="10"/></>
                            : <><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></>
                          }
                        </svg>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', marginBottom: 5, fontFamily: 'var(--font2)' }}>
                        {filter === 'covered' ? 'Nothing covered yet' : filter === 'pending' ? 'All topics covered' : 'No topics yet'}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--txt3)', lineHeight: 1.55, maxWidth: 260, margin: '0 auto' }}>
                        {filter === 'all' ? 'Type a topic in the bar below and press Enter.' : filter === 'pending' ? 'Great work — your full plan is done.' : 'Start marking topics as you teach them.'}
                      </div>
                    </div>
                  )
                  : visibleTopics.map((t, idx) => (
                    <div key={t.id} style={{ animation: `cuTopicIn .22s ${idx * 0.03}s cubic-bezier(.32,.72,0,1) both` }}>
                      <TopicCard topic={t} onMark={mark} onUnmark={unmark} onDelete={del} busy={markMut.isPending || unmarkMut.isPending} />
                    </div>
                  ))
              }
            </div>

            {/* Sticky glass quick-add */}
            <QuickAddBar subjectId={subjectId} classId={classId} term={term} year={year} />
          </div>
        </div>
      )}
    </div>
  )
}
