import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTermProgress, TERM_EVENT_COLOR } from '../../hooks/useTermProgress'
import { useAuth } from '../../store/AuthContext'
import { ErrorBoundary } from './ErrorBoundary'
import type { TermEvent, TermEventType } from '../../types/week9'

// ─── Premium CSS ──────────────────────────────────────────────────────────────
const CSS = `
  .tpt-shell {
    position: relative; border-radius: 24px; overflow: hidden;
    background: var(--surface);
    border: .5px solid var(--border);
    box-shadow: 0 4px 32px rgba(13,148,136,.07), 0 1px 8px rgba(0,0,0,.05);
  }
  [data-theme="dark"] .tpt-shell {
    background: rgba(15,23,42,.82);
    border: .5px solid rgba(255,255,255,.07);
    box-shadow: 0 8px 40px rgba(0,0,0,.35);
  }
  .tpt-track-wrap { position: relative; padding: 28px 24px 0; }
  .tpt-track {
    position: relative; height: 8px; border-radius: 99px;
    background: var(--surface2);
    box-shadow: inset 0 1px 3px rgba(0,0,0,.07);
  }
  .tpt-fill {
    position: absolute; left: 0; top: 0; height: 100%; border-radius: 99px;
    background: linear-gradient(90deg, #0d9488 0%, #0ea5e9 100%);
    transition: width 1.1s cubic-bezier(0.4,0,0.2,1);
    box-shadow: 0 0 12px rgba(13,148,136,.5), 0 2px 6px rgba(13,148,136,.3);
  }
  .tpt-fill::after {
    content: ''; position: absolute; inset: 0; border-radius: 99px;
    background: repeating-linear-gradient(90deg,transparent 0,rgba(255,255,255,.15) 20px,transparent 40px);
    animation: tptStripe 3s linear infinite;
  }
  @keyframes tptStripe { from{background-position:0 0} to{background-position:80px 0} }

  .tpt-today {
    position: absolute; top: -22px; bottom: -22px; width: 3px; border-radius: 2px;
    background: linear-gradient(180deg,transparent 0%,var(--brand) 15%,var(--brand) 85%,transparent 100%);
    transform: translateX(-1.5px);
    z-index: 10;
  }
  .tpt-today::before {
    content: 'TODAY';
    position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
    background: var(--brand);
    color: #fff; font-size: 8px; font-weight: 900; letter-spacing: .8px;
    padding: 2px 6px; border-radius: 99px;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(13,148,136,.5);
    animation: tptPulse 2.5s ease infinite;
  }
  .tpt-today::after {
    content: '';
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--brand);
    animation: tptRing 2.5s ease infinite;
  }
  @keyframes tptPulse {
    0%,100% { box-shadow: 0 2px 8px rgba(13,148,136,.5) }
    50%      { box-shadow: 0 2px 16px rgba(13,148,136,.8) }
  }
  @keyframes tptRing {
    0%   { box-shadow: 0 0 0 0 rgba(13,148,136,.6) }
    70%  { box-shadow: 0 0 0 8px rgba(13,148,136,0) }
    100% { box-shadow: 0 0 0 0 rgba(13,148,136,0) }
  }

  .tpt-dot { position: absolute; top: 50%; transform: translate(-50%,-50%); z-index: 10; cursor: pointer; }
  .tpt-dot-inner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2.5px solid var(--surface);
    transition: transform .18s cubic-bezier(.34,1.56,.64,1), box-shadow .18s ease;
    position: relative; z-index: 1;
  }
  .tpt-dot:hover .tpt-dot-inner { transform: scale(1.5); }

  .tpt-popover {
    position: absolute; top: 26px; left: 50%; transform: translateX(-50%);
    background: var(--surface);
    border: .5px solid var(--border);
    border-radius: 16px; padding: 12px 14px; min-width: 200px;
    box-shadow: 0 12px 40px rgba(0,0,0,.16); z-index: 60;
    animation: tptPopIn .18s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes tptPopIn {
    from { opacity:0; transform:translateX(-50%) translateY(4px) scale(.92) }
    to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1) }
  }

  .tpt-chips { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
  .tpt-chip {
    padding: 3px 9px; border-radius: 99px; font-size: 10.5px; font-weight: 800;
    white-space: nowrap;
  }
  .tpt-legend { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
  .tpt-legend-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0 }
`

