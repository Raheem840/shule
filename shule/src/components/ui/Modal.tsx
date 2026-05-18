import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: Size
  children: ReactNode
  footer?: ReactNode
}

const sizeWidths: Record<Size, string> = {
  sm: '400px',
  md: '560px',
  lg: '720px',
  xl: '900px',
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => dialogRef.current?.focus(), 10)
      return () => clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(3,7,17,0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Dialog — sui-modal-dialog → fadeUp animation in index.css */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="sui-modal-dialog"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: sizeWidths[size],
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--sh-lg)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          outline: 'none',
        }}
      >
        {/* Header */}
        {title && (
          <div
            style={{
              padding: '1rem 1.25rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font2)',
                fontSize: 15,
                fontWeight: 800,
                color: 'var(--txt)',
                letterSpacing: '-0.3px',
              }}
            >
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--r)',
                border: '1px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--txt2)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '0.9rem 1.25rem',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function ModalCancelButton({ onClose }: { onClose: () => void }) {
  return <Button variant="secondary" onClick={onClose}>Cancel</Button>
}
