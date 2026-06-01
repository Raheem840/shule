import { useState, useMemo, useEffect } from 'react'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useTimetableSlots } from '../../hooks/useTimetableSlots'
import { useAuth } from '../../store/AuthContext'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TimetableSlot } from '../../types/week9'

// ─── Types ────────────────────────────────────────────────────────────────────
type EventType = 'class' | 'break' | 'lunch' | 'assembly' | 'prayer' | 'preps' | 'custom'
type PeriodDef = { num: number; type: EventType; label: string; startTime: string; endTime: string; days?: number[] }

function appliesToDay(def: PeriodDef, day: number): boolean {
  if (def.type === 'class') return true
  if (!def.days || def.days.length === 0) return true
  return def.days.includes(day)
}

const DAYS: [number, string][] = [[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[7,'Sun']]

function jsToSchoolDay(d: number): number | null {
  if (d === 0) return 7
  if (d >= 1 && d <= 6) return d
  return null
}

const EVENT_META: Record<EventType, { color: string; bg: string; icon: string }> = {
  class:    { color: '#64748b', bg: 'var(--surface2)',      icon: '📚' },
  break:    { color: '#f59e0b', bg: 'rgba(245,158,11,.12)', icon: '☕' },
  lunch:    { color: '#0ea5e9', bg: 'rgba(14,165,233,.12)', icon: '🍽' },
  assembly: { color: '#8b5cf6', bg: 'rgba(139,92,246,.12)', icon: '🎓' },
  prayer:   { color: '#10b981', bg: 'rgba(16,185,129,.12)', icon: '🙏' },
  preps:    { color: '#f43f5e', bg: 'rgba(244,63,94,.12)',  icon: '📖' },
  custom:   { color: '#0d9488', bg: 'rgba(13,148,136,.12)', icon: '⭐' },
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
  ['#6366f1','rgba(99,102,241,.14)'],  ['#0ea5e9','rgba(14,165,233,.14)'],
  ['#10b981','rgba(16,185,129,.14)'],  ['#f59e0b','rgba(245,158,11,.14)'],
  ['#f43f5e','rgba(244,63,94,.14)'],   ['#8b5cf6','rgba(139,92,246,.14)'],
  ['#ec4899','rgba(236,72,153,.14)'],  ['#0d9488','rgba(13,148,136,.14)'],
  ['#84cc16','rgba(132,204,22,.14)'],  ['#f97316','rgba(249,115,22,.14)'],
]

const SUBJ_PALETTE: [string, string][] = [
  ['#6366f1','rgba(99,102,241,.13)'],  ['#0ea5e9','rgba(14,165,233,.13)'],
  ['#10b981','rgba(16,185,129,.13)'],  ['#f59e0b','rgba(245,158,11,.13)'],
  ['#f43f5e','rgba(244,63,94,.13)'],   ['#8b5cf6','rgba(139,92,246,.13)'],
  ['#ec4899','rgba(236,72,153,.13)'],  ['#0d9488','rgba(13,148,136,.13)'],
]

function classColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return CLASS_PALETTE[Math.abs(h) % CLASS_PALETTE.length]
}

function subjectColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJ_PALETTE[Math.abs(h) % SUBJ_PALETTE.length]
}

function ini(n: string) { return n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() }

