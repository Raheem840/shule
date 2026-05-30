import { useState } from 'react'
import { useTermProgress, TERM_EVENT_COLOR } from '../../hooks/useTermProgress'
import { ErrorBoundary } from './ErrorBoundary'
import type { TermEvent } from '../../types/week9'

// ── Event dot with popover ─────────────────────────────────────────────────
function EventDot({ event, pct }: { event: TermEvent; pct: number }) {
  const [open, setOpen] = useState(false)
  const isPast = new Date(event.date) < new Date()
  const color  = TERM_EVENT_COLOR[event.type]

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10,
      }}
    >
      {/* Dot */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          width: 12, height: 12, borderRadius: '50%',
          background: color,
          border: '2px solid var(--surface)',
          cursor: 'pointer',
          opacity: isPast ? 1 : 0.7,
          boxShadow: `0 0 0 3px ${color}30`,
          transition: 'transform 0.15s',
        }}
        title={event.title}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.4)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      />

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute', top: 18, left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 14px', minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)', zIndex: 50,
            fontSize: 12,
          }}
          // Close on outside click
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ fontWeight: 800, color: 'var(--txt)', marginBottom: 4 }}>
            {event.title}
          </div>
          {event.subjectName && (
            <div style={{ color: 'var(--txt2)' }}>Subject: {event.subjectName}</div>
          )}
          {event.className && (
            <div style={{ color: 'var(--txt2)' }}>Class: {event.className}</div>
          )}
          <div style={{ color: 'var(--txt3)', marginTop: 4 }}>
            {new Date(event.date).toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'short',
            })}
          </div>
          {event.classAverage != null && (
            <div style={{
              marginTop: 6, padding: '4px 8px', borderRadius: 6,
              background: 'var(--brand-light)', color: 'var(--brand)',
              fontWeight: 700,
            }}>
              Class avg: {event.classAverage}%
            </div>
          )}
          <div style={{
            marginTop: 4,
            display: 'inline-block',
            padding: '2px 6px', borderRadius: 4, fontSize: 10,
            background: `${TERM_EVENT_COLOR[event.type]}20`,
            color: TERM_EVENT_COLOR[event.type],
            fontWeight: 700, textTransform: 'uppercase',
          }}>
            {event.type}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TermProgressTimeline ───────────────────────────────────────────────────
