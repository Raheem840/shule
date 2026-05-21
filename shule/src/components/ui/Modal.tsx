import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

type Size = 'sm' | 'md' | 'lg' | 'xl'

interface ModalProps {
  open:     boolean
  onClose:  () => void
  title?:   string
  size?:    Size
  children: ReactNode
  footer?:  ReactNode
}

const sizeWidths: Record<Size, string> = {
  sm: '420px',
  md: '580px',
  lg: '740px',
  xl: '920px',
}

// Portal into .ar so CSS tokens (--modal-bg, dark-mode overrides) cascade correctly.
function getPortalTarget(): HTMLElement {
  return (document.querySelector('.ar') as HTMLElement | null) ?? document.body
}

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Auto-focus
  useEffect(() => {
    if (open) {
      const id = setTimeout(() => dialogRef.current?.focus(), 10)
      return () => clearTimeout(id)
    }
  }, [open])

  // Prevent body scroll
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
      {/* ── Overlay — subtle dark veil, no extra blur so the dialog's blur shines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--modal-overlay)',
        }}
        onClick={onClose}
      />

      {/* ── Glass dialog */}
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
          /* Frosted glass */
          background:              'var(--modal-bg)',
          backdropFilter:          'blur(28px) saturate(200%)',
          WebkitBackdropFilter:    'blur(28px) saturate(200%)',
          /* Layered borders: normal sides + brighter top edge */
          border:                  '1px solid var(--modal-border)',
          borderTop:               '1.5px solid var(--modal-border-t)',
          borderRadius:            'var(--r-xl)',
          boxShadow:               'var(--modal-shadow)',
          display:                 'flex',
          flexDirection:           'column',
          maxHeight:               '90vh',
          outline:                 'none',
          overflow:                'hidden',
        }}
      >
        {/* ── Header */}
        {title && (
          <div
            style={{
              padding:         '1rem 1.25rem 0.9rem',
              borderBottom:    '1px solid var(--modal-divider)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'space-between',
              flexShrink:      0,
              gap:             '0.75rem',
            }}
          >
            <span
              style={{
                fontFamily:    'var(--font2)',
                fontSize:      16,
                fontWeight:    800,
                color:         'var(--txt)',
                letterSpacing: '-0.4px',
                lineHeight:    1.2,
              }}
            >
              {title}
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="sui-modal-close"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* ── Body */}
        <div
          style={{
            flex:            1,
            overflowY:       'auto',
            padding:         '1.25rem',
            scrollbarWidth:  'thin',
            scrollbarColor:  'var(--border) transparent',
          }}
        >
          {children}
        </div>

        {/* ── Footer */}
        {footer && (
          <div
            style={{
              padding:        '0.9rem 1.25rem',
              borderTop:      '1px solid var(--modal-divider)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'flex-end',
              gap:            '0.5rem',
              flexShrink:     0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    getPortalTarget()
  )
}

export function ModalCancelButton({ onClose }: { onClose: () => void }) {
  return <Button variant="secondary" onClick={onClose}>Cancel</Button>
}
