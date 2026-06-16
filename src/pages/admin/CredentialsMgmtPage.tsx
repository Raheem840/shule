import { useState, useMemo, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { generateTempPassword } from '../../lib/passwords'
import { useToast } from '../../components/ui/Toast'
import { useClasses } from '../../hooks/useClasses'
import { useStaff } from '../../hooks/useStaff'
import {
  useActivateStaffLogin,
  useResetStaffPassword,
} from '../../hooks/useStaffAuth'
import {
  useCreateStudentLogin,
  useResetStudentPassword,
  getPendingStudentActivations,
  clearPendingStudentActivation,
} from '../../hooks/useStudents'
import { useSchoolSettings } from '../../hooks/useAdmin'


// ── Types ──────────────────────────────────────────────────────────────────────
type TabId = 'staff' | 'students' | 'parents'


type StudentRow = {
  id: string
  school_id: string
  auth_user_id: string | null
  auth_email: string | null
  temp_password: string | null
  first_name: string
  last_name: string
  admission_number: string
  class_id: string | null
}

type ParentRow = {
  id: string
  school_id: string
  auth_user_id: string | null
  email: string
  full_name: string
  phone: string | null
  student_ids: string[]
  temp_password: string | null
  created_at: string
}

type PasswordResult = { id: string; name: string; email: string; password: string; type: TabId; manual?: boolean }

type BulkSelection = Set<string>

// ── Helpers ────────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  principal:     'Principal',
  deputy:        'Deputy Head',
  dos:           'Director of Studies',
  secretary:     'Secretary',
  bursar:        'Bursar',
  class_teacher: 'Class Teacher',
  teacher:       'Teacher',
  it_admin:      'IT Admin',
}

function statusBadge(authUserId: string | null, isActive?: boolean) {
  if (!authUserId) return { label: 'No login', color: 'var(--danger)', bg: 'rgba(244,63,94,.1)' }
  if (isActive === false) return { label: 'Deactivated', color: 'var(--warning)', bg: 'rgba(245,158,11,.1)' }
  return { label: 'Active', color: 'var(--success)', bg: 'rgba(16,185,129,.1)' }
}

function copy(text: string, onDone?: () => void) {
  void navigator.clipboard.writeText(text).then(() => onDone?.())
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IcoShield  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
const IcoSearch  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
const IcoCopy    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
const IcoClose   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
const IcoCheck   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
const IcoRefresh = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
const IcoEye     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const IcoEyeOff  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
const IcoWarn    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const IcoDownload= () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
const IcoUsers   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
const IcoStudent = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
const IcoParent  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const IcoUnlink  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 00-.12-7.07 5.006 5.006 0 00-6.95 0l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 00.12 7.07 5.006 5.006 0 006.95 0l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>
const IcoMail    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
const IcoKey     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
const IcoLock    = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
const IcoUnlock  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 019.9-1"/></svg>

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
      <span className="shule-skeleton" style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <span className="shule-skeleton" style={{ display: 'block', height: 12, width: '40%', borderRadius: 4, marginBottom: 6 }} />
        <span className="shule-skeleton" style={{ display: 'block', height: 10, width: '60%', borderRadius: 4 }} />
      </div>
      <span className="shule-skeleton" style={{ display: 'block', width: 60, height: 22, borderRadius: 99 }} />
      <span className="shule-skeleton" style={{ display: 'block', width: 80, height: 30, borderRadius: 8 }} />
    </div>
  )
}

// ── Password reveal card ───────────────────────────────────────────────────────
function PasswordCard({ result, onDismiss }: { result: PasswordResult; onDismiss: () => void }) {
  const [copied, setCopied] = useState<'email' | 'pass' | 'all' | null>(null)

  function doCopy(key: 'email' | 'pass' | 'all', value: string) {
    copy(value, () => { setCopied(key); setTimeout(() => setCopied(null), 2000) })
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(16,185,129,.35)', background: 'linear-gradient(135deg,rgba(16,185,129,.07),rgba(13,148,136,.04))', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(16,185,129,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
            <IcoCheck />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>Password Reset — {result.name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>{result.manual ? 'Manual mode — create auth account in Supabase Dashboard first, then share credentials' : 'Share these credentials securely'}</div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, display: 'flex' }}>
          <IcoClose />
        </button>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { key: 'email' as const, label: 'Email',    value: result.email },
          { key: 'pass'  as const, label: 'Password', value: result.password },
        ].map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(16,185,129,.12)', borderRadius: 10, padding: '9px 13px' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{f.value}</div>
            </div>
            <button
              onClick={() => doCopy(f.key, f.value)}
              style={{ background: copied === f.key ? 'rgba(16,185,129,.12)' : 'var(--surface)', border: `1px solid ${copied === f.key ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: copied === f.key ? 'var(--success)' : 'var(--txt2)', transition: 'all 0.15s', fontFamily: 'var(--font2)' }}
            >
              {copied === f.key ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 16px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => doCopy('all', `${result.name}\nEmail: ${result.email}\nPassword: ${result.password}\nURL: ${window.location.origin}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
        >
          <IcoCopy />{copied === 'all' ? '✓ Copied All' : 'Copy All'}
        </button>
      </div>
    </div>
  )
}

