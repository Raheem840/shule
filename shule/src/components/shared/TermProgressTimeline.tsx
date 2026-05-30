import { useState, useEffect, useRef } from 'react'
import { useTermProgress, TERM_EVENT_COLOR } from '../../hooks/useTermProgress'
import { ErrorBoundary } from './ErrorBoundary'
import type { TermEvent } from '../../types/week9'

// ─── CSS for timeline ─────────────────────────────────────────────────────────
const TL_CSS = `
  .tl-shell {
    position: relative; border-radius: 20px; overflow: visible;
    background: rgba(255,255,255,0.82);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255,255,255,0.55);
    box-shadow: 0 4px 32px rgba(13,148,136,0.08), 0 1px 8px rgba(0,0,0,0.04);
  }
  [data-theme="dark"] .tl-shell {
    background: rgba(15,23,42,0.80);
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 4px 32px rgba(0,0,0,0.3);
  }
  .tl-dot:hover .tl-dot-inner { transform: scale(1.5) !important; }
  .tl-dot-inner { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1); }
  .tl-popover { animation: tlPopoverIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both; }
  @keyframes tlPopoverIn { from{opacity:0;transform:translateX(-50%) translateY(4px) scale(0.9)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
  @keyframes tlFill  { from { width: 0 } to { width: var(--tl-pct) } }
  @keyframes tlPulse { 0%,100%{box-shadow:0 0 0 0 rgba(13,148,136,0.5)} 50%{box-shadow:0 0 0 6px rgba(13,148,136,0)} }
  @keyframes tlShimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes tlWave { 0%{background-position:0 0} 100%{background-position:80px 0} }
`

