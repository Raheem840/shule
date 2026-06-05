import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import type { NotificationType } from '../../types/week9'

const AUTO_DISMISS_MS = 5500

interface ToastNotif {
  id: string
  type: NotificationType
  title: string | null
  body: string
  link: string | null
}

// ── Icons per notification type ──────────────────────────────────────────────
function NotifIcon({ type }: { type: NotificationType }) {
  const style = { flexShrink: 0 } as const
  switch (type) {
    case 'report_card':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
    case 'message':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    case 'announcement':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><path d="M22 17H2a3 3 0 000 6h20a3 3 0 000-6z"/><path d="M16 1H8L2 9h20L16 1z"/><line x1="12" y1="1" x2="12" y2="9"/></svg>
    case 'fee':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    case 'attendance':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>
    case 'event':
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    default:
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
  }
}

const TYPE_COLOR: Record<NotificationType, string> = {
  report_card: '#8b5cf6',
  message:     '#0ea5e9',
  announcement:'#f59e0b',
  fee:         '#10b981',
  attendance:  '#f43f5e',
  event:       '#0d9488',
  general:     '#475569',
}

// ── Single toast card ─────────────────────────────────────────────────────────
function ToastCard({
  notif,
  onDismiss,
}: {
  notif: ToastNotif
  onDismiss: () => void
}) {
  const navigate = useNavigate()
  const [progress, setProgress] = useState(100)
  const [visible, setVisible]   = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Slide-in after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Progress bar countdown
  useEffect(() => {
    const step = 100 / (AUTO_DISMISS_MS / 50)
    intervalRef.current = setInterval(() => {
      setProgress(p => {
        if (p <= step) {
          clearInterval(intervalRef.current!)
          handleDismiss()
          return 0
        }
        return p - step
      })
    }, 50)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleDismiss() {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  function handleClick() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    handleDismiss()
    if (notif.link) navigate(notif.link)
  }

  const accentColor = TYPE_COLOR[notif.type] ?? '#475569'

  return (
    <div
      onClick={notif.link ? handleClick : undefined}
      style={{
        position:      'relative',
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
        padding:       '14px 16px 10px',
        background:    'var(--surface)',
        borderRadius:  16,
        boxShadow:     '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
        border:        `1px solid color-mix(in srgb, ${accentColor} 20%, var(--border))`,
        borderLeft:    `3.5px solid ${accentColor}`,
        cursor:        notif.link ? 'pointer' : 'default',
        minWidth:      300,
        maxWidth:      360,
        overflow:      'hidden',
        transform:     visible ? 'translateX(0)' : 'translateX(calc(100% + 24px))',
        opacity:       visible ? 1 : 0,
        transition:    'transform 0.32s cubic-bezier(0.34,1.4,0.64,1), opacity 0.25s ease',
        backdropFilter:'blur(8px)',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accentColor,
        }}>
          <NotifIcon type={notif.type} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {notif.title && (
            <div style={{
              fontSize: 13, fontWeight: 700, color: 'var(--txt)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}>
              {notif.title}
            </div>
          )}
          <div style={{
            fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.45,
            display:         '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow:        'hidden',
          }}>
            {notif.body}
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={e => { e.stopPropagation(); handleDismiss() }}
          style={{
            width: 22, height: 22, borderRadius: 6, border: 'none',
            background: 'var(--surface2)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--txt3)', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--border)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface2)')}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Click hint */}
      {notif.link && (
        <div style={{ fontSize: 11, color: accentColor, fontWeight: 600, paddingLeft: 44, opacity: 0.8 }}>
          Tap to view →
        </div>
      )}

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
        background: 'var(--border)',
      }}>
        <div style={{
          height: '100%',
          width:  `${progress}%`,
          background: accentColor,
          transition: 'width 0.05s linear',
          borderRadius: 99,
        }} />
      </div>
    </div>
  )
}

// ── Provider — realtime subscription + toast queue ────────────────────────────
export function NotificationToastProvider() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [toasts, setToasts] = useState<ToastNotif[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notif-toast-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          const incoming: ToastNotif = {
            id:    r['id'] as string,
            type:  (r['type'] as NotificationType) ?? 'general',
            title: (r['title'] as string | null) ?? null,
            body:  (r['body'] as string) ?? '',
            link:  (r['link'] as string | null) ?? null,
          }
          // Add to queue (cap at 4 visible)
          setToasts(prev => [incoming, ...prev].slice(0, 4))
          // Refresh the bell counter
          void qc.invalidateQueries({ queryKey: ['notifications', user.id] })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.id, qc])

  if (toasts.length === 0) return null

  return createPortal(
    <div
      style={{
        position:      'fixed',
        top:           20,
        right:         20,
        zIndex:        9999,
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        alignItems:    'flex-end',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'auto' }}>
          <ToastCard notif={t} onDismiss={() => dismiss(t.id)} />
        </div>
      ))}
    </div>,
    document.body
  )
}