// ── Status badge pill ──────────────────────────────────────────────────────────
function StatusPill({ authUserId, isActive }: { authUserId: string | null; isActive?: boolean }) {
  const s = statusBadge(authUserId, isActive)
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
      {s.label}
    </span>
  )
}

// ── Warning badge ──────────────────────────────────────────────────────────────
function OrphanBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(244,63,94,.1)', color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <IcoWarn />Orphan
    </span>
  )
}

// ── Duplicate email warning ────────────────────────────────────────────────────
function DupeBadge() {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: 'rgba(245,158,11,.1)', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <IcoWarn />Duplicate
    </span>
  )
}

// ── Inline action button ───────────────────────────────────────────────────────
function ActionBtn({ onClick, disabled, label, icon, variant = 'ghost' }: {
  onClick: () => void
  disabled?: boolean
  label: string
  icon: React.ReactNode
  variant?: 'ghost' | 'warning' | 'danger' | 'brand'
}) {
  const styles: Record<string, React.CSSProperties> = {
    ghost:   { border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)' },
    warning: { border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: 'var(--warning)' },
    danger:  { border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.08)', color: 'var(--danger)' },
    brand:   { border: 'none', background: 'linear-gradient(135deg,var(--brand),var(--info))', color: '#fff' },
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, transition: 'all 0.15s', whiteSpace: 'nowrap', ...styles[variant] }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.85' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = '1' }}
    >
      {icon}{label}
    </button>
  )
}

// ── Confirm modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, onConfirm, onClose, danger }: {
  title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean
}) {
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 600, padding: 20 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 440, boxShadow: '0 32px 96px rgba(0,0,0,.32)', overflow: 'hidden' }}
      >
        {/* Colour bar */}
        <div style={{ height: 4, background: danger ? 'var(--danger)' : 'linear-gradient(90deg,var(--brand),var(--info))' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon + title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: danger ? 'rgba(244,63,94,.12)' : 'rgba(13,148,136,.1)',
              color: danger ? 'var(--danger)' : 'var(--brand)',
            }}>
              {danger
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              }
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', lineHeight: 1.3 }}>{title}</div>
              <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6, marginTop: 5 }}>{body}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'background .15s' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: danger ? 'var(--danger)' : 'linear-gradient(135deg,var(--brand),var(--info))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: danger ? '0 4px 14px rgba(244,63,94,.3)' : '0 4px 14px rgba(13,148,136,.3)' }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ── Parent temp-password reveal (blur + 5-min auto-hide) ──────────────────────