function loadPeriodDefs(schoolId: string): PeriodDef[] {
  try {
    const raw = localStorage.getItem(`shule:period-cfg:${schoolId}`)
    if (raw) return JSON.parse(raw) as PeriodDef[]
  } catch { /**/ }
  return DEFAULT_PERIODS
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEPUTY TIMETABLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function DeputyTimetablePage() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const { data: classes = [] } = useClasses()
  const [term,          setTerm]          = useState('Term 1')
  const [year,          setYear]          = useState(new Date().getFullYear())
  const [filterClassId, setFilterClassId] = useState('')
  const [mobileDay,     setMobileDay]     = useState(1)
  const [periodDefs,    setPeriodDefs]    = useState<PeriodDef[]>(DEFAULT_PERIODS)

  useEffect(() => {
    if (user?.schoolId) setPeriodDefs(loadPeriodDefs(user.schoolId))
  }, [user?.schoolId])

  // Load ALL slots (no class filter) for the school view
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

  // teacher conflicts
  const conflictSet = useMemo(() => {
    const s = new Set<string>()
    for (const [key, slots] of cellMap) {
      const seen = new Map<string, number>()
      for (const sl of slots) seen.set(sl.teacherId, (seen.get(sl.teacherId) ?? 0) + 1)
      for (const [tid, cnt] of seen) if (cnt > 1) s.add(`${key}-${tid}`)
    }
    return s
  }, [cellMap])

  const todayCol = jsToSchoolDay(new Date().getDay())
  const totalConflicts = conflictSet.size
  const publishedCount = allSlots.filter(s => s.isPublished).length

  // ── When filtering to a single class — full-size read-only grid ──────────────
  if (filterClassId) {
    const classSlots = allSlots.filter(s => s.classId === filterClassId)
    const slotMap = new Map(classSlots.map(s => [`${s.dayOfWeek}-${s.periodNumber}`, s]))
    const className = classNameMap.get(filterClassId) ?? ''

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 18 : 22, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>{className} Timetable</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>{term} · {year} · Read-only view</p>
          </div>
          <button onClick={() => setFilterClassId('')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 11, border: '.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--txt2)', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            School View
          </button>
        </div>

        {/* Full class grid */}
        {isMobile ? (
          // Mobile: day tabs
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', background: 'var(--surface)', padding: '10px 12px', borderRadius: 12, border: '.5px solid var(--border)' }}>
              {DAYS.map(([d, label]) => (
                <button key={d} onClick={() => setMobileDay(d)}
                  style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 9, border: 'none', background: mobileDay === d ? 'linear-gradient(145deg,#0ea5e9,#0284c7)' : 'var(--surface2)', color: mobileDay === d ? '#fff' : 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', boxShadow: mobileDay === d ? '0 3px 10px rgba(14,165,233,.4)' : 'none' }}
                >{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {periodDefs.map(def => {
                const isEvent = def.type !== 'class'
                const meta = EVENT_META[def.type]
                const slot = slotMap.get(`${mobileDay}-${def.num}`)
                if (isEvent) return (
                  <div key={def.num} style={{ padding: '10px 14px', borderRadius: 12, background: meta.bg, border: `.5px solid ${meta.color}30`, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{meta.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: meta.color }}>{def.label}</span>
                    {def.startTime && <span style={{ fontSize: 11, color: meta.color, opacity: .7, fontFamily: 'var(--font3)', marginLeft: 4 }}>{def.startTime}–{def.endTime}</span>}
                  </div>
                )
                const [col, bg] = slot ? subjectColor(slot.subjectId) : ['var(--txt3)', 'var(--surface)']
                return (
                  <div key={def.num} style={{ padding: '12px 14px', borderRadius: 12, border: `.5px solid ${slot ? col + '30' : 'var(--border)'}`, background: slot ? bg : 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>P{def.num}</span>
                    </div>
                    {slot ? (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: col, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{slot.teacherName ?? '—'}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--txt3)' }}>{def.label} — Free</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
            <div className="hscroll">
              <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 14px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 130, textAlign: 'left' }}>Period</th>
                    {DAYS.map(([d, label]) => (
                      <th key={d} style={{ padding: '12px 8px', background: d === todayCol ? 'rgba(14,165,233,.06)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? '#0ea5e9' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                        {label}
                        {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2.5, borderRadius: 2, background: '#0ea5e9' }} />}
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
                          const [col, bg] = slot ? subjectColor(slot.subjectId) : ['', '']
                          return (
                            <td key={day} style={{ padding: 6, width: '18%', height: 82, verticalAlign: 'top', border: '.5px solid var(--border)', background: day === todayCol ? 'rgba(14,165,233,.015)' : 'transparent' }}>
                              {slot ? (
                                <div style={{ background: bg, border: `.5px solid ${col}35`, borderRadius: 10, padding: '7px 9px', height: '100%', boxSizing: 'border-box' }}>
                                  <div style={{ fontWeight: 700, fontSize: 12.5, color: col, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName ?? '—'}</div>
                                  <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 900, color: col, flexShrink: 0 }}>{ini(slot.teacherName ?? '?')}</div>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.teacherName?.split(' ')[0] ?? '—'}</span>
                                  </div>
                                  {slot.startTime && <div style={{ fontSize: 9.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{slot.startTime}–{slot.endTime}</div>}
                                  {!slot.isPublished && <div style={{ fontSize: 9, color: 'var(--warning)', fontWeight: 700, marginTop: 2 }}>Draft</div>}
                                </div>
                              ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: 'var(--border)', fontSize: 15 }}>—</span>
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
        )}
      </div>
    )
  }

  // ═══ SCHOOL-WIDE VIEW ═══════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.2),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 19 : 23, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>School Timetable</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Full school view — all classes · Read-only</p>
          </div>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'Classes', value: classes.length, color: '#0ea5e9', glow: 'rgba(14,165,233,.2)', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
          { label: 'Slots Published', value: publishedCount, color: '#10b981', glow: 'rgba(16,185,129,.2)', icon: 'M20 6 9 17l-5-5' },
          { label: 'Conflicts', value: totalConflicts, color: totalConflicts > 0 ? '#f43f5e' : '#10b981', glow: totalConflicts > 0 ? 'rgba(244,63,94,.2)' : 'rgba(16,185,129,.2)', icon: 'M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' },
        ].map(k => (
          <div key={k.label} style={{ flex: '1 1 120px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -16, right: -16, width: 72, height: 72, borderRadius: '50%', background: k.glow, filter: 'blur(24px)', pointerEvents: 'none' }} />
            <svg viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" width="18" height="18" style={{ marginBottom: 8 }}><path d={k.icon}/></svg>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 200px', maxWidth: 280 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Jump to class</div>
          <select value={filterClassId} onChange={e => setFilterClassId(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            <option value="">All classes (school view)</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 110px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Term</div>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            {['Term 1','Term 2','Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ flex: '0 0 88px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 5 }}>Year</div>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[1,2,3,4].map(i => <div key={i} className="shule-skeleton" style={{ height: 80, borderRadius: 10 }} />)}
        </div>
      )}

      {/* Mobile: day tabs */}
      {!isLoading && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', background: 'var(--surface)', padding: '10px 12px', borderRadius: 12, border: '.5px solid var(--border)' }}>
            {DAYS.map(([d, label]) => (
              <button key={d} onClick={() => setMobileDay(d)}
                style={{ flex: '0 0 auto', padding: '7px 14px', borderRadius: 9, border: 'none', background: mobileDay === d ? 'linear-gradient(145deg,#0ea5e9,#0284c7)' : 'var(--surface2)', color: mobileDay === d ? '#fff' : 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', boxShadow: mobileDay === d ? '0 3px 10px rgba(14,165,233,.4)' : 'none' }}
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
                  <div style={{ padding: '8px 14px', background: 'var(--surface2)', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--txt2)' }}>{def.label}</span>
                    {def.startTime && <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</span>}
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)' }}>{slots.length} slot{slots.length !== 1 ? 's' : ''}</span>
                  </div>
                  {slots.length > 0 ? (
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {slots.map(s => {
                        const [col, bg] = classColor(s.classId)
                        const cName = classNameMap.get(s.classId) ?? '?'
                        return (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 9, background: bg, border: `.5px solid ${col}30` }}>
                            <div style={{ flexShrink: 0, width: 36, height: 24, borderRadius: 7, background: `${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 900, color: col }}>{cName.slice(0, 4)}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.subjectName ?? '—'}</div>
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

      {/* Desktop: merged school grid */}
      {!isLoading && !isMobile && (
        <>
          <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
            <div className="hscroll">
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px 16px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 130, textAlign: 'left' }}>Period</th>
                    {DAYS.map(([d, label]) => (
                      <th key={d} style={{ padding: '12px 8px', background: d === todayCol ? 'rgba(14,165,233,.05)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? '#0ea5e9' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                        {label}
                        {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2, background: '#0ea5e9' }} />}
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
                        <td style={{ padding: '8px 14px', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', verticalAlign: 'top', minWidth: 120 }}>
                          <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--txt2)' }}>{def.label}</div>
                          {def.startTime && <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{def.startTime}–{def.endTime}</div>}
                        </td>
                        {DAYS.map(([day]) => {
                          const slots = cellMap.get(`${day}-${def.num}`) ?? []
                          const hasConflict = slots.some(s => conflictSet.has(`${day}-${def.num}-${s.teacherId}`))
                          return (
                            <td key={day} style={{ padding: 5, verticalAlign: 'top', border: '.5px solid var(--border)', background: hasConflict ? 'rgba(244,63,94,.02)' : day === todayCol ? 'rgba(14,165,233,.01)' : 'transparent', minWidth: 150 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {slots.map(s => {
                                  const [col, bg] = classColor(s.classId)
                                  const isConflict = conflictSet.has(`${day}-${def.num}-${s.teacherId}`)
                                  const cName = classNameMap.get(s.classId) ?? '?'
                                  return (
                                    <div key={s.id}
                                      onClick={() => setFilterClassId(s.classId)}
                                      title={`${cName}: ${s.subjectName ?? '—'} — ${s.teacherName ?? '—'} (click to zoom)`}
                                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 8, background: bg, border: `.5px solid ${isConflict ? 'rgba(244,63,94,.6)' : col + '30'}`, cursor: 'pointer', transition: 'all .14s', boxShadow: isConflict ? '0 0 0 1.5px rgba(244,63,94,.3)' : 'none' }}
                                      onMouseEnter={e => (e.currentTarget.style.opacity = '.8')}
                                      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    >
                                      <div style={{ flexShrink: 0, width: 30, height: 22, borderRadius: 5, background: `${col}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: col }}>
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
                                {slots.length === 0 && (
                                  <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ color: 'var(--border)', fontSize: 14 }}>—</span>
                                  </div>
                                )}
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
          {/* Class legend / quick jump */}
          {classes.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, flexShrink: 0 }}>Click class to zoom:</span>
              {classes.map(c => {
                const [col, bg] = classColor(c.id)
                return (
                  <button key={c.id} onClick={() => setFilterClassId(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', transition: 'all .14s', border: `.5px solid ${col}40`, background: bg, color: col }}
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