// ─── Event dot ────────────────────────────────────────────────────────────────
function EventDot({ event, pct }: { event: TermEvent; pct: number }) {
  const [open, setOpen] = useState(false)
  const isPast  = new Date(event.date) < new Date()
  const color   = TERM_EVENT_COLOR[event.type]
  const dotRef  = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={dotRef}
      className="tl-dot"
      style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}
    >
      <div
        className="tl-dot-inner"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 14, height: 14, borderRadius: '50%', cursor: 'pointer',
          background: color,
          border: `2.5px solid var(--surface)`,
          opacity: isPast ? 1 : 0.65,
          boxShadow: `0 0 0 ${open ? 5 : 3}px ${color}30`,
        }}
        title={event.title}
      />

      {open && (
        <div
          className="tl-popover"
          style={{
            position: 'absolute', top: 22, left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14, padding: '12px 16px', minWidth: 192,
            boxShadow: '0 8px 32px rgba(0,0,0,0.16)', zIndex: 60,
            fontSize: 12,
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ fontWeight: 800, color: 'var(--txt)', marginBottom: 5, fontSize: 13 }}>
            {event.title}
          </div>
          {event.subjectName && (
            <div style={{ color: 'var(--txt2)', marginBottom: 2 }}>Subject: {event.subjectName}</div>
          )}
          {event.className && (
            <div style={{ color: 'var(--txt2)', marginBottom: 2 }}>Class: {event.className}</div>
          )}
          <div style={{ color: 'var(--txt3)', marginTop: 4 }}>
            {new Date(event.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </div>
          {event.classAverage != null && (
            <div style={{
              marginTop: 8, padding: '5px 10px', borderRadius: 8,
              background: 'var(--brand-light)', color: 'var(--brand)', fontWeight: 700,
            }}>
              Class avg: {event.classAverage}%
            </div>
          )}
          <div style={{
            marginTop: 6, display: 'inline-block',
            padding: '2px 8px', borderRadius: 6, fontSize: 10,
            background: `${color}20`, color, fontWeight: 700, textTransform: 'uppercase',
          }}>
            {event.type}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── TermProgressTimeline ─────────────────────────────────────────────────────
export function TermProgressTimeline() {
  const { data: tp, isLoading } = useTermProgress()
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [tp])

  if (isLoading) {
    return (
      <div style={{
        height: 168, borderRadius: 20, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, color: 'var(--txt3)', fontSize: 13,
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(13,148,136,0.3)', borderTopColor: 'var(--brand)', animation: 'spin 0.7s linear infinite' }} />
        Loading term progress…
      </div>
    )
  }

  if (!tp) {
    return (
      <div style={{
        height: 168, borderRadius: 20, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--txt3)', fontSize: 13,
      }}>
        No active academic year configured.
      </div>
    )
  }

  if (tp.currentTerm === 'Term dates not configured') {
    return (
      <div style={{
        height: 168, borderRadius: 20, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--warning)' }}>Term dates not set</span>
        <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Add term start/end dates in Academic Year settings.</span>
      </div>
    )
  }

  const pct    = Math.min(100, Math.max(0, tp.percentElapsed))
  const tStart = new Date(tp.termStart).getTime()
  const tEnd   = new Date(tp.termEnd).getTime()
  const span   = Math.max(1, tEnd - tStart)

  const eventPositions = tp.events.map(ev =>
    Math.max(0, Math.min(100, ((new Date(ev.date).getTime() - tStart) / span) * 100))
  )

  const fillPct = animated ? pct : 0

  return (
    <>
      <style>{TL_CSS}</style>
      <div
        className="tl-shell"
        style={{ height: 168, marginBottom: 24, willChange: 'transform' }}
      >
        {/* ── Filled area ── */}
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: `${fillPct}%`, height: '100%',
          borderRadius: '20px 0 0 20px',
          background: 'linear-gradient(135deg, rgba(13,148,136,0.16) 0%, rgba(13,148,136,0.08) 100%)',
          transition: `width 1.1s cubic-bezier(0.4,0,0.2,1)`,
          overflow: 'hidden',
        }}>
          {/* Animated shimmer stripe */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(90deg, transparent 0px, rgba(13,148,136,0.07) 20px, transparent 40px)',
            animation: 'tlWave 3s linear infinite',
          }} />
        </div>

        {/* ── Wavy right edge of fill ── */}
        {fillPct > 1 && fillPct < 99 && (
          <div style={{
            position: 'absolute', left: `${fillPct}%`, top: 0, height: '100%', width: 20,
            transform: 'translateX(-50%)', pointerEvents: 'none',
          }}>
            <svg viewBox="0 0 20 168" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <path
                d="M10,0 C16,21 4,42 10,63 C16,84 4,105 10,126 C16,147 4,158 10,168 L0,168 L0,0 Z"
                fill="rgba(13,148,136,0.16)"
              />
            </svg>
          </div>
        )}

        {/* ── Track ── */}
        <div style={{
          position: 'absolute', left: 20, right: 20,
          top: '50%', height: 3,
          background: 'var(--border)',
          transform: 'translateY(-50%)',
          borderRadius: 2,
        }} />

        {/* ── TODAY line ── */}
        <div style={{
          position: 'absolute', left: `${pct}%`, top: 12, bottom: 12,
          width: 2.5, background: 'var(--brand)',
          borderRadius: 2, transform: 'translateX(-1.25px)',
          boxShadow: '0 0 12px rgba(13,148,136,0.6), 0 0 4px rgba(13,148,136,0.4)',
          animation: 'tlPulse 2.5s ease infinite',
        }}>
          <div style={{
            position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
            fontSize: 8, fontWeight: 900, color: '#fff',
            letterSpacing: '0.4px', whiteSpace: 'nowrap',
            background: 'var(--brand)',
            padding: '2px 6px', borderRadius: 99,
            boxShadow: '0 2px 8px rgba(13,148,136,0.4)',
          }}>
            TODAY
          </div>
        </div>

        {/* ── Event dots ── */}
        {tp.events.map((ev, i) => (
          <EventDot key={ev.id} event={ev} pct={eventPositions[i]} />
        ))}

        {/* ── Start label ── */}
        <div style={{
          position: 'absolute', left: 20, bottom: 14,
          fontSize: 10, color: 'var(--txt3)', fontWeight: 700,
        }}>
          {new Date(tp.termStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>

        {/* ── End label ── */}
        <div style={{
          position: 'absolute', right: 20, bottom: 14,
          fontSize: 10, color: 'var(--txt3)', fontWeight: 700,
        }}>
          {new Date(tp.termEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>

        {/* ── Centre info strip ── */}
        <div style={{
          position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 8, alignItems: 'center', whiteSpace: 'nowrap',
        }}>
          {[
            { label: tp.currentTerm, accent: true },
            { label: `Week ${tp.weekNumber}/${tp.totalWeeks}` },
            { label: `${tp.daysRemaining}d left` },
            { label: `${Math.round(pct)}%` },
          ].map((chip, i) => (
            <div key={i} style={{
              padding: '3px 9px', borderRadius: 99, fontSize: 10, fontWeight: 800,
              background: chip.accent ? 'rgba(13,148,136,0.12)' : 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(8px)',
              color: chip.accent ? 'var(--brand)' : 'var(--txt2)',
              border: chip.accent ? '1px solid rgba(13,148,136,0.2)' : '1px solid var(--border)',
              boxShadow: chip.accent ? '0 2px 8px rgba(13,148,136,0.14)' : 'none',
            }}>
              {chip.label}
            </div>
          ))}
        </div>

        {/* ── Event legend (top-right) ── */}
        {tp.events.length > 0 && (
          <div style={{
            position: 'absolute', top: 14, right: 20,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            {(Object.entries(TERM_EVENT_COLOR) as [string, string][]).map(([type, color]) =>
              tp.events.some(e => e.type === type) ? (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--txt3)', textTransform: 'capitalize' }}>{type}</span>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Safe wrapper ─────────────────────────────────────────────────────────────
export function SafeTermProgressTimeline() {
  return (
    <ErrorBoundary fallback={<div style={{ minHeight: 168 }} />}>
      <div style={{ minHeight: 168 }}>
        <TermProgressTimeline />
      </div>
    </ErrorBoundary>
  )
}