export function TermProgressTimeline() {
  const { data: tp, isLoading } = useTermProgress()

  if (isLoading) {
    return (
      <div style={{
        height: 120, borderRadius: 14, background: 'var(--surface)',
        border: '1px solid var(--border)', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--txt3)', fontSize: 13,
      }}>
        Loading term progress…
      </div>
    )
  }

  // Render a minimal placeholder when data is unavailable
  if (!tp) {
    return (
      <div style={{
        minHeight: 120, borderRadius: 14, background: 'var(--surface)',
        border: '1px solid var(--border)', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--txt3)', fontSize: 13,
      }}>
        No active academic year configured.
      </div>
    )
  }

  // Term dates not configured — show a clear warning instead of a flat zero bar
  if (tp.currentTerm === 'Term dates not configured') {
    return (
      <div style={{
        minHeight: 120, borderRadius: 14, background: 'var(--surface)',
        border: '1px solid var(--border)', marginBottom: 24,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>
          Term dates not set
        </span>
        <span style={{ fontSize: 12, color: 'var(--txt3)' }}>
          Open Academic Year and add term start/end dates to see progress.
        </span>
      </div>
    )
  }

  const pct = Math.min(100, Math.max(0, tp.percentElapsed))

  // Map each event to its X position (% of term elapsed when event occurs)
  const tStart = new Date(tp.termStart).getTime()
  const tEnd   = new Date(tp.termEnd).getTime()
  const span   = Math.max(1, tEnd - tStart)

  const eventPositions = tp.events.map(ev => {
    const evMs = new Date(ev.date).getTime()
    return Math.max(0, Math.min(100, ((evMs - tStart) / span) * 100))
  })

  return (
    <div style={{
      position: 'relative', minHeight: 120, height: 120, borderRadius: 14, overflow: 'visible',
      background: 'var(--surface)', border: '1px solid var(--border)',
      marginBottom: 24, willChange: 'transform',
    }}>
      {/* Wave fill — the "elapsed" portion */}
      <div style={{
        position: 'absolute', left: 0, top: 0,
        width: `${pct}%`, height: '100%',
        background: 'linear-gradient(135deg, rgba(13,148,136,0.18) 0%, rgba(13,148,136,0.10) 100%)',
        borderRadius: '14px 0 0 14px',
        transition: 'width 0.6s ease',
        overflow: 'hidden',
      }}>
        {/* Animated wave shimmer */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `repeating-linear-gradient(
            90deg,
            transparent 0px,
            rgba(13,148,136,0.06) 20px,
            transparent 40px
          )`,
          animation: 'shule-wave-scroll 3s linear infinite',
        }} />
      </div>

      {/* Wave edge SVG — the wavy right edge of the fill */}
      {pct > 0 && pct < 100 && (
        <div style={{
          position: 'absolute',
          left: `${pct}%`,
          top: 0, height: '100%', width: 20,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
        }}>
          <svg viewBox="0 0 20 120" preserveAspectRatio="none"
            style={{ width: '100%', height: '100%' }}>
            <path
              d="M10,0 C16,15 4,30 10,45 C16,60 4,75 10,90 C16,105 4,115 10,120 L0,120 L0,0 Z"
              fill="rgba(13,148,136,0.18)"
            />
          </svg>
        </div>
      )}

      {/* Keyframes injected once */}
      <style>{`
        @keyframes shule-wave-scroll {
          0%   { background-position: 0 0; }
          100% { background-position: 80px 0; }
        }
      `}</style>

      {/* Horizontal timeline track */}
      <div style={{
        position: 'absolute', left: 16, right: 16, top: '50%',
        height: 2, background: 'var(--border)',
        transform: 'translateY(-50%)',
      }} />

      {/* TODAY vertical line */}
      <div style={{
        position: 'absolute', left: `${pct}%`, top: 4, bottom: 4,
        width: 2, background: 'var(--brand)',
        borderRadius: 2,
        transform: 'translateX(-1px)',
        boxShadow: '0 0 8px rgba(13,148,136,0.5)',
      }}>
        <span style={{
          position: 'absolute', top: -16, left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 8, fontWeight: 800, color: 'var(--brand)',
          letterSpacing: '0.5px', whiteSpace: 'nowrap',
          background: 'var(--surface)', padding: '1px 4px',
          borderRadius: 3,
        }}>
          TODAY
        </span>
      </div>

      {/* Event dots */}
      {tp.events.map((ev, i) => (
        <EventDot key={ev.id} event={ev} pct={eventPositions[i]} />
      ))}

      {/* Start label */}
      <div style={{
        position: 'absolute', left: 16, bottom: 10,
        fontSize: 10, color: 'var(--txt3)', fontWeight: 600,
      }}>
        {new Date(tp.termStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </div>

      {/* End label */}
      <div style={{
        position: 'absolute', right: 16, bottom: 10,
        fontSize: 10, color: 'var(--txt3)', fontWeight: 600,
      }}>
        {new Date(tp.termEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
      </div>

      {/* Centre info */}
      <div style={{
        position: 'absolute', bottom: 10,
        left: '50%', transform: 'translateX(-50%)',
        display: 'flex', gap: 12, alignItems: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--txt2)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ color: 'var(--brand)' }}>{tp.currentTerm}</span>
        <span>·</span>
        <span>Week {tp.weekNumber} of {tp.totalWeeks}</span>
        <span>·</span>
        <span>{tp.daysRemaining} day{tp.daysRemaining !== 1 ? 's' : ''} remaining</span>
      </div>
    </div>
  )
}

// Safe wrapper — silently swallows render errors so a missing academic year
// never breaks a dashboard.
export function SafeTermProgressTimeline() {
  return (
    <ErrorBoundary fallback={<div style={{ minHeight: 120 }} />}>
      <div style={{ minHeight: 120 }}>
        <TermProgressTimeline />
      </div>
    </ErrorBoundary>
  )
}
