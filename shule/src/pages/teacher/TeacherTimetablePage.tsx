import { useState, useMemo } from 'react'
import { useTeacherTimetable } from '../../hooks/useTimetableSlots'
import { useIsMobile } from '../../hooks/useIsMobile'

const DAYS: [number, string, string][] = [
  [1,'Mon','Monday'], [2,'Tue','Tuesday'], [3,'Wed','Wednesday'],
  [4,'Thu','Thursday'], [5,'Fri','Friday'], [6,'Sat','Saturday'], [7,'Sun','Sunday'],
]

function jsToSchoolDay(d: number): number | null {
  if (d === 0) return 7
  if (d >= 1 && d <= 6) return d
  return null
}

const SUBJ_PALETTE: [string, string][] = [
  ['#6366f1','rgba(99,102,241,.14)'],  ['#0ea5e9','rgba(14,165,233,.14)'],
  ['#10b981','rgba(16,185,129,.14)'],  ['#f59e0b','rgba(245,158,11,.14)'],
  ['#f43f5e','rgba(244,63,94,.14)'],   ['#8b5cf6','rgba(139,92,246,.14)'],
  ['#ec4899','rgba(236,72,153,.14)'],  ['#0d9488','rgba(13,148,136,.14)'],
]

function subjColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJ_PALETTE[Math.abs(h) % SUBJ_PALETTE.length]
}

