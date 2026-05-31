import { useState, useMemo } from 'react'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useTimetableSlots } from '../../hooks/useTimetableSlots'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TimetableSlot } from '../../types/week9'

const DAYS: [number, string, string][] = [
  [1, 'Mon', 'Monday'],
  [2, 'Tue', 'Tuesday'],
  [3, 'Wed', 'Wednesday'],
  [4, 'Thu', 'Thursday'],
  [5, 'Fri', 'Friday'],
]
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8]

const SUBJECT_PALETTE: [string, string][] = [
  ['#6366f1', 'rgba(99,102,241,.13)'],
  ['#0ea5e9', 'rgba(14,165,233,.13)'],
  ['#10b981', 'rgba(16,185,129,.13)'],
  ['#f59e0b', 'rgba(245,158,11,.13)'],
  ['#f43f5e', 'rgba(244,63,94,.13)'],
  ['#8b5cf6', 'rgba(139,92,246,.13)'],
  ['#ec4899', 'rgba(236,72,153,.13)'],
  ['#0d9488', 'rgba(13,148,136,.13)'],
]

function slotColor(id: string): [string, string] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  return SUBJECT_PALETTE[Math.abs(h) % SUBJECT_PALETTE.length]
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Read-only slot card ───────────────────────────────────────────────────────────
function ReadSlot({ slot }: { slot: TimetableSlot }) {
  const [color, bg] = slotColor(slot.subjectId)
  return (
    <div style={{
      background: bg, border: `.5px solid ${color}35`,
      borderRadius: 10, padding: '6px 8px', userSelect: 'none',
    }}>
      <div style={{ fontWeight: 700, fontSize: 11.5, color, marginBottom: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {slot.subjectName ?? '—'}
      </div>
      <div style={{ fontSize: 10, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 900, color, flexShrink: 0, fontFamily: 'var(--font2)' }}>
          {initials(slot.teacherName ?? '?')}
        </div>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {slot.teacherName?.split(' ')[0] ?? '—'}
        </span>
      </div>
      {slot.startTime && (
        <div style={{ fontSize: 9, color: 'var(--txt3)', marginTop: 1, fontFamily: 'var(--font3)' }}>
          {slot.startTime}–{slot.endTime}
        </div>
      )}
      {!slot.isPublished && (
        <div style={{ fontSize: 9, color: 'var(--warning)', marginTop: 2, fontWeight: 700 }}>Draft</div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════
// DEPUTY TIMETABLE PAGE
// ═══════════════════════════════════════════════════════════════════════════════════
export function DeputyTimetablePage() {
  const isMobile = useIsMobile()
  const { data: classes = [] } = useClasses()

  const [selectedClass,  setSelectedClass]  = useState<string | null>(null)
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [term, setTerm] = useState('Term 1')
  const [year, setYear] = useState(new Date().getFullYear())

  const { data: streams = [] } = useStreams(selectedClass)

  const { data: slots = [], isLoading } = useTimetableSlots({
    classId: selectedClass, streamId: selectedStream, term, year,
  })

  // day-period lookup
  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>()
    for (const s of slots) m.set(`${s.dayOfWeek}-${s.periodNumber}`, s)
    return m
  }, [slots])

  // Group slots by day for mobile view
  const byDay = useMemo(() => {
    const map = new Map<number, TimetableSlot[]>()
    for (const [d] of DAYS) map.set(d, [])
    for (const s of slots) {
      const arr = map.get(s.dayOfWeek) ?? []
      arr.push(s)
      map.set(s.dayOfWeek, arr)
    }
    for (const [, arr] of map) arr.sort((a, b) => a.periodNumber - b.periodNumber)
    return map
  }, [slots])

  const selectedClassName = classes.find(c => c.id === selectedClass)?.name ?? ''
  const publishedCount    = slots.filter(s => s.isPublished).length
  const today             = new Date().getDay()
  const todayCol          = today >= 1 && today <= 5 ? today : null

  // Coverage — how many of 40 possible slots are filled
  const totalPossible = DAYS.length * PERIODS.length
  const coveragePct   = slots.length > 0 ? Math.round((slots.length / totalPossible) * 100) : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header ── */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.18),transparent 70%)', filter: 'blur(36px)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(14,165,233,.4)', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: isMobile ? 18 : 22, color: 'var(--txt)', margin: 0, letterSpacing: -.3 }}>
              Timetable Overview
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--txt3)', margin: 0 }}>
              View published timetables across all classes. Read-only.
            </p>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 8px rgba(0,0,0,.04)', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 160px', minWidth: 150 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Class</label>
          <select
            value={selectedClass ?? ''}
            onChange={e => { setSelectedClass(e.target.value || null); setSelectedStream(null) }}
            className="sui-input" style={{ width: '100%' }}
          >
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {selectedClass && streams.length > 0 && (
          <div style={{ flex: '1 1 140px', minWidth: 130 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Stream</label>
            <select value={selectedStream ?? ''} onChange={e => setSelectedStream(e.target.value || null)} className="sui-input" style={{ width: '100%' }}>
              <option value="">All streams</option>
              {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ flex: '0 0 120px', minWidth: 110 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)} className="sui-input" style={{ width: '100%' }}>
            {['Term 1', 'Term 2', 'Term 3'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ flex: '0 0 92px', minWidth: 82 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: .7 }}>Year</label>
          <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="sui-input" style={{ width: '100%' }} />
        </div>

        {selectedClass && slots.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ padding: '7px 14px', borderRadius: 99, whiteSpace: 'nowrap',
              background: publishedCount === slots.length ? 'rgba(16,185,129,.1)' : 'rgba(245,158,11,.1)',
              color: publishedCount === slots.length ? 'var(--success)' : 'var(--warning)',
              border: publishedCount === slots.length ? '.5px solid rgba(16,185,129,.25)' : '.5px solid rgba(245,158,11,.25)',
              fontSize: 12, fontWeight: 700,
            }}>
              {publishedCount}/{slots.length} published
            </div>
          </div>
        )}
      </div>

      {/* ── Empty state: no class selected ── */}
      {!selectedClass && (
        <div style={{ padding: '52px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'rgba(14,165,233,.1)', border: '.5px solid rgba(14,165,233,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>
            Select a class
          </div>
          <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 320, margin: '0 auto' }}>
            Choose a class above to view its timetable for the selected term.
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedClass && isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} className="shule-skeleton" style={{ height: 76, borderRadius: 12 }} />)}
        </div>
      )}

      {/* ── No slots ── */}
      {selectedClass && !isLoading && slots.length === 0 && (
        <div style={{ padding: '44px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 18, border: '.5px solid var(--border)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>No timetable available</div>
          <div style={{ fontSize: 13, color: 'var(--txt3)' }}>The DoS has not yet built a timetable for {selectedClassName} this term.</div>
        </div>
      )}

      {/* ── Coverage KPI row ── */}
      {selectedClass && !isLoading && slots.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Slots', value: slots.length, color: '#0ea5e9', glow: 'rgba(14,165,233,.22)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg> },
            { label: 'Published', value: publishedCount, color: '#10b981', glow: 'rgba(16,185,129,.22)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg> },
            { label: 'Grid Coverage', value: `${coveragePct}%`, color: '#8b5cf6', glow: 'rgba(139,92,246,.22)', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18"><path d="M12 20V10M6 20V4M18 20v-6"/></svg> },
          ].map(k => (
            <div key={k.label} style={{ flex: '1 1 120px', background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 16, padding: '16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -16, right: -16, width: 72, height: 72, borderRadius: '50%', background: k.glow, filter: 'blur(24px)', pointerEvents: 'none' }} />
              <div style={{ width: 36, height: 36, borderRadius: 11, background: k.glow, display: 'flex', alignItems: 'center', justifyContent: 'center', color: k.color, marginBottom: 10 }}>{k.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', letterSpacing: -1, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Desktop: grid ── */}
      {selectedClass && !isLoading && slots.length > 0 && !isMobile && (
        <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 18, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,.06)' }}>
          {/* Grid title bar */}
          <div style={{ padding: '14px 20px 12px', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{selectedClassName}</span>
            {selectedStream && (
              <span style={{ padding: '2px 10px', borderRadius: 99, background: 'rgba(14,165,233,.1)', color: '#0ea5e9', fontSize: 11, fontWeight: 700, border: '.5px solid rgba(14,165,233,.2)' }}>
                {streams.find(s => s.id === selectedStream)?.name}
              </span>
            )}
            <span style={{ padding: '2px 10px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--txt3)', fontSize: 11, fontWeight: 600, border: '.5px solid var(--border)' }}>
              {term} · {year}
            </span>
            <div style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--txt3)', fontStyle: 'italic' }}>
              Read-only view
            </div>
          </div>

          <div className="hscroll">
            <table style={{ borderCollapse: 'collapse', minWidth: 580, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 12px', background: 'var(--surface2)', fontWeight: 800, fontSize: 10, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .8, borderBottom: '.5px solid var(--border)', width: 56, textAlign: 'center' }}>P</th>
                  {DAYS.map(([d, label]) => (
                    <th key={d} style={{
                      padding: '12px 8px',
                      background: d === todayCol ? 'rgba(14,165,233,.06)' : 'var(--surface2)',
                      fontWeight: 800, fontSize: 11,
                      color: d === todayCol ? '#0ea5e9' : 'var(--txt2)',
                      textTransform: 'uppercase', letterSpacing: .8,
                      borderBottom: '.5px solid var(--border)', textAlign: 'center', position: 'relative',
                    }}>
                      {label}
                      {d === todayCol && <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 20, height: 2.5, borderRadius: 2, background: '#0ea5e9' }} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(period => (
                  <tr key={period}>
                    <td style={{ padding: '8px', fontWeight: 800, fontSize: 12, color: 'var(--txt3)', textAlign: 'center', background: 'var(--surface2)', borderRight: '.5px solid var(--border)', borderBottom: '.5px solid var(--border)', width: 52 }}>
                      {period}
                    </td>
                    {DAYS.map(([day]) => {
                      const s = slotMap.get(`${day}-${period}`)
                      return (
                        <td key={day} style={{
                          padding: 5, width: '18%', height: 76,
                          border: '.5px solid var(--border)', verticalAlign: 'top',
                          background: day === todayCol ? 'rgba(14,165,233,.02)' : 'transparent',
                        }}>
                          {s ? <ReadSlot slot={s} /> : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'var(--border)', fontSize: 13 }}>—</span>
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

      {/* ── Mobile: day accordion cards ── */}
      {selectedClass && !isLoading && slots.length > 0 && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DAYS.map(([d, , fullLabel]) => {
            const daySlots = byDay.get(d) ?? []
            if (daySlots.length === 0) return null
            const isToday = d === todayCol
            return (
              <div key={d} style={{
                background: 'var(--surface)', borderRadius: 16, overflow: 'hidden',
                border: `.5px solid ${isToday ? 'rgba(14,165,233,.4)' : 'var(--border)'}`,
                boxShadow: isToday ? '0 0 0 2.5px rgba(14,165,233,.12)' : '0 1px 6px rgba(0,0,0,.04)',
              }}>
                {/* Day header */}
                <div style={{ padding: '10px 14px', background: isToday ? 'rgba(14,165,233,.07)' : 'var(--surface2)', borderBottom: '.5px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: isToday ? '#0ea5e9' : 'var(--txt)', fontFamily: 'var(--font2)' }}>{fullLabel}</div>
                  {isToday && (
                    <div style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(14,165,233,.12)', color: '#0ea5e9', fontSize: 10, fontWeight: 800, border: '.5px solid rgba(14,165,233,.2)' }}>
                      Today
                    </div>
                  )}
                  <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>
                    {daySlots.length} period{daySlots.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Slot rows */}
                {daySlots.map((s, i) => {
                  const [color] = slotColor(s.subjectId)
                  return (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                      borderBottom: i < daySlots.length - 1 ? '.5px solid var(--border)' : 'none',
                      borderLeft: `3px solid ${color}`,
                    }}>
                      <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--surface2)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: 'var(--txt3)', flexShrink: 0, fontFamily: 'var(--font2)' }}>
                        {s.periodNumber}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13.5, color, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.subjectName ?? '—'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--txt3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.teacherName ?? '—'}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        {s.startTime && (
                          <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                            {s.startTime}–{s.endTime}
                          </div>
                        )}
                        {!s.isPublished && (
                          <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 700, marginTop: 2 }}>Draft</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
