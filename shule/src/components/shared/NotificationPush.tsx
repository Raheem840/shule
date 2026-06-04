import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import type { Notification } from '../../types/week9'

// ── Notification type config ──────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { icon: string; color: string; label: string; gradient: string }> = {
  report_card: {
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    color: '#8b5cf6', label: 'Report Card',
    gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  },
  attendance: {
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
    color: '#0ea5e9', label: 'Attendance',
    gradient: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
  },
  message: {
    icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    color: '#10b981', label: 'Message',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
  },
  announcement: {
    icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
    color: '#f59e0b', label: 'Announcement',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  event: {
    icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    color: '#f59e0b', label: 'Event',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  fee: {
    icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    color: '#f43f5e', label: 'Fee',
    gradient: 'linear-gradient(135deg, #f43f5e, #e11d48)',
  },
  general: {
    icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    color: '#0d9488', label: 'Notification',
    gradient: 'linear-gradient(135deg, #0d9488, #0f766e)',
  },
}

// ── Single push toast card ─────────────────────────────────────────────────────
function PushToast({
  notif,
  onDismiss,
  index,
}: {
  notif: Notification & { key: number; fromName?: string }
  onDismiss: () => void
  index: number
}) {
  const navigate   = useNavigate()
  const [exiting, setExiting] = useState(false)
  const [hovered, setHovered] = useState(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout>>()
  const DURATION  = 7000

  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.general

  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(), DURATION)
    return () => clearTimeout(timerRef.current)
  }, [])

  function dismiss() {
    setExiting(true)
    setTimeout(onDismiss, 350)
  }

  function handleClick() {
    dismiss()
    if (notif.link) navigate(notif.link)
  }

  // Pause timer on hover
  function handleMouseEnter() {
    setHovered(true)
    clearTimeout(timerRef.current)
  }

  function handleMouseLeave() {
    setHovered(false)
    timerRef.current = setTimeout(() => dismiss(), DURATION / 2)
  }

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: 360, maxWidth: '92vw',
        background: 'var(--surface)',
        border: `1px solid ${cfg.color}30`,
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 16,
        boxShadow: `0 12px 40px rgba(0,0,0,.18), 0 4px 16px ${cfg.color}20`,
        cursor: notif.link ? 'pointer' : 'default',
        animation: exiting
          ? 'pushSlideOut .35s cubic-bezier(.4,0,1,1) forwards'
          : `pushSlideIn .38s cubic-bezier(.32,.72,0,1) ${index * 0.06}s both`,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        backdropFilter: 'blur(16px)',
        transition: 'box-shadow .2s, transform .2s',
        transform: hovered ? 'scale(1.01)' : 'scale(1)',
      }}
    >
      {/* Top accent gradient */}
      <div style={{ height: 3, background: cfg.gradient, borderRadius: '16px 16px 0 0', margin: '-1px -1px 0 -4px', width: 'calc(100% + 5px)' }} />

      <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 13, flexShrink: 0,
          background: `${cfg.color}15`, border: `1.5px solid ${cfg.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={cfg.icon} />
          </svg>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3,
          }}>
            <span style={{
              fontSize: 9.5, fontWeight: 900, fontFamily: 'var(--font2)', letterSpacing: .7,
              textTransform: 'uppercase', color: cfg.color,
            }}>
              {cfg.label}
            </span>
            <span style={{ fontSize: 9.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
              · {new Date(notif.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Sender name for messages */}
          {notif.fromName && (
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 2 }}>
              {notif.fromName}
            </div>
          )}

          {/* Body text */}
          <div style={{
            fontSize: 12.5, fontWeight: notif.fromName ? 500 : 700,
            color: notif.fromName ? 'var(--txt2)' : 'var(--txt)',
            lineHeight: 1.45,
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {notif.body}
          </div>

          {notif.link && (
            <div style={{ fontSize: 10.5, color: cfg.color, fontWeight: 700, marginTop: 4, fontFamily: 'var(--font2)' }}>
              Tap to open →
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={e => { e.stopPropagation(); dismiss() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, color: 'var(--txt3)', flexShrink: 0,
            display: 'flex', alignItems: 'center', borderRadius: 7,
            transition: 'background .1s',
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = 'var(--surface2)'); e.stopPropagation() }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 4, right: 0, height: 3,
        background: 'var(--surface2)', overflow: 'hidden',
        borderRadius: '0 0 16px 0',
      }}>
        <div style={{
          height: '100%',
          background: cfg.gradient,
          animation: hovered ? 'none' : `pushProgress ${DURATION}ms linear forwards`,
        }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PUSH LISTENER
// Subscribes to realtime inserts on notifications table for the current user.
// Slides in from top-right like a native app push notification.
// ═══════════════════════════════════════════════════════════════════════════════
export function NotificationPushListener() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [queue, setQueue] = useState<(Notification & { key: number; fromName?: string })[]>([])
  const keyRef = useRef(0)

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notif-push-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          // title holds the sender name for message/announcement notifications
          const titleVal = (r['title'] as string | null) ?? null
          const notif: Notification & { key: number; fromName?: string } = {
            key:       ++keyRef.current,
            id:        r['id'] as string,
            schoolId:  r['school_id'] as string,
            userId:    r['user_id'] as string,
            type:      r['type'] as Notification['type'],
            title:     titleVal,
            body:      r['body'] as string,
            link:      r['link'] as string | null,
            readAt:    r['read_at'] as string | null,
            createdAt: r['created_at'] as string,
            fromName:  titleVal ?? undefined,
          }
          setQueue(q => [notif, ...q.slice(0, 3)])
          void qc.invalidateQueries({ queryKey: ['notifications', user.id] })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [user?.id])

  if (queue.length === 0) return null

  const portal = (document.querySelector('.ar') as HTMLElement) ?? document.body

  return createPortal(
    <>
      <style>{`
        @keyframes pushSlideIn {
          from { opacity:0; transform:translateX(110%) scale(.95) }
          to   { opacity:1; transform:translateX(0) scale(1) }
        }
        @keyframes pushSlideOut {
          to { opacity:0; transform:translateX(110%) scale(.92) }
        }
        @keyframes pushProgress {
          from { width:100% } to { width:0% }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        pointerEvents: 'none',
        maxWidth: '92vw',
      }}>
        {queue.map((n, i) => (
          <div key={n.key} style={{ pointerEvents: 'all' }}>
            <PushToast
              notif={n}
              index={i}
              onDismiss={() => setQueue(q => q.filter(x => x.key !== n.key))}
            />
          </div>
        ))}
      </div>
    </>,
    portal
  )
}
