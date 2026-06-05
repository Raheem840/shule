import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useQuery } from '@tanstack/react-query'
import { useClasses, useStreams, useSubjects } from '../../hooks/useClasses'
import {
  useTimetableSlots,
  useCreateTimetableSlot,
  useDeleteTimetableSlot,
  useCheckCollision,
  usePublishTimetable,
} from '../../hooks/useTimetableSlots'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TimetableSlot } from '../../types/week9'

// ─── Types ────────────────────────────────────────────────────────────────────
type EventType = 'class' | 'break' | 'lunch' | 'assembly' | 'prayer' | 'preps' | 'custom'
type PeriodDef = { num: number; type: EventType; label: string; startTime: string; endTime: string; days?: number[] }
type ViewMode = 'overview' | 'school' | 'builder'
type TeacherRow = { id: string; name: string; subjects: string[]; classes: string[] }
type ModalTarget = { classId: string; streamId: string | null; day: number; period: number }

// ─── Constants ────────────────────────────────────────────────────────────────
const DAYS: [number, string][] = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']]

// JS getDay(): 0=Sun,1=Mon…6=Sat  →  our schema: 1=Mon…6=Sat,7=Sun
function jsToSchoolDay(d: number): number | null {
  if (d === 0) return 7
  if (d >= 1 && d <= 6) return d
  return null
}

const EVENT_META: Record<EventType, { color: string; bg: string; icon: string; label: string }> = {
  class:    { color: '#64748b', bg: 'var(--surface2)',             icon: '📚', label: 'Class'    },
  break:    { color: '#f59e0b', bg: 'rgba(245,158,11,.13)',        icon: '☕', label: 'Break'    },
  lunch:    { color: '#0ea5e9', bg: 'rgba(14,165,233,.13)',        icon: '🍽', label: 'Lunch'    },
  assembly: { color: '#8b5cf6', bg: 'rgba(139,92,246,.13)',        icon: '🎓', label: 'Assembly' },
  prayer:   { color: '#10b981', bg: 'rgba(16,185,129,.13)',        icon: '🙏', label: 'Prayer'   },
  preps:    { color: '#f43f5e', bg: 'rgba(244,63,94,.13)',         icon: '📖', label: 'Preps'    },
  custom:   { color: '#0d9488', bg: 'rgba(13,148,136,.13)',        icon: '⭐', label: 'Custom'   },
}

const DEFAULT_PERIODS: PeriodDef[] = [
  { num:1,  type:'assembly', label:'Assembly',  startTime:'07:00', endTime:'07:30' },
  { num:2,  type:'class',    label:'Period 1',  startTime:'07:30', endTime:'08:10' },
  { num:3,  type:'class',    label:'Period 2',  startTime:'08:10', endTime:'08:50' },
  { num:4,  type:'class',    label:'Period 3',  startTime:'08:50', endTime:'09:30' },
  { num:5,  type:'break',    label:'Break',     startTime:'09:30', endTime:'10:00' },
  { num:6,  type:'class',    label:'Period 4',  startTime:'10:00', endTime:'10:40' },
  { num:7,  type:'class',    label:'Period 5',  startTime:'10:40', endTime:'11:20' },
  { num:8,  type:'lunch',    label:'Lunch',     startTime:'11:20', endTime:'13:00' },
  { num:9,  type:'class',    label:'Period 6',  startTime:'13:00', endTime:'13:40' },
  { num:10, type:'class',    label:'Period 7',  startTime:'13:40', endTime:'14:20' },
  { num:11, type:'preps',    label:'Preps',     startTime:'16:00', endTime:'18:00' },
]

const CLASS_PALETTE: [string, string][] = [
  ['#6366f1','rgba(99,102,241,.15)'],  ['#0ea5e9','rgba(14,165,233,.15)'],
  ['#10b981','rgba(16,185,129,.15)'],  ['#f59e0b','rgba(245,158,11,.15)'],
  ['#f43f5e','rgba(244,63,94,.15)'],   ['#8b5cf6','rgba(139,92,246,.15)'],
  ['#ec4899','rgba(236,72,153,.15)'],  ['#0d9488','rgba(13,148,136,.15)'],
  ['#84cc16','rgba(132,204,22,.15)'],  ['#f97316','rgba(249,115,22,.15)'],
]

function classColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return CLASS_PALETTE[Math.abs(h) % CLASS_PALETTE.length]
}

const SUBJ_PALETTE: [string, string][] = [
  ['#6366f1','rgba(99,102,241,.14)'],  ['#0ea5e9','rgba(14,165,233,.14)'],
  ['#10b981','rgba(16,185,129,.14)'],  ['#f59e0b','rgba(245,158,11,.14)'],
  ['#f43f5e','rgba(244,63,94,.14)'],   ['#8b5cf6','rgba(139,92,246,.14)'],
  ['#ec4899','rgba(236,72,153,.14)'],  ['#0d9488','rgba(13,148,136,.14)'],
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function subjectColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJ_PALETTE[Math.abs(h) % SUBJ_PALETTE.length]
}

function ini(n: string) { return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }

// Which days a period applies to (undefined = all days)
function appliesToDay(def: PeriodDef, day: number): boolean {
  if (def.type === 'class') return true
  if (!def.days || def.days.length === 0) return true
  return def.days.includes(day)
}

function cfgKey(sid: string) { return `shule:period-cfg:${sid}` }
function loadCfg(sid: string): PeriodDef[] {
  try { const r = localStorage.getItem(cfgKey(sid)); if (r) return JSON.parse(r) as PeriodDef[] } catch { /**/ }
  return DEFAULT_PERIODS
}
function saveCfg(sid: string, defs: PeriodDef[]) {
  localStorage.setItem(cfgKey(sid), JSON.stringify(defs))
}

