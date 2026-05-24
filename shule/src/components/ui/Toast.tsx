import type { ReactNode } from 'react'
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { createPortal } from 'react-dom'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void
  error:   (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info:    (message: string, duration?: number) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const icons: Record<ToastVariant, ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

const variantStyles: Record<ToastVariant, { bg: string; color: string; border: string }> = {
  success: { bg: 'var(--success-bg)',  color: 'var(--success)', border: 'rgba(16,185,129,0.25)' },
  error:   { bg: 'var(--danger-bg)',   color: 'var(--danger)',  border: 'rgba(244,63,94,0.25)' },
  warning: { bg: 'var(--warning-bg)',  color: 'var(--warning)', border: 'rgba(245,158,11,0.25)' },
  info:    { bg: 'var(--info-bg)',     color: 'var(--info)',    border: 'rgba(14,165,233,0.25)' },
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { bg, color, border } = variantStyles[toast.variant]

  useEffect(() => {
    const t = setTimeout(onDismiss, toast.duration)
    return () => clearTimeout(t)
  }, [toast.duration, onDismiss])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.6rem',
        padding: '0.75rem 1rem',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--sh-md)',
        color,
        minWidth: 280,
        maxWidth: 420,
        animation: 'fadeUp 0.2s ease both',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span style={{ flexShrink: 0, paddingTop: 1 }}>{icons[toast.variant]}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, lineHeight: 1.45, color }}>
        {toast.message}
      </span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color,
          opacity: 0.6,
          padding: 2,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const add = useCallback((message: string, variant: ToastVariant, duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts(prev => [...prev, { id, message, variant, duration }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const ctx: ToastContextValue = {
    success: (m, d) => add(m, 'success', d),
    error:   (m, d) => add(m, 'error',   d),
    warning: (m, d) => add(m, 'warning', d),
    info:    (m, d) => add(m, 'info',    d),
    dismiss,
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            alignItems: 'flex-end',
          }}
        >
          {toasts.map(t => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
