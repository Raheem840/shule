/**
 * EventTimeline — Premium vertical chronicle layout for school events.
 * Used by SharedEventsPage and TeacherEventsPage.
 *
 * Design: "Observatory Chronicle" — a continuous ink-line spine with
 * event nodes that unfurl on hover to reveal full detail.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SchoolEvent } from '../../types/week9'

// ── Event type registry ───────────────────────────────────────────────────────
export const ALL_EVENT_TYPES = [
  { value: 'term_start',   label: 'Term Begins',  color: '#10b981' },
  { value: 'term_end',     label: 'Term Ends',    color: '#f43f5e' },
  { value: 'exam_week',    label: 'Exam Week',    color: '#f59e0b' },
  { value: 'holiday',      label: 'Holiday',      color: '#0ea5e9' },
  { value: 'pta',          label: 'PTA Meeting',  color: '#8b5cf6' },
  { value: 'sport',        label: 'Sports Day',   color: '#ec4899' },
  { value: 'graduation',   label: 'Prize Giving', color: '#0d9488' },
  { value: 'exam',         label: 'Exam',         color: '#f43f5e' },
  { value: 'test',         label: 'Test',         color: '#f59e0b' },
  { value: 'ca',           label: 'CA',           color: '#f59e0b' },
  { value: 'aoi',          label: 'AoI',          color: '#0ea5e9' },
  { value: 'dit',          label: 'DIT',          color: '#8b5cf6' },
  { value: 'practical',    label: 'Practical',    color: '#0d9488' },
  { value: 'assignment',   label: 'Assignment',   color: '#64748b' },
  { value: 'general',      label: 'General',      color: '#10b981' },
]
export const DOS_EXTRA_TYPES = ALL_EVENT_TYPES.slice(0, 7)
export const TEACHER_EVENT_TYPES = ALL_EVENT_TYPES.slice(7)

export function typeColor(t: string) { return ALL_EVENT_TYPES.find(e => e.value === t)?.color ?? '#64748b' }
export function typeLabel(t: string) { return ALL_EVENT_TYPES.find(e => e.value === t)?.label ?? t }

// ── Date helpers ──────────────────────────────────────────────────────────────
// event_date is a plain DATE column meant to represent the school's own local
// calendar day — comparing it against new Date().toISOString() (UTC) is wrong
// for any school east of UTC (Uganda is UTC+3): for the first ~3 hours of
// every local day, toISOString()'s date is still "yesterday", so a genuinely
// past event kept passing eventDate >= today and showing as upcoming/today.
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function isToday(d: string) { return d.slice(0, 10) === localToday() }
export function isPast(d: string)  { return d.slice(0, 10) < localToday() }
export function daysUntil(d: string) {
  const target = new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime()
  const today   = new Date(`${localToday()}T00:00:00Z`).getTime()
  return Math.round((target - today) / 86_400_000)
}
export function monthKey(d: string) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
}
export function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

// ── CSS injected once ─────────────────────────────────────────────────────────
const TL_CSS = `
@keyframes tlEntry {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes tlPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--tl-pulse-color, rgba(13,148,136,0.5)); }
  60%      { box-shadow: 0 0 0 7px transparent; }
}
@keyframes tlMonthIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tl-dot-today { animation: tlPulse 2.4s ease-in-out infinite; }
.tl-card-action:hover { background: var(--surface) !important; border-color: var(--brand) !important; color: var(--brand) !important; }
`

// ── Month separator ───────────────────────────────────────────────────────────
function MonthHeader({ label, idx }: { label: string; idx: number }) {
  const [mo] = label.split(' ')  // e.g. "JUNE"
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '72px 28px 1fr',
      alignItems: 'center',
      margin: idx === 0 ? '0 0 4px' : '28px 0 4px',
      animation: 'tlMonthIn 0.4s ease both',
    }}>
      {/* Left: ghost month text */}
      <div style={{ textAlign: 'right', paddingRight: 14, overflow: 'hidden' }}>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '1.5px',
          textTransform: 'uppercase', color: 'var(--txt3)', opacity: 0.5,
          fontFamily: 'var(--font3)',
        }}>
          {mo?.slice(0, 3)}
        </span>
      </div>
      {/* Diamond node */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 8, height: 8,
          background: 'var(--txt3)',
          transform: 'rotate(45deg)',
          opacity: 0.35,
          flexShrink: 0,
          zIndex: 2,
          position: 'relative',
        }} />
      </div>
      {/* Label + rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12 }}>
        <span style={{
          fontSize: 10, fontWeight: 900, letterSpacing: '2px',
          textTransform: 'uppercase', color: 'var(--txt3)',
          whiteSpace: 'nowrap', fontFamily: 'var(--font2)',
        }}>
          {label}
        </span>
        <div style={{ flex: 1, height: 0.5, background: 'var(--border)' }} />
      </div>
    </div>
  )
}

// ── Timeline node ─────────────────────────────────────────────────────────────
function TimelineNode({
  event, canDelete, canEdit, canJournal, onEdit, onDelete, idx,
}: {
  event:     SchoolEvent
  canDelete: boolean
  canEdit:   boolean
  canJournal: boolean
  onEdit?:   (e: SchoolEvent) => void
  onDelete?: (e: SchoolEvent) => void
  idx:       number
}) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const color = typeColor(event.eventType)
  const today = isToday(event.eventDate)
  const past  = isPast(event.eventDate)
  const days  = daysUntil(event.eventDate)

  const dt     = new Date(event.eventDate)
  const dayNum = String(dt.getDate()).padStart(2, '0')
  const mon    = dt.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
  const wkd    = dt.toLocaleDateString('en-GB', { weekday: 'short' })
  const fullDate = dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const dotSize = today ? 15 : past ? 7 : 11
  const muted   = past && !today

  const hasMeta = !!(event.className || event.subjectName || event.term || event.totalMarks || event.passMark)
  const showActions = (canJournal && past && !today && !event.journaled) || (canEdit && !!onEdit) || (canDelete && !!onDelete)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '72px 28px 1fr',
      alignItems: 'flex-start',
      animation: `tlEntry 0.45s ${Math.min(idx * 0.045, 0.6)}s cubic-bezier(0.22, 1, 0.36, 1) both`,
    }}>
      {/* ── Date ── */}
      <div style={{
        textAlign: 'right', paddingRight: 14,
        paddingTop: today ? 8 : past ? 12 : 10,
        userSelect: 'none',
      }}>
        <div style={{
          fontSize: today ? 26 : 21,
          fontWeight: 900,
          fontFamily: 'var(--font3)',
          lineHeight: 1,
          color: muted ? 'var(--txt3)' : color,
          opacity: muted ? 0.45 : 1,
          letterSpacing: '-1px',
          transition: 'color 0.2s',
        }}>
          {dayNum}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '1px',
          color: muted ? 'var(--txt3)' : color,
          opacity: muted ? 0.4 : 0.7,
          marginTop: 2,
        }}>
          {mon}
        </div>
      </div>

      {/* ── Dot ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: today ? 12 : past ? 15 : 13 }}>
        <div
          className={today ? 'tl-dot-today' : undefined}
          style={{
            width: dotSize, height: dotSize,
            borderRadius: '50%',
            background: today ? color : past ? 'var(--surface2)' : 'transparent',
            border: today ? `2px solid ${color}` : past ? `1.5px solid var(--border)` : `2px solid ${color}`,
            boxShadow: today ? `0 0 0 4px ${color}22` : 'none',
            zIndex: 2, position: 'relative', flexShrink: 0,
            transition: 'transform 0.2s ease',
            ...(today ? { ['--tl-pulse-color' as any]: `${color}55` } : {}),
          }}
        />
      </div>

      {/* ── Card ── */}
      <div style={{ paddingLeft: 12, paddingBottom: 8 }}>
        <div
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => {
            // A past, not-yet-journaled event (e.g. a test/exam date) is almost
            // always clicked to go journal it — skip the expand step and take
            // the teacher straight to the exam journal, prefilled from this event.
            if (canJournal && past && !today && !event.journaled) {
              navigate('/teacher/exams', { state: { prefill: event } })
              return
            }
            setOpen(o => !o)
          }}
          style={{
            background: open ? `${color}06` : 'var(--surface)',
            border: `1px solid ${open ? color + '45' : today ? color + '30' : 'var(--border)'}`,
            borderRadius: 14,
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'border-color 0.22s ease, background 0.22s ease, box-shadow 0.22s ease',
            boxShadow: open
              ? `0 12px 40px ${color}16, 0 3px 10px rgba(0,0,0,0.07)`
              : today
                ? `0 2px 14px ${color}18`
                : '0 1px 4px rgba(0,0,0,0.04)',
            opacity: muted ? 0.72 : 1,
          }}
        >
          {/* Accent bar */}
          <div style={{ height: 2.5, background: `linear-gradient(90deg, ${color} 0%, ${color}55 55%, transparent 100%)` }} />

          {/* Always-visible content */}
          <div style={{ padding: '11px 15px 10px' }}>
            {/* Badge row */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
              <span style={{
                padding: '2px 8px', borderRadius: 99, fontSize: 9.5,
                fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase',
                background: `${color}16`, color, border: `0.5px solid ${color}28`,
                flexShrink: 0,
              }}>
                {typeLabel(event.eventType)}
              </span>
              {today && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.5px', background: 'rgba(13,148,136,.12)', color: 'var(--brand)', border: '0.5px solid rgba(13,148,136,.3)', textTransform: 'uppercase' }}>
                  Today
                </span>
              )}
              {!past && !today && days >= 0 && days <= 7 && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 700, background: 'rgba(245,158,11,.1)', color: 'var(--warning)' }}>
                  {days === 0 ? 'Tomorrow' : `in ${days}d`}
                </span>
              )}
              {event.journaled && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 700, background: 'rgba(16,185,129,.1)', color: 'var(--success)' }}>
                  ✓ Journaled
                </span>
              )}
              {event.visibleToParents && (
                <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 9.5, fontWeight: 700, background: 'rgba(14,165,233,.08)', color: 'var(--info)', border: '0.5px solid rgba(14,165,233,.2)' }}>
                  Shared
                </span>
              )}
              {/* Explicit expand affordance — the card's own onClick fast-paths straight
                  to the exam journal for journalable past events, which would otherwise
                  make the Edit/Delete actions (only shown when expanded) unreachable on
                  touch devices, where hover-to-expand never fires. */}
              {(canEdit || canDelete) && (
                <button
                  aria-label={open ? 'Collapse details' : 'Expand details'}
                  onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
                  style={{
                    marginLeft: 'auto', width: 22, height: 22, borderRadius: 7,
                    border: '0.5px solid var(--border)', background: 'var(--surface2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--txt3)', flexShrink: 0,
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Title */}
            <div style={{
              fontFamily: 'var(--font2)', fontWeight: 800,
              fontSize: today ? 15.5 : 14.5,
              lineHeight: 1.3, color: open ? color : 'var(--txt)',
              transition: 'color 0.2s ease',
              overflow: open ? 'visible' : 'hidden',
              textOverflow: open ? 'unset' : 'ellipsis',
              whiteSpace: open ? 'normal' : 'nowrap',
            }}>
              {event.title}
            </div>

            {/* Date sub-line */}
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              {wkd} · {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Expandable detail section */}
          <div style={{
            maxHeight: open ? '400px' : 0,
            opacity: open ? 1 : 0,
            overflow: 'hidden',
            transition: 'max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease',
          }}>
            <div style={{
              padding: '10px 15px 14px',
              borderTop: `1px solid ${color}16`,
            }}>
              {/* Full date */}
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: hasMeta ? 10 : 0, fontStyle: 'italic' }}>
                {fullDate}
              </div>

              {/* Meta chips */}
              {hasMeta && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                  {event.className && (
                    <span style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', border: '0.5px solid var(--border)', color: 'var(--txt2)' }}>
                      {event.className}{event.streamName ? ` · ${event.streamName}` : ''}
                    </span>
                  )}
                  {event.subjectName && (
                    <span style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', border: '0.5px solid var(--border)', color: 'var(--txt2)' }}>
                      {event.subjectName}
                    </span>
                  )}
                  {event.term && (
                    <span style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', border: '0.5px solid var(--border)', color: 'var(--txt2)' }}>
                      {event.term}
                    </span>
                  )}
                  {event.totalMarks && (
                    <span style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: `${color}12`, border: `0.5px solid ${color}28`, color }}>
                      {event.totalMarks} marks
                    </span>
                  )}
                  {event.passMark && (
                    <span style={{ padding: '3px 9px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--surface2)', border: '0.5px solid var(--border)', color: 'var(--txt3)' }}>
                      Pass: {event.passMark}
                    </span>
                  )}
                </div>
              )}

              {/* Creator */}
              {event.creatorName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--txt3)', marginBottom: 8 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span style={{ fontWeight: 600 }}>{event.creatorName}</span>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <div style={{
                  fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6,
                  marginBottom: showActions ? 12 : 0,
                  padding: '8px 10px', borderRadius: 8,
                  background: `${color}07`, borderLeft: `2.5px solid ${color}40`,
                  fontStyle: 'italic',
                }}>
                  {event.description}
                </div>
              )}

              {/* Actions */}
              {showActions && (
                <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                  {canJournal && past && !today && !event.journaled && (
                    <button
                      onClick={e => { e.stopPropagation(); navigate('/teacher/exams', { state: { prefill: event } }) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 10, border: 'none',
                        background: `linear-gradient(135deg,${color},${color}cc)`,
                        color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        boxShadow: `0 3px 12px ${color}44`,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                    >
                      Journal Entry
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  )}
                  {canEdit && onEdit && (
                    <button
                      className="tl-card-action"
                      onClick={e => { e.stopPropagation(); onEdit(event) }}
                      style={{
                        width: 30, height: 30, borderRadius: 9,
                        border: '0.5px solid var(--border)', background: 'var(--surface2)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--txt3)', transition: 'all 0.15s',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  )}
                  {canDelete && onDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(event) }}
                      style={{
                        width: 30, height: 30, borderRadius: 9,
                        border: '0.5px solid rgba(244,63,94,.28)', background: 'rgba(244,63,94,.07)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--danger)', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(244,63,94,.14)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,.07)' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface EventTimelineProps {
  events:     SchoolEvent[]
  isLoading:  boolean
  canDelete:  (e: SchoolEvent) => boolean
  canEdit:    (e: SchoolEvent) => boolean
  canJournal: boolean
  onEdit?:    (e: SchoolEvent) => void
  onDelete?:  (e: SchoolEvent) => void
  emptyTitle?: string
  emptyBody?:  string
}

export function EventTimeline({
  events, isLoading,
  canDelete, canEdit, canJournal,
  onEdit, onDelete,
  emptyTitle = 'No events',
  emptyBody  = 'Events will appear here when created.',
}: EventTimelineProps) {
  // Group by month
  const grouped: [string, SchoolEvent[]][] = []
  const seen = new Map<string, SchoolEvent[]>()
  for (const ev of events) {
    const k = monthKey(ev.eventDate)
    if (!seen.has(k)) { seen.set(k, []); grouped.push([k, seen.get(k)!]) }
    seen.get(k)!.push(ev)
  }

  // Loading skeletons
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 100 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="shule-skeleton" style={{
            height: 72, borderRadius: 14,
            animationDelay: `${i * 0.06}s`,
          }} />
        ))}
      </div>
    )
  }

  // Empty state
  if (grouped.length === 0) {
    return (
      <div style={{
        padding: '52px 24px', textAlign: 'center',
        background: 'var(--surface)', borderRadius: 18,
        border: '1px solid var(--border)',
        animation: 'tlEntry 0.3s ease both',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: 'rgba(245,158,11,.08)', border: '0.5px solid rgba(245,158,11,.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.9">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
          {emptyTitle}
        </div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
          {emptyBody}
        </div>
      </div>
    )
  }

  let nodeIdx = 0

  return (
    <>
      <style>{TL_CSS}</style>

      {/* Timeline spine wrapper */}
      <div style={{ position: 'relative' }}>
        {/* Continuous spine line */}
        <div style={{
          position: 'absolute',
          left: 85,   // 72px date col + 13px (center of 28px junction col)
          top: 8, bottom: 8,
          width: 1.5,
          background: 'linear-gradient(to bottom, transparent 0%, var(--border) 24px, var(--border) calc(100% - 24px), transparent 100%)',
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

        {/* Events by month */}
        {grouped.map(([month, evs], gi) => (
          <div key={month}>
            <MonthHeader label={monthLabel(month)} idx={gi} />
            {evs.map(ev => {
              const idx = nodeIdx++
              return (
                <TimelineNode
                  key={ev.id}
                  event={ev}
                  canDelete={canDelete(ev)}
                  canEdit={canEdit(ev)}
                  canJournal={canJournal}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  idx={idx}
                />
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