// ─── Teachers hook ─────────────────────────────────────────────────────────────
function useTeachersForTimetable() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['teachers-for-timetable', user?.schoolId],
    enabled: !!user?.schoolId,
    queryFn: async (): Promise<TeacherRow[]> => {
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name, subjects, classes')
        .eq('school_id', user!.schoolId).eq('is_active', true)
        .in('role', ['teacher', 'class_teacher']).order('last_name')
      if (error) throw error
      return (data ?? []).map((r: any) => ({
        id: r.id, name: `${r.first_name} ${r.last_name}`,
        subjects: (r.subjects as string[]) ?? [],
        classes:  (r.classes  as string[]) ?? [],
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERIOD CONFIG PANEL  (slide-out drawer)
// ═══════════════════════════════════════════════════════════════════════════════
function PeriodConfigPanel({ defs, onChange, onClose }: {
  defs: PeriodDef[]
  onChange: (d: PeriodDef[]) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<PeriodDef[]>(() => defs.map(d => ({ ...d })))

  function upd(i: number, patch: Partial<PeriodDef>) {
    setLocal(prev => prev.map((d, j) => j === i ? { ...d, ...patch } : d))
  }

  function addPeriod() {
    const maxNum = local.reduce((m, d) => Math.max(m, d.num), 0)
    setLocal(prev => [...prev, { num: maxNum + 1, type: 'class', label: `Period ${maxNum + 1}`, startTime: '', endTime: '' }])
  }

  function remove(i: number) {
    setLocal(prev => prev.filter((_, j) => j !== i).map((d, j) => ({ ...d, num: j + 1 })))
  }

  function save() { onChange(local); onClose() }
  function reset() { setLocal(DEFAULT_PERIODS.map(d => ({ ...d }))) }

  const portal = document.querySelector('.ar') as HTMLElement ?? document.body

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'stretch' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      {/* Backdrop */}
      <div style={{ flex: 1, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      {/* Drawer */}
      <div style={{
        width: '100%', maxWidth: 480, height: '100%', background: 'var(--surface)',
        boxShadow: '-20px 0 60px rgba(0,0,0,.2)', display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .22s cubic-bezier(.16,1,.3,1)',
      }}>
        {/* Drawer header */}
        <div style={{ padding: '22px 24px 18px', borderBottom: '.5px solid var(--border)', flexShrink: 0, background: 'linear-gradient(135deg,rgba(13,148,136,.06),transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(13,148,136,.4)', flexShrink: 0 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', letterSpacing: -.3 }}>Configure Periods</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 1 }}>Set times & event types for each period</div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--surface2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Period list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {local.map((def, i) => {
            const meta = EVENT_META[def.type]
            return (
              <div key={i} style={{ background: 'var(--surface2)', border: `.5px solid ${def.type !== 'class' ? meta.color + '30' : 'var(--border)'}`, borderRadius: 14, padding: '14px 14px 12px', position: 'relative', transition: 'border-color .15s' }}>
                {/* Row top: type selector + label */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 9, background: meta.bg, border: `.5px solid ${meta.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                    {meta.icon}
                  </div>
                  <select value={def.type}
                    onChange={e => {
                      const t = e.target.value as EventType
                      const autoLabel = t !== 'class' && t !== 'custom' ? EVENT_META[t].label : def.label
                      upd(i, { type: t, label: autoLabel })
                    }}
                    style={{ flex: '0 0 120px', fontSize: 12, fontWeight: 700, color: meta.color, background: meta.bg, border: `.5px solid ${meta.color}30`, borderRadius: 8, padding: '5px 8px', cursor: 'pointer', outline: 'none' }}
                  >
                    {(Object.keys(EVENT_META) as EventType[]).map(t => (
                      <option key={t} value={t}>{EVENT_META[t].label}</option>
                    ))}
                  </select>
                  <input value={def.label} onChange={e => upd(i, { label: e.target.value })}
                    placeholder="Period label…"
                    style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--txt)', background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
                  />
                  <button onClick={() => remove(i)} style={{ width: 24, height: 24, borderRadius: 7, border: 'none', background: 'rgba(244,63,94,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', flexShrink: 0, fontSize: 10 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                  </button>
                </div>
                {/* Time row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: def.type !== 'class' ? 10 : 0 }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>Start</div>
                    <input type="time" value={def.startTime} onChange={e => upd(i, { startTime: e.target.value })}
                      style={{ width: '100%', fontSize: 12, fontWeight: 600, color: 'var(--txt)', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', outline: 'none', fontFamily: 'var(--font3)' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 4 }}>End</div>
                    <input type="time" value={def.endTime} onChange={e => upd(i, { endTime: e.target.value })}
                      style={{ width: '100%', fontSize: 12, fontWeight: 600, color: 'var(--txt)', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 8, padding: '6px 10px', outline: 'none', fontFamily: 'var(--font3)' }}
                    />
                  </div>
                </div>
                {/* Day selector — only for non-class event periods */}
                {def.type !== 'class' && (
                  <div style={{ marginTop: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Active on days <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(tap to exclude)</span></div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {DAYS.map(([dayNum, label]) => {
                        const active = !def.days || def.days.length === 0 || def.days.includes(dayNum)
                        return (
                          <button key={dayNum} type="button"
                            onClick={() => {
                              const allDays = [1,2,3,4,5,6,7]
                              const current = def.days?.length ? def.days : allDays
                              const next    = active ? current.filter(d => d !== dayNum) : [...current, dayNum].sort((a,b)=>a-b)
                              upd(i, { days: next.length === 7 ? undefined : next })
                            }}
                            style={{ width: 36, height: 30, borderRadius: 8, border: `.5px solid ${active ? meta.color + '45' : 'var(--border)'}`, background: active ? `${meta.color}18` : 'var(--surface)', color: active ? meta.color : 'var(--txt3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .13s' }}
                          >{label}</button>
                        )
                      })}
                    </div>
                    {def.days && def.days.length < 7 && (
                      <div style={{ fontSize: 11, color: meta.color, marginTop: 5, opacity: .8 }}>
                        Only on: {def.days.map(d => DAYS.find(([n]) => n === d)?.[1]).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={addPeriod} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '11px', borderRadius: 12, border: '1.5px dashed var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--txt3)', fontSize: 13, fontWeight: 600, transition: 'all .14s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt3)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Period
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 20px', borderTop: '.5px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={reset} style={{ padding: '10px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>
            Reset Defaults
          </button>
          <button onClick={save} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,#0d9488,#0f766e)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,.4)' }}>
            Save Configuration
          </button>
        </div>
      </div>
    </div>,
    portal
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN SLOT MODAL
// ═══════════════════════════════════════════════════════════════════════════════
const Lbl = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>
    {children}{required && <span style={{ color: 'var(--danger)', marginLeft: 2 }}>*</span>}
  </label>
)

function AssignModal({ target, term, year, periodDefs, onClose, onSaved }: {
  target: ModalTarget; term: string; year: number
  periodDefs: PeriodDef[]
  onClose: () => void; onSaved: () => void
}) {
  const { data: allSubjects = [] } = useSubjects()
  const { data: allTeachers = [] } = useTeachersForTimetable()
  const createSlot     = useCreateTimetableSlot()
  const checkCollision = useCheckCollision()
  const [teacherId, setTeacherId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [err,       setErr]       = useState('')
  const [search,    setSearch]    = useState('')

  // ── Resolve period time (read-only from predefined config) ──
  const periodDef = periodDefs.find(p => p.num === target.period)
  const startTime = periodDef?.startTime ?? ''
  const endTime   = periodDef?.endTime   ?? ''
  const dayLabel  = DAYS.find(d => d[0] === target.day)?.[1] ?? ''

  // ── Filter: ONLY teachers assigned to this class ──────────────
  const classTeachers = allTeachers.filter(t =>
    t.classes.includes(target.classId)
  )
  // If nobody is assigned yet, fall back to all teachers (better than empty)
  const teachers = classTeachers.length > 0 ? classTeachers : allTeachers
  const isFiltered = classTeachers.length > 0

  const visibleTeachers = search.trim()
    ? teachers.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : teachers

  const selectedTeacher  = teachers.find(t => t.id === teacherId)
  const filteredSubjects = selectedTeacher && selectedTeacher.subjects.length > 0
    ? allSubjects.filter(s => selectedTeacher.subjects.includes(s.id))
    : allSubjects
  const noSubjects = !!selectedTeacher && selectedTeacher.subjects.length === 0

  async function save() {
    if (!teacherId || !subjectId) { setErr('Select a teacher and subject'); return }
    setErr('')
    try {
      const { classConflict, teacherConflict } = await checkCollision.mutateAsync({
        classId: target.classId, streamId: target.streamId,
        teacherId, dayOfWeek: target.day, periodNumber: target.period, term, year,
      })
      if (classConflict)   { setErr('This class already has a slot at this period.'); return }
      if (teacherConflict) { setErr(`${selectedTeacher?.name ?? 'Teacher'} is double-booked at period ${target.period} on ${dayLabel}.`); return }
      await createSlot.mutateAsync({
        classId: target.classId, streamId: target.streamId,
        subjectId, teacherId,
        dayOfWeek: target.day as 1|2|3|4|5|6|7,
        periodNumber: target.period,
        startTime: startTime || null, endTime: endTime || null, term, year,
      })
      onSaved()
    } catch (ex: any) { setErr(ex.message ?? 'Failed to save') }
  }

  const busy   = createSlot.isPending || checkCollision.isPending
  const portal = document.querySelector('.ar') as HTMLElement ?? document.body
  const canSave = teacherId && subjectId && !busy

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 640, maxHeight: '92dvh', background: 'var(--surface)', borderRadius: 26, boxShadow: '0 32px 100px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'discCenterIn .26s cubic-bezier(.32,.72,0,1) both' }}>

        {/* ── Premium gradient header ── */}
        <div style={{ background: 'linear-gradient(135deg, #2d1b69 0%, #4c1d95 50%, #5b21b6 100%)', padding: '24px 28px 20px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, left: 80, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', letterSpacing: -.4, lineHeight: 1 }}>Assign Period Slot</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', marginTop: 3 }}>{dayLabel} · Period {target.period}</div>
                </div>
              </div>
              {/* Period time chip */}
              {(startTime || endTime) && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 99, padding: '4px 12px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff', fontFamily: 'var(--font3)' }}>{startTime}{endTime ? ` – ${endTime}` : ''}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.12)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.7)', flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Filter info */}
          {isFiltered ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(13,148,136,.07)', border: '.5px solid rgba(13,148,136,.2)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <span style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>
                Showing {classTeachers.length} teacher{classTeachers.length !== 1 ? 's' : ''} assigned to this class
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,.07)', border: '.5px solid rgba(245,158,11,.2)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700 }}>
                No teachers assigned to this class — showing all. Assign teachers in DoS → Teachers first.
              </span>
            </div>
          )}

          {/* Teacher picker */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Lbl required>Teacher</Lbl>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: .4 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  style={{ paddingLeft: 26, paddingRight: 10, paddingTop: 5, paddingBottom: 5, borderRadius: 8, border: '.5px solid var(--border)', fontSize: 12, background: 'var(--surface2)', color: 'var(--txt)', outline: 'none', width: 140 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
              {visibleTeachers.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--txt3)', padding: '16px', background: 'var(--surface2)', borderRadius: 12, textAlign: 'center' }}>
                  {search ? `No teachers match "${search}"` : 'No teachers available.'}
                </div>
              )}
              {visibleTeachers.map(t => {
                const active = teacherId === t.id
                const [col, bg] = subjectColor(t.id)
                return (
                  <div key={t.id} onClick={() => { setTeacherId(t.id); setSubjectId(''); setErr('') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, border: `1.5px solid ${active ? col : 'var(--border)'}`, background: active ? bg : 'var(--surface)', cursor: 'pointer', transition: 'all .15s cubic-bezier(.34,1.56,.64,1)', boxShadow: active ? `0 4px 16px ${col}25` : 'none', transform: active ? 'scale(1.01)' : 'none' }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 13, background: `linear-gradient(135deg, ${col}, ${col}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, fontFamily: 'var(--font2)', boxShadow: `0 3px 10px ${col}40` }}>
                      {ini(t.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font2)' }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{t.subjects.length > 0 ? `${t.subjects.length} subject${t.subjects.length !== 1 ? 's' : ''}` : 'No subjects'}</span>
                        {t.classes.length > 0 && <span style={{ color: 'var(--brand)' }}>{t.classes.length} class{t.classes.length !== 1 ? 'es' : ''}</span>}
                      </div>
                    </div>
                    {active && (
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Subject chips */}
          {teacherId && (
            <div>
              <Lbl required>Subject</Lbl>
              {noSubjects ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '.5px solid rgba(245,158,11,.25)', color: 'var(--warning)', fontSize: 13, fontWeight: 600 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  No subjects assigned to this teacher. Assign subjects in DoS → Teachers first.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {filteredSubjects.map(s => {
                    const [col, bg] = subjectColor(s.id)
                    const active = subjectId === s.id
                    return (
                      <button key={s.id} type="button" onClick={() => setSubjectId(s.id)}
                        style={{ padding: '8px 18px', borderRadius: 99, border: `1.5px solid ${active ? col : 'var(--border)'}`, background: active ? bg : 'var(--surface2)', color: active ? col : 'var(--txt3)', fontSize: 13.5, fontWeight: active ? 800 : 600, cursor: 'pointer', transition: 'all .15s', boxShadow: active ? `0 2px 10px ${col}30` : 'none' }}
                      >{s.name}</button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {err && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(244,63,94,.07)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
              <svg width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {err}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '16px 28px 22px', borderTop: '.5px solid var(--border)', flexShrink: 0, display: 'flex', gap: 12 }}>
          <button onClick={onClose}
            style={{ flex: 1, height: 48, borderRadius: 14, background: 'var(--surface2)', border: '.5px solid var(--border)', fontWeight: 700, fontSize: 14, cursor: 'pointer', color: 'var(--txt2)', transition: 'background .13s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
          >Cancel</button>
          <button disabled={!canSave} onClick={() => { void save() }}
            style={{ flex: 2, height: 48, borderRadius: 14, border: 'none', background: canSave ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'var(--border)', color: canSave ? '#fff' : 'var(--txt3)', fontWeight: 800, fontSize: 14, cursor: canSave ? 'pointer' : 'default', transition: 'all .18s', boxShadow: canSave ? '0 6px 20px rgba(139,92,246,.45)' : 'none', letterSpacing: .2 }}
          >
            {busy ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }} />
                Checking…
              </span>
            ) : 'Assign Slot'}
          </button>
        </div>
      </div>
    </div>,
    portal
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAGGABLE SLOT CHIP  (builder view)
// ═══════════════════════════════════════════════════════════════════════════════
function SlotChip({ slot, onDelete }: { slot: TimetableSlot; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id, data: { slot } })
  const [color, bg] = subjectColor(slot.subjectId)
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ background: bg, border: `.5px solid ${color}40`, borderRadius: 10, padding: '6px 8px', cursor: isDragging ? 'grabbing' : 'grab', opacity: isDragging ? 0.3 : 1, position: 'relative', userSelect: 'none', WebkitUserSelect: 'none', transition: 'opacity .15s', height: '100%', boxSizing: 'border-box' }}
    >
      <div style={{ fontWeight: 700, fontSize: 11.5, color, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 14, marginBottom: 2 }}>{slot.subjectName ?? '—'}</div>
      <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 900, color, flexShrink: 0 }}>{ini(slot.teacherName ?? '?')}</div>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.teacherName?.split(' ')[0] ?? '—'}</span>
      </div>
      {slot.startTime && <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 1, fontFamily: 'var(--font3)' }}>{slot.startTime}–{slot.endTime}</div>}
      <button onClick={e => { e.stopPropagation(); onDelete() }}
        style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: 5, border: 'none', background: 'rgba(0,0,0,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', padding: 0, lineHeight: 1 }}
      >✕</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DROPPABLE CELL  (builder view)
// ═══════════════════════════════════════════════════════════════════════════════
function TimetableCell({ day, period, slot, conflict, onClickEmpty, onDelete }: {
  day: number; period: number; slot?: TimetableSlot; conflict: boolean
  onClickEmpty: () => void; onDelete: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `cell-${day}-${period}`, data: { day, period } })
  return (
    <td ref={setNodeRef} style={{ padding: 4, width: '18%', height: 80, verticalAlign: 'top', transition: 'background .14s',
      background: conflict ? 'rgba(244,63,94,.05)' : isOver ? 'rgba(13,148,136,.08)' : 'transparent',
      border: conflict ? '.5px solid rgba(244,63,94,.28)' : '.5px solid var(--border)',
    }}>
      {slot ? (
        <SlotChip slot={slot} onDelete={onDelete} />
      ) : (
        <div onClick={onClickEmpty} className="timetable-empty-cell"
          style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 7, border: '.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .14s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </div>
      )}
    </td>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILDER VIEW  (single class deep-dive)
// ═══════════════════════════════════════════════════════════════════════════════
function BuilderView({ term, year, periodDefs, onAssign, initialClassId }: {
  term: string; year: number; periodDefs: PeriodDef[]
  onAssign: (t: ModalTarget) => void
  initialClassId?: string | null
}) {
  const isMobile = useIsMobile()
  const { data: classes = [] } = useClasses()
  const [selectedClass,  setSelectedClass]  = useState<string | null>(initialClassId ?? null)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [mobileDay,      setMobileDay]      = useState<number>(1)
  const [dragActive,     setDragActive]     = useState(false)
  const [published,      setPublished]      = useState(false)

  const { data: streams = [] } = useStreams(selectedClass)
  const { data: slots = [], isLoading } = useTimetableSlots({ classId: selectedClass, streamId: selectedStream, term, year })
  const deleteSlot = useDeleteTimetableSlot()
  const createSlot = useCreateTimetableSlot()
  const publishMut = usePublishTimetable()

  // Reset stream/published when class changes
  useEffect(() => { setSelectedStream(null); setPublished(false) }, [selectedClass])

  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  const conflictKeys = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of slots) {
      const k = `${s.teacherId}-${s.dayOfWeek}-${s.periodNumber}`
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const keys = new Set<string>()
    for (const s of slots) {
      if ((counts.get(`${s.teacherId}-${s.dayOfWeek}-${s.periodNumber}`) ?? 0) > 1)
        keys.add(`${s.dayOfWeek}-${s.periodNumber}`)
    }
    return keys
  }, [slots])

  const todayCol = jsToSchoolDay(new Date().getDay())
  const classPeriods = periodDefs.filter(d => d.type === 'class')
  const publishedCount = slots.filter(s => s.isPublished).length
  const totalClassSlots = classPeriods.length * 5

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setDragActive(false)
    if (!over || !selectedClass) return
    const parts = (over.id as string).split('-')
    const newDay = parseInt(parts[1]) as 1|2|3|4|5|6|7
    const newPeriod = parseInt(parts[2])
    const slot = active.data.current?.slot as TimetableSlot | undefined
    if (!slot) return
    if (slot.dayOfWeek === newDay && slot.periodNumber === newPeriod) return
    if (slotMap.has(`${newDay}-${newPeriod}`)) return
    try {
      await deleteSlot.mutateAsync(slot.id)
      await createSlot.mutateAsync({
        classId: slot.classId, streamId: slot.streamId,
        subjectId: slot.subjectId, teacherId: slot.teacherId,
        dayOfWeek: newDay, periodNumber: newPeriod,
        startTime: slot.startTime, endTime: slot.endTime, term, year,
      })
    } catch { /**/ }
  }

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name ?? ''

  // ── Class + stream selector ────────────────────────────────────────────────
  const ClassPicker = (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 16px', alignItems: 'flex-end' }}>
      <div style={{ flex: '1 1 160px', minWidth: 140 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Class</div>
        <select value={selectedClass ?? ''} onChange={e => setSelectedClass(e.target.value || null)} className="sui-input" style={{ width: '100%' }}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {selectedClass && streams.length > 0 && (
        <div style={{ flex: '1 1 130px', minWidth: 120 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Stream</div>
          <select value={selectedStream ?? ''} onChange={e => setSelectedStream(e.target.value || null)} className="sui-input" style={{ width: '100%' }}>
            <option value="">All streams</option>
            {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {selectedClass && slots.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
          <span style={{ padding: '5px 12px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
            background: publishedCount === slots.length ? 'rgba(16,185,129,.1)' : 'rgba(139,92,246,.1)',
            color: publishedCount === slots.length ? 'var(--success)' : '#8b5cf6',
            border: `.5px solid ${publishedCount === slots.length ? 'rgba(16,185,129,.25)' : 'rgba(139,92,246,.25)'}`,
          }}>
            {slots.length}/{totalClassSlots} slots
          </span>
          <button disabled={publishMut.isPending || published || slots.length === 0}
            onClick={() => { void publishMut.mutateAsync({ classId: selectedClass!, term, year }).then(() => setPublished(true)) }}
            style={{ padding: '8px 16px', borderRadius: 10, border: published ? '.5px solid rgba(16,185,129,.3)' : 'none', background: published ? 'rgba(16,185,129,.1)' : slots.length === 0 ? 'var(--surface2)' : 'linear-gradient(145deg,#10b981,#059669)', color: published ? 'var(--success)' : slots.length === 0 ? 'var(--txt3)' : '#fff', fontWeight: 700, fontSize: 12.5, cursor: published || slots.length === 0 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: published || slots.length === 0 ? 'none' : '0 3px 10px rgba(16,185,129,.4)' }}
          >
            {published ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Published</> : publishMut.isPending ? 'Publishing…' : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>Publish</>}
          </button>
        </div>
      )}
    </div>
  )

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!selectedClass) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ClassPicker}
      <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
        <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(145deg,rgba(139,92,246,.15),rgba(139,92,246,.05))', border: '.5px solid rgba(139,92,246,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>Select a class to build its timetable</div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 340, margin: '0 auto' }}>Switch to Overview mode to see and edit all classes at once.</div>
      </div>
    </div>
  )

  // ── Mobile day-tab view ───────────────────────────────────────────────────
  if (isMobile) {
    const daySlots = slots.filter(s => s.dayOfWeek === mobileDay)
    const daySlotMap = new Map(daySlots.map(s => [s.periodNumber, s]))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ClassPicker}
        {isLoading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="shule-skeleton" style={{ width: 200, height: 20, borderRadius: 10 }} /></div> : (
          <>
            {/* Day tabs */}
            <div style={{ display: 'flex', gap: 6, background: 'var(--surface)', padding: '10px 14px', borderRadius: 14, border: '.5px solid var(--border)', overflowX: 'auto' }}>
              {DAYS.map(([d, label]) => (
                <button key={d} onClick={() => setMobileDay(d)}
                  style={{ flex: '0 0 auto', padding: '8px 16px', borderRadius: 10, border: 'none', background: mobileDay === d ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'var(--surface2)', color: mobileDay === d ? '#fff' : 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', boxShadow: mobileDay === d ? '0 3px 10px rgba(139,92,246,.4)' : 'none', position: 'relative' }}
                >
                  {label}
                  {d === todayCol && <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: mobileDay === d ? 'rgba(255,255,255,.8)' : '#8b5cf6' }} />}
                </button>
              ))}
            </div>

            {/* Period cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {periodDefs.map(def => {
                const isEvent = def.type !== 'class'
                const meta = EVENT_META[def.type]
                const slot = daySlotMap.get(def.num)
                const isConflict = conflictKeys.has(`${mobileDay}-${def.num}`)

                if (isEvent) {
                  if (!appliesToDay(def, mobileDay)) return null
                  return (
                    <div key={def.num} style={{ padding: '10px 16px', borderRadius: 12, background: meta.bg, border: `.5px solid ${meta.color}30`, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{meta.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>{def.label}</div>
                        {def.startTime && <div style={{ fontSize: 11, color: meta.color, opacity: .7, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                      </div>
                    </div>
                  )
                }

                return (
                  <div key={def.num} onClick={() => !slot && onAssign({ classId: selectedClass!, streamId: selectedStream, day: mobileDay, period: def.num })}
                    style={{ padding: '12px 14px', borderRadius: 12, border: `.5px solid ${isConflict ? 'rgba(244,63,94,.4)' : slot ? 'var(--border)' : '.5px dashed var(--border)'}`, background: isConflict ? 'rgba(244,63,94,.04)' : 'var(--surface)', cursor: slot ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'background .14s' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>P{def.num}</span>
                    </div>
                    {slot ? (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {(() => { const [c] = subjectColor(slot.subjectId); return <><div style={{ fontSize: 13.5, fontWeight: 700, color: c, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName}</div><div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>{slot.teacherName}</div></> })()}
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, color: 'var(--txt3)', fontWeight: 500 }}>{def.label}</div>
                        {def.startTime && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                      </div>
                    )}
                    {!slot && (
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(139,92,246,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </div>
                    )}
                    {slot && (
                      <button onClick={e => { e.stopPropagation(); void deleteSlot.mutateAsync(slot.id) }}
                        style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'rgba(244,63,94,.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger)', flexShrink: 0 }}
                      ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg></button>
                    )}
                  </div>
                )
              })}
            </div>
            {conflictKeys.size > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 12, fontWeight: 700 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                {conflictKeys.size} teacher conflict{conflictKeys.size !== 1 ? 's' : ''} — check all days
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Desktop DnD grid ─────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {ClassPicker}
      {isLoading && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 10 }} />)}</div>}
      {!isLoading && (
        <DndContext onDragStart={() => setDragActive(true)} onDragEnd={e => { void handleDragEnd(e) }} onDragCancel={() => setDragActive(false)}>
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
            {/* Grid header bar */}
            <div style={{ padding: '14px 20px 12px', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: 'linear-gradient(135deg,rgba(139,92,246,.04),transparent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{selectedClassName}</span>
                {selectedStream && <span style={{ padding: '2px 10px', borderRadius: 99, background: 'rgba(139,92,246,.1)', color: '#8b5cf6', fontSize: 11, fontWeight: 700, border: '.5px solid rgba(139,92,246,.2)' }}>{streams.find(s => s.id === selectedStream)?.name}</span>}
                <span style={{ padding: '2px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--txt3)', fontSize: 11, fontWeight: 600, border: '.5px solid var(--border)' }}>{term} · {year}</span>
              </div>
              {conflictKeys.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 11.5, fontWeight: 700 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  {conflictKeys.size} conflict{conflictKeys.size !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            <div className="hscroll">
              <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', background: 'var(--surface2)', fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 110, textAlign: 'left' }}>Period</th>
                    {DAYS.map(([d, label]) => (
                      <th key={d} style={{ padding: '10px 8px', background: d === todayCol ? 'rgba(139,92,246,.07)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? '#8b5cf6' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                        {label}
                        {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2.5, borderRadius: 2, background: '#8b5cf6' }} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periodDefs.map(def => {
                    const isEvent = def.type !== 'class'
                    const meta    = EVENT_META[def.type]

                    if (isEvent) return (
                      <tr key={def.num}>
                        <td style={{ padding: '6px 12px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: `.5px solid ${meta.color}18`, width: 110 }}>
                          <div style={{ fontWeight: 800, fontSize: 11, color: meta.color }}>{meta.icon} {def.label}</div>
                          {def.startTime && <div style={{ fontSize: 9.5, color: meta.color, opacity: .65, fontFamily: 'var(--font3)', marginTop: 1 }}>{def.startTime}–{def.endTime}</div>}
                        </td>
                        {DAYS.map(([day]) => {
                          const applies = appliesToDay(def, day)
                          return (
                            <td key={day} style={{ border: `.5px solid ${applies ? meta.color + '18' : 'var(--border)'}`, background: applies ? meta.bg : 'transparent', padding: applies ? '7px 10px' : 4, verticalAlign: 'middle', height: 42 }}>
                              {applies ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 14 }}>{meta.icon}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{def.label}</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: 'var(--border)', fontSize: 12 }}>—</span>
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    )

                    return (
                      <tr key={def.num}>
                        <td style={{ padding: '6px 12px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', width: 110 }}>
                          <div style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--txt2)' }}>{def.label}</div>
                          {def.startTime && <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 1, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                        </td>
                        {DAYS.map(([day]) => {
                          const key  = `${day}-${def.num}`
                          const slot = slotMap.get(key)
                          return (
                            <TimetableCell
                              key={key} day={day} period={def.num}
                              slot={slot} conflict={conflictKeys.has(key)}
                              onClickEmpty={() => onAssign({ classId: selectedClass!, streamId: selectedStream, day, period: def.num })}
                              onDelete={() => slot && void deleteSlot.mutateAsync(slot.id)}
                            />
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <DragOverlay>
            {dragActive && (
              <div style={{ background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', color: '#fff', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, boxShadow: '0 6px 24px rgba(139,92,246,.5)', cursor: 'grabbing', userSelect: 'none' }}>
                Moving slot…
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Legend */}
      {!isLoading && (
        <div style={{ display: 'flex', gap: 18, fontSize: 11.5, color: 'var(--txt3)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(99,102,241,.15)', border: '.5px solid rgba(99,102,241,.3)' }} />
            Assigned · drag to move
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.25)' }} />
            Teacher conflict
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, border: '.5px dashed var(--border)' }} />
            Empty · click to assign
          </span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI TIMETABLE CARD  (overview mode)
// ═══════════════════════════════════════════════════════════════════════════════
function MiniCard({ cls, slots, periodDefs, onCellClick, onEdit }: {
  cls: { id: string; name: string; level: string | null }
  slots: TimetableSlot[]
  periodDefs: PeriodDef[]
  onCellClick: (day: number, period: number) => void
  onEdit: () => void
}) {
  const isMobile = useIsMobile()
  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  const classPeriods = periodDefs.filter(d => d.type === 'class')
  const filled   = slots.length
  const total    = classPeriods.length * 5
  const pct      = total > 0 ? Math.round((filled / total) * 100) : 0
  const pubCount = slots.filter(s => s.isPublished).length
  const todayCol = jsToSchoolDay(new Date().getDay())

  return (
    <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.05)', display: 'flex', flexDirection: 'column', transition: 'box-shadow .15s, transform .15s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,.1)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.05)'; e.currentTarget.style.transform = 'none' }}
    >
      {/* Card header */}
      <div style={{ padding: '14px 16px 12px', background: 'linear-gradient(135deg,rgba(139,92,246,.06),rgba(13,148,136,.03))', borderBottom: '.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(139,92,246,.35)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 15, color: 'var(--txt)', letterSpacing: -.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls.name}</div>
            {cls.level && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{cls.level}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font3)' }}>{pct}%</span>
            {pubCount > 0 && <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--success)', padding: '1px 7px', borderRadius: 99, background: 'rgba(16,185,129,.1)', border: '.5px solid rgba(16,185,129,.2)' }}>✓ {pubCount} pub</span>}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ height: 5, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: pct >= 80 ? 'var(--success)' : pct >= 40 ? 'var(--warning)' : 'var(--danger)', transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>

      {/* Mini grid (desktop only — too tiny on mobile) */}
      {!isMobile && (
        <div style={{ padding: '8px 10px 6px', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 58, padding: '3px 5px', fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textAlign: 'left' }}></th>
                {DAYS.map(([d, label]) => (
                  <th key={d} style={{ padding: '3px 2px', fontSize: 9.5, fontWeight: 700, color: d === todayCol ? '#8b5cf6' : 'var(--txt3)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodDefs.map(def => {
                const isEvent = def.type !== 'class'
                const meta    = EVENT_META[def.type]

                if (isEvent) return (
                  <tr key={def.num}>
                    <td style={{ padding: '1px 2px', width: 58 }}>
                      <div style={{ height: 20, borderRadius: 5, background: meta.bg, display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: meta.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.icon}</span>
                      </div>
                    </td>
                    {DAYS.map(([day]) => (
                      <td key={day} style={{ padding: '1px 1px' }}>
                        {appliesToDay(def, day) ? (
                          <div style={{ height: 20, borderRadius: 5, background: meta.bg, border: `.5px solid ${meta.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 8, fontWeight: 700, color: meta.color }}>{meta.icon}</span>
                          </div>
                        ) : (
                          <div style={{ height: 20, borderRadius: 5, border: '.5px dashed var(--border)', opacity: .3 }} />
                        )}
                      </td>
                    ))}
                  </tr>
                )

                return (
                  <tr key={def.num}>
                    <td style={{ padding: '2px 4px 2px 2px', fontSize: 9, fontWeight: 600, color: 'var(--txt3)' }}>
                      {def.startTime ? <span style={{ fontFamily: 'var(--font3)', fontSize: 8 }}>{def.startTime}</span> : <span>{def.label}</span>}
                    </td>
                    {DAYS.map(([day]) => {
                      const slot = slotMap.get(`${day}-${def.num}`)
                      if (!slot) return (
                        <td key={day} style={{ padding: '2px', textAlign: 'center' }}>
                          <div onClick={() => onCellClick(day, def.num)}
                            style={{ width: '100%', height: 26, borderRadius: 5, border: '.5px dashed var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          />
                        </td>
                      )
                      const [col, bg] = subjectColor(slot.subjectId)
                      return (
                        <td key={day} style={{ padding: '2px', textAlign: 'center' }}>
                          <div title={`${slot.subjectName} — ${slot.teacherName}`}
                            style={{ width: '100%', height: 26, borderRadius: 5, background: bg, border: `.5px solid ${col}30`, cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: col }} />
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile: just show filled count */}
      {isMobile && (
        <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12.5, color: 'var(--txt3)' }}>{filled}/{total} periods filled</span>
        </div>
      )}

      {/* Edit button */}
      <div style={{ padding: '10px 14px 14px', marginTop: 'auto' }}>
        <button onClick={onEdit}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '.5px solid rgba(139,92,246,.3)', background: 'rgba(139,92,246,.06)', color: '#8b5cf6', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all .14s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,.06)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Timetable
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW VIEW  (eagle-eye)
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewView({ term, year, periodDefs, onAssign, onEditClass }: {
  term: string; year: number; periodDefs: PeriodDef[]
  onAssign: (t: ModalTarget) => void
  onEditClass: (classId: string) => void
}) {
  const { data: classes = [] } = useClasses()
  const [filterLevel, setFilterLevel] = useState<string>('')

  const { data: allSlots = [], isLoading } = useTimetableSlots({ term, year })

  const levels = useMemo(() => {
    const s = new Set<string>()
    for (const c of classes) if (c.level) s.add(c.level)
    return [...s].sort()
  }, [classes])

  const slotsByClass = useMemo(() => {
    const m = new Map<string, TimetableSlot[]>()
    for (const s of allSlots) {
      if (!m.has(s.classId)) m.set(s.classId, [])
      m.get(s.classId)!.push(s)
    }
    return m
  }, [allSlots])

  const filtered = useMemo(() =>
    filterLevel ? classes.filter(c => c.level === filterLevel) : classes,
    [classes, filterLevel]
  )

  const totalFilled  = allSlots.length
  const classPeriods = periodDefs.filter(d => d.type === 'class').length
  const totalSlots   = classes.length * classPeriods * 5
  const overallPct   = totalSlots > 0 ? Math.round((totalFilled / totalSlots) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Overview KPI bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 140px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Classes</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--txt)', fontFamily: 'var(--font2)', letterSpacing: -1 }}>{classes.length}</div>
        </div>
        <div style={{ flex: '1 1 140px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Slots Filled</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 40 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font2)', letterSpacing: -1 }}>{totalFilled}<span style={{ fontSize: 14, color: 'var(--txt3)', fontWeight: 600 }}>/{totalSlots}</span></div>
        </div>
        <div style={{ flex: '1 1 140px', padding: '14px 18px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.04)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6 }}>Coverage</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: overallPct >= 80 ? 'var(--success)' : overallPct >= 40 ? 'var(--warning)' : 'var(--danger)', fontFamily: 'var(--font2)', letterSpacing: -1 }}>{overallPct}%</div>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: 'var(--surface2)', marginTop: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: overallPct >= 80 ? 'var(--success)' : overallPct >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 99, transition: 'width .6s' }} />
          </div>
        </div>
      </div>

      {/* Level filter */}
      {levels.length > 1 && (
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Filter:</span>
          {['', ...levels].map(lv => (
            <button key={lv || 'all'} onClick={() => setFilterLevel(lv)}
              style={{ padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, border: filterLevel === lv ? '.5px solid var(--brand)' : '.5px solid var(--border)', background: filterLevel === lv ? 'rgba(13,148,136,.1)' : 'var(--surface)', color: filterLevel === lv ? 'var(--brand)' : 'var(--txt3)', cursor: 'pointer', transition: 'all .14s' }}
            >{lv || 'All Levels'}</button>
          ))}
        </div>
      )}

      {/* Cards grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="shule-skeleton" style={{ height: 340, borderRadius: 18 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt3)' }}>No classes found{filterLevel ? ` for ${filterLevel}` : ''}.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 18 }}>
          {filtered.map(cls => (
            <MiniCard
              key={cls.id}
              cls={cls}
              slots={slotsByClass.get(cls.id) ?? []}
              periodDefs={periodDefs}
              onCellClick={(day, period) => onAssign({ classId: cls.id, streamId: null, day, period })}
              onEdit={() => onEditClass(cls.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SCHOOL-WIDE TIMETABLE  (all classes merged — read/filter view)
// ═══════════════════════════════════════════════════════════════════════════════
function SchoolView({ term, year, periodDefs }: {
  term: string; year: number; periodDefs: PeriodDef[]
}) {
  const isMobile = useIsMobile()
  const { data: classes = [] } = useClasses()
  const [filterClassId, setFilterClassId] = useState('')
  const [mobileDay, setMobileDay] = useState(1)

  const { data: allSlots = [], isLoading } = useTimetableSlots({ term, year })

  const classNameMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of classes) m.set(c.id, c.name)
    return m
  }, [classes])

  // day×period → slots[]
  const cellMap = useMemo(() => {
    const m = new Map<string, TimetableSlot[]>()
    for (const s of allSlots) {
      const key = `${s.dayOfWeek}-${s.periodNumber}`
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    return m
  }, [allSlots])

  // teacher conflict keys: "day-period-teacherId"
  const conflictSet = useMemo(() => {
    const s = new Set<string>()
    for (const [key, slots] of cellMap) {
      const seen = new Map<string, number>()
      for (const sl of slots) seen.set(sl.teacherId, (seen.get(sl.teacherId) ?? 0) + 1)
      for (const [tid, cnt] of seen) if (cnt > 1) s.add(`${key}-${tid}`)
    }
    return s
  }, [cellMap])

  const totalConflicts = conflictSet.size
  const todayCol = jsToSchoolDay(new Date().getDay())

  // When a class filter is active → show full-size single-class grid
  if (filterClassId) {
    const classSlots = allSlots.filter(s => s.classId === filterClassId)
    const slotMap = new Map(classSlots.map(s => [`${s.dayOfWeek}-${s.periodNumber}`, s]))
    const className = classNameMap.get(filterClassId) ?? ''
    const filled = classSlots.length
    const classPeriods = periodDefs.filter(d => d.type === 'class').length
    const pct = classPeriods * 5 > 0 ? Math.round((filled / (classPeriods * 5)) * 100) : 0

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Back to all classes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setFilterClassId('')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--txt3)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            All Classes
          </button>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 17, color: 'var(--txt)', letterSpacing: -.2 }}>{className}</div>
          <div style={{ padding: '3px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, background: pct >= 80 ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)', color: pct >= 80 ? 'var(--success)' : 'var(--warning)', border: `.5px solid ${pct >= 80 ? 'rgba(16,185,129,.25)' : 'rgba(245,158,11,.25)'}` }}>
            {pct}% filled
          </div>
        </div>
        {/* Full class grid */}
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
          <div className="hscroll">
            <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 14px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 130, textAlign: 'left' }}>Period</th>
                  {DAYS.map(([d, label]) => (
                    <th key={d} style={{ padding: '12px 8px', background: d === todayCol ? 'rgba(13,148,136,.06)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? 'var(--brand)' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                      {label}
                      {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2.5, borderRadius: 2, background: 'var(--brand)' }} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodDefs.map(def => {
                  const isEvent = def.type !== 'class'
                  const meta = EVENT_META[def.type]
                  if (isEvent) return (
                    <tr key={def.num}>
                      <td style={{ padding: '6px 12px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: `.5px solid ${meta.color}15` }}>
                        <div style={{ fontWeight: 800, fontSize: 11, color: meta.color }}>{meta.icon} {def.label}</div>
                        {def.startTime && <div style={{ fontSize: 9.5, color: meta.color, opacity: .6, fontFamily: 'var(--font3)', marginTop: 1 }}>{def.startTime}–{def.endTime}</div>}
                      </td>
                      {DAYS.map(([day]) => (
                        <td key={day} style={{ border: `.5px solid ${appliesToDay(def,day) ? meta.color+'18' : 'var(--border)'}`, background: appliesToDay(def,day) ? meta.bg : 'transparent', padding: appliesToDay(def,day) ? '7px 10px' : 4, verticalAlign: 'middle', height: 42 }}>
                          {appliesToDay(def,day) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 14 }}>{meta.icon}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{def.label}</span>
                            </div>
                          ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--border)', fontSize: 12 }}>—</span></div>}
                        </td>
                      ))}
                    </tr>
                  )
                  return (
                    <tr key={def.num}>
                      <td style={{ padding: '8px 14px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--txt2)' }}>{def.label}</div>
                        {def.startTime && <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                      </td>
                      {DAYS.map(([day]) => {
                        const slot = slotMap.get(`${day}-${def.num}`)
                        const [col, bg] = slot ? subjectColor(slot.subjectId) : ['var(--txt3)', 'transparent']
                        return (
                          <td key={day} style={{ padding: 5, width: '18%', height: 80, verticalAlign: 'top', border: '.5px solid var(--border)', background: day === todayCol ? 'rgba(13,148,136,.015)' : 'transparent' }}>
                            {slot ? (
                              <div style={{ background: bg, border: `.5px solid ${col}35`, borderRadius: 10, padding: '7px 9px', height: '100%', boxSizing: 'border-box' }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: col, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName ?? '—'}</div>
                                <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 900, color: col, flexShrink: 0 }}>{ini(slot.teacherName ?? '?')}</div>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.teacherName?.split(' ')[0] ?? '—'}</span>
                                </div>
                                {slot.startTime && <div style={{ fontSize: 9.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{slot.startTime}–{slot.endTime}</div>}
                              </div>
                            ) : (
                              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Full school merged view ──────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px', maxWidth: 300 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Filter to one class</div>
          <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            <option value="">All {classes.length} classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {totalConflicts > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(244,63,94,.08)', border: '.5px solid rgba(244,63,94,.22)', color: 'var(--danger)', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            {totalConflicts} teacher conflict{totalConflicts !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Mobile: day tabs + period list */}
      {isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', background: 'var(--surface)', padding: '10px 12px', borderRadius: 12, border: '.5px solid var(--border)' }}>
            {DAYS.map(([d, label]) => (
              <button key={d} onClick={() => setMobileDay(d)}
                style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 9, border: 'none', background: mobileDay === d ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'var(--surface2)', color: mobileDay === d ? '#fff' : 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s' }}
              >{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {periodDefs.map(def => {
              const isEvent = def.type !== 'class'
              const meta = EVENT_META[def.type]
              const slots = cellMap.get(`${mobileDay}-${def.num}`) ?? []
              if (isEvent) return (
                <div key={def.num} style={{ padding: '10px 14px', borderRadius: 12, background: meta.bg, border: `.5px solid ${meta.color}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{meta.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>{def.label}</span>
                  {def.startTime && <span style={{ fontSize: 11, color: meta.color, opacity: .7, fontFamily: 'var(--font3)', marginLeft: 4 }}>{def.startTime}–{def.endTime}</span>}
                </div>
              )
              return (
                <div key={def.num} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '7px 14px', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--txt2)' }}>{def.label}</span>
                    {def.startTime && <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)' }}>{slots.length} class{slots.length !== 1 ? 'es' : ''}</span>
                  </div>
                  {slots.length > 0 ? (
                    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {slots.map(s => {
                        const [col, bg] = classColor(s.classId)
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 9, background: bg, border: `.5px solid ${col}30` }}>
                            <div style={{ width: 34, height: 24, borderRadius: 6, background: `${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 900, color: col, flexShrink: 0, letterSpacing: -.2 }}>{(classNameMap.get(s.classId) ?? '?').slice(0, 4)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName ?? '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{s.teacherName?.split(' ')[0] ?? '—'}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '10px 14px', color: 'var(--txt3)', fontSize: 12 }}>No classes this period</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Desktop: merged grid */}
      {!isMobile && (
        <>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[1,2,3,4,5].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 10 }} />)}
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
              <div className="hscroll">
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 130, textAlign: 'left' }}>Period</th>
                      {DAYS.map(([d, label]) => (
                        <th key={d} style={{ padding: '12px 8px', background: d === todayCol ? 'rgba(13,148,136,.05)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? 'var(--brand)' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          {label}
                          {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2, background: 'var(--brand)' }} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodDefs.map(def => {
                      const isEvent = def.type !== 'class'
                      const meta = EVENT_META[def.type]
                      if (isEvent) return (
                        <tr key={def.num}>
                          <td style={{ padding: '6px 12px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: `.5px solid ${meta.color}15`, minWidth: 120 }}>
                            <div style={{ fontWeight: 800, fontSize: 11, color: meta.color }}>{meta.icon} {def.label}</div>
                            {def.startTime && <div style={{ fontSize: 9.5, color: meta.color, opacity: .6, fontFamily: 'var(--font3)', marginTop: 1 }}>{def.startTime}–{def.endTime}</div>}
                          </td>
                          {DAYS.map(([day]) => (
                            <td key={day} style={{ border: `.5px solid ${appliesToDay(def,day) ? meta.color+'18' : 'var(--border)'}`, background: appliesToDay(def,day) ? meta.bg : 'transparent', padding: appliesToDay(def,day) ? '7px 10px' : 4, verticalAlign: 'middle', height: 42, minWidth: 150 }}>
                              {appliesToDay(def,day) ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <span style={{ fontSize: 15 }}>{meta.icon}</span>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{def.label}</span>
                                </div>
                              ) : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--border)', fontSize: 12 }}>—</span></div>}
                            </td>
                          ))}
                        </tr>
                      )
                      return (
                        <tr key={def.num}>
                          <td style={{ padding: '8px 14px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', verticalAlign: 'top', minWidth: 120 }}>
                            <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--txt2)' }}>{def.label}</div>
                            {def.startTime && <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                          </td>
                          {DAYS.map(([day]) => {
                            const slots = cellMap.get(`${day}-${def.num}`) ?? []
                            const hasConflict = slots.some(s => conflictSet.has(`${day}-${def.num}-${s.teacherId}`))
                            return (
                              <td key={day} style={{ padding: 5, verticalAlign: 'top', border: '.5px solid var(--border)', background: hasConflict ? 'rgba(244,63,94,.02)' : day === todayCol ? 'rgba(13,148,136,.01)' : 'transparent', minWidth: 150 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {slots.map(s => {
                                    const [col, bg] = classColor(s.classId)
                                    const isConflict = conflictSet.has(`${day}-${def.num}-${s.teacherId}`)
                                    const cName = classNameMap.get(s.classId) ?? '?'
                                    return (
                                      <div key={s.id}
                                        title={`${cName}: ${s.subjectName ?? '—'} — ${s.teacherName ?? '—'}`}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 8, background: bg, border: `.5px solid ${isConflict ? 'rgba(244,63,94,.6)' : col + '30'}`, boxShadow: isConflict ? '0 0 0 1.5px rgba(244,63,94,.3)' : 'none', transition: 'opacity .15s' }}
                                      >
                                        <div style={{ flexShrink: 0, width: 28, height: 22, borderRadius: 5, background: `${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: col, letterSpacing: -.2 }}>
                                          {cName.replace(/\s+/g,'').slice(0,4)}
                                        </div>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                          <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName ?? '—'}</div>
                                          <div style={{ fontSize: 9.5, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.teacherName?.split(' ')[0] ?? '—'}</div>
                                        </div>
                                        {isConflict && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', flexShrink: 0 }} />}
                                      </div>
                                    )
                                  })}
                                  {slots.length === 0 && <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: 'var(--border)', fontSize: 14 }}>—</span></div>}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {/* Class colour legend */}
          {!isLoading && classes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0 }}>Jump to class:</span>
              {classes.map(c => {
                const [col, bg] = classColor(c.id)
                return (
                  <button key={c.id} onClick={() => setFilterClassId(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', transition: 'all .14s', border: `.5px solid ${col}50`, background: bg, color: col }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '.75')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />{c.name}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOS TIMETABLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DosTimetablePage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const [view,            setView]            = useState<ViewMode>('overview')
  const [term,            setTerm]            = useState('Term 1')
  const [year,            setYear]            = useState(new Date().getFullYear())
  const [showConfigPanel, setShowConfigPanel] = useState(false)
  const [assignTarget,    setAssignTarget]    = useState<ModalTarget | null>(null)
  const [builderClass,    setBuilderClass]    = useState<string | null>(null)

  const [periodDefs, setPeriodDefs] = useState<PeriodDef[]>(() =>
    user?.schoolId ? loadCfg(user.schoolId) : DEFAULT_PERIODS
  )

  useEffect(() => {
    if (user?.schoolId) setPeriodDefs(loadCfg(user.schoolId))
  }, [user?.schoolId])

  function handleConfigSave(defs: PeriodDef[]) {
    if (user?.schoolId) saveCfg(user.schoolId, defs)
    setPeriodDefs(defs)
  }

  function handleEditClass(classId: string) {
    setBuilderClass(classId)
    setView('builder')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#8b5cf6,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(139,92,246,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 19 : 23, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>Timetable Builder</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: 0, marginTop: 2 }}>
              {view === 'overview' ? 'Eagle-eye view — all classes at once' : 'Single class builder — drag slots to rearrange'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <button onClick={() => setShowConfigPanel(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: '.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--txt2)', boxShadow: '0 1px 4px rgba(0,0,0,.05)', transition: 'all .14s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M4.93 19.07l1.41-1.41M19.07 19.07l-1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
            {!isMobile && 'Configure Periods'}
          </button>
        </div>
      </div>

      {/* ── Filters + view toggle row ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '14px 18px', boxShadow: '0 1px 8px rgba(0,0,0,.04)' }}>
        {/* Term */}
        <div style={{ flex: '0 0 110px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Term</div>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Year */}
        <div style={{ flex: '0 0 88px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Year</div>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: '100%' }} />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface2)', borderRadius: 12, padding: 3, border: '.5px solid var(--border)', gap: 2 }}>
          {([
            ['overview', 'Overview',  'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z'],
            ['school',   'School',    'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
            ['builder',  'Builder',   'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18'],
          ] as [ViewMode, string, string][]).map(([v, label, path]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, border: 'none', background: view === v ? 'var(--surface)' : 'transparent', color: view === v ? 'var(--txt)' : 'var(--txt3)', fontSize: 12.5, fontWeight: view === v ? 700 : 600, cursor: 'pointer', transition: 'all .15s', boxShadow: view === v ? '0 1px 6px rgba(0,0,0,.08)' : 'none', whiteSpace: 'nowrap' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d={path}/></svg>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      {view === 'school' && (
        <SchoolView term={term} year={year} periodDefs={periodDefs} />
      )}
      {view === 'overview' ? (
        <OverviewView
          term={term} year={year} periodDefs={periodDefs}
          onAssign={setAssignTarget}
          onEditClass={handleEditClass}
        />
      ) : view === 'builder' ? (
        <BuilderView
          term={term} year={year} periodDefs={periodDefs}
          onAssign={setAssignTarget}
          initialClassId={builderClass}
        />
      ) : null}

      {/* Period config panel */}
      {showConfigPanel && (
        <PeriodConfigPanel
          defs={periodDefs}
          onChange={handleConfigSave}
          onClose={() => setShowConfigPanel(false)}
        />
      )}

      {/* Assign modal */}
      {assignTarget && (
        <AssignModal
          target={assignTarget} term={term} year={year}
          periodDefs={periodDefs}
          onClose={() => setAssignTarget(null)}
          onSaved={() => setAssignTarget(null)}
        />
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .timetable-empty-cell:hover > div { opacity: 1 !important; }
      `}</style>
    </div>
  )
}
