import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStaff } from '../../hooks/useStaff'
import { useClasses } from '../../hooks/useClasses'
import { useDepartments } from '../../hooks/useClasses'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { useAuth } from '../../store/AuthContext'
import {
  useActivateStaffLogin,
  useResetStaffPassword,
  useLinkAuthUser,
  useSendCredentialsSms,
} from '../../hooks/useStaffAuth'
import {
  useCreateStudentLogin,
  useResetStudentPassword,
  getPendingStudentActivations,
  setPendingStudentActivation,
  clearPendingStudentActivation,
  type PendingStudentActivation,
} from '../../hooks/useStudents'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../components/ui/Toast'
import { getFriendlyErrorMessage } from '../../lib/errors'
import { Avatar } from '../../components/shared/Avatar'
import { generateTempPassword } from '../../lib/passwords'
import type { Staff } from '../../types/app'

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

const ROLE_GRAD: Record<string, [string, string]> = {
  principal:     ['#f59e0b', '#d97706'],
  deputy:        ['#0d9488', '#0f766e'],
  dos:           ['#8b5cf6', '#7c3aed'],
  secretary:     ['#0ea5e9', '#0284c7'],
  bursar:        ['#f43f5e', '#e11d48'],
  class_teacher: ['#10b981', '#059669'],
  teacher:       ['#6366f1', '#4f46e5'],
  it_admin:      ['#94a3b8', '#64748b'],
}

function roleGrad(role: string): [string, string] {
  return ROLE_GRAD[role] ?? ['#94a3b8', '#64748b']
}

const ROLE_TABS = [
  { value: '', label: 'All' },
  { value: 'teacher',       label: 'Teacher' },
  { value: 'class_teacher', label: 'Class Teacher' },
  { value: 'dos',           label: 'DoS' },
  { value: 'secretary',     label: 'Secretary' },
  { value: 'bursar',        label: 'Bursar' },
  { value: 'principal',     label: 'Principal' },
]