function ParentPasswordReveal({ password }: { password: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied,   setCopied]   = useState(false)

  // Auto-hide after 5 minutes for security
  useEffect(() => {
    if (!revealed) return
    const timer = setTimeout(() => setRevealed(false), 5 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [revealed])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font3)', fontSize: 12, color: 'var(--txt2)', filter: revealed ? 'none' : 'blur(4px)', userSelect: revealed ? 'text' : 'none', transition: 'filter 0.2s', letterSpacing: .5 }}>
        {password}
      </span>
      <button
        onClick={() => setRevealed(r => !r)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}
        title={revealed ? 'Hide password' : 'Reveal password'}
      >
        {revealed ? <IcoEyeOff /> : <IcoEye />}
      </button>
      {revealed && (
        <button
          onClick={() => { copy(password, () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success)' : 'var(--txt3)', display: 'flex', padding: 2 }}
          title="Copy password"
        >
          {copied ? <IcoCheck /> : <IcoCopy />}
        </button>
      )}
    </div>
  )
}

// ── Student linked name display ────────────────────────────────────────────────
function StudentLinks({ studentIds, studentMap }: { studentIds: string[]; studentMap: Map<string, string> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {studentIds.map(sid => (
        <span key={sid} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(14,165,233,.1)', color: 'var(--info)', fontWeight: 700 }}>
          {studentMap.get(sid) ?? sid.slice(0, 8) + '…'}
        </span>
      ))}
      {studentIds.length === 0 && <span style={{ fontSize: 11, color: 'var(--txt3)', fontStyle: 'italic' }}>No linked students</span>}
    </div>
  )
}

// ── CSV export helper ──────────────────────────────────────────────────────────
function exportStudentsCsv(rows: StudentRow[], classMap: Map<string, string>, schoolShortName: string) {
  const lines = ['Name,Admission Number,Class,Generated Email,Status']
  rows.forEach(r => {
    const name     = `${r.first_name} ${r.last_name}`
    const cls      = r.class_id ? (classMap.get(r.class_id) ?? '') : ''
    const admEmail = r.admission_number.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'student'
    const sn       = schoolShortName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const email    = `${admEmail}@${sn}.ug`
    const status  = r.auth_user_id ? 'Active' : 'Pending'
    lines.push(`"${name}","${r.admission_number}","${cls}","${email}","${status}"`)
  })
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `student-credentials-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function StaffPanel({
  schoolId,
  onPasswordResult,
}: {
  schoolId: string
  onPasswordResult: (r: PasswordResult) => void
}) {
  const { data: allStaff = [], isLoading } = useStaff({})
  const { success: ok, error: err } = useToast()
  const qc = useQueryClient()

  const activate = useActivateStaffLogin()
  const resetPw  = useResetStaffPassword()

  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<BulkSelection>(new Set())
  const [busyIds,    setBusyIds]    = useState<Set<string>>(new Set())
  const [confirm,    setConfirm]    = useState<{ title: string; body: string; onConfirm: () => void } | null>(null)
  const [copiedId,   setCopiedId]   = useState<string | null>(null)
  const [copiedPwId, setCopiedPwId] = useState<string | null>(null)

  // Detect duplicate emails
  const emailCounts = useMemo(() => {
    const map = new Map<string, number>()
    allStaff.forEach(s => { if (s.email) map.set(s.email, (map.get(s.email) ?? 0) + 1) })
    return map
  }, [allStaff])

  const filtered = useMemo(() => {
    if (!search.trim()) return allStaff
    const q = search.toLowerCase()
    return allStaff.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.staffNumber.toLowerCase().includes(q) ||
      (s.email ?? '').toLowerCase().includes(q)
    )
  }, [allStaff, search])

  function setBusy(id: string, busy: boolean) {
    setBusyIds(prev => { const n = new Set(prev); busy ? n.add(id) : n.delete(id); return n })
  }

  async function handleActivate(staffId: string) {
    setBusy(staffId, true)
    try {
      const r = await activate.mutateAsync({ staffId })
      const staff = allStaff.find(s => s.id === staffId)
      const name  = staff ? `${staff.firstName} ${staff.lastName}` : 'Staff'
      onPasswordResult({ id: staffId, name, email: r.email, password: r.tempPassword, type: 'staff', manual: r.manual })
      ok('Login activated')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Activation failed'
      if (msg.includes('already activated')) {
        err('This staff member already has a login — use "Reset PW" to issue new credentials, or "Unlink" first if the account is broken.')
        void qc.invalidateQueries({ queryKey: ['staff', schoolId] })
      } else {
        err(msg)
      }
    }
    finally { setBusy(staffId, false) }
  }

  async function handleReset(staff: typeof allStaff[0]) {
    if (!staff.authUserId) return
    setBusy(staff.id, true)
    try {
      const r = await resetPw.mutateAsync({ authUserId: staff.authUserId, staffId: staff.id, email: staff.email ?? '', name: `${staff.firstName} ${staff.lastName}` })
      const displayEmail = staff.email ?? '(email not set — check staff profile)'
      onPasswordResult({ id: staff.id, name: `${staff.firstName} ${staff.lastName}`, email: displayEmail, password: r.tempPassword, type: 'staff' })
      ok('Password reset')
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
    finally { setBusy(staff.id, false) }
  }

  async function handleDeactivate(staff: typeof allStaff[0]) {
    const { error } = await supabase.from('staff').update({ is_active: false }).eq('id', staff.id).eq('school_id', schoolId)
    if (error) { err(error.message); return }
    qc.invalidateQueries({ queryKey: ['staff', schoolId] })
    ok(`${staff.firstName} ${staff.lastName} deactivated`)
  }

  async function handleReactivate(staff: typeof allStaff[0]) {
    const { error } = await supabase.from('staff').update({ is_active: true }).eq('id', staff.id).eq('school_id', schoolId)
    if (error) { err(error.message); return }
    qc.invalidateQueries({ queryKey: ['staff', schoolId] })
    ok(`${staff.firstName} ${staff.lastName} reactivated`)
  }

  async function handleUnlink(staff: typeof allStaff[0]) {
    const { error } = await supabase.from('staff').update({ auth_user_id: null }).eq('id', staff.id).eq('school_id', schoolId)
    if (error) { err(error.message); return }
    qc.invalidateQueries({ queryKey: ['staff', schoolId] })
    ok('Auth user unlinked (orphan cleaned up)')
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function bulkReset() {
    const targets = filtered.filter(s => selected.has(s.id) && s.authUserId && s.email)
    if (!targets.length) { err('No selected staff with active logins'); return }
    for (const s of targets) { await handleReset(s) }
    setSelected(new Set())
    ok(`Reset ${targets.length} passwords`)
  }

  async function activateAll() {
    const targets = allStaff.filter(s => !s.authUserId && !!s.email)
    if (!targets.length) { ok('All staff already have logins'); return }
    let done = 0
    for (const s of targets) {
      try { await handleActivate(s.id); done++ } catch { /* individual errors shown by handleActivate */ }
    }
    ok(`Activated ${done} of ${targets.length} staff`)
  }

  const unactivatedStaffCount = allStaff.filter(s => !s.authUserId && !!s.email).length
  const isOrphan = (s: typeof allStaff[0]) => !!s.authUserId && !s.email

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', height: 36, flex: 1, minWidth: 200 }}>
          <IcoSearch />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, staff number or email…" style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 0 }}><IcoClose /></button>}
        </div>
        {unactivatedStaffCount > 0 && (
          <ActionBtn
            onClick={() => setConfirm({ title: `Activate all ${unactivatedStaffCount} staff?`, body: 'This will create login accounts for all staff members who don\'t have one yet.', onConfirm: () => { void activateAll(); setConfirm(null) } })}
            label={`Activate All (${unactivatedStaffCount})`}
            icon={<IcoKey />}
            variant="brand"
          />
        )}
        {selected.size > 0 && (
          <ActionBtn onClick={() => setConfirm({ title: `Reset ${selected.size} passwords?`, body: 'New temp passwords will be generated for all selected staff members with active logins.', onConfirm: () => { void bulkReset(); setConfirm(null) } })} label={`Reset ${selected.size}`} icon={<IcoRefresh />} variant="warning" />
        )}
      </div>

      {/* List */}
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        : filtered.length === 0
          ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--txt3)' }}>
              <IcoUsers />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>{search ? 'No staff match your search' : 'No staff records'}</div>
            </div>
          )
          : filtered.map(s => {
            const isBusy  = busyIds.has(s.id)
            const isDupe  = s.email ? (emailCounts.get(s.email) ?? 0) > 1 : false
            const orphan  = isOrphan(s)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border)', background: selected.has(s.id) ? 'rgba(13,148,136,.04)' : 'transparent', transition: 'background 0.15s' }}>
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--brand)', cursor: 'pointer' }}
                />
                {/* Avatar initials */}
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                    {s.firstName[0]?.toUpperCase()}{s.lastName[0]?.toUpperCase()}
                  </span>
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt)' }}>{s.firstName} {s.lastName}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--txt3)', border: '1px solid var(--border)' }}>{ROLE_LABELS[s.role] ?? s.role}</span>
                    {orphan  && <OrphanBadge />}
                    {isDupe  && <DupeBadge />}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.email ?? <em style={{ fontStyle: 'italic', fontFamily: 'var(--font)' }}>No email on file</em>}
                    {s.staffNumber && <span style={{ marginLeft: 8, opacity: .65 }}>{s.staffNumber}</span>}
                  </div>
                  {s.tempPassword && s.authUserId && (
                    <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Stored PW:</span>
                      <ParentPasswordReveal password={s.tempPassword} />
                    </div>
                  )}
                </div>
                {/* Status */}
                <StatusPill authUserId={s.authUserId} isActive={s.isActive} />
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                  {!s.authUserId ? (
                    <ActionBtn onClick={() => void handleActivate(s.id)} disabled={!s.email || isBusy} label={isBusy ? 'Activating…' : 'Activate'} icon={<IcoKey />} variant="brand" />
                  ) : (
                    <ActionBtn onClick={() => void handleReset(s)} disabled={isBusy} label={isBusy ? 'Resetting…' : 'Reset PW'} icon={<IcoRefresh />} variant="warning" />
                  )}
                  {s.email && (
                    <ActionBtn
                      onClick={() => { copy(s.email!, () => { setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000) }) }}
                      label={copiedId === s.id ? 'Copied' : 'Email'}
                      icon={copiedId === s.id ? <IcoCheck /> : <IcoMail />}
                      variant="ghost"
                    />
                  )}
                  {s.tempPassword && s.authUserId && (
                    <ActionBtn
                      onClick={() => { copy(s.tempPassword!, () => { setCopiedPwId(s.id); setTimeout(() => setCopiedPwId(null), 2000) }) }}
                      label={copiedPwId === s.id ? 'Copied!' : 'Copy PW'}
                      icon={copiedPwId === s.id ? <IcoCheck /> : <IcoKey />}
                      variant="ghost"
                    />
                  )}
                  {s.authUserId && s.isActive && (
                    <ActionBtn onClick={() => setConfirm({ title: `Deactivate ${s.firstName}?`, body: 'Their login will be disabled. They will not be able to sign in.', onConfirm: () => { void handleDeactivate(s); setConfirm(null) } })} label="Deactivate" icon={<IcoLock />} variant="danger" />
                  )}
                  {s.authUserId && !s.isActive && (
                    <ActionBtn onClick={() => void handleReactivate(s)} label="Reactivate" icon={<IcoUnlock />} variant="ghost" />
                  )}
                  {orphan && (
                    <ActionBtn onClick={() => setConfirm({ title: 'Unlink orphan account?', body: 'This will null out auth_user_id on the staff record. The Supabase auth user is NOT deleted.', onConfirm: () => { void handleUnlink(s); setConfirm(null) } })} label="Unlink" icon={<IcoUnlink />} variant="danger" />
                  )}
                </div>
              </div>
            )
          })
      }

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel="Confirm"
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function StudentsPanel({
  schoolId,
  schoolShortName,
  onPasswordResult,
}: {
  schoolId:        string
  schoolShortName: string
  onPasswordResult: (r: PasswordResult) => void
}) {
  const { success: ok, error: err } = useToast()
  const qc = useQueryClient()
  const { data: classes = [] } = useClasses()
  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  const createLogin = useCreateStudentLogin()
  const resetPw     = useResetStudentPassword()

  const [search,   setSearch]   = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selected, setSelected] = useState<BulkSelection>(new Set())
  const [busyIds,  setBusyIds]  = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedPwId, setCopiedPwId] = useState<string | null>(null)
  const [confirm,  setConfirm]  = useState<{ title: string; body: string; onConfirm: () => void } | null>(null)
  // Force re-render when localStorage changes (e.g. after creating a login)
  const [localPendingVersion, setLocalPendingVersion] = useState(0)

  const { data: allStudents = [], isLoading } = useQuery({
    queryKey: ['students-creds', schoolId],
    enabled:  !!schoolId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, auth_user_id, auth_email, temp_password, first_name, last_name, admission_number, class_id')
        .eq('school_id', schoolId)
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as StudentRow[]
    },
  })

  // Merge with localStorage pending activations so pending emails and passwords show
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localPending = useMemo(() => getPendingStudentActivations(), [allStudents, localPendingVersion])

  const filtered = useMemo(() => {
    let out = allStudents
    if (classFilter) out = out.filter(s => s.class_id === classFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(s => `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) || s.admission_number.toLowerCase().includes(q))
    }
    return out
  }, [allStudents, search, classFilter])

  function setBusy(id: string, busy: boolean) {
    setBusyIds(prev => { const n = new Set(prev); busy ? n.add(id) : n.delete(id); return n })
  }

  function derivedEmail(s: StudentRow) {
    // Use the stored auth_email when available — it's the exact email in Supabase auth
    if (s.auth_email) return s.auth_email
    // No auth account yet — derive from admission number for preview
    const admEmail = s.admission_number.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'student'
    const sn       = schoolShortName.toLowerCase().replace(/[^a-z0-9]/g, '')
    return `${admEmail}@${sn}.ug`
  }

  async function handleActivate(s: StudentRow) {
    setBusy(s.id, true)
    try {
      const r = await createLogin.mutateAsync(s.id)
      onPasswordResult({ id: s.id, name: `${s.first_name} ${s.last_name}`, email: r.email, password: r.tempPassword, type: 'students' })
      setLocalPendingVersion(v => v + 1)
      ok('Login created')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed'
      if (msg.includes('already activated')) {
        err('This student already has a login — use "Reset PW" to issue new credentials, or "Unlink" first if the account is broken.')
        // Refresh list so the correct status + Reset PW button appear
        void qc.invalidateQueries({ queryKey: ['students-creds', schoolId] })
      } else {
        err(msg)
      }
    }
    finally { setBusy(s.id, false) }
  }

  async function handleReset(s: StudentRow) {
    if (!s.auth_user_id) return
    setBusy(s.id, true)
    const email = derivedEmail(s)
    const name  = `${s.first_name} ${s.last_name}`
    try {
      const r = await resetPw.mutateAsync({ studentId: s.id, authUserId: s.auth_user_id, email, name, admissionNumber: s.admission_number })
      onPasswordResult({ id: s.id, name, email: r.email, password: r.tempPassword, type: 'students' })
      setLocalPendingVersion(v => v + 1)
      ok('Password reset')
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
    finally { setBusy(s.id, false) }
  }

  function handleClearPending(studentId: string) {
    clearPendingStudentActivation(studentId)
    setLocalPendingVersion(v => v + 1)
  }

  async function handleUnlinkStudent(s: StudentRow) {
    const { error } = await supabase.from('students').update({ auth_user_id: null }).eq('id', s.id).eq('school_id', schoolId)
    if (error) { err(error.message); return }
    ok('Auth user unlinked — student can be re-registered')
  }

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function bulkReset() {
    const targets = filtered.filter(s => selected.has(s.id) && s.auth_user_id)
    if (!targets.length) { err('No selected students with active logins'); return }
    for (const s of targets) { await handleReset(s) }
    setSelected(new Set())
    ok(`Reset ${targets.length} student passwords`)
  }

  async function activateAll() {
    const targets = allStudents.filter(s => !s.auth_user_id)
    if (!targets.length) { ok('All students already have logins'); return }
    let done = 0
    for (const s of targets) {
      try { await handleActivate(s); done++ } catch { /* individual errors shown by handleActivate */ }
    }
    ok(`Activated ${done} of ${targets.length} students`)
  }

  const unactivatedCount = allStudents.filter(s => !s.auth_user_id).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', height: 36, flex: 1, minWidth: 200 }}>
          <IcoSearch />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or admission number…" style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 0 }}><IcoClose /></button>}
        </div>
        {classes.length > 0 && (
          <select
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            style={{ height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontSize: 12.5, cursor: 'pointer', outline: 'none' }}
          >
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <ActionBtn
          onClick={() => exportStudentsCsv(filtered, classMap, schoolShortName)}
          label="Export CSV"
          icon={<IcoDownload />}
          variant="ghost"
        />
        {unactivatedCount > 0 && (
          <ActionBtn
            onClick={() => setConfirm({ title: `Activate all ${unactivatedCount} students?`, body: 'This will create login accounts for every student who doesn\'t have one yet. This may take a minute.', onConfirm: () => { void activateAll(); setConfirm(null) } })}
            label={`Activate All (${unactivatedCount})`}
            icon={<IcoKey />}
            variant="brand"
          />
        )}
        {selected.size > 0 && (
          <ActionBtn onClick={() => setConfirm({ title: `Reset ${selected.size} passwords?`, body: 'New temp passwords will be generated for all selected students with active logins.', onConfirm: () => { void bulkReset(); setConfirm(null) } })} label={`Reset ${selected.size}`} icon={<IcoRefresh />} variant="warning" />
        )}
      </div>

      {/* List */}
      {isLoading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
        : filtered.length === 0
          ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--txt3)' }}>
              <IcoStudent />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>{search || classFilter ? 'No students match your filters' : 'No students found'}</div>
            </div>
          )
          : filtered.map(s => {
            const isBusy  = busyIds.has(s.id)
            const email   = derivedEmail(s)
            const pending = localPending[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 18px', borderBottom: '1px solid var(--border)', background: selected.has(s.id) ? 'rgba(13,148,136,.04)' : 'transparent', transition: 'background 0.15s' }}>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggleSelect(s.id)}
                  style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--brand)', cursor: 'pointer', marginTop: 10 }}
                />
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--info),var(--brand))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                    {s.first_name[0]?.toUpperCase()}{s.last_name[0]?.toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt)' }}>{s.first_name} {s.last_name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font3)' }}>{s.admission_number}</span>
                    {s.class_id && classMap.get(s.class_id) && <span>{classMap.get(s.class_id)}</span>}
                  </div>
                  {/* Always show the derived email */}
                  <div style={{ fontSize: 11, color: 'var(--brand)', fontFamily: 'var(--font3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email}
                  </div>
                  {/* Password display — always show DB temp_password when available;
                      fall back to localStorage pending if that's all we have */}
                  {(s.temp_password || pending) && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5,
                        color: s.temp_password ? 'var(--brand)' : 'var(--txt3)',
                      }}>
                        {s.temp_password ? 'Stored PW:' : 'Temp PW:'}
                      </span>
                      <ParentPasswordReveal password={s.temp_password ?? pending?.tempPassword ?? ''} />
                      {pending && !s.temp_password && (
                        <button
                          onClick={() => handleClearPending(s.id)}
                          title="Mark as saved and clear from this device"
                          style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--txt3)', fontSize: 10, fontWeight: 700, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}
                        >
                          <IcoCheck /><span>Saved</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <StatusPill authUserId={s.auth_user_id} />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {!s.auth_user_id ? (
                      <ActionBtn onClick={() => void handleActivate(s)} disabled={isBusy} label={isBusy ? 'Creating…' : 'Create Login'} icon={<IcoKey />} variant="brand" />
                    ) : (
                      <>
                        <ActionBtn onClick={() => void handleReset(s)} disabled={isBusy} label={isBusy ? 'Resetting…' : 'Reset PW'} icon={<IcoRefresh />} variant="warning" />
                        <ActionBtn
                          onClick={() => setConfirm({ title: `Unlink auth for ${s.first_name}?`, body: 'This sets auth_user_id to null on the student record. Use this if the account shows Active but the student cannot log in (orphan). You can then re-create the login.', onConfirm: () => { void handleUnlinkStudent(s); setConfirm(null) } })}
                          label="Unlink"
                          icon={<IcoUnlink />}
                          variant="danger"
                        />
                      </>
                    )}
                    {(s.temp_password || pending) ? (
                      <ActionBtn
                        onClick={() => {
                          const pw = s.temp_password ?? pending?.tempPassword ?? ''
                          copy(pw, () => { setCopiedPwId(s.id); setTimeout(() => setCopiedPwId(null), 2000) })
                        }}
                        label={copiedPwId === s.id ? 'Copied!' : 'Copy PW'}
                        icon={copiedPwId === s.id ? <IcoCheck /> : <IcoKey />}
                        variant="ghost"
                      />
                    ) : null}
                    <ActionBtn
                      onClick={() => { copy(email, () => { setCopiedId(s.id); setTimeout(() => setCopiedId(null), 2000) }) }}
                      label={copiedId === s.id ? 'Copied' : 'Copy Email'}
                      icon={copiedId === s.id ? <IcoCheck /> : <IcoCopy />}
                      variant="ghost"
                    />
                  </div>
                </div>
              </div>
            )
          })
      }

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel="Confirm"
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function ParentsPanel({
  schoolId,
  onPasswordResult,
}: {
  schoolId: string
  onPasswordResult: (r: PasswordResult) => void
}) {
  const { success: ok, error: err } = useToast()
  const qc = useQueryClient()

  const [search,    setSearch]   = useState('')
  const [busyIds,   setBusyIds]  = useState<Set<string>>(new Set())
  const [copiedId,  setCopiedId] = useState<string | null>(null)
  const [confirm,   setConfirm]  = useState<{ title: string; body: string; onConfirm: () => void } | null>(null)

  const { data: parents = [], isLoading: parentsLoading } = useQuery({
    queryKey: ['parent-accounts-creds', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, school_id, auth_user_id, email, full_name, phone, student_ids, temp_password, created_at')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ParentRow[]
    },
  })

  // Build student name lookup from all students referenced by parents
  const allStudentIds = useMemo(() => {
    const ids = new Set<string>()
    parents.forEach(p => p.student_ids?.forEach(id => ids.add(id)))
    return Array.from(ids)
  }, [parents])

  const { data: studentNames = [] } = useQuery({
    queryKey: ['student-names-for-parents', schoolId, allStudentIds.join(',')],
    enabled:  !!schoolId && allStudentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, first_name, last_name')
        .in('id', allStudentIds)
        .eq('school_id', schoolId)
      if (error) throw error
      return (data ?? []) as { id: string; first_name: string; last_name: string }[]
    },
  })

  const studentMap = useMemo(() => new Map(studentNames.map(s => [s.id, `${s.first_name} ${s.last_name}`])), [studentNames])

  // Detect duplicate emails
  const emailCounts = useMemo(() => {
    const map = new Map<string, number>()
    parents.forEach(p => { if (p.email) map.set(p.email, (map.get(p.email) ?? 0) + 1) })
    return map
  }, [parents])

  const filtered = useMemo(() => {
    if (!search.trim()) return parents
    const q = search.toLowerCase()
    return parents.filter(p =>
      p.full_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.phone ?? '').includes(q)
    )
  }, [parents, search])

  function setBusy(id: string, busy: boolean) {
    setBusyIds(prev => { const n = new Set(prev); busy ? n.add(id) : n.delete(id); return n })
  }

  async function handleResetParentPassword(p: ParentRow) {
    setBusy(p.id, true)
    try {
      const newPw = generateTempPassword()
      if (!p.auth_user_id) throw new Error('Parent has no active login to reset')
      // Use reset-parent-password which sets app_metadata correctly for parent role
      const { error: fnError } = await supabase.functions.invoke('reset-parent-password', {
        body: { userId: p.auth_user_id, newPassword: newPw, schoolId },
      })
      if (fnError) throw new Error(fnError.message)

      // Persist the new temp_password in parent_accounts for display
      await supabase
        .from('parent_accounts')
        .update({ temp_password: newPw })
        .eq('id', p.id)
        .eq('school_id', schoolId)

      qc.invalidateQueries({ queryKey: ['parent-accounts-creds', schoolId] })
      onPasswordResult({ id: p.id, name: p.full_name, email: p.email, password: newPw, type: 'parents' })
      ok('Parent password reset')
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
    finally { setBusy(p.id, false) }
  }

  async function handleUnlinkOrphan(p: ParentRow) {
    const { error } = await supabase
      .from('parent_accounts')
      .update({ auth_user_id: null })
      .eq('id', p.id)
      .eq('school_id', schoolId)
    if (error) { err(error.message); return }
    qc.invalidateQueries({ queryKey: ['parent-accounts-creds', schoolId] })
    ok('Orphan auth user unlinked')
  }

  const isOrphan = (p: ParentRow) => !!p.auth_user_id && !p.email

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', height: 36, flex: 1, minWidth: 200 }}>
          <IcoSearch />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or phone…" style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 0 }}><IcoClose /></button>}
        </div>
      </div>

      {/* List */}
      {parentsLoading
        ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        : filtered.length === 0
          ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: 'var(--txt3)' }}>
              <IcoParent />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>{search ? 'No parents match your search' : 'No parent accounts yet'}</div>
            </div>
          )
          : filtered.map(p => {
            const isBusy = busyIds.has(p.id)
            const isDupe = (emailCounts.get(p.email) ?? 0) > 1
            const orphan = isOrphan(p)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--violet),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>
                    {p.full_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Name + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--txt)' }}>{p.full_name}</span>
                    {orphan && <OrphanBadge />}
                    {isDupe && <DupeBadge />}
                  </div>
                  {/* Email */}
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2, fontFamily: 'var(--font3)' }}>{p.email}</div>
                  {/* Phone */}
                  {p.phone && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>{p.phone}</div>}
                  {/* Student links */}
                  <div style={{ marginTop: 6 }}>
                    <StudentLinks studentIds={p.student_ids ?? []} studentMap={studentMap} />
                  </div>
                  {/* Temp password reveal */}
                  {p.temp_password && p.auth_user_id && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Temp PW:</span>
                      <ParentPasswordReveal password={p.temp_password} />
                    </div>
                  )}
                </div>
                {/* Status */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <StatusPill authUserId={p.auth_user_id} />
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {p.auth_user_id && (
                      <ActionBtn onClick={() => setConfirm({ title: `Reset password for ${p.full_name}?`, body: 'A new temporary password will be generated and saved to their account record.', onConfirm: () => { void handleResetParentPassword(p); setConfirm(null) } })} disabled={isBusy} label={isBusy ? 'Resetting…' : 'Reset PW'} icon={<IcoRefresh />} variant="warning" />
                    )}
                    <ActionBtn
                      onClick={() => { copy(p.email, () => { setCopiedId(p.id); setTimeout(() => setCopiedId(null), 2000) }) }}
                      label={copiedId === p.id ? 'Copied' : 'Email'}
                      icon={copiedId === p.id ? <IcoCheck /> : <IcoMail />}
                      variant="ghost"
                    />
                    {orphan && (
                      <ActionBtn onClick={() => setConfirm({ title: 'Unlink orphan auth user?', body: 'This removes the auth_user_id reference from the parent account record. The Supabase auth user itself is not deleted.', onConfirm: () => { void handleUnlinkOrphan(p); setConfirm(null) } })} label="Unlink" icon={<IcoUnlink />} variant="danger" />
                    )}
                  </div>
                </div>
              </div>
            )
          })
      }

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel="Confirm"
          onConfirm={confirm.onConfirm}
          onClose={() => setConfirm(null)}
          danger
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function CredentialsMgmtPage() {
  const { user }          = useAuth()
  const { data: school }  = useSchoolSettings()
  const schoolId          = user?.schoolId ?? ''
  const schoolShortName   = school?.shortName || school?.schoolName || 'school'

  const [activeTab, setActiveTab] = useState<TabId>('staff')
  const [pwResult,  setPwResult]  = useState<PasswordResult | null>(null)

  // KPI counts — light queries, small column sets
  const { data: staffCount }   = useQuery({
    queryKey: ['creds-kpi-staff', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
      return count ?? 0
    },
  })
  const { data: staffActive }  = useQuery({
    queryKey: ['creds-kpi-staff-active', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('staff').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).not('auth_user_id', 'is', null)
      return count ?? 0
    },
  })
  const { data: studCount }    = useQuery({
    queryKey: ['creds-kpi-students', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
      return count ?? 0
    },
  })
  const { data: studActive }   = useQuery({
    queryKey: ['creds-kpi-students-active', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).not('auth_user_id', 'is', null)
      return count ?? 0
    },
  })
  const { data: parentCount }  = useQuery({
    queryKey: ['creds-kpi-parents', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('parent_accounts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
      return count ?? 0
    },
  })
  const { data: parentActive } = useQuery({
    queryKey: ['creds-kpi-parents-active', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { count } = await supabase.from('parent_accounts').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).not('auth_user_id', 'is', null)
      return count ?? 0
    },
  })

  const kpis = [
    { label: 'Staff', total: staffCount ?? 0, active: staffActive ?? 0, icon: <IcoUsers />, accent: 'var(--violet)', tab: 'staff' as TabId },
    { label: 'Students', total: studCount ?? 0, active: studActive ?? 0, icon: <IcoStudent />, accent: 'var(--info)', tab: 'students' as TabId },
    { label: 'Parents', total: parentCount ?? 0, active: parentActive ?? 0, icon: <IcoParent />, accent: 'var(--success)', tab: 'parents' as TabId },
  ]

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'staff',    label: 'Staff Accounts',   icon: <IcoUsers /> },
    { id: 'students', label: 'Student Accounts', icon: <IcoStudent /> },
    { id: 'parents',  label: 'Parent Accounts',  icon: <IcoParent /> },
  ]

  const handlePasswordResult = useCallback((r: PasswordResult) => setPwResult(r), [])

  return (
    <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero band ─────────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0d4a47 100%)', padding: '28px 28px 24px', position: 'relative' }}>
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(13,148,136,.12)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: 40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(139,92,246,.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(13,148,136,.25)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
              <IcoShield />
            </div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 24, color: '#fff', margin: 0, letterSpacing: -.5 }}>
              Credentials Management
            </h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, margin: '0 0 22px', maxWidth: 520 }}>
            Activate, reset, and audit system access for all users — staff, students, and parents.
          </p>
          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {kpis.map(k => (
              <button
                key={k.tab}
                onClick={() => setActiveTab(k.tab)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: activeTab === k.tab ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.06)', backdropFilter: 'blur(10px)', borderRadius: 12, padding: '12px 18px', border: activeTab === k.tab ? `1px solid rgba(255,255,255,.2)` : '1px solid rgba(255,255,255,.08)', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left' }}
              >
                <div style={{ color: k.accent }}>{k.icon}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1 }}>
                    {k.active}<span style={{ fontSize: 13, fontWeight: 600, opacity: .55 }}>/{k.total}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 3, fontWeight: 600, letterSpacing: .3, textTransform: 'uppercase' }}>
                    {k.label} Active
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Password result card (dismissable) ────────────────────────────── */}
      {pwResult && <PasswordCard result={pwResult} onDismiss={() => setPwResult(null)} />}

      {/* ── Orphan / duplicate notice ─────────────────────────────────────── */}
      <div style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,.25)', background: 'rgba(245,158,11,.05)', padding: '10px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ color: 'var(--warning)', marginTop: 1, flexShrink: 0 }}><IcoWarn /></div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--warning)' }}>Orphan accounts</strong> — if a user shows as <em>Active</em> but cannot log in, the auth user may have been deleted. Use <strong>"Unlink"</strong> to reset the auth link, then re-create the login.{' '}
          Staff orphans are also detected when <em>auth_user_id is set but no email is on file</em>.{' '}
          <strong style={{ color: 'var(--warning)' }}>Duplicate email</strong> badges warn when the same address appears on multiple accounts — resolve before users encounter login conflicts.
        </div>
      </div>

      {/* ── Tab switcher + panel ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '13px 20px', border: 'none', background: activeTab === t.id ? 'var(--surface)' : 'transparent', color: activeTab === t.id ? 'var(--brand)' : 'var(--txt3)', fontWeight: activeTab === t.id ? 800 : 600, fontSize: 13, fontFamily: 'var(--font2)', cursor: 'pointer', borderBottom: activeTab === t.id ? '2px solid var(--brand)' : '2px solid transparent', transition: 'all 0.15s', marginBottom: -1 }}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Panel content */}
        {activeTab === 'staff' && (
          <StaffPanel schoolId={schoolId} onPasswordResult={handlePasswordResult} />
        )}
        {activeTab === 'students' && (
          <StudentsPanel schoolId={schoolId} schoolShortName={schoolShortName} onPasswordResult={handlePasswordResult} />
        )}
        {activeTab === 'parents' && (
          <ParentsPanel schoolId={schoolId} onPasswordResult={handlePasswordResult} />
        )}
      </div>

      {/* Footer note */}
      <div style={{ fontSize: 11.5, color: 'var(--txt3)', textAlign: 'center', paddingBottom: 8 }}>
        All credential actions are recorded in the audit log. Stored passwords are the last password issued — they become stale if a user self-resets.
      </div>
    </div>
  )
}
