import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Avatar } from '../../components/shared/Avatar'
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
interface CredInfo {
  staffId: string; staffName: string; role: string; deptName: string | null
  email: string; password: string; phone: string | null; manual: boolean
}

function CredentialDeliveryPanel({ cred, schoolName, onDismiss }: {
  cred: CredInfo; schoolName: string; onDismiss: () => void
}) {
  const sendSms = useSendCredentialsSms()
  const { ok, err } = useToast()
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
      await sendSms.mutateAsync({ phone: cred.phone, name: cred.staffName, email: cred.email, password: cred.password })
      setSmsSent(true); ok('Credentials sent via SMS')
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
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font2)' }}>Login Activated — {cred.staffName}</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
              {cred.manual ? 'Manual mode — use credentials below to create auth user in Supabase Dashboard' : 'Auth account created. Share credentials via any method below.'}
            </div>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Cred fields */}
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

      {/* Delivery actions */}
      <div style={{ padding: '12px 18px 16px', borderTop: '1px solid rgba(16,185,129,.1)' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>Deliver Credentials</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Print slip */}
          <button
            onClick={() => printCredentialSlip({ staffName: cred.staffName, role: cred.role, deptName: cred.deptName, email: cred.email, password: cred.password, schoolName })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, color: 'var(--txt)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Credential Slip
          </button>

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

          {/* Copy all */}
          <button
            onClick={() => { const t = `${cred.staffName} Login\nEmail: ${cred.email}\nPassword: ${cred.password}\nURL: ${window.location.origin}`; void navigator.clipboard.writeText(t); copy('all', t) }}
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

// ── Link Auth Modal ───────────────────────────────────────────────────────────
function LinkAuthModal({ staffId, staffName, onClose }: { staffId: string; staffName: string; onClose: () => void }) {
  const [uuid, setUuid] = useState('')
  const link = useLinkAuthUser()
  const { ok, err } = useToast()
  async function handleLink() {
    try { await link.mutateAsync({ staffId, authUserId: uuid }); ok(`${staffName} linked`); onClose() }
    catch (e) { err(e instanceof Error ? e.message : 'Link failed') }
  }
  return (
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
}

// ── Pending staff card ────────────────────────────────────────────────────────
function PendingCard({ staff, deptName, onActivated }: { staff: Staff; deptName: string | null; onActivated: (c: CredInfo) => void }) {
  const [c1, c2] = roleGrad(staff.role)
  const activate = useActivateStaffLogin()
  const { err }  = useToast()
  const hasEmail = !!staff.email

  async function handleActivate() {
    try {
      const r = await activate.mutateAsync(staff.id)
      onActivated({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, role: staff.role, deptName, email: r.email, password: r.tempPassword, phone: staff.phone, manual: r.manual })
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
function ActiveCard({ staff, deptName, onReset, onLink }: { staff: Staff; deptName: string | null; onReset: (c: CredInfo) => void; onLink: (staffId: string, name: string) => void }) {
  const [c1, c2] = roleGrad(staff.role)
  const reset    = useResetStaffPassword()
  const { err }  = useToast()

  async function handleReset() {
    if (!staff.authUserId || !staff.email) return
    try {
      const r = await reset.mutateAsync({ authUserId: staff.authUserId, staffId: staff.id, email: staff.email, name: `${staff.firstName} ${staff.lastName}` })
      onReset({ staffId: staff.id, staffName: `${staff.firstName} ${staff.lastName}`, role: staff.role, deptName, email: staff.email, password: r.tempPassword, phone: staff.phone, manual: r.manual })
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: `linear-gradient(90deg,${c1},${c2})` }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: `linear-gradient(135deg,${c1},${c2})`, padding: 2 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--surface)' }}>
                <Avatar photoPath={staff.photoUrl} bucket="staff-photos" name={`${staff.firstName} ${staff.lastName}`} size="md" />
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--surface)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.firstName} {staff.lastName}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: c1, background: `${c1}18`, padding: '2px 8px', borderRadius: 99 }}>{ROLE_LABELS[staff.role] ?? staff.role}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,.1)', padding: '2px 7px', borderRadius: 99 }}>● Active</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          {staff.email && <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{staff.email}</span>}
          {deptName && <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{deptName}</span>}
          <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{staff.staffNumber}</span>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button onClick={() => void handleReset()} disabled={!staff.authUserId || !staff.email || reset.isPending}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: 'var(--warning)', fontWeight: 700, fontSize: 12, cursor: reset.isPending ? 'wait' : 'pointer', opacity: reset.isPending ? 0.7 : 1, transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!reset.isPending) e.currentTarget.style.background = 'rgba(245,158,11,.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,.08)' }}>
            {reset.isPending ? 'Resetting…' : '↺ Reset Password'}
          </button>
          <button onClick={() => onLink(staff.id, `${staff.firstName} ${staff.lastName}`)}
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.color = 'var(--txt2)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface2)'; e.currentTarget.style.color = 'var(--txt3)' }}
            title="Manually link a Supabase auth UUID">
            Link
          </button>
        </div>
      </div>
    </div>
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