export function TeacherTimetablePage() {
  const isMobile = useIsMobile()
  const [term,      setTerm]      = useState('Term 1')
  const [year,      setYear]      = useState(new Date().getFullYear())
  const [mobileDay, setMobileDay] = useState<number>(() => jsToSchoolDay(new Date().getDay()) ?? 1)

  const { data: slots = [], isLoading } = useTeacherTimetable({ term, year })

  const todayCol = jsToSchoolDay(new Date().getDay())

  // Derive period range from slot data
  const periodNums = useMemo(() => {
    if (slots.length === 0) return [1,2,3,4,5,6,7,8]
    const nums = [...new Set(slots.map(s => s.periodNumber))].sort((a,b) => a - b)
    const min = nums[0], max = nums[nums.length - 1]
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }, [slots])

  const slotMap = useMemo(() => {
    const m = new Map<string, typeof slots[number]>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  // Summary stats
  const subjectSet  = useMemo(() => new Set(slots.map(s => s.subjectId)), [slots])
  const classSet    = useMemo(() => new Set(slots.map(s => s.classId)), [slots])
  const periodsPerDay = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of slots) m.set(s.dayOfWeek, (m.get(s.dayOfWeek) ?? 0) + 1)
    return m
  }, [slots])
  const busiestDay = useMemo(() => {
    let max = 0, day = 0
    for (const [d, cnt] of periodsPerDay) if (cnt > max) { max = cnt; day = d }
    return day > 0 ? DAYS.find(([d]) => d === day)?.[2] ?? '' : ''
  }, [periodsPerDay])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Header ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,148,136,.2),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', position: 'relative' }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0d9488,#0f766e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(13,148,136,.45)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 19 : 23, color: 'var(--txt)', margin: 0, letterSpacing: -.4 }}>My Timetable</h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: '2px 0 0' }}>Your assigned teaching periods · {term} {year}</p>
          </div>
        </div>
      </div>

      {/* ── Term / Year selectors ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '14px 18px', alignItems: 'flex-end' }}>
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

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="shule-skeleton" style={{ height: 76, borderRadius: 12 }} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && slots.length === 0 && (
        <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(145deg,rgba(13,148,136,.12),rgba(13,148,136,.04))', border: '.5px solid rgba(13,148,136,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>No timetable this term</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 320, margin: '0 auto' }}>
            Your timetable hasn't been published yet. Check back after the DoS builds and publishes it.
          </div>
        </div>
      )}

      {!isLoading && slots.length > 0 && (
        <>
          {/* ── KPI strip ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: 12 }}>
            {[
              { label: 'Periods/Week', value: slots.length, color: '#0d9488', glow: 'rgba(13,148,136,.2)', icon: 'M12 20V10M18 20V4M6 20v-4' },
              { label: 'Subjects',     value: subjectSet.size, color: '#8b5cf6', glow: 'rgba(139,92,246,.2)', icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' },
              { label: 'Classes',      value: classSet.size,  color: '#0ea5e9', glow: 'rgba(14,165,233,.2)', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -14, right: -14, width: 64, height: 64, borderRadius: '50%', background: k.glow, filter: 'blur(20px)', pointerEvents: 'none' }} />
                <svg viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth="2" width="17" height="17" style={{ marginBottom: 7 }}><path d={k.icon}/></svg>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{k.label}</div>
                <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -1, lineHeight: 1 }}>{k.value}</div>
              </div>
            ))}
            {busiestDay && (
              <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -14, right: -14, width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,.2)', filter: 'blur(20px)', pointerEvents: 'none' }} />
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" width="17" height="17" style={{ marginBottom: 7 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>Busiest Day</div>
                <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -.3, lineHeight: 1.2 }}>{busiestDay}</div>
              </div>
            )}
          </div>

          {/* Mobile: day tabs */}
          {isMobile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', background: 'var(--surface)', padding: '10px 12px', borderRadius: 12, border: '.5px solid var(--border)' }}>
                {DAYS.map(([d, label]) => {
                  const count = periodsPerDay.get(d) ?? 0
                  return (
                    <button key={d} onClick={() => setMobileDay(d)}
                      style={{ flex: '0 0 auto', padding: '8px 14px', borderRadius: 10, border: 'none', background: mobileDay === d ? 'linear-gradient(145deg,#0d9488,#0f766e)' : 'var(--surface2)', color: mobileDay === d ? '#fff' : 'var(--txt3)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .15s', boxShadow: mobileDay === d ? '0 3px 12px rgba(13,148,136,.45)' : 'none', position: 'relative' }}
                    >
                      {label}
                      {count > 0 && <span style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderRadius: '50%', background: mobileDay === d ? 'rgba(255,255,255,.6)' : 'var(--brand)' }} />}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {periodNums.map(p => {
                  const slot = slotMap.get(`${mobileDay}-${p}`)
                  if (!slot) return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, border: '.5px dashed var(--border)', background: 'var(--surface)', opacity: .5 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>P{p}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--txt3)' }}>Free period</span>
                    </div>
                  )
                  const [col, bg] = subjColor(slot.subjectId)
                  return (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, border: `.5px solid ${col}30`, background: bg, boxShadow: `0 2px 12px ${col}18` }}>
                      <div style={{ width: 42, height: 42, borderRadius: 13, background: `${col}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: col, fontFamily: 'var(--font2)' }}>P{p}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: col, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.className ?? '—'}</div>
                      </div>
                      {slot.startTime && (
                        <div style={{ fontSize: 11.5, color: col, fontFamily: 'var(--font3)', fontWeight: 700, flexShrink: 0 }}>{slot.startTime}<br/>{slot.endTime}</div>
                      )}
                    </div>
                  )
                })}
                {(periodsPerDay.get(mobileDay) ?? 0) === 0 && (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: 'var(--surface)', borderRadius: 14, border: '.5px solid var(--border)', color: 'var(--txt3)', fontSize: 13 }}>
                    No teaching periods on {DAYS.find(([d]) => d === mobileDay)?.[2] ?? ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Desktop: full grid */}
          {!isMobile && (
            <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 20px rgba(0,0,0,.06)' }}>
              {/* Grid header bar */}
              <div style={{ padding: '14px 20px 12px', borderBottom: '.5px solid var(--border)', background: 'linear-gradient(135deg,rgba(13,148,136,.05),transparent)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>Weekly Schedule</span>
                <span style={{ padding: '2px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--txt3)', fontSize: 11, fontWeight: 600, border: '.5px solid var(--border)' }}>{term} · {year}</span>
                <span style={{ marginLeft: 'auto', padding: '3px 12px', borderRadius: 99, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', fontSize: 11.5, fontWeight: 700, border: '.5px solid rgba(13,148,136,.25)' }}>
                  {slots.length} period{slots.length !== 1 ? 's' : ''} / week
                </span>
              </div>

              <div className="hscroll">
                <table style={{ borderCollapse: 'collapse', minWidth: 600, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 14px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 56, textAlign: 'center' }}>P</th>
                      {DAYS.map(([d, label]) => (
                        <th key={d} style={{ padding: '10px 8px', background: d === todayCol ? 'rgba(13,148,136,.07)' : 'var(--surface2)', fontWeight: 800, fontSize: 11, color: d === todayCol ? 'var(--brand)' : 'var(--txt2)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative' }}>
                          {label}
                          {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2, background: 'var(--brand)' }} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periodNums.map(p => (
                      <tr key={p}>
                        <td style={{ padding: '8px', fontWeight: 800, fontSize: 12, color: 'var(--txt3)', textAlign: 'center', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', width: 52 }}>{p}</td>
                        {DAYS.map(([day]) => {
                          const slot = slotMap.get(`${day}-${p}`)
                          const [col, bg] = slot ? subjColor(slot.subjectId) : ['', '']
                          return (
                            <td key={day} style={{ padding: 5, width: '18%', height: 82, verticalAlign: 'top', border: '.5px solid var(--border)', background: day === todayCol ? 'rgba(13,148,136,.02)' : 'transparent', transition: 'background .14s' }}>
                              {slot ? (
                                <div style={{ background: bg, border: `.5px solid ${col}40`, borderRadius: 11, padding: '7px 9px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: 12.5, color: col, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subjectName ?? '—'}</div>
                                    <div style={{ fontSize: 11, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.className ?? '—'}</span>
                                    </div>
                                  </div>
                                  {slot.startTime && (
                                    <div style={{ fontSize: 9.5, color: col, fontFamily: 'var(--font3)', fontWeight: 700, marginTop: 3 }}>{slot.startTime}–{slot.endTime}</div>
                                  )}
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subject legend */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Subjects:</span>
              {[...subjectSet].map(sid => {
                const slot = slots.find(s => s.subjectId === sid)
                if (!slot?.subjectName) return null
                const [col, bg] = subjColor(sid)
                return (
                  <div key={sid} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, border: `.5px solid ${col}40`, background: bg, color: col }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: col }} />
                    {slot.subjectName}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
