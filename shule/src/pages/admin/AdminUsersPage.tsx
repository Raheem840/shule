import { useState, useMemo } from 'react'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { useUserManagement } from '../../hooks/useAdmin'
import {
  useActivateStaffLogin,
  useResetStaffPassword,
  useLinkAuthUser,
} from '../../hooks/useStaffAuth'
import type { UserRow } from '../../types/week9'
import { useToast } from '../../components/ui/Toast'

// ── Role config ────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  principal:     { label: 'Principal',       color: '#0d9488', bg: 'rgba(13,148,136,0.12)' },
  deputy:        { label: 'Deputy',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  dos:           { label: 'Dir. of Studies', color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' },
  secretary:     { label: 'Secretary',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  bursar:        { label: 'Bursar',          color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  class_teacher: { label: 'Class Teacher',   color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
  teacher:       { label: 'Teacher',         color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
  it_admin:      { label: 'IT Admin',        color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

function roleMeta(role: string) {
  return ROLE_META[role] ?? { label: role, color: 'var(--txt2)', bg: 'var(--surface2)' }
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

// ── Credential banner ──────────────────────────────────────────────────────
function CredentialBanner({ email, tempPassword, manual, onDismiss }: {
  email: string; tempPassword: string; manual: boolean; onDismiss: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(13,148,136,0.06) 100%)',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: 16, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(16,185,129,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--success)' }}>
            {manual ? 'Stored locally — create manually in Supabase' : 'Login activated'}
          </div>
          {manual && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>
            Copy credentials below then create the auth account in Supabase Dashboard.
          </div>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[{ label: 'Email', value: email, key: 'email' }, { label: 'Temp Password', value: tempPassword, key: 'pass' }].map(f => (
          <div key={f.key} style={{
            background: 'rgba(0,0,0,0.04)', borderRadius: 10,
            padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid rgba(16,185,129,0.15)',
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 }}>{f.label}</div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{f.value}</div>
            </div>
            <button
              onClick={() => copy(f.value, f.key)}
              style={{
                border: '1px solid rgba(16,185,129,0.3)', borderRadius: 7,
                padding: '4px 10px', fontSize: 11, fontWeight: 700,
                background: copied === f.key ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: 'var(--success)', cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {copied === f.key ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={onDismiss}
        style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--txt3)', padding: '2px 0' }}
      >
        Dismiss
      </button>
    </div>
  )
}

// ── KPI chip ───────────────────────────────────────────────────────────────
function KpiChip({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 20px', flex: 1,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 13,
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: `1px solid ${color}25`,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ position: 'relative', width: 8, height: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: active ? '#10b981' : '#94a3b8',
        }} />
        {active && (
          <div style={{
            position: 'absolute', inset: -2, borderRadius: '50%',
            border: '1.5px solid #10b981', opacity: 0.5,
            animation: 'shule-ping 1.8s ease-out infinite',
          }} />
        )}
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: active ? 'var(--success)' : 'var(--txt3)',
      }}>
        {active ? 'Active' : 'No Login'}
      </span>
    </div>
  )
}

// ── User row card ──────────────────────────────────────────────────────────
function UserCard({
  row, actionId,
  onActivate, onReset, onConfirmActivated,
}: {
  row: UserRow
  actionId: string | null
  onActivate:          (r: UserRow) => void
  onReset:             (r: UserRow) => void
  onConfirmActivated:  (r: UserRow) => void
}) {
  const [hovered, setHovered] = useState(false)
  const meta   = roleMeta(row.role)
  const busy   = actionId === row.staffId
  const active = !!row.authUserId

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--surface2)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      {/* Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 13, flexShrink: 0,
          background: `linear-gradient(135deg, ${meta.color}cc 0%, ${meta.color}88 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
          boxShadow: `0 4px 12px ${meta.color}30`,
        }}>
          {initials(row.name)}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--txt)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {row.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 99,
              background: meta.bg,
              fontSize: 10, fontWeight: 800, color: meta.color,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
              {meta.label}
            </span>
            {!row.isActive && (
              <span style={{
                padding: '2px 7px', borderRadius: 99,
                background: 'rgba(148,163,184,0.12)',
                fontSize: 10, fontWeight: 700, color: 'var(--txt3)',
              }}>
                Deactivated
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <StatusBadge active={active} />

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center',
        opacity: hovered || busy ? 1 : 0.45,
        transition: 'opacity 0.2s',
      }}>
        {!active ? (
          <>
            <button
              disabled={busy}
              onClick={() => onActivate(row)}
              style={{
                padding: '7px 16px', borderRadius: 9,
                background: busy ? 'var(--surface2)' : 'var(--brand)',
                color: busy ? 'var(--txt3)' : '#fff',
                border: 'none', fontWeight: 700, fontSize: 12,
                cursor: busy ? 'default' : 'pointer',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {busy ? 'Activating…' : 'Activate Login'}
            </button>
            <button
              disabled={busy}
              onClick={() => onConfirmActivated(row)}
              style={{
                padding: '7px 14px', borderRadius: 9,
                background: 'transparent',
                border: '1px solid var(--info)',
                color: 'var(--info)', fontWeight: 700, fontSize: 12,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              Link Existing
            </button>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={() => onReset(row)}
            style={{
              padding: '7px 16px', borderRadius: 9,
              background: 'transparent',
              border: `1px solid ${hovered ? 'var(--warning)' : 'var(--border)'}`,
              color: hovered ? 'var(--warning)' : 'var(--txt2)',
              fontWeight: 700, fontSize: 12,
              cursor: busy ? 'default' : 'pointer',
              transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
          >
            {busy ? 'Resetting…' : 'Reset Password'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Link modal ─────────────────────────────────────────────────────────────
function LinkModal({ target, onClose, onLink, isPending }: {
  target:    UserRow
  onClose:   () => void
  onLink:    (authUserId: string) => Promise<void>
  isPending: boolean
}) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')
  const meta = roleMeta(target.role)

  async function submit() {
    if (!val.trim()) return
    setErr('')
    try {
      await onLink(val.trim())
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to link account')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: 32,
        width: 460, maxWidth: '90vw',
        border: '1px solid var(--border)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}88)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
            boxShadow: `0 4px 14px ${meta.color}30`,
          }}>
            {initials(target.name)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
              Link Existing Account
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>{target.name}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface2)', borderRadius: 12,
          padding: '12px 16px', marginBottom: 20,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--txt)' }}>How to find the UUID:</strong><br />
            Supabase Dashboard → Authentication → Users → copy the UUID from the user's row.
          </div>
        </div>

        <input
          className="sui-input"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void submit() }}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          style={{ width: '100%', marginBottom: 12, fontFamily: 'var(--font3)', fontSize: 12 }}
          autoFocus
        />

        {err && (
          <div style={{
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
            color: 'var(--danger)', padding: '10px 14px',
            borderRadius: 10, fontSize: 13, marginBottom: 16,
          }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px', borderRadius: 10,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            disabled={!val.trim() || isPending}
            onClick={() => void submit()}
            style={{
              padding: '9px 22px', borderRadius: 10,
              background: val.trim() && !isPending ? 'var(--brand)' : 'var(--surface2)',
              color: val.trim() && !isPending ? '#fff' : 'var(--txt3)',
              border: 'none', fontWeight: 700, fontSize: 13,
              cursor: val.trim() && !isPending ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            {isPending ? 'Linking…' : 'Link Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════
const ALL_ROLES = ['principal','deputy','dos','secretary','bursar','class_teacher','teacher','it_admin']

export function AdminUsersPage() {
  const { data = [], isLoading } = useUserManagement()
  const activateLogin = useActivateStaffLogin()
  const resetPassword = useResetStaffPassword()
  const linkAuth      = useLinkAuthUser()
  const { success: ok, error: err } = useToast()

  const [search,        setSearch]        = useState('')
  const [roleFilter,    setRoleFilter]    = useState<string | null>(null)
  const [creds,         setCreds]         = useState<{ email: string; tempPassword: string; manual: boolean } | null>(null)
  const [actionId,      setActionId]      = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<UserRow | null>(null)

  const rows = useMemo(() => {
    let r = data
    if (roleFilter)    r = r.filter(u => u.role === roleFilter)
    if (search.trim()) r = r.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
    )
    return r
  }, [data, search, roleFilter])

  const totalActive   = data.filter(u => !!u.authUserId).length
  const totalInactive = data.filter(u => !u.authUserId).length

  async function handleActivate(row: UserRow) {
    setActionId(row.staffId)
    try {
      const result = await activateLogin.mutateAsync(row.staffId)
      setCreds(result)
      ok('Login activated.')
    } catch (e: unknown) {
      err(e instanceof Error ? e.message : 'Activation failed')
    } finally { setActionId(null) }
  }

  async function handleReset(row: UserRow) {
    if (!row.authUserId || !row.name) return
    setActionId(row.staffId)
    try {
      const result = await resetPassword.mutateAsync({
        authUserId: row.authUserId, staffId: row.staffId, email: '', name: row.name,
      })
      setCreds({ email: '(unchanged)', ...result })
      ok('Password reset.')
    } catch (e: unknown) {
      err(e instanceof Error ? e.message : 'Reset failed')
    } finally { setActionId(null) }
  }

  return (
    <>
      <style>{`
        @keyframes shule-ping {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      <div className="sui-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── Hero Band ── */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
          borderRadius: 18, padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(139,92,246,0.35)',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, left: '35%', width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/>
                </svg>
              </div>
              <div>
                <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: '#fff', margin: 0, letterSpacing: -0.5 }}>
                  User Management
                </h1>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>
                  Activate logins and manage staff accounts
                </p>
              </div>
            </div>

            {/* Hero stat chips */}
            {!isLoading && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Staff', value: data.length, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
                  { label: 'Active Logins', value: totalActive, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> },
                  { label: 'Pending', value: totalInactive, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
                ].map(chip => (
                  <div key={chip.label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'rgba(255,255,255,0.15)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 12, padding: '10px 16px',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9,
                      background: 'rgba(255,255,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {chip.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1, fontFamily: 'var(--font2)' }}>{chip.value}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontWeight: 600 }}>{chip.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Credential banner */}
        {creds && <CredentialBanner {...creds} onDismiss={() => setCreds(null)} />}

        {/* KPI strip */}
        {!isLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KpiChip
              label="Total Staff"
              value={data.length}
              color="var(--brand)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>}
            />
            <KpiChip
              label="Active Logins"
              value={totalActive}
              color="var(--success)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>}
            />
            <KpiChip
              label="Pending Activation"
              value={totalInactive}
              color="var(--warning)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
            />
          </div>
        )}

        {/* Search + role filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
            <svg
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="sui-input"
              placeholder="Search staff…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 34, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setRoleFilter(null)}
              style={{
                padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                background: !roleFilter ? 'var(--brand)' : 'var(--surface2)',
                color: !roleFilter ? '#fff' : 'var(--txt2)',
                border: !roleFilter ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              All
            </button>
            {ALL_ROLES.filter(r => data.some(u => u.role === r)).map(r => {
              const m      = roleMeta(r)
              const active = roleFilter === r
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(active ? null : r)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    background: active ? m.bg : 'var(--surface2)',
                    color: active ? m.color : 'var(--txt2)',
                    border: active ? `1px solid ${m.color}50` : '1px solid var(--border)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto auto',
              gap: 16, padding: '10px 20px',
              background: 'var(--surface2)',
              borderBottom: '1px solid var(--border)',
            }}>
              {['Staff Member', 'Status', 'Actions'].map(h => (
                <div key={h} style={{
                  fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>
                  {h}
                </div>
              ))}
            </div>

            {rows.length === 0 ? (
              <div style={{
                padding: '56px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16,
                  background: 'var(--surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/>
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>No staff found</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                  {search || roleFilter ? 'Try a different search or filter.' : 'No staff have been registered yet.'}
                </div>
              </div>
            ) : (
              rows.map(row => (
                <UserCard
                  key={row.staffId}
                  row={row}
                  actionId={actionId}
                  onActivate={handleActivate}
                  onReset={handleReset}
                  onConfirmActivated={r => setConfirmTarget(r)}
                />
              ))
            )}

            {rows.length > 0 && (
              <div style={{
                padding: '10px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 600 }}>
                  {rows.length} staff member{rows.length !== 1 ? 's' : ''}
                  {roleFilter ? ` · ${roleMeta(roleFilter).label}` : ''}
                </span>
                <span style={{ fontSize: 11, color: 'var(--txt3)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{totalActive}</span> active ·{' '}
                  <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{totalInactive}</span> pending
                </span>
              </div>
            )}
          </div>
        )}

        {/* Link modal */}
        {confirmTarget && (
          <LinkModal
            target={confirmTarget}
            onClose={() => setConfirmTarget(null)}
            isPending={linkAuth.isPending}
            onLink={async (authUserId) => {
              await linkAuth.mutateAsync({ staffId: confirmTarget.staffId, authUserId })
              ok(`${confirmTarget.name}'s account linked successfully.`)
              setConfirmTarget(null)
            }}
          />
        )}
      </div>
    </>
  )
}