// ── Credential slip printer ──────────────────────────────────────────────────
function printCredentialSlip(p: {
  staffName: string; role: string; deptName: string | null
  email: string; password: string; schoolName: string
}) {
  const today    = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const loginUrl = window.location.origin
  const win = window.open('', '_blank', 'width=680,height=820,scrollbars=no')
  if (!win) { alert('Pop-up blocked — allow pop-ups for this site.'); return }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Login Credentials — ${p.staffName}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,sans-serif;background:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.slip{background:#fff;width:100%;max-width:480px;border-radius:16px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.14)}.hdr{background:linear-gradient(135deg,#8b5cf6,#6366f1);padding:24px 28px;color:#fff}.conf{display:inline-block;background:rgba(255,255,255,.2);padding:3px 12px;border-radius:99px;font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:10px}.sch{font-size:19px;font-weight:900;letter-spacing:-.3px}.sub{font-size:11px;opacity:.75;margin-top:3px}.body{padding:24px 28px}.lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94a3b8;margin-bottom:6px}.nm{font-size:18px;font-weight:800;color:#0f172a}.rl{font-size:11.5px;color:#64748b;margin-top:3px;text-transform:capitalize}.div{height:1px;background:#e2e8f0;margin:18px 0}.crd{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:10px}.clbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94a3b8;margin-bottom:5px}.cval{font-family:'Courier New',monospace;font-size:15px;font-weight:700;color:#0f172a;word-break:break-all}.url{background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:12px 16px;margin-bottom:16px}.ulbl{font-size:9px;font-weight:800;text-transform:uppercase;color:#0d9488;margin-bottom:4px}.uval{font-size:11.5px;color:#0d9488;font-weight:600;word-break:break-all}.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px}.wt{font-size:10px;font-weight:800;color:#92400e;margin-bottom:4px}.wb{font-size:10.5px;color:#78350f;line-height:1.55}.ftr{padding:16px 28px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end}.sl{width:130px;border-bottom:1px solid #cbd5e1;padding-bottom:2px}.sll{font-size:9px;color:#94a3b8;margin-top:4px}.dt{font-size:10px;color:#94a3b8}@media print{body{background:#fff;padding:0;display:block}.slip{max-width:100%;border-radius:0;box-shadow:none}@page{size:A5;margin:8mm}}</style>
</head><body><div class="slip"><div class="hdr"><div class="conf">Confidential</div><div class="sch">${p.schoolName}</div><div class="sub">Staff Login Credentials</div></div><div class="body"><div class="lbl">Issued To</div><div class="nm">${p.staffName}</div><div class="rl">${ROLE_LABELS[p.role] ?? p.role}${p.deptName ? ' · ' + p.deptName : ''}</div><div class="div"></div><div class="lbl">Login Credentials</div><div class="crd"><div class="clbl">Email Address</div><div class="cval">${p.email}</div></div><div class="crd"><div class="clbl">Temporary Password</div><div class="cval">${p.password}</div></div><div class="url"><div class="ulbl">Login URL</div><div class="uval">${loginUrl}</div></div><div class="warn"><div class="wt">⚠ Important Instructions</div><div class="wb">Log in and change your password immediately after first sign-in. Keep these credentials private — do not share with anyone. Your account activity is logged and monitored.</div></div></div><div class="ftr"><div><div class="sl"></div><div class="sll">IT Administrator Signature</div></div><div class="dt">Issued: ${today}</div></div></div><script>window.onload=function(){window.print()}</script></body></html>`)
  win.document.close()
}

// ── Credential delivery panel ────────────────────────────────────────────────
// Staff no longer have a plaintext password IT admin can see or hand off —
// activation/reset both send an email with a link for the staff member to set
// their own password. This panel confirms that email was sent and offers an
// optional SMS nudge (no password included).
interface CredInfo {
  staffId: string; staffName: string; role: string; deptName: string | null
  email: string; phone: string | null
  // Only set for a password RESET (direct-password-set, no email dependency).
  // Absent for first-time activation, which genuinely is email-based — see
  // the header/subtext branching in CredentialDeliveryPanel below.
  password?: string
}

function CredentialDeliveryPanel({ cred, onDismiss }: {
  cred: CredInfo; schoolName: string; onDismiss: () => void
}) {
  const sendSms = useSendCredentialsSms()
  const { success: ok, error: err } = useToast()
  const [copied, setCopied]   = useState<string | null>(null)
  const [smsSent, setSmsSent] = useState(false)
  const [smsBusy, setSmsBusy] = useState(false)

  function copy(key: string, value: string) {
    void navigator.clipboard.writeText(value)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  async function handleSms() {
    if (!cred.phone) return
    setSmsBusy(true)
    try {
      await sendSms.mutateAsync({ phone: cred.phone, name: cred.staffName, email: cred.email })
      setSmsSent(true); ok('Notification sent via SMS')
    } catch (e) { err(e instanceof Error ? e.message : 'SMS failed') }
    finally { setSmsBusy(false) }
  }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(16,185,129,.3)', background: 'linear-gradient(135deg,rgba(16,185,129,.06),rgba(13,148,136,.04))', marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(16,185,129,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>
              {cred.password ? 'Password Reset' : 'Login Activated'} — {cred.staffName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {cred.password
                ? 'Share these credentials securely.'
                : 'An email was sent to set their password. No password to share.'}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Email + password fields */}
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(16,185,129,.12)', borderRadius: 10, padding: '10px 14px' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>Email Address</div>
            <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{cred.email}</div>
          </div>
          <button onClick={() => copy('email', cred.email)} style={{ background: copied === 'email' ? 'rgba(16,185,129,.12)' : 'var(--surface)', border: `1px solid ${copied === 'email' ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied === 'email' ? 'var(--success)' : 'var(--txt2)', transition: 'all 0.15s' }}>
            {copied === 'email' ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        {cred.password && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(16,185,129,.12)', borderRadius: 10, padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>Password</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{cred.password}</div>
            </div>
            <button onClick={() => copy('pass', cred.password!)} style={{ background: copied === 'pass' ? 'rgba(16,185,129,.12)' : 'var(--surface)', border: `1px solid ${copied === 'pass' ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied === 'pass' ? 'var(--success)' : 'var(--txt2)', transition: 'all 0.15s' }}>
              {copied === 'pass' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Delivery actions */}
      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid rgba(16,185,129,.1)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Notify</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* SMS */}
          {cred.phone ? (
            <button
              onClick={() => void handleSms()}
              disabled={smsBusy || smsSent}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', background: smsSent ? 'rgba(16,185,129,.15)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)', fontSize: 12.5, fontWeight: 700, color: smsSent ? 'var(--success)' : '#fff', cursor: smsBusy || smsSent ? 'default' : 'pointer', opacity: smsBusy ? 0.7 : 1, transition: 'all 0.15s' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07"/><polyline points="22 2 11 13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {smsBusy ? 'Sending…' : smsSent ? '✓ SMS Sent' : `Send SMS · ${cred.phone}`}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, border: '1px dashed var(--border)', fontSize: 12, color: 'var(--txt3)', fontStyle: 'italic' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              No phone on file — SMS unavailable
            </div>
          )}

          {/* Copy email */}
          <button
            onClick={() => { const t = `${cred.staffName} Login\nEmail: ${cred.email}\nURL: ${window.location.origin}`; void navigator.clipboard.writeText(t); copy('all', t) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            {copied === 'all' ? '✓ Copied All' : 'Copy All'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── setUserDisabled helper ────────────────────────────────────────────────────
async function callSetUserDisabled(authUserId: string, disabled: boolean): Promise<void> {
  const { error } = await supabase.functions.invoke('set-user-disabled', {
    body: { authUserId, disabled },
  })
  if (error) throw new Error(error.message)
}

// ── Deactivate Confirm Modal ──────────────────────────────────────────────────
function DeactivateConfirmModal({
  name,
  role,
  onConfirm,
  onCancel,
  busy,
}: {
  name: string
  role: string
  onConfirm: () => void
  onCancel: () => void
  busy: boolean
}) {
  const [typed, setTyped] = useState('')
  const isPrincipal = role === 'principal'
  const confirmWord = isPrincipal ? name : 'DEACTIVATE'
  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(244,63,94,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', marginBottom: 8, textAlign: 'center' }}>
          Revoke System Access
        </div>
        <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 6, lineHeight: 1.6, textAlign: 'center' }}>
          <strong>{name}</strong> will be immediately locked out.
        </p>
        <p style={{ fontSize: 13, color: 'var(--txt3)', marginBottom: 16, lineHeight: 1.6, textAlign: 'center' }}>
          {isPrincipal
            ? <>Type their full name — <strong style={{ color: 'var(--txt)' }}>{confirmWord}</strong> — to confirm.</>
            : <>Type <strong style={{ color: 'var(--txt)', fontFamily: 'var(--font3)' }}>{confirmWord}</strong> to confirm.</>
          }
        </p>
        <input
          value={typed}
          onChange={e => setTyped(e.target.value)}
          className="sui-input"
          style={{ width: '100%', marginBottom: 16 }}
          placeholder={isPrincipal ? 'Type full name…' : 'Type DEACTIVATE…'}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button onClick={onCancel} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            disabled={typed.trim() !== confirmWord || busy}
            onClick={onConfirm}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'var(--danger)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: typed.trim() === confirmWord && !busy ? 'pointer' : 'not-allowed', opacity: typed.trim() !== confirmWord || busy ? 0.45 : 1 }}
          >
            {busy ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Link Auth Modal ───────────────────────────────────────────────────────────
function LinkAuthModal({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const [uuid, setUuid] = useState('')
  const link = useLinkAuthUser()
  const { success: ok, error: err } = useToast()
  async function handleLink() {
    try { await link.mutateAsync({ staffId, authUserId: uuid }); ok(`${staffName} linked`); onClose() }
    catch (e) { err(e instanceof Error ? e.message : 'Link failed') }
  }
  const modal = (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 80px rgba(0,0,0,.28)' }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)' }}>Link Existing Auth User</div>
          <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>{staffName} — paste UUID from Supabase Dashboard</div>
        </div>
        <div style={{ background: 'rgba(14,165,233,.07)', border: '1px solid rgba(14,165,233,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: 'var(--info)', lineHeight: 1.55 }}>
          Go to <strong>Supabase Dashboard → Authentication → Users</strong>, find/create the user, copy their UUID.
        </div>
        <input value={uuid} onChange={e => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)', background: 'var(--surface2)', outline: 'none', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => void handleLink()} disabled={link.isPending || !uuid.trim()}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: link.isPending || !uuid.trim() ? 'not-allowed' : 'pointer', opacity: link.isPending || !uuid.trim() ? 0.65 : 1 }}>
            {link.isPending ? 'Linking…' : 'Link Account'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Pending staff card ────────────────────────────────────────────────────────
function PendingCard({ staff, deptName, onActivated }: { staff: Staff; deptName: string | null; onActivated: (c: CredInfo) => void }) {
  const [c1, c2] = roleGrad(staff.role)
  const activate = useActivateStaffLogin()
  const { error: err }  = useToast()
  const hasEmail = !!staff.email

  async function handleActivate() {
    try {
      const r = await activate.mutateAsync({ staffId: staff.id })
      onActivated({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, role: staff.role, deptName, email: r.email, phone: staff.phone })
      if (!r.emailSent) err(`Login linked, but the email to ${r.email} failed to send — ask them to use "Forgot password" at login instead.`)
    } catch (e) { err(e instanceof Error ? e.message : 'Activation failed') }
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${c1},${c2})` }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg,${c1},${c2})`, padding: 2 }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
              <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={`${staff.firstName} ${staff.lastName}`} size="md" />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.firstName} {staff.lastName}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: c1, background: `${c1}18`, padding: '2px 8px', borderRadius: 99 }}>{ROLE_LABELS[staff.role] ?? staff.role}</span>
              {deptName && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{deptName}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: hasEmail ? 'var(--success)' : 'var(--danger)' }} />
            <span style={{ fontSize: 11.5, color: hasEmail ? 'var(--txt2)' : 'var(--danger)', fontFamily: hasEmail ? 'var(--font3)' : 'var(--font)', fontWeight: hasEmail ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hasEmail ? staff.email : 'No email — activation blocked'}
            </span>
          </div>
          {staff.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07"/></svg>
              <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{staff.phone}</span>
            </div>
          )}
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{staff.staffNumber}</span>
        </div>
        <button onClick={() => void handleActivate()} disabled={!hasEmail || activate.isPending}
          title={!hasEmail ? 'Add an email to this staff profile first' : ''}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: hasEmail ? 'linear-gradient(135deg,#0d9488,#0ea5e9)' : 'var(--surface2)', color: hasEmail ? '#fff' : 'var(--txt3)', fontWeight: 700, fontSize: 12.5, cursor: hasEmail && !activate.isPending ? 'pointer' : 'not-allowed', opacity: activate.isPending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s' }}>
          {activate.isPending ? 'Activating…' : !hasEmail ? 'Email Required' : (
            <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Activate Login</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Active staff card ─────────────────────────────────────────────────────────
function ActiveCard({ staff, deptName, onReset, onLink, onDeactivated }: { staff: Staff; deptName: string | null; onReset: (c: CredInfo) => void; onLink: (staffId: string, name: string) => void; onDeactivated: () => void }) {
  const [c1, c2] = roleGrad(staff.role)
  const reset    = useResetStaffPassword()
  const qc       = useQueryClient()
  const { user } = useAuth()
  const { error: err, success: ok } = useToast()
  const [deactivateBusy,   setDeactivateBusy]   = useState(false)
  const [showPrincipalConfirm, setShowPrincipalConfirm] = useState(false)
  const staffName = `${staff.firstName} ${staff.lastName}`

  async function handleReset() {
    if (!staff.authUserId || !staff.email) return
    try {
      const r = await reset.mutateAsync({ authUserId: staff.authUserId, staffId: staff.id, email: staff.email, name: staffName })
      onReset({ staffId: staff.id, staffName, role: staff.role, deptName, email: staff.email, phone: staff.phone, password: r.tempPassword })
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
  }

  async function doDeactivate() {
    if (!staff.authUserId) return
    if (user?.role !== 'it_admin') return
    setDeactivateBusy(true)
    try {
      await Promise.all([
        supabase.from('staff').update({ is_active: false }).eq('id', staff.id).eq('school_id', staff.schoolId),
        callSetUserDisabled(staff.authUserId, true),
      ])
      ok(`${staffName}'s access revoked`)
      void qc.invalidateQueries({ queryKey: ['staff', staff.schoolId] })
      onDeactivated()
    } catch (e) { err(e instanceof Error ? e.message : 'Deactivation failed') }
    finally { setDeactivateBusy(false); setShowPrincipalConfirm(false) }
  }

  async function doReactivate() {
    if (!staff.authUserId) return
    if (user?.role !== 'it_admin') return
    setDeactivateBusy(true)
    try {
      await Promise.all([
        supabase.from('staff').update({ is_active: true }).eq('id', staff.id).eq('school_id', staff.schoolId),
        callSetUserDisabled(staff.authUserId, false),
      ])
      ok(`${staffName}'s access restored`)
      void qc.invalidateQueries({ queryKey: ['staff', staff.schoolId] })
      onDeactivated()
    } catch (e) { err(e instanceof Error ? e.message : 'Reactivation failed') }
    finally { setDeactivateBusy(false) }
  }

  function handleDeactivateClick() {
    setShowPrincipalConfirm(true)
  }

  const isActive = staff.isActive !== false

  return (
    <>
      <div style={{ borderRadius: 14, border: `1px solid ${isActive ? 'var(--border)' : 'rgba(244,63,94,.25)'}`, background: isActive ? 'var(--surface)' : 'rgba(244,63,94,.03)', overflow: 'hidden' }}>
        <div style={{ height: 3, background: `linear-gradient(90deg,${c1},${c2})` }} />
        <div style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, padding: 2, opacity: isActive ? 1 : 0.5 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
                  <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={staffName} size="md" />
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--danger)', border: '2px solid var(--surface)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staffName}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: c1, background: `${c1}18`, padding: '2px 8px', borderRadius: 99 }}>{ROLE_LABELS[staff.role] ?? staff.role}</span>
                {isActive
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,.1)', padding: '2px 7px', borderRadius: 99 }}>● Active</span>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)',  background: 'rgba(244,63,94,.1)',  padding: '2px 7px', borderRadius: 99 }}>● Deactivated</span>
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {staff.email && <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.email}</span>}
            {deptName && <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{deptName}</span>}
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{staff.staffNumber}</span>
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {isActive ? (
              <>
                <button onClick={() => void handleReset()} disabled={!staff.authUserId || !staff.email || reset.isPending}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: 'var(--warning)', fontWeight: 700, fontSize: 12, cursor: reset.isPending ? 'wait' : 'pointer', opacity: reset.isPending ? 0.7 : 1, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!reset.isPending) e.currentTarget.style.background = 'rgba(245,158,11,.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,.08)' }}>
                  {reset.isPending ? 'Resetting…' : '↺ Reset Password'}
                </button>
                <button onClick={() => onLink(staff.id, staffName)}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--txt2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--txt3)' }}
                  title="Manually link a Supabase auth UUID">
                  Link
                </button>
                <button onClick={() => handleDeactivateClick()} disabled={deactivateBusy || !staff.authUserId}
                  style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontWeight: 700, fontSize: 11, cursor: deactivateBusy ? 'wait' : 'pointer', opacity: deactivateBusy ? 0.6 : 1, transition: 'all 0.15s' }}
                  onMouseEnter={e => { if (!deactivateBusy) e.currentTarget.style.background = 'rgba(244,63,94,.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,.08)' }}
                  title="Revoke system access">
                  {deactivateBusy ? '…' : 'Deactivate'}
                </button>
              </>
            ) : (
              <button onClick={() => void doReactivate()} disabled={deactivateBusy || !staff.authUserId}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: deactivateBusy ? 'wait' : 'pointer', opacity: deactivateBusy ? 0.7 : 1, transition: 'all 0.15s' }}>
                {deactivateBusy ? 'Reactivating…' : '↑ Restore Access'}
              </button>
            )}
          </div>
        </div>
      </div>
      {showPrincipalConfirm && (
        <DeactivateConfirmModal
          name={staffName}
          role={staff.role}
          busy={deactivateBusy}
          onConfirm={() => void doDeactivate()}
          onCancel={() => setShowPrincipalConfirm(false)}
        />
      )}
    </>
  )
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <span className="shule-skeleton" style={{ display: 'block', height: 3 }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span className="shule-skeleton" style={{ display: 'block', width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span className="shule-skeleton" style={{ display: 'block', height: 13, width: '70%', borderRadius: 6, marginBottom: 8 }} />
            <span className="shule-skeleton" style={{ display: 'block', height: 18, width: '45%', borderRadius: 99 }} />
          </div>
        </div>
        <span className="shule-skeleton" style={{ display: 'block', height: 11, width: '80%', borderRadius: 4, marginBottom: 6 }} />
        <span className="shule-skeleton" style={{ display: 'block', height: 36, width: '100%', borderRadius: 10, marginTop: 8 }} />
      </div>
    </div>
  )
}

// ── Pending Activations Banner ────────────────────────────────────────────────
type BulkActivationProgress =
  | { phase: 'idle' }
  | { phase: 'running'; current: number; total: number }
  | { phase: 'done'; activated: number; failed: number }

function PendingActivationsBanner({
  schoolId,
  pendingStudentCount,
  pendingStaffCount,
  onScrollToPending,
}: {
  schoolId: string
  pendingStudentCount: number
  pendingStaffCount: number
  onScrollToPending: () => void
}) {
  const [dismissed,  setDismissed]  = useState(false)
  const [progress,   setProgress]   = useState<BulkActivationProgress>({ phase: 'idle' })
  const abortRef = useRef(false)
  const { success: ok, error: err } = useToast()
  const qc = useQueryClient()

  const total = pendingStudentCount + pendingStaffCount
  if (dismissed || total === 0) return null

  async function bulkActivateStudents() {
    // Fetch school short_name once so we can derive emails per student
    const { data: schoolData } = await supabase
      .from('school_profile')
      .select('short_name, school_name')
      .eq('id', schoolId)
      .maybeSingle()
    const rawDomain = (schoolData?.short_name as string | null)
      || (schoolData?.school_name as string | null)
      || 'school'
    const shortName = rawDomain.toLowerCase().replace(/[^a-z0-9]/g, '')

    const { data, error } = await supabase
      .from('students')
      .select('id, first_name, last_name, admission_number, auth_email')
      .eq('school_id', schoolId)
      .is('auth_user_id', null)
      .eq('status', 'active')
    if (error) { err(error.message); return }
    const students = data ?? []

    setProgress({ phase: 'running', current: 0, total: students.length })
    abortRef.current = false
    let activated = 0; let failed = 0

    // Process in batches of 10
    for (let i = 0; i < students.length; i += 10) {
      if (abortRef.current) break
      const batch = students.slice(i, i + 10)
      await Promise.all(batch.map(async (s: { id: string; admission_number: string; auth_email: string | null }) => {
        try {
          const admSlug = (s.admission_number ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'student'
          const email    = s.auth_email || `${admSlug}@${shortName}.ug`
          const password = generateTempPassword()
          const { error: fnError } = await supabase.functions.invoke('create-student-auth-user', {
            body: { studentId: s.id, email, schoolId, password },
          })
          if (fnError) throw fnError
          activated++
        } catch { failed++ }
        setProgress(p => p.phase === 'running' ? { ...p, current: p.current + 1 } : p)
      }))
    }
    setProgress({ phase: 'done', activated, failed })
    void qc.invalidateQueries({ queryKey: ['students-pending-login', schoolId] })
    void qc.invalidateQueries({ queryKey: ['students-active-login', schoolId] })
    ok(`${activated} student accounts activated`)
  }

  async function bulkActivateStaff() {
    const { data, error } = await supabase
      .from('staff')
      .select('id, first_name, last_name, email')
      .eq('school_id', schoolId)
      .is('auth_user_id', null)
      .eq('is_active', true)
      .not('email', 'is', null)
    if (error) { err(error.message); return }
    const staff = data ?? []

    setProgress({ phase: 'running', current: 0, total: staff.length })
    abortRef.current = false
    let activated = 0; let failed = 0

    for (let i = 0; i < staff.length; i += 10) {
      if (abortRef.current) break
      const batch = staff.slice(i, i + 10)
      await Promise.all(batch.map(async (s: { id: string; email: string | null }) => {
        try {
          const { error: fnError } = await supabase.functions.invoke('create-staff-auth-user', {
            body: { staffId: s.id, email: s.email, schoolId, redirectTo: `${window.location.origin}/reset-password` },
          })
          if (fnError) throw fnError
          activated++
        } catch { failed++ }
        setProgress(p => p.phase === 'running' ? { ...p, current: p.current + 1 } : p)
      }))
    }
    setProgress({ phase: 'done', activated, failed })
    void qc.invalidateQueries({ queryKey: ['staff', schoolId] })
    ok(`${activated} staff accounts activated`)
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(245,158,11,.35)', background: 'rgba(245,158,11,.06)', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(245,158,11,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--warning)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: '#92400e' }}>
              Pending Activations
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 1 }}>
              {pendingStudentCount > 0 && `${pendingStudentCount} student${pendingStudentCount !== 1 ? 's' : ''}`}
              {pendingStudentCount > 0 && pendingStaffCount > 0 && ' and '}
              {pendingStaffCount > 0 && `${pendingStaffCount} staff member${pendingStaffCount !== 1 ? 's' : ''}`}
              {' '}have no login accounts yet.
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, display: 'flex', flexShrink: 0, marginTop: 2 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Progress bar */}
      {progress.phase === 'running' && (
        <div style={{ marginTop: 2 }}>
          <div style={{ fontSize: 12, color: 'var(--txt2)', marginBottom: 6, fontWeight: 600 }}>
            Activating {progress.current}/{progress.total}…
          </div>
          <div style={{ height: 5, background: 'rgba(245,158,11,.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(progress.current / progress.total) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#0d9488)', borderRadius: 99, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {progress.phase === 'done' && (
        <div style={{ fontSize: 12, color: '#065f46', fontWeight: 700, background: 'rgba(16,185,129,.08)', border: '.5px solid rgba(16,185,129,.25)', borderRadius: 8, padding: '7px 12px' }}>
          {progress.activated} accounts activated{progress.failed > 0 ? ` · ${progress.failed} failed` : ''}.
        </div>
      )}

      {/* Action buttons */}
      {progress.phase === 'idle' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pendingStudentCount > 0 && (
            <button
              onClick={() => void bulkActivateStudents()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 3px 12px rgba(245,158,11,.4)', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Activate All {pendingStudentCount} Students
            </button>
          )}
          {pendingStaffCount > 0 && (
            <button
              onClick={() => void bulkActivateStaff()}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', boxShadow: '0 3px 12px rgba(139,92,246,.4)', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Activate All {pendingStaffCount} Staff
            </button>
          )}
          <button
            onClick={onScrollToPending}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(245,158,11,.35)', background: 'transparent', color: '#92400e', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            View Pending
          </button>
        </div>
      )}

      {progress.phase === 'running' && (
        <button
          onClick={() => { abortRef.current = true }}
          style={{ padding: '6px 14px', borderRadius: 9, border: '1px solid rgba(244,63,94,.35)', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontWeight: 700, fontSize: 12, cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

// ── Post-import Redirect Banner ────────────────────────────────────────────────
const IMPORT_KEY = 'shule_pending_activations'

function PostImportBanner({ onScrollToPending }: { onScrollToPending: () => void }) {
  const [data, setData] = useState<{ count: number; at: string } | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { count?: number; at?: string }
      if (!parsed.count || !parsed.at) return
      const age = Date.now() - new Date(parsed.at).getTime()
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(IMPORT_KEY)
        return
      }
      setData({ count: parsed.count, at: parsed.at })
    } catch { /* ignore */ }
  }, [])

  if (!data) return null

  function dismiss() {
    localStorage.removeItem(IMPORT_KEY)
    setData(null)
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(14,165,233,.35)', background: 'linear-gradient(135deg,rgba(14,165,233,.07),rgba(13,148,136,.04))', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(14,165,233,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--info)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: '#0369a1' }}>
          Recent Import
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 1 }}>
          {data.count} student{data.count !== 1 ? 's' : ''} were just imported and need login accounts.
        </div>
      </div>
      <button
        onClick={() => { dismiss(); onScrollToPending() }}
        style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
      >
        View Pending
      </button>
      <button
        onClick={dismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, display: 'flex', flexShrink: 0 }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

// ── Student row type (from DB query) ──────────────────────────────────────────
type StudentLoginRow = {
  id:               string
  school_id:        string
  first_name:       string
  last_name:        string
  admission_number: string
  class_id:         string | null
  auth_user_id:     string | null
  auth_email:       string | null
  status:           'active' | 'suspended' | 'expelled'
}

// ── StudentCredInfo ──────────────────────────────────────────────────────────
interface StudentCredInfo {
  studentId:       string
  studentName:     string
  admissionNumber: string
  email:           string
  password:        string
  manual:          boolean
}

// ── StudentCredentialDeliveryPanel ───────────────────────────────────────────
function StudentCredentialDeliveryPanel({ cred, onDismiss }: {
  cred: StudentCredInfo; schoolName: string; onDismiss: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(key: string, value: string) {
    void navigator.clipboard.writeText(value)
    setCopied(key); setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(16,185,129,.3)', background: 'linear-gradient(135deg,rgba(16,185,129,.06),rgba(13,148,136,.04))', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(16,185,129,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>Login Activated — {cred.studentName}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {cred.manual ? 'Manual mode — use credentials below to create auth user in Supabase Dashboard' : 'Auth account created. Share credentials below.'}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {([{ key: 'email', label: 'Email Address', value: cred.email }, { key: 'pass', label: 'Password', value: cred.password }] as const).map(f => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(16,185,129,.12)', borderRadius: 10, padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{f.value}</div>
            </div>
            <button onClick={() => copy(f.key, f.value)} style={{ background: copied === f.key ? 'rgba(16,185,129,.12)' : 'var(--surface)', border: `1px solid ${copied === f.key ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied === f.key ? 'var(--success)' : 'var(--txt2)', transition: 'all 0.15s' }}>
              {copied === f.key ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid rgba(16,185,129,.1)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => { const t = `${cred.studentName} Login\nAdmission: ${cred.admissionNumber}\nEmail: ${cred.email}\nPassword: ${cred.password}\nURL: ${window.location.origin}`; void navigator.clipboard.writeText(t); copy('all', t) }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, color: 'var(--txt2)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            {copied === 'all' ? '✓ Copied All' : 'Copy All'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── StudentPendingCard ────────────────────────────────────────────────────────
function StudentPendingCard({ student, className, pending, schoolId, onActivated }: {
  student:     StudentLoginRow
  className:   string | null
  pending:     PendingStudentActivation | null
  schoolId:    string
  onActivated: (c: StudentCredInfo) => void
}) {
  const createLogin = useCreateStudentLogin()
  const { success: ok, error: err } = useToast()
  const [busy, setBusy] = useState(false)
  const name = `${student.first_name} ${student.last_name}`

  async function handleActivate() {
    if (busy) return
    setBusy(true)
    try {
      if (pending) {
        // Credentials exist — invoke the Edge Function directly
        const { error: fnError } = await supabase.functions.invoke('create-student-auth-user', {
          body: { studentId: student.id, email: pending.email, schoolId, password: pending.tempPassword },
        })
        if (!fnError) {
          clearPendingStudentActivation(student.id)
          ok(`${name} login activated`)
          onActivated({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: pending.email, password: pending.tempPassword, manual: false })
          return
        }
        // Edge Function failed — show existing credentials still
        onActivated({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: pending.email, password: pending.tempPassword, manual: true })
      } else {
        // No credentials yet — generate them
        const r = await createLogin.mutateAsync(student.id)
        onActivated({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: r.email, password: r.tempPassword, manual: r.manual })
      }
    } catch (e) { err(e instanceof Error ? e.message : 'Activation failed') }
    finally { setBusy(false) }
  }

  function handleRegenerate() {
    if (!pending) return
    // For a pending (not-yet-activated) student: generate fresh credentials locally.
    // No Edge Function call — student has no auth_user_id yet.
    const newPassword = generateTempPassword()
    const updated: PendingStudentActivation = { ...pending, tempPassword: newPassword, storedAt: new Date().toISOString() }
    setPendingStudentActivation(updated)
    ok('New credentials generated')
    onActivated({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: pending.email, password: newPassword, manual: true })
  }

  const isPending = busy || createLogin.isPending

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#0ea5e9,#0d9488)' }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#0ea5e9,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: '#0ea5e9', background: 'rgba(14,165,233,.12)', padding: '2px 8px', borderRadius: 99 }}>Student</span>
              {className && <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{className}</span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: pending ? 'var(--warning)' : 'var(--txt3)' }} />
            <span style={{ fontSize: 11.5, color: pending ? 'var(--txt2)' : 'var(--txt3)', fontFamily: pending ? 'var(--font3)' : 'var(--font)', fontStyle: pending ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pending ? pending.email : 'No credentials yet'}
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{student.admission_number}</span>
          {pending && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span style={{ fontSize: 10, color: 'var(--warning)' }}>
                Generated {new Date(pending.storedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 7 }}>
          <button
            onClick={() => void handleActivate()}
            disabled={isPending}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: isPending ? 'not-allowed' : 'pointer', opacity: isPending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'opacity 0.15s' }}
          >
            {isPending
              ? 'Activating…'
              : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>{pending ? 'Activate' : 'Generate & Activate'}</>
            }
          </button>
          {pending && (
            <button
              onClick={() => handleRegenerate()}
              disabled={false}
              style={{ padding: '9px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--txt2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--txt3)' }}
              title="Generate new credentials"
            >
              ↺ Regen
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── StudentActiveCard ─────────────────────────────────────────────────────────
function StudentActiveCard({ student, className, schoolShortName, onReset, onToggled }: {
  student:         StudentLoginRow
  className:       string | null
  schoolShortName: string
  onReset:         (c: StudentCredInfo) => void
  onToggled:       () => void
}) {
  const reset  = useResetStudentPassword()
  const qc     = useQueryClient()
  const { user } = useAuth()
  const { error: err, success: ok } = useToast()
  const name   = `${student.first_name} ${student.last_name}`
  const [busy,        setBusy]        = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleReset() {
    if (!student.auth_user_id) return
    try {
      const admSlug = student.admission_number.toLowerCase().replace(/[^a-z0-9]/g, '') || 'student'
      const r = await reset.mutateAsync({
        studentId:       student.id,
        authUserId:      student.auth_user_id,
        email:           student.auth_email ?? `${admSlug}@${schoolShortName || 'school'}.ug`,
        name,
        admissionNumber: student.admission_number,
      })
      onReset({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: r.email, password: r.tempPassword, manual: r.manual })
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
  }

  async function doDeactivate() {
    if (!student.auth_user_id) return
    if (user?.role !== 'it_admin') return
    setBusy(true)
    try {
      await Promise.all([
        supabase.from('students').update({ status: 'suspended' }).eq('id', student.id).eq('school_id', student.school_id),
        callSetUserDisabled(student.auth_user_id, true),
      ])
      ok(`${name}'s access revoked`)
      void qc.invalidateQueries({ queryKey: ['students-active-login', student.school_id] })
      void qc.invalidateQueries({ queryKey: ['my-student-record'] })
      onToggled()
    } catch (e) { err(e instanceof Error ? e.message : 'Deactivation failed') }
    finally { setBusy(false) }
  }

  async function doReactivate() {
    if (!student.auth_user_id) return
    if (user?.role !== 'it_admin') return
    setBusy(true)
    try {
      await Promise.all([
        supabase.from('students').update({ status: 'active' }).eq('id', student.id).eq('school_id', student.school_id),
        callSetUserDisabled(student.auth_user_id, false),
      ])
      ok(`${name}'s access restored`)
      void qc.invalidateQueries({ queryKey: ['students-active-login', student.school_id] })
      void qc.invalidateQueries({ queryKey: ['my-student-record'] })
      onToggled()
    } catch (e) { err(e instanceof Error ? e.message : 'Reactivation failed') }
    finally { setBusy(false) }
  }

  const isActive = student.status === 'active'

  return (
    <>
    <div style={{ borderRadius: 14, border: `1px solid ${isActive ? 'var(--border)' : 'rgba(244,63,94,.25)'}`, background: isActive ? 'var(--surface)' : 'rgba(244,63,94,.03)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#0ea5e9,#0d9488)' }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.5 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: isActive ? 'var(--success)' : 'var(--danger)', border: '2px solid var(--surface)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: '#0ea5e9', background: 'rgba(14,165,233,.12)', padding: '2px 8px', borderRadius: 99 }}>Student</span>
              {isActive
                ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,.1)', padding: '2px 7px', borderRadius: 99 }}>● Active</span>
                : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)',  background: 'rgba(244,63,94,.1)',  padding: '2px 7px', borderRadius: 99 }}>● {student.status}</span>
              }
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          {className && <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{className}</span>}
          <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{student.admission_number}</span>
        </div>
        {isActive ? (
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={() => void handleReset()} disabled={!student.auth_user_id || reset.isPending}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: 'var(--warning)', fontWeight: 700, fontSize: 12, cursor: reset.isPending ? 'wait' : 'pointer', opacity: reset.isPending ? 0.7 : 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!reset.isPending) e.currentTarget.style.background = 'rgba(245,158,11,.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,.08)' }}>
              {reset.isPending ? 'Resetting…' : '↺ Reset Password'}
            </button>
            <button onClick={() => setShowConfirm(true)} disabled={busy || !student.auth_user_id}
              style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontWeight: 700, fontSize: 11, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(244,63,94,.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(244,63,94,.08)' }}>
              {busy ? '…' : 'Deactivate'}
            </button>
          </div>
        ) : (
          <button onClick={() => void doReactivate()} disabled={busy || !student.auth_user_id}
            style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, transition: 'all 0.15s' }}>
            {busy ? 'Reactivating…' : '↑ Restore Access'}
          </button>
        )}
      </div>
    </div>
    {showConfirm && (
      <DeactivateConfirmModal
        name={name}
        role="student"
        busy={busy}
        onConfirm={() => void doDeactivate()}
        onCancel={() => setShowConfirm(false)}
      />
    )}
    </>
  )
}

// ── ParentAccountCard ─────────────────────────────────────────────────────────
function ParentAccountCard({ parent, schoolId, onActivated }: {
  parent: { id: string; email: string; full_name: string | null; phone: string | null; auth_user_id: string | null; temp_password: string | null; student_ids: string[] }
  schoolId: string
  onActivated: () => void
}) {
  const { success: ok, error: err } = useToast()
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const isPending = !parent.auth_user_id

  async function handleActivate() {
    setBusy(true)
    try {
      const password = generateTempPassword()
      const { error } = await supabase.functions.invoke('create-parent-auth-user', {
        body: { parentAccountId: parent.id, email: parent.email, schoolId, password },
      })
      if (error) throw new Error(error.message)
      ok(`Account created for ${parent.full_name ?? parent.email}`)
      onActivated()
    } catch (e: any) { err(e.message ?? 'Failed to create account') }
    finally { setBusy(false) }
  }

  const name = parent.full_name ?? parent.email

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 14, border: `1px solid ${isPending ? 'rgba(245,158,11,.3)' : 'var(--border)'}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.06)' }}>
      <div style={{ height: 3, background: isPending ? 'var(--warning)' : 'var(--success)' }} />
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--txt)', marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', marginBottom: 2 }}>{parent.email}</div>
        {parent.phone && <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginBottom: 6 }}>{parent.phone}</div>}
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginBottom: 10 }}>
          {parent.student_ids.length} linked student{parent.student_ids.length !== 1 ? 's' : ''}
        </div>
        {!isPending && parent.temp_password && (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 3 }}>Stored Password</div>
            <div style={{ fontFamily: 'var(--font3)', fontSize: 12.5, color: 'var(--txt)', fontWeight: 600 }}>{parent.temp_password}</div>
          </div>
        )}
        {isPending ? (
          <button onClick={() => void handleActivate()} disabled={busy}
            style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: 'none', background: busy ? 'var(--border)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: busy ? 'var(--txt3)' : '#fff', fontWeight: 700, fontSize: 12.5, cursor: busy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            {busy ? 'Creating…' : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Create Account</>}
          </button>
        ) : (
          <button onClick={() => { void navigator.clipboard.writeText(`Email: ${parent.email}\nPassword: ${parent.temp_password ?? '—'}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid var(--border)', background: copied ? 'rgba(16,185,129,.08)' : 'var(--surface2)', color: copied ? 'var(--success)' : 'var(--txt2)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            {copied ? '✓ Copied' : 'Copy Credentials'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── CredVaultRow ──────────────────────────────────────────────────────────────
function CredVaultRow({ entry, schoolName }: { entry: { id: string; name: string; type: string; email: string; password: string }; schoolName: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied,   setCopied]   = useState(false)
  const typeColor: Record<string, string> = { Staff: '#8b5cf6', Student: '#0ea5e9', Parent: '#f59e0b' }
  const color = typeColor[entry.type] ?? 'var(--txt3)'

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}>
      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{entry.name}</td>
      <td style={{ padding: '10px 14px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}14`, border: `.5px solid ${color}40`, borderRadius: 99, padding: '2px 8px' }}>{entry.type}</span>
      </td>
      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)' }}>{entry.email}</td>
      <td style={{ padding: '10px 14px', fontFamily: 'var(--font3)', fontSize: 13, color: revealed ? 'var(--txt)' : 'var(--txt3)', cursor: 'pointer', userSelect: revealed ? 'text' : 'none' }}
        onMouseEnter={() => setRevealed(true)} onMouseLeave={() => setRevealed(false)}>
        {revealed ? entry.password : '••••••••'}
      </td>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => { void navigator.clipboard.writeText(`${entry.name}\nEmail: ${entry.email}\nPassword: ${entry.password}`); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: copied ? 'rgba(16,185,129,.08)' : 'var(--surface)', color: copied ? 'var(--success)' : 'var(--txt2)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            {copied ? '✓' : 'Copy'}
          </button>
          <button onClick={() => printCredentialSlip({ staffName: entry.name, role: entry.type, deptName: null, email: entry.email, password: entry.password, schoolName })}
            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            Print
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── CreateUserWizard ──────────────────────────────────────────────────────────
const WIZARD_ROLES = [
  { value: 'principal',     label: 'Principal',           grad: ['#f59e0b', '#d97706'] as [string, string] },
  { value: 'deputy',        label: 'Deputy Head',         grad: ['#0d9488', '#0f766e'] as [string, string] },
  { value: 'dos',           label: 'Director of Studies', grad: ['#8b5cf6', '#7c3aed'] as [string, string] },
  { value: 'secretary',     label: 'Secretary',           grad: ['#0ea5e9', '#0284c7'] as [string, string] },
  { value: 'bursar',        label: 'Bursar',              grad: ['#f43f5e', '#e11d48'] as [string, string] },
  { value: 'class_teacher', label: 'Class Teacher',       grad: ['#10b981', '#059669'] as [string, string] },
  { value: 'teacher',       label: 'Teacher',             grad: ['#6366f1', '#4f46e5'] as [string, string] },
  { value: 'it_admin',      label: 'IT Admin',            grad: ['#94a3b8', '#64748b'] as [string, string] },
]

// IT admin creates staff accounts only — students and parents are the
// secretary's job (see StudentRegistrationWizard / StudentsPage). Staff never
// get a password IT admin can see: create-staff-auth-user emails them an
// invite/reset link, the same "Forgot password" mechanism as the login page.
function CreateUserWizard({ onClose, schoolId, schoolShortName, schoolName: _schoolName }: {
  onClose:         () => void
  schoolId:        string
  schoolShortName: string
  schoolName:      string
}) {
  const { user }                        = useAuth()
  const qc                              = useQueryClient()
  const { success: ok } = useToast()

  const [step,   setStep]   = useState<'details' | 'done'>('details')
  const [role,   setRole]   = useState('teacher')

  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [phone,      setPhone]      = useState('')

  const [busy,   setBusy]   = useState(false)
  const [error,  setError]  = useState<string | null>(null)
  const [result, setResult] = useState<{ email: string; name: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Escape closes the wizard. Keep onClose in a ref so the listener is only
  // re-registered when `busy` changes, not on every parent re-render.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !busy) onCloseRef.current() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy])

  const sn = (schoolShortName || 'school').toLowerCase().replace(/[^a-z0-9]/g, '')

  function previewEmail(): string {
    if (emailInput.trim()) return emailInput.trim().toLowerCase()
    const fn = firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    const ln = lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
    if (!fn && !ln) return `username@${sn}.ug`
    return `${fn}${ln ? '.' + ln : ''}@${sn}.ug`
  }

  function isValid(): boolean {
    return !!firstName.trim() && !!lastName.trim()
  }

  function resetForm() {
    setStep('details'); setRole('teacher')
    setFirstName(''); setLastName(''); setEmailInput(''); setPhone('')
    setResult(null); setError(null)
  }

  async function handleCreate() {
    if (busy) return
    if (!user || !['it_admin', 'principal', 'secretary'].includes(user.role ?? '')) {
      setError('Forbidden: insufficient role'); return
    }
    setBusy(true)
    setError(null)
    // Track the inserted row so we can roll back if the edge function fails
    let orphanId: string | null = null
    try {
      const email = emailInput.trim() ? emailInput.trim().toLowerCase() : previewEmail()
      const { data: row, error: ie } = await supabase
        .from('staff')
        .insert({ school_id: schoolId, first_name: firstName.trim(), last_name: lastName.trim(), role, email, phone: phone.trim() || null, is_active: true })
        .select('id').single()
      if (ie) throw ie
      orphanId = (row as { id: string }).id
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-staff-auth-user', {
        body: { staffId: orphanId, email, schoolId, redirectTo: `${window.location.origin}/reset-password` },
      })
      if (fnErr || fnData == null || !(fnData as any)?.success) throw new Error((fnData as { error?: string } | null)?.error ?? fnErr?.message ?? 'Failed to create auth user')
      orphanId = null
      void qc.invalidateQueries({ queryKey: ['staff', schoolId] })
      void qc.invalidateQueries({ queryKey: ['credentials-vault', schoolId] })
      setResult({ email, name: `${firstName.trim()} ${lastName.trim()}` })

      setStep('done')
      ok(`Account created for ${firstName.trim()} ${lastName.trim()} — invite email sent`)
    } catch (e) {
      // Roll back the staff row if the edge function failed after a successful INSERT.
      if (orphanId) {
        const { error: rbErr } = await supabase.from('staff').delete().eq('id', orphanId).eq('school_id', schoolId)
        if (rbErr) console.error('Orphan cleanup failed:', orphanId, rbErr.message)
      }
      setError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setBusy(false)
    }
  }

  function copy(key: string, val: string) {
    void navigator.clipboard.writeText(val)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1px solid var(--border)', background: 'var(--surface)',
    fontSize: 13, color: 'var(--txt)', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--txt3)',
    textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5,
  }

  const modal = (
    <div
      className="sui-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,13,26,.65)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div className="sui-modal-dialog" style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,.3)', border: '1px solid var(--border)', margin: '0 16px' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10, borderRadius: '20px 20px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 16, color: 'var(--txt)', letterSpacing: -.3 }}>
                {step === 'done' ? 'Account Created' : 'Create Staff Account'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
                {step === 'details' ? 'Fill in staff details' : 'Invite email sent'}
              </div>
            </div>
          </div>
          <button onClick={() => !busy && onClose()} style={{ background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', color: 'var(--txt3)', padding: 6, borderRadius: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '20px 24px 24px' }}>

          {/* ── Details form ───────────────────────────────────── */}
          {step === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Staff Role</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
                  {WIZARD_ROLES.map(r => {
                    const [c1] = r.grad
                    const sel  = role === r.value
                    return (
                      <button key={r.value} onClick={() => setRole(r.value)}
                        style={{ padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${sel ? c1 : 'var(--border)'}`, background: sel ? `${c1}14` : 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.14s' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sel ? c1 : 'var(--border)', flexShrink: 0 }} />
                        <span style={{ fontSize: 12.5, fontWeight: sel ? 800 : 600, color: sel ? c1 : 'var(--txt2)', fontFamily: 'var(--font2)' }}>{r.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={labelStyle}>First Name *</div>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Last Name *</div>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={labelStyle}>Email <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional — auto-generated if blank)</span></div>
                <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder={previewEmail()} style={inputStyle} />
                {!emailInput && (firstName || lastName) && (
                  <div style={{ fontSize: 11, color: 'var(--info)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Will use: <code style={{ fontFamily: 'var(--font3)' }}>{previewEmail()}</code>
                  </div>
                )}
              </div>
              <div>
                <div style={labelStyle}>Phone <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></div>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256 700 000000" style={inputStyle} />
              </div>

              <div style={{ fontSize: 11.5, color: 'var(--txt3)', display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)', borderRadius: 10, padding: '8px 12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                No password to set — they'll receive an email with a link to create their own.
              </div>

              {error && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.06)', padding: '10px 14px', fontSize: 12.5, color: 'var(--danger)' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={onClose}
                  style={{ flex: '0 0 auto', padding: '11px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font2)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={!isValid() || busy}
                  style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', background: isValid() && !busy ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'var(--border)', color: isValid() && !busy ? '#fff' : 'var(--txt3)', fontWeight: 800, fontSize: 13.5, fontFamily: 'var(--font2)', cursor: isValid() && !busy ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}>
                  {busy
                    ? 'Creating…'
                    : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Create Account</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ── Step done: credentials ─────────────────────────── */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 14, color: 'var(--success)' }}>{result.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 2 }}>
                    Account created. An invite email was sent to set their password.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Email Address</div>
                  <div style={{ fontFamily: 'var(--font3)', fontSize: 13.5, color: 'var(--txt)', fontWeight: 600, wordBreak: 'break-all' }}>{result.email}</div>
                </div>
                <button onClick={() => copy('email', result.email)}
                  style={{ flexShrink: 0, padding: '5px 12px', borderRadius: 8, border: `1px solid ${copied === 'email' ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, background: copied === 'email' ? 'rgba(16,185,129,.1)' : 'var(--surface)', color: copied === 'email' ? 'var(--success)' : 'var(--txt2)', fontSize: 11, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {copied === 'email' ? '✓' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid var(--border)' }}>
                <button onClick={resetForm}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font2)', cursor: 'pointer' }}>
                  Create Another
                </button>
                <button onClick={onClose}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: 'var(--font2)', cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.querySelector('.ar') ?? document.body)
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const qc = useQueryClient()
  const [wizardOpen, setWizardOpen] = useState(false)
  const closeWizard = useCallback(() => setWizardOpen(false), [])
  // Top-level section switcher: Staff | Students | Parents | Credentials
  const [section,    setSection]    = useState<'staff' | 'students' | 'parents' | 'credentials'>('staff')
  const [tab,        setTab]        = useState<'pending' | 'active'>('pending')
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [linkModal,  setLinkModal]  = useState<{ staffId: string; staffName: string } | null>(null)
  const [newCred,        setNewCred]        = useState<CredInfo | null>(null)
  const [newStudentCred, setNewStudentCred] = useState<StudentCredInfo | null>(null)

  const pendingSectionRef = useRef<HTMLDivElement>(null)

  const scrollToPending = useCallback(() => {
    setSection('students')
    setTab('pending')
    setTimeout(() => {
      pendingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  const { user }                                           = useAuth()
  const { data: allStaff = [], isLoading: staffLoading, error: staffError } = useStaff(useMemo(() => ({}), []))
  const { data: depts    = [] }                           = useDepartments()
  const { data: classes  = [] }                           = useClasses()
  const { data: school }                                  = useSchoolSettings()
  const deptMap  = useMemo(() => new Map(depts.map(d => [d.id, d.name])),    [depts])
  const classMap = useMemo(() => new Map(classes.map(c => [c.id, c.name])), [classes])

  const schoolId   = user?.schoolId ?? ''
  const schoolName = school?.schoolName ?? 'School'

  // ── Staff lists ──────────────────────────────────────────────
  const staffPending = useMemo(() => allStaff.filter(s => !s.authUserId), [allStaff])
  const staffActive  = useMemo(() => allStaff.filter(s =>  s.authUserId), [allStaff])

  function filterStaff(list: Staff[]) {
    let out = list
    if (roleFilter) out = out.filter(s => s.role === roleFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.staffNumber.toLowerCase().includes(q) ||
        (s.email ?? '').toLowerCase().includes(q)
      )
    }
    return out
  }

  const staffDisplay = filterStaff(tab === 'pending' ? staffPending : staffActive)

  // ── Student queries ──────────────────────────────────────────
  const { data: studentsPending = [], isLoading: studPendingLoading } = useQuery({
    queryKey: ['students-pending-login', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, first_name, last_name, admission_number, class_id, auth_user_id, auth_email, status')
        .eq('school_id', schoolId)
        .is('auth_user_id', null)
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as StudentLoginRow[]
    },
  })

  const { data: studentsActive = [], isLoading: studActiveLoading } = useQuery({
    queryKey: ['students-active-login', schoolId],
    enabled:  !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, school_id, first_name, last_name, admission_number, class_id, auth_user_id, auth_email, status')
        .eq('school_id', schoolId)
        .not('auth_user_id', 'is', null)
        .order('last_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as StudentLoginRow[]
    },
  })

  // Merge DB pending list with localStorage pending activations
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localPending = useMemo(() => getPendingStudentActivations(), [studentsPending])
  const studentsLoading = studPendingLoading || studActiveLoading

  // ── Parent account queries ───────────────────────────────────
  type ParentRow = {
    id: string; email: string; full_name: string | null; phone: string | null
    auth_user_id: string | null; temp_password: string | null; student_ids: string[]
  }
  const { data: parentsPending = [], isLoading: parentsPendingLoading } = useQuery({
    queryKey: ['parents-pending-login', schoolId],
    enabled:  !!schoolId && section === 'parents',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, email, full_name, phone, auth_user_id, temp_password, student_ids')
        .eq('school_id', schoolId)
        .is('auth_user_id', null)
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ParentRow[]
    },
  })
  const { data: parentsActive = [], isLoading: parentsActiveLoading } = useQuery({
    queryKey: ['parents-active-login', schoolId],
    enabled:  !!schoolId && section === 'parents',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parent_accounts')
        .select('id, email, full_name, phone, auth_user_id, temp_password, student_ids')
        .eq('school_id', schoolId)
        .not('auth_user_id', 'is', null)
        .order('full_name', { ascending: true })
      if (error) throw error
      return (data ?? []) as ParentRow[]
    },
  })
  const parentsLoading = parentsPendingLoading || parentsActiveLoading

  // ── Credentials vault queries ────────────────────────────────
  type VaultEntry = { id: string; name: string; type: string; email: string; password: string }
  const { data: vaultEntries = [], isLoading: vaultLoading } = useQuery({
    queryKey: ['credentials-vault', schoolId],
    enabled:  !!schoolId && section === 'credentials',
    staleTime: 30_000,
    queryFn: async () => {
      // Staff are intentionally excluded — they no longer have a password IT
      // admin can see (email invite/reset link model). staff.temp_password is
      // stale for anyone activated/reset before that change and must not be
      // surfaced as if it were still a live credential.
      const [studRes, parentRes] = await Promise.all([
        supabase.from('students').select('id, first_name, last_name, auth_email, temp_password')
          .eq('school_id', schoolId).not('temp_password', 'is', null).not('auth_email', 'is', null),
        supabase.from('parent_accounts').select('id, full_name, email, temp_password')
          .eq('school_id', schoolId).not('temp_password', 'is', null).not('email', 'is', null),
      ])
      const entries: VaultEntry[] = []
      for (const r of (studRes.data ?? []) as any[]) {
        entries.push({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: 'Student', email: r.auth_email, password: r.temp_password })
      }
      for (const r of (parentRes.data ?? []) as any[]) {
        entries.push({ id: r.id, name: r.full_name ?? r.email, type: 'Parent', email: r.email, password: r.temp_password })
      }
      return entries
    },
  })

  function filterStudents(list: StudentLoginRow[]) {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(s =>
      `${s.first_name} ${s.last_name}`.toLowerCase().includes(q) ||
      s.admission_number.toLowerCase().includes(q)
    )
  }

  const studDisplay = filterStudents(tab === 'pending' ? studentsPending : studentsActive)
  const isLoading   = section === 'staff' ? staffLoading : studentsLoading

  function onStaffActivated(cred: CredInfo) { setNewCred(cred); setTab('active') }
  function onStudentActivated(cred: StudentCredInfo) { setNewStudentCred(cred); setTab('active') }

  // Hero stat chips — show appropriate counts per section
  const heroStats =
    section === 'staff' ? [
      { label: 'Total Staff',    value: staffLoading ? '—' : String(allStaff.length),    accent: 'rgba(255,255,255,.2)' },
      { label: 'Pending',        value: staffLoading ? '—' : String(staffPending.length), accent: staffPending.length > 0 ? 'rgba(244,63,94,.45)' : 'rgba(255,255,255,.15)' },
      { label: 'Active Logins',  value: staffLoading ? '—' : String(staffActive.length),  accent: 'rgba(255,255,255,.15)' },
    ] : section === 'students' ? [
      { label: 'Total Students', value: studentsLoading ? '—' : String(studentsPending.length + studentsActive.length), accent: 'rgba(255,255,255,.2)' },
      { label: 'Pending',        value: studentsLoading ? '—' : String(studentsPending.length), accent: studentsPending.length > 0 ? 'rgba(244,63,94,.45)' : 'rgba(255,255,255,.15)' },
      { label: 'Active Logins',  value: studentsLoading ? '—' : String(studentsActive.length),  accent: 'rgba(255,255,255,.15)' },
    ] : section === 'parents' ? [
      { label: 'Total Parents',  value: parentsLoading ? '—' : String(parentsPending.length + parentsActive.length), accent: 'rgba(255,255,255,.2)' },
      { label: 'Pending',        value: parentsLoading ? '—' : String(parentsPending.length), accent: parentsPending.length > 0 ? 'rgba(244,63,94,.45)' : 'rgba(255,255,255,.15)' },
      { label: 'Active Logins',  value: parentsLoading ? '—' : String(parentsActive.length), accent: 'rgba(255,255,255,.15)' },
    ] : [
      { label: 'Credentials Stored', value: vaultLoading ? '—' : String(vaultEntries.length), accent: 'rgba(255,255,255,.2)' },
    ]

  return (
    <>
      <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Hero */}
        <div style={{ borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(135deg,#8b5cf6 0%,#6366f1 100%)', padding: '28px 28px 24px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -20, left: 60, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -.4 }}>User Logins</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: 0 }}>
                Activate and manage system access for all users
              </p>
              <button
                onClick={() => setWizardOpen(true)}
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.18)', backdropFilter: 'blur(8px)', color: '#fff', fontWeight: 800, fontSize: 12.5, fontFamily: 'var(--font2)', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.26)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.18)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create User
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {heroStats.map(s => (
                <div key={s.label} style={{ background: s.accent, backdropFilter: 'blur(10px)', borderRadius: 10, padding: '8px 14px', border: '1px solid rgba(255,255,255,.15)' }}>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: '#fff', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.7)', marginTop: 3, fontWeight: 600, letterSpacing: .3 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Post-import redirect banner */}
        <PostImportBanner onScrollToPending={scrollToPending} />

        {/* Pending activations amber banner */}
        {(studentsPending.length > 0 || staffPending.length > 0) && (
          <PendingActivationsBanner
            schoolId={schoolId}
            pendingStudentCount={studentsPending.length}
            pendingStaffCount={staffPending.length}
            onScrollToPending={scrollToPending}
          />
        )}

        {/* Credential panels */}
        {newCred        && <CredentialDeliveryPanel cred={newCred} schoolName={schoolName} onDismiss={() => setNewCred(null)} />}
        {newStudentCred && <StudentCredentialDeliveryPanel cred={newStudentCred} schoolName={schoolName} onDismiss={() => setNewStudentCred(null)} />}

        {/* Staff query error / diagnostic */}
        {staffError && section === 'staff' && (
          <div style={{ borderRadius: 12, border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.06)', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--font2)', marginBottom: 4 }}>Failed to load staff</div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)', marginBottom: 4 }}>{getFriendlyErrorMessage(staffError)}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                School ID: <code style={{ fontFamily: 'var(--font3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{user?.schoolId ?? 'none'}</code>
                {' · '}Role: <code style={{ fontFamily: 'var(--font3)', background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{user?.role ?? 'none'}</code>
              </div>
            </div>
          </div>
        )}
        {!staffError && !staffLoading && allStaff.length === 0 && section === 'staff' && (
          <div style={{ borderRadius: 12, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.06)', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font2)' }}>No staff records found for this school</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                School ID in session: <code style={{ fontFamily: 'var(--font3)', background: 'var(--surface2)', padding: '1px 5px', borderRadius: 4 }}>{user?.schoolId ?? '—'}</code>
                {' · '}Must match <code style={{ fontFamily: 'var(--font3)' }}>school_id</code> on staff rows.
              </div>
            </div>
          </div>
        )}

        {/* Section switcher: Staff | Students | Parents | Credentials */}
        <div ref={pendingSectionRef} className="user-section-tabs" style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)', overflowX: 'auto' }}>
          {([
            { id: 'staff'       as const, label: 'Staff',       badge: staffPending.length,    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
            { id: 'students'    as const, label: 'Students',    badge: studentsPending.length,  icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
            { id: 'parents'     as const, label: 'Parents',     badge: parentsPending.length,   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg> },
            { id: 'credentials' as const, label: 'Credentials', badge: 0,                       icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> },
          ]).map(s => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setSearch(''); setRoleFilter(''); setTab('pending') }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, transition: 'all 0.15s', flexShrink: 0, background: section === s.id ? 'var(--surface)' : 'transparent', color: section === s.id ? 'var(--txt)' : 'var(--txt3)', boxShadow: section === s.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}
            >
              {s.icon}
              {s.label}
              {s.badge > 0 && (
                <span style={{ background: 'rgba(244,63,94,.15)', color: 'var(--danger)', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 800 }}>
                  {s.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sub-tabs: Pending | Active (not shown for credentials section) */}
        {section !== 'credentials' && (() => {
          const subTabs = section === 'staff'
            ? [
                { id: 'pending' as const, label: 'Pending Activation', count: staffPending.length, red: staffPending.length > 0 },
                { id: 'active'  as const, label: 'Active Logins',      count: staffActive.length,  red: false },
              ]
            : section === 'students'
            ? [
                { id: 'pending' as const, label: 'Pending Activation', count: studentsPending.length, red: studentsPending.length > 0 },
                { id: 'active'  as const, label: 'Active Logins',      count: studentsActive.length,  red: false },
              ]
            : [
                { id: 'pending' as const, label: 'Pending Activation', count: parentsPending.length, red: parentsPending.length > 0 },
                { id: 'active'  as const, label: 'Active Logins',      count: parentsActive.length,  red: false },
              ]
          return (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {subTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, background: tab === t.id ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'var(--surface)', color: tab === t.id ? '#fff' : 'var(--txt2)', boxShadow: tab === t.id ? '0 4px 14px rgba(99,102,241,.35)' : 'none', border: tab === t.id ? 'none' : '1px solid var(--border)', transition: 'all 0.18s' }}>
                  {t.label}
                  <span style={{ background: tab === t.id ? 'rgba(255,255,255,.25)' : t.red ? 'rgba(244,63,94,.12)' : 'var(--surface2)', color: tab === t.id ? '#fff' : t.red ? 'var(--danger)' : 'var(--txt3)', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          )
        })()}

        {/* Search + role pills (not shown for credentials section) */}
        {section !== 'credentials' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', height: 44 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={section === 'staff' ? 'Search by name, staff number or email…' : 'Search by name or admission number…'}
              style={{ border: 'none', background: 'transparent', fontSize: 12.5, color: 'var(--txt)', outline: 'none', flex: 1 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', display: 'flex', padding: 2 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          {section === 'staff' && (
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {ROLE_TABS.map(rt => {
                const isActive = roleFilter === rt.value
                const [c1] = rt.value ? roleGrad(rt.value) : ['#8b5cf6', '#6366f1']
                return (
                  <button key={rt.value} onClick={() => setRoleFilter(rt.value)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 99, border: `1px solid ${isActive ? `${c1}40` : 'var(--border)'}`, background: isActive ? `${c1}14` : 'var(--surface)', color: isActive ? c1 : 'var(--txt3)', fontWeight: isActive ? 800 : 600, fontSize: 12.5, fontFamily: 'var(--font2)', cursor: 'pointer', transition: 'all 0.14s' } as React.CSSProperties}>
                    {rt.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>}

        {/* Card grid / Credentials vault */}
        {isLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : section === 'staff' ? (
          staffDisplay.length === 0 ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(139,92,246,.1),rgba(99,102,241,.1))', border: '1px solid rgba(139,92,246,.15)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>
                  {tab === 'pending' && !search && !roleFilter ? 'All staff have active logins' : 'No staff match your filters'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
                  {tab === 'pending' && !search && !roleFilter ? 'Every registered staff member has system access.' : 'Try adjusting your search or role filter.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {tab === 'pending'
                ? staffDisplay.map(s => <PendingCard key={s.id} staff={s} deptName={s.departmentId ? (deptMap.get(s.departmentId) ?? null) : null} onActivated={onStaffActivated} />)
                : staffDisplay.map(s => <ActiveCard  key={s.id} staff={s} deptName={s.departmentId ? (deptMap.get(s.departmentId) ?? null) : null} onReset={setNewCred} onLink={(id, nm) => setLinkModal({ staffId: id, staffName: nm })} onDeactivated={() => void qc.invalidateQueries({ queryKey: ['staff', schoolId] })} />)
              }
            </div>
          )
        ) : (
          // Students section
          studDisplay.length === 0 ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,rgba(14,165,233,.1),rgba(13,148,136,.1))', border: '1px solid rgba(14,165,233,.15)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>
                  {tab === 'pending' && !search ? 'All students have active logins' : 'No students match your search'}
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 5 }}>
                  {tab === 'pending' && !search ? 'Every registered student has system access.' : 'Try adjusting your search.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {tab === 'pending'
                ? studDisplay.map(s => (
                    <StudentPendingCard
                      key={s.id}
                      student={s}
                      className={s.class_id ? (classMap.get(s.class_id) ?? null) : null}
                      pending={localPending[s.id] ?? null}
                      schoolId={schoolId}
                      onActivated={onStudentActivated}
                    />
                  ))
                : studDisplay.map(s => (
                    <StudentActiveCard
                      key={s.id}
                      student={s}
                      className={s.class_id ? (classMap.get(s.class_id) ?? null) : null}
                      schoolShortName={(school?.shortName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}
                      onReset={setNewStudentCred}
                      onToggled={() => void qc.invalidateQueries({ queryKey: ['students-active-login', schoolId] })}
                    />
                  ))
              }
            </div>
          )
        )}

        {/* ── Parents section ────────────────────────────── */}
        {section === 'parents' && (
          parentsLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            (() => {
              const list = (tab === 'pending' ? parentsPending : parentsActive).filter(p => {
                if (!search.trim()) return true
                const q = search.toLowerCase()
                return (p.full_name ?? '').toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
              })
              return list.length === 0 ? (
                <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                  <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>
                    {tab === 'pending' ? 'All parents have active accounts' : 'No active parent accounts yet'}
                  </div>
                </div>
              ) : (
                <div className="stagger-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                  {list.map(p => (
                    <ParentAccountCard
                      key={p.id}
                      parent={p}
                      schoolId={schoolId}
                      onActivated={() => {
                        void qc.invalidateQueries({ queryKey: ['parents-pending-login', schoolId] })
                        void qc.invalidateQueries({ queryKey: ['parents-active-login',  schoolId] })
                        setTab('active')
                      }}
                    />
                  ))}
                </div>
              )
            })()
          )
        )}

        {/* ── Credentials vault ──────────────────────────── */}
        {section === 'credentials' && (
          vaultLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <SkeletonCard />
            </div>
          ) : vaultEntries.length === 0 ? (
            <div style={{ padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, color: 'var(--txt)' }}>No stored credentials</div>
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>Credentials appear here after staff, students, or parents are activated.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', overflowX: 'auto' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', fontFamily: 'var(--font2)' }}>
                  {vaultEntries.length} credential{vaultEntries.length !== 1 ? 's' : ''} stored
                </span>
                <span style={{ fontSize: 11, color: 'var(--txt3)' }}>Hover to reveal passwords</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Name', 'Type', 'Email', 'Password', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.7, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vaultEntries.map((e) => (
                    <CredVaultRow key={e.id} entry={e} schoolName={schoolName} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {!isLoading && section !== 'credentials' && section !== 'parents' && (
          <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', paddingBottom: 8 }}>
            {section === 'staff'
              ? staffDisplay.length > 0 ? `${staffDisplay.length} ${tab === 'pending' ? 'pending' : 'active'} staff${staffDisplay.length !== 1 ? ' members' : ' member'}${(search || roleFilter) ? ' (filtered)' : ''}` : null
              : studDisplay.length > 0  ? `${studDisplay.length} ${tab === 'pending' ? 'pending' : 'active'} student${studDisplay.length !== 1 ? 's' : ''}${search ? ' (filtered)' : ''}` : null
            }
          </div>
        )}
      </div>

      {linkModal && <LinkAuthModal staffId={linkModal.staffId} staffName={linkModal.staffName} onClose={() => setLinkModal(null)} />}

      {wizardOpen && !!school && (
        <CreateUserWizard
          onClose={closeWizard}
          schoolId={schoolId}
          schoolShortName={(school.shortName ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}
          schoolName={schoolName}
        />
      )}
    </>
  )
}
