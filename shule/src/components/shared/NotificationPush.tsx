import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../store/AuthContext'
import { useQueryClient } from '@tanstack/react-query'
import type { Notification } from '../../types/week9'

// ── Icon for notification type ─────────────────────────────────────────────
function NotifIcon({ type }: { type: Notification['type'] }) {
  const configs: Record<string, { icon: string; color: string }> = {
    report_card: { icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6', color: '#8b5cf6' },
    attendance:  { icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', color: '#0ea5e9' },
    message:     { icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', color: '#10b981' },
    event:       { icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', color: '#f59e0b' },
    fee:         { icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6', color: '#f43f5e' },
    general:     { icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', color: '#0d9488' },
  }
  const c = configs[type] ?? configs.general
  return (
    <div style={{ width: 36, height: 36, borderRadius: 11, background: `${c.color}18`, border: `.5px solid ${c.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={c.icon} />
      </svg>
    </div>
  )
}

// ── Single toast card ──────────────────────────────────────────────────────
function PushToast({ notif, onDismiss }: { notif: Notification & { key: number }; onDismiss: () => void }) {
  const navigate   = useNavigate()
  const [exiting, setExiting] = useState(false)
  const timerRef  = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    timerRef.current = setTimeout(() => dismiss(), 6000)
    return () => clearTimeout(timerRef.current)
  }, [])

  function dismiss() {
    setExiting(true)
    setTimeout(onDismiss, 320)
  }

  function handleClick() {
    dismiss()
    if (notif.link) navigate(notif.link)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        background: 'var(--surface)',
        border: '.5px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 8px 32px rgba(0,0,0,.16)',
        cursor: notif.link ? 'pointer' : 'default',
        width: 340, maxWidth: '90vw',
        animation: exiting
          ? 'pushSlideOut .32s cubic-bezier(.4,0,1,1) forwards'
          : 'pushSlideIn .3s cubic-bezier(.32,.72,0,1) both',
        position: 'relative',
        userSelect: 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      <NotifIcon type={notif.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', lineHeight: 1.4, marginBottom: 2 }}>
          {notif.body}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
          {new Date(notif.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          {notif.link && <span style={{ marginLeft: 6, color: 'var(--brand)', fontWeight: 700 }}>· Tap to view</span>}
        </div>
      </div>
      <button
        onClick={e => { e.stopPropagation(); dismiss() }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--txt3)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      {/* Progress bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, borderRadius: '0 0 16px 16px', background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'var(--brand)', animation: 'pushProgress 6s linear forwards' }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION PUSH LISTENER
// Subscribes to realtime inserts on notifications table for the current user.
// ═══════════════════════════════════════════════════════════════════════════════
export function NotificationPushListener() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [queue, setQueue] = useState<(Notification & { key: number })[]>([])
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
          const notif: Notification & { key: number } = {
            key:       ++keyRef.current,
            id:        r['id'] as string,
            schoolId:  r['school_id'] as string,
            userId:    r['user_id'] as string,
            type:      r['type'] as Notification['type'],
            body:      r['body'] as string,
            link:      r['link'] as string | null,
            readAt:    r['read_at'] as string | null,
            createdAt: r['created_at'] as string,
          }
          setQueue(q => [...q.slice(-3), notif])
          // Refresh notification bell count
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
          from { opacity:0; transform:translateX(100%) scale(.95) }
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
        position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
        display: 'flex', flexDirection: 'column-reverse', gap: 10,
        pointerEvents: 'none',
      }}>
        {queue.map(n => (
          <div key={n.key} style={{ pointerEvents: 'all' }}>
            <PushToast
              notif={n}
              onDismiss={() => setQueue(q => q.filter(x => x.key !== n.key))}
            />
          </div>
        ))}
      </div>
    </>,
    portal
  )
}