// ── Student row type (from DB query) ──────────────────────────────────────────
type StudentLoginRow = {
  id:               string
  school_id:        string
  first_name:       string
  last_name:        string
  admission_number: string
  class_id:         string | null
  auth_user_id:     string | null
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
  const { ok, err } = useToast()
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
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    const arr = new Uint8Array(10)
    crypto.getRandomValues(arr)
    const newPassword = Array.from(arr, b => chars[b % chars.length]).join('')
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
function StudentActiveCard({ student, className, onReset }: {
  student:   StudentLoginRow
  className: string | null
  onReset:   (c: StudentCredInfo) => void
}) {
  const reset       = useResetStudentPassword()
  const { err }     = useToast()
  const name        = `${student.first_name} ${student.last_name}`

  async function handleReset() {
    if (!student.auth_user_id) return
    try {
      const r = await reset.mutateAsync({
        studentId:       student.id,
        authUserId:      student.auth_user_id,
        email:           `${student.admission_number.toLowerCase().replace(/\//g, '-')}@school.ug`,
        name,
        admissionNumber: student.admission_number,
      })
      onReset({ studentId: student.id, studentName: name, admissionNumber: student.admission_number, email: r.email, password: r.tempPassword, manual: r.manual })
    } catch (e) { err(e instanceof Error ? e.message : 'Reset failed') }
  }

  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ height: 3, background: 'linear-gradient(90deg,#0ea5e9,#0d9488)' }} />
      <div style={{ padding: '16px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#0ea5e9,#0d9488)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: 'var(--success)', border: '2px solid var(--surface)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: .5, color: '#0ea5e9', background: 'rgba(14,165,233,.12)', padding: '2px 8px', borderRadius: 99 }}>Student</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)', background: 'rgba(16,185,129,.1)', padding: '2px 7px', borderRadius: 99 }}>● Active</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
          {className && <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{className}</span>}
          <span style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>{student.admission_number}</span>
        </div>
        <button onClick={() => void handleReset()} disabled={!student.auth_user_id || reset.isPending}
          style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid rgba(245,158,11,.3)', background: 'rgba(245,158,11,.08)', color: 'var(--warning)', fontWeight: 700, fontSize: 12, cursor: reset.isPending ? 'wait' : 'pointer', opacity: reset.isPending ? 0.7 : 1, transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!reset.isPending) e.currentTarget.style.background = 'rgba(245,158,11,.15)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,158,11,.08)' }}>
          {reset.isPending ? 'Resetting…' : '↺ Reset Password'}
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  // Top-level section switcher: Staff | Students
  const [section,    setSection]    = useState<'staff' | 'students'>('staff')
  const [tab,        setTab]        = useState<'pending' | 'active'>('pending')
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [linkModal,  setLinkModal]  = useState<{ staffId: string; staffName: string } | null>(null)
  const [newCred,        setNewCred]        = useState<CredInfo | null>(null)
  const [newStudentCred, setNewStudentCred] = useState<StudentCredInfo | null>(null)

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
        .select('id, school_id, first_name, last_name, admission_number, class_id, auth_user_id')
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
        .select('id, school_id, first_name, last_name, admission_number, class_id, auth_user_id')
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
  const heroStats = section === 'staff'
    ? [
        { label: 'Total Staff',    value: staffLoading ? '—' : String(allStaff.length),    accent: 'rgba(255,255,255,.2)' },
        { label: 'Pending',        value: staffLoading ? '—' : String(staffPending.length), accent: staffPending.length > 0 ? 'rgba(244,63,94,.45)' : 'rgba(255,255,255,.15)' },
        { label: 'Active Logins',  value: staffLoading ? '—' : String(staffActive.length),  accent: 'rgba(255,255,255,.15)' },
      ]
    : [
        { label: 'Total Students', value: studentsLoading ? '—' : String(studentsPending.length + studentsActive.length), accent: 'rgba(255,255,255,.2)' },
        { label: 'Pending',        value: studentsLoading ? '—' : String(studentsPending.length), accent: studentsPending.length > 0 ? 'rgba(244,63,94,.45)' : 'rgba(255,255,255,.15)' },
        { label: 'Active Logins',  value: studentsLoading ? '—' : String(studentsActive.length),  accent: 'rgba(255,255,255,.15)' },
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
            <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 12.5, margin: '0 0 20px' }}>
              Activate and manage system access for staff and students
            </p>
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

        {/* Credential panels */}
        {newCred        && <CredentialDeliveryPanel cred={newCred} schoolName={schoolName} onDismiss={() => setNewCred(null)} />}
        {newStudentCred && <StudentCredentialDeliveryPanel cred={newStudentCred} schoolName={schoolName} onDismiss={() => setNewStudentCred(null)} />}

        {/* Staff query error / diagnostic */}
        {staffError && section === 'staff' && (
          <div style={{ borderRadius: 12, border: '1px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.06)', padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--font2)', marginBottom: 4 }}>Failed to load staff</div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', fontFamily: 'var(--font3)', marginBottom: 4 }}>{(staffError as Error).message}</div>
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

        {/* Section switcher: Staff | Students */}
        <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface2)', borderRadius: 12, border: '1px solid var(--border)', alignSelf: 'flex-start' }}>
          {([
            { id: 'staff'    as const, label: 'Staff',    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
            { id: 'students' as const, label: 'Students', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg> },
          ]).map(s => (
            <button
              key={s.id}
              onClick={() => { setSection(s.id); setSearch(''); setRoleFilter(''); setTab('pending') }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, transition: 'all 0.15s', background: section === s.id ? 'var(--surface)' : 'transparent', color: section === s.id ? 'var(--txt)' : 'var(--txt3)', boxShadow: section === s.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Sub-tabs: Pending | Active */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {section === 'staff'
            ? ([
                { id: 'pending' as const, label: 'Pending Activation', count: staffPending.length, red: staffPending.length > 0 },
                { id: 'active'  as const, label: 'Active Logins',      count: staffActive.length,  red: false },
              ])
            : ([
                { id: 'pending' as const, label: 'Pending Activation', count: studentsPending.length, red: studentsPending.length > 0 },
                { id: 'active'  as const, label: 'Active Logins',      count: studentsActive.length,  red: false },
              ])
          }.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 99, cursor: 'pointer', fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 13, background: tab === t.id ? 'linear-gradient(135deg,#8b5cf6,#6366f1)' : 'var(--surface)', color: tab === t.id ? '#fff' : 'var(--txt2)', boxShadow: tab === t.id ? '0 4px 14px rgba(99,102,241,.35)' : 'none', border: tab === t.id ? 'none' : '1px solid var(--border)', transition: 'all 0.18s' }}>
              {t.label}
              <span style={{ background: tab === t.id ? 'rgba(255,255,255,.25)' : t.red ? 'rgba(244,63,94,.12)' : 'var(--surface2)', color: tab === t.id ? '#fff' : t.red ? 'var(--danger)' : 'var(--txt3)', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 800 }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + role pills (staff only shows role filter) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', height: 38 }}>
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
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
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
        </div>

        {/* Card grid */}
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
                : staffDisplay.map(s => <ActiveCard  key={s.id} staff={s} deptName={s.departmentId ? (deptMap.get(s.departmentId) ?? null) : null} onReset={setNewCred} onLink={(id, nm) => setLinkModal({ staffId: id, staffName: nm })} />)
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
                      onReset={setNewStudentCred}
                    />
                  ))
              }
            </div>
          )
        )}

        {!isLoading && (
          <div style={{ fontSize: 12, color: 'var(--txt3)', textAlign: 'center', paddingBottom: 8 }}>
            {section === 'staff'
              ? staffDisplay.length > 0 ? `${staffDisplay.length} ${tab === 'pending' ? 'pending' : 'active'} staff${staffDisplay.length !== 1 ? ' members' : ' member'}${(search || roleFilter) ? ' (filtered)' : ''}` : null
              : studDisplay.length > 0  ? `${studDisplay.length} ${tab === 'pending' ? 'pending' : 'active'} student${studDisplay.length !== 1 ? 's' : ''}${search ? ' (filtered)' : ''}` : null
            }
          </div>
        )}
      </div>

      {linkModal && <LinkAuthModal staffId={linkModal.staffId} staffName={linkModal.staffName} onClose={() => setLinkModal(null)} />}
    </>
  )
}