// ─── Event dot with popover ────────────────────────────────────────────────────
function EventDot({ event, pct }: { event: TermEvent; pct: number }) {
  const [open,    setOpen]    = useState(false)
  const [hovered, setHovered] = useState(false)
  const dotRef  = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const past     = new Date(event.date) < new Date()
  const color    = TERM_EVENT_COLOR[event.type] ?? '#64748b'

  const eventsPath = user?.role === 'teacher' || user?.role === 'class_teacher'
    ? '/teacher/events'
    : user?.role === 'dos'     ? '/dos/events'
    : user?.role === 'deputy'  ? '/deputy/events'
    : user?.role === 'principal' ? '/principal/events'
    : null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (dotRef.current && !dotRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleClick() {
    if (eventsPath) {
      navigate(eventsPath)
    } else {
      setOpen(o => !o)
    }
  }

  const dateStr = new Date(event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div
      ref={dotRef}
      className="tpt-dot"
      style={{ left: `${pct}%` }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setOpen(false) }}
    >
      <div className="tpt-dot-inner" style={{
        background: color,
        opacity: past ? 1 : 0.6,
        boxShadow: open || hovered ? `0 0 0 5px ${color}30, 0 0 12px ${color}60` : `0 0 0 3px ${color}22`,
      }} />

      {/* Hover tooltip */}
      {hovered && !open && (
        <div style={{
          position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--txt)', color: '#fff',
          borderRadius: 8, padding: '6px 10px',
          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,.2)',
          zIndex: 70, pointerEvents: 'none',
          animation: 'tptPopIn .15s ease both',
        }}>
          {event.title}
          <div style={{ fontSize: 10, fontWeight: 400, opacity: .8, marginTop: 1 }}>{dateStr}</div>
          <div style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, background: 'var(--txt)', borderRadius: 1, rotate: '45deg' }} />
        </div>
      )}

      {open && (
        <div className="tpt-popover" onMouseLeave={() => setOpen(false)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 9, background: `${color}18`, border: `.5px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, color: 'var(--txt)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--txt3)', marginTop: 1 }}>{dateStr}</div>
            </div>
          </div>
          {(event.subjectName || event.className) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {event.subjectName && <span style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 6 }}>{event.subjectName}</span>}
              {event.className   && <span style={{ fontSize: 10.5, color: 'var(--txt2)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 6 }}>{event.className}</span>}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, background: `${color}18`, color, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .4 }}>{event.type}</span>
            {event.classAverage != null && (
              <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10.5, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', fontWeight: 700 }}>Avg {event.classAverage}%</span>
            )}
          </div>
          {eventsPath && (
            <button
              onClick={e => { e.stopPropagation(); navigate(eventsPath) }}
              style={{ marginTop: 10, width: '100%', padding: '6px 0', borderRadius: 8, border: 'none', background: `${color}15`, color, fontWeight: 700, fontSize: 11.5, cursor: 'pointer' }}
            >
              View all events →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TERM PROGRESS TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════
export function TermProgressTimeline() {
  const { loading: authLoading } = useAuth()
  const { data: tp, isLoading } = useTermProgress()
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 120)
    return () => clearTimeout(t)
  }, [tp])

  // ── Loading — also covers the brief window before auth state is established ──
  if (isLoading || authLoading) {
    return (
      <div style={{ height: 164, borderRadius: 24, marginBottom: 24, background: 'var(--surface)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--txt3)', fontSize: 13 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(13,148,136,.3)', borderTopColor: 'var(--brand)', animation: 'spin .7s linear infinite' }} />
        Loading term progress…
      </div>
    )
  }

  // ── No academic year ──
  if (!tp) {
    return (
      <div style={{ height: 164, borderRadius: 24, marginBottom: 24, background: 'var(--surface)', border: '.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', fontSize: 13 }}>
        No active academic year configured.
      </div>
    )
  }

  // ── Term dates not set ──
  if (tp.currentTerm === 'Term dates not configured') {
    return (
      <div style={{ height: 164, borderRadius: 24, marginBottom: 24, background: 'var(--surface)', border: '.5px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>Term dates not set</span>
        <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Add term dates in Academic Year settings.</span>
      </div>
    )
  }

  const pct    = Math.min(100, Math.max(0, tp.percentElapsed))
  const tStart = new Date(tp.termStart).getTime()
  const tEnd   = new Date(tp.termEnd).getTime()
  const span   = Math.max(1, tEnd - tStart)

  const eventPositions = tp.events.map(ev =>
    Math.max(2, Math.min(98, ((new Date(ev.date).getTime() - tStart) / span) * 100))
  )

  const fillPct      = animated ? pct : 0
  const pctColor     = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#0d9488'
  const daysLeft     = tp.daysRemaining
  const urgencyLabel = daysLeft <= 7 ? `${daysLeft}d left!` : daysLeft <= 21 ? `${daysLeft}d left` : `${tp.weekNumber} / ${tp.totalWeeks} wks`
  const presentTypes = [...new Set(tp.events.map(e => e.type))]

  return (
    <>
      <style>{CSS}</style>
      <div className="tpt-shell" style={{ marginBottom: 24, willChange: 'transform' }}>

        {/* ── Background gradient fill (left side) ── */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${fillPct}%`,
          background: 'linear-gradient(135deg,rgba(13,148,136,.06) 0%,rgba(14,165,233,.04) 100%)',
          borderRadius: '24px 0 0 24px',
          transition: 'width 1.1s cubic-bezier(.4,0,.2,1)',
          pointerEvents: 'none',
        }} />

        {/* ── Top row: term chip + stats ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px 0', position: 'relative' }}>
          {/* Left: term + week */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 800, background: 'rgba(13,148,136,.1)', color: 'var(--brand)', border: '.5px solid rgba(13,148,136,.2)', letterSpacing: .2 }}>
              {tp.currentTerm}
            </span>
            <span style={{ padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: 'var(--surface2)', color: 'var(--txt2)', border: '.5px solid var(--border)' }}>
              {urgencyLabel}
            </span>
          </div>

          {/* Right: % + date range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {presentTypes.length > 0 && (
              <div className="tpt-legend" style={{ gap: 6 }}>
                {(Object.entries(TERM_EVENT_COLOR) as [string, string][]).map(([type, color]) =>
                  presentTypes.includes(type as TermEventType) ? (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <div className="tpt-legend-dot" style={{ background: color }} />
                      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'capitalize' }}>{type}</span>
                    </div>
                  ) : null
                )}
              </div>
            )}
            <span style={{ fontFamily: 'var(--font3)', fontWeight: 900, fontSize: 20, color: pctColor, lineHeight: 1, letterSpacing: -1 }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* ── Track ── */}
        <div className="tpt-track-wrap">
          <div className="tpt-track">
            <div className="tpt-fill" style={{ width: `${fillPct}%` }} />

            {/* TODAY marker */}
            <div className="tpt-today" style={{ left: `${pct}%` }} />

            {/* Event dots */}
            {tp.events.map((ev, i) => (
              <EventDot key={ev.id} event={ev} pct={eventPositions[i]} />
            ))}
          </div>
        </div>

        {/* ── Bottom row: dates + days remaining ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 22px 16px', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1 }}>Start</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
              {new Date(tp.termStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          {/* Center: progress pills */}
          <div style={{ display: 'flex', gap: 5, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 9px', borderRadius: 99, background: pctColor + '14', border: `.5px solid ${pctColor}28` }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: pctColor }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: pctColor, fontFamily: 'var(--font3)' }}>{Math.round(pct)}% elapsed</span>
            </div>
            {tp.events.length > 0 && (
              <div style={{ padding: '3px 9px', borderRadius: 99, background: 'var(--surface2)', border: '.5px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--txt3)' }}>
                {tp.events.length} event{tp.events.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 1 }}>End</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>
              {new Date(tp.termEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Safe wrapper ─────────────────────────────────────────────────────────────
export function SafeTermProgressTimeline() {
  return (
    <ErrorBoundary fallback={<div style={{ minHeight: 164, marginBottom: 24 }} />}>
      <div style={{ minHeight: 164 }}>
        <TermProgressTimeline />
      </div>
    </ErrorBoundary>
  )
}
