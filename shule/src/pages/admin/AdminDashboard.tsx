import { useState, useRef } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useSystemKpis,
  useStorageBuckets,
  useUserManagement,
  useResetPassword,
  useDeactivateUser,
  useDeleteUser,
  useSchoolSettings,
  useSaveSchoolSettings,
  useSaveApiConfig,
  useApiConfigStatus,
  useAcademicYears,
  useToggleSurvey,
  usePromoteStudents,
} from '../../hooks/useAdmin'
import type { UserRow } from '../../types/week9'

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accent = 'brand', icon }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'brand' | 'danger' | 'warning' | 'info' | 'success' | 'violet'
  icon?: React.ReactNode
}) {
  return (
    <div className={`sui-kpi-v2 sui-kpi-accent-${accent}`} style={{ flex: 1, minWidth: 140 }}>
      {icon && <div className={`sui-kpi-icon sui-kpi-icon-${accent}`}>{icon}</div>}
      <div className="sui-kpi-label">{label}</div>
      <div className="sui-kpi-num sui-count-reveal">{value}</div>
      {sub && <div className="sui-kpi-sub">{sub}</div>}
    </div>
  )
}

// ─── SECTION 1 — System KPIs ─────────────────────────────────────────────
function SystemKpisSection() {
  const { data: kpis, isLoading } = useSystemKpis()
  const { data: buckets = [], isLoading: bucketsLoading } = useStorageBuckets()

  if (isLoading) return <div style={{ color: 'var(--txt3)' }}>Loading system data…</div>
  if (!kpis) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="stagger-cards" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard
          label="Total Users" value={kpis.totalUsers} accent="brand"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="7" cy="7" r="3"/><path d="M1 18a6 6 0 0112 0"/><circle cx="15" cy="5" r="2.5"/><path d="M18 16a4 4 0 00-7.2-2.4"/></svg>}
        />
        <KpiCard
          label="Active Today" value={kpis.activeToday} accent="success"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4"/></svg>}
        />
        <KpiCard
          label="Browser Storage" value={`${kpis.storageUsedMb} MB`} sub="IndexedDB estimate" accent="info"
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><ellipse cx="10" cy="6" rx="7" ry="3"/><path d="M3 6v4c0 1.66 3.13 3 7 3s7-1.34 7-3V6"/><path d="M3 10v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4"/></svg>}
        />
        <KpiCard
          label="Sync Pending"
          value={kpis.syncQueuePending}
          accent={kpis.syncQueuePending > 0 ? 'warning' : 'success'}
          sub={kpis.syncQueuePending > 0 ? 'Waiting to sync' : 'All clear'}
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4v5h5M16 16v-5h-5"/><path d="M4 9a8 8 0 018-5 8 8 0 016.93 4M16 11a8 8 0 01-8 5 8 8 0 01-6.93-4"/></svg>}
        />
        <KpiCard
          label="Sync Failed"
          value={kpis.syncQueueFailed}
          accent={kpis.syncQueueFailed > 0 ? 'danger' : 'success'}
          sub={kpis.syncQueueFailed > 0 ? 'Manual review needed' : 'All clear'}
          icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 14h.01"/></svg>}
        />
      </div>

      {/* Storage per bucket */}
      <div className="sui-glass-panel sui-table-head-sticky">
        <div className="sui-glass-panel-header">
          <span style={{ fontFamily: 'var(--font2)', fontSize: 14, fontWeight: 800, color: 'var(--txt)' }}>Storage Buckets</span>
        </div>
        {bucketsLoading ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Listing buckets…</div>
        ) : buckets.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No storage buckets found.</div>
        ) : (
          <table className="dtable" style={{ width: '100%' }}>
            <thead>
              <tr>
                {['Bucket', 'Files', 'Size (MB)'].map(h => (
                  <th key={h} className="sui-th" style={{ background: 'var(--surface2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.name} className="sui-tr">
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', fontSize: 13 }}>
                    {b.name}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 13 }}>{b.fileCount}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--brand)', fontWeight: 700, fontFamily: 'var(--font3)', fontSize: 13 }}>
                    {b.sizeMb} MB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── SECTION 2 — User Management ─────────────────────────────────────────
// Role colours shared within the dashboard section
const UM_ROLE: Record<string, { label: string; color: string; bg: string }> = {
  principal:     { label: 'Principal',       color: '#0d9488', bg: 'rgba(13,148,136,0.12)'  },
  deputy:        { label: 'Deputy',           color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  dos:           { label: 'Dir. of Studies',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)'  },
  secretary:     { label: 'Secretary',        color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  bursar:        { label: 'Bursar',           color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  class_teacher: { label: 'Class Teacher',    color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'   },
  teacher:       { label: 'Teacher',          color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'   },
  it_admin:      { label: 'IT Admin',         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}
function umRole(r: string) { return UM_ROLE[r] ?? { label: r, color: 'var(--txt2)', bg: 'var(--surface2)' } }
function umInitials(name: string) { return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') }

function UserManagementSection() {
  const { data: users = [], isLoading } = useUserManagement()
  const { mutateAsync: resetPwd,    isPending: resetting } = useResetPassword()
  const { mutateAsync: toggleActive }                      = useDeactivateUser()
  const { mutateAsync: deleteUser,  isPending: deleting }  = useDeleteUser()
  const [resetTarget,  setResetTarget]  = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)
  const [deleteTyped,  setDeleteTyped]  = useState('')
  const [deleteError,  setDeleteError]  = useState('')
  const [resetDone,    setResetDone]    = useState(false)
  const [resetError,   setResetError]   = useState('')
  const [search,       setSearch]       = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = search.trim()
    ? users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.role.includes(search.toLowerCase()))
    : users

  const rowVirtualizer = useVirtualizer({
    count:            filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize:     () => 64,
    overscan:         5,
  })

  const totalActive   = users.filter(u => u.isActive).length
  const totalInactive = users.filter(u => !u.isActive).length

  async function handleReset() {
    if (!resetTarget?.authUserId) return
    setResetError('')
    try {
      await resetPwd(resetTarget.authUserId)
      setResetDone(true)
    } catch (err: any) {
      setResetError(err.message ?? 'Reset failed')
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteTyped !== 'DELETE') return
    setDeleteError('')
    try {
      await deleteUser({ staffId: deleteTarget.staffId, authUserId: deleteTarget.authUserId })
      setDeleteTarget(null)
      setDeleteTyped('')
    } catch (err: any) {
      setDeleteError(err.message ?? 'Delete failed')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI strip */}
      {!isLoading && (
        <div className="mob-grid-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: 'Total Staff',  value: users.length,    color: '#0d9488' },
            { label: 'Active',       value: totalActive,     color: '#10b981' },
            { label: 'Inactive',     value: totalInactive,   color: '#f43f5e' },
          ].map(k => (
            <div key={k.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--surface2)', borderRadius: 12,
              padding: '12px 16px', border: '1px solid var(--border)',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: `${k.color}18`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: k.color }} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 2, fontWeight: 600 }}>{k.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320 }}>
        <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input className="sui-input" placeholder="Search staff…" value={search}
          onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
      </div>

      {isLoading && <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Loading users…</div>}

      {/* Premium card list */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 90px 260px',
          padding: '9px 16px', background: 'var(--surface2)',
          borderBottom: '1px solid var(--border)',
        }}>
          {['Staff Member', 'Last Login', 'Status', 'Actions'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{h}</div>
          ))}
        </div>

        <div ref={listRef} style={{ overflowY: 'auto', maxHeight: 440, position: 'relative' }}>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(vr => {
              const u = users[vr.index] // use original `users` since virtualizer uses that count
              if (!u) return null
              // Skip if filtered out
              if (filtered.indexOf(u) === -1 && search.trim()) return null
              const meta = umRole(u.role)
              return (
                <div
                  key={u.staffId}
                  style={{
                    position: 'absolute', top: 0, left: 0, right: 0,
                    height: vr.size, transform: `translateY(${vr.start}px)`,
                    display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 110px 90px 260px',
                    alignItems: 'center', padding: '0 16px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {/* Identity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                      background: `linear-gradient(135deg, ${meta.color}cc, ${meta.color}77)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
                      boxShadow: `0 3px 10px ${meta.color}28`,
                    }}>
                      {umInitials(u.name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.name}
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3,
                        padding: '1px 7px', borderRadius: 99,
                        background: meta.bg, fontSize: 9, fontWeight: 800,
                        color: meta.color, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
                        {meta.label}
                      </span>
                    </div>
                  </div>

                  {/* Last login */}
                  <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--font3)' }}>
                    {u.lastLogin
                      ? new Date(u.lastLogin).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : <span style={{ color: 'var(--txt3)', fontStyle: 'italic' }}>Never</span>}
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: u.isActive ? '#10b981' : '#f43f5e',
                      boxShadow: u.isActive ? '0 0 0 2px rgba(16,185,129,0.2)' : '0 0 0 2px rgba(244,63,94,0.2)',
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: u.isActive ? 'var(--success)' : 'var(--danger)' }}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {u.authUserId && (
                      <button
                        onClick={() => { setResetTarget(u); setResetDone(false); setResetError('') }}
                        style={{
                          padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--txt2)', cursor: 'pointer',
                        }}
                      >
                        Reset Pwd
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive({ staffId: u.staffId, isActive: !u.isActive })}
                      style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                        border: `1px solid ${u.isActive ? 'rgba(245,158,11,0.4)' : 'rgba(16,185,129,0.4)'}`,
                        background: u.isActive ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                        color: u.isActive ? 'var(--warning)' : 'var(--success)', cursor: 'pointer',
                      }}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(u); setDeleteTyped(''); setDeleteError('') }}
                      style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 10, fontWeight: 700,
                        border: '1px solid rgba(244,63,94,0.3)', background: 'rgba(244,63,94,0.06)',
                        color: 'var(--danger)', cursor: 'pointer',
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{
            padding: '9px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, color: 'var(--txt3)', fontWeight: 600,
          }}>
            <span>{filtered.length} staff member{filtered.length !== 1 ? 's' : ''}</span>
            <span>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{totalActive}</span> active ·{' '}
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{totalInactive}</span> inactive
            </span>
          </div>
        )}
      </div>

      {/* Delete User Modal */}
      {deleteTarget && (
        <div
          className="sui-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'var(--modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
        >
          <div
            className="sui-modal-dialog"
            style={{
              background: 'var(--modal-bg)', borderRadius: 20, padding: 28, width: 420,
              border: '1px solid var(--modal-border)',
              borderTop: '1px solid var(--modal-border-t)',
              backdropFilter: 'blur(24px)', boxShadow: 'var(--modal-shadow)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, marginTop: 0, color: 'var(--danger)' }}>
              Delete User Account
            </h3>
            <p style={{ color: 'var(--txt2)', fontSize: 13, lineHeight: 1.5 }}>
              This will permanently remove <strong>{deleteTarget.name}</strong>'s staff record and revoke their login access.
              This action cannot be undone.
            </p>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 8 }}>
              Type <code style={{ fontFamily: 'var(--font3)', background: 'var(--danger-bg)', color: 'var(--danger)', padding: '1px 5px', borderRadius: 4 }}>DELETE</code> to confirm:
            </p>
            <input
              value={deleteTyped}
              onChange={e => setDeleteTyped(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="sui-input"
              style={{ width: '100%', marginBottom: 12 }}
              autoFocus
            />
            {deleteError && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)',
                padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteTarget(null)} className="sui-btn-outline">Cancel</button>
              <button
                onClick={() => { void handleDelete() }}
                disabled={deleteTyped !== 'DELETE' || deleting}
                style={{
                  padding: '8px 18px', border: 'none', borderRadius: 10,
                  background: deleteTyped === 'DELETE' ? 'var(--danger)' : 'var(--surface2)',
                  color: deleteTyped === 'DELETE' ? '#fff' : 'var(--txt3)',
                  fontWeight: 700, fontSize: 13, cursor: deleteTyped === 'DELETE' ? 'pointer' : 'default',
                  fontFamily: 'var(--font2)',
                }}
              >
                {deleting ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div
          className="sui-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'var(--modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) setResetTarget(null) }}
        >
          <div
            className="sui-modal-dialog"
            style={{
              background: 'var(--modal-bg)', borderRadius: 20, padding: 28, width: 400,
              border: '1px solid var(--modal-border)',
              borderTop: '1px solid var(--modal-border-t)',
              backdropFilter: 'blur(24px)', boxShadow: 'var(--modal-shadow)',
            }}
          >
            <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16, marginTop: 0 }}>
              Reset Password
            </h3>
            {resetDone ? (
              <>
                <div style={{
                  background: 'var(--success-bg)', color: 'var(--success)',
                  padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16,
                }}>
                  Password reset to <strong>Shule@2025</strong>. The staff member must change it on next login.
                </div>
                <button onClick={() => setResetTarget(null)} className="sui-btn-primary">Done</button>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--txt2)', fontSize: 13 }}>
                  Reset password for <strong>{resetTarget.name}</strong> to the temporary password{' '}
                  <code style={{ fontFamily: 'var(--font3)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 4 }}>
                    Shule@2025
                  </code>
                  ?
                </p>
                {resetError && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)',
                    padding: '8px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
                    {resetError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setResetTarget(null)} className="sui-btn-outline">Cancel</button>
                  <button
                    onClick={() => { void handleReset() }}
                    disabled={resetting}
                    className="sui-btn-primary"
                  >
                    {resetting ? 'Resetting…' : 'Reset Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SECTION 3 — School Settings ─────────────────────────────────────────
function SchoolSettingsSection() {
  const { data: settings, isLoading } = useSchoolSettings()
  const { data: apiStatus } = useApiConfigStatus()
  const { data: academicYears = [] } = useAcademicYears()
  const { mutateAsync: saveSettings, isPending: savingSettings } = useSaveSchoolSettings()
  const { mutateAsync: saveApiKey, isPending: savingKey } = useSaveApiConfig()
  const { mutateAsync: toggleSurvey } = useToggleSurvey()
  const { mutateAsync: promoteStudents, isPending: isPromoting } = usePromoteStudents()
  const [showPromoteModal, setShowPromoteModal]       = useState(false)
  const [promoteConfirmText, setPromoteConfirmText]   = useState('')
  const [promoteProgress, setPromoteProgress]         = useState<{ current: number; total: number } | null>(null)
  const [promoteResult, setPromoteResult]             = useState<{ promoted: number; completed: number; total: number } | null>(null)
  const [promoteErr, setPromoteErr]                   = useState('')

  const [form, setForm] = useState({ schoolName: '', shortName: '', motto: '', primaryColor: '#0d9488' })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [atKey, setAtKey] = useState('')
  const [waToken, setWaToken] = useState('')
  const [savedKeys, setSavedKeys] = useState<{ at: boolean; wa: boolean }>({ at: false, wa: false })

  // Populate form from fetched settings
  const hasPopulated = useRef(false)
  if (settings && !hasPopulated.current) {
    setForm({
      schoolName:   settings.schoolName,
      shortName:    settings.shortName ?? '',
      motto:        settings.motto ?? '',
      primaryColor: settings.primaryColor,
    })
    hasPopulated.current = true
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    await saveSettings({
      schoolName:   form.schoolName,
      shortName:    form.shortName,
      motto:        form.motto,
      primaryColor: form.primaryColor,
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 3000)
  }

  async function handleSaveAtKey() {
    if (!atKey.trim()) return
    await saveApiKey({ keyName: 'at_api_key', keyValue: atKey, enabled: true })
    setAtKey('')
    setSavedKeys(s => ({ ...s, at: true }))
  }

  async function handleSaveWaToken() {
    if (!waToken.trim()) return
    await saveApiKey({ keyName: 'wa_access_token', keyValue: waToken, enabled: true })
    setWaToken('')
    setSavedKeys(s => ({ ...s, wa: true }))
  }

  if (isLoading) return <div style={{ color: 'var(--txt3)' }}>Loading settings…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* School Profile */}
      <div className="sui-glass-panel" style={{ padding: 20 }}>
        <div className="sui-section-head">
          <span className="sui-section-title">School Profile</span>
        </div>
        <form onSubmit={e => { void handleSaveSettings(e) }}
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              School Name
            </label>
            <input
              value={form.schoolName}
              onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Short Name
            </label>
            <input
              value={form.shortName}
              onChange={e => setForm(f => ({ ...f, shortName: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Motto
            </label>
            <input
              value={form.motto}
              onChange={e => setForm(f => ({ ...f, motto: e.target.value }))}
              className="sui-input"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Brand Colour
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                style={{ width: 40, height: 36, border: '1px solid var(--border)', borderRadius: 8, padding: 2, cursor: 'pointer' }}
              />
              <input
                value={form.primaryColor}
                onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))}
                className="sui-input"
                style={{ width: 100, fontFamily: 'var(--font3)' }}
                maxLength={7}
              />
              {/* Live preview */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: form.primaryColor, flexShrink: 0,
                  border: '2px solid rgba(0,0,0,0.1)',
                }} />
                <button
                  type="button"
                  style={{
                    padding: '4px 12px', border: 'none', borderRadius: 20,
                    background: form.primaryColor, color: '#fff',
                    fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12, cursor: 'default',
                  }}
                >
                  Preview
                </button>
                <div style={{
                  padding: '4px 10px', borderRadius: 20,
                  background: form.primaryColor + '18',
                  color: form.primaryColor,
                  fontFamily: 'var(--font2)', fontWeight: 700, fontSize: 12,
                  border: `1.5px solid ${form.primaryColor}40`,
                }}>
                  Active
                </div>
              </div>
            </div>
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="submit" disabled={savingSettings} className="sui-btn-primary">
              {savingSettings ? 'Saving…' : 'Save Profile'}
            </button>
            {settingsSaved && (
              <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>
                Saved!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Communication APIs */}
      <div className="sui-glass-panel" style={{ padding: 20 }}>
        <div className="sui-section-head" style={{ marginBottom: 4 }}>
          <span className="sui-section-title">Communication APIs</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16, fontWeight: 600 }}>
          API keys are encrypted and stored securely. They will never be shown after saving.
        </div>

        {/* Africa's Talking */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>Africa's Talking</div>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: apiStatus?.atEnabled ? 'var(--success-bg)' : 'var(--surface2)',
              color: apiStatus?.atEnabled ? 'var(--success)' : 'var(--txt3)',
            }}>
              {apiStatus?.atEnabled ? 'Enabled' : savedKeys.at ? 'Configured' : 'Not configured'}
            </span>
          </div>
          {savedKeys.at ? (
            <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              API key saved securely.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={atKey}
                onChange={e => setAtKey(e.target.value)}
                placeholder="Enter Africa's Talking API key…"
                className="sui-input"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => { void handleSaveAtKey() }}
                disabled={savingKey || !atKey.trim()}
                className="sui-btn-primary"
              >
                Save Key
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp Cloud API */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>WhatsApp Cloud API</div>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: apiStatus?.waEnabled ? 'var(--success-bg)' : 'var(--surface2)',
              color: apiStatus?.waEnabled ? 'var(--success)' : 'var(--txt3)',
            }}>
              {apiStatus?.waEnabled ? 'Enabled' : savedKeys.wa ? 'Configured' : 'Not configured'}
            </span>
          </div>
          {savedKeys.wa ? (
            <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
              Access token saved securely.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={waToken}
                onChange={e => setWaToken(e.target.value)}
                placeholder="Enter WhatsApp Cloud API access token…"
                className="sui-input"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => { void handleSaveWaToken() }}
                disabled={savingKey || !waToken.trim()}
                className="sui-btn-primary"
              >
                Save Token
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Academic Years + Survey Toggle + Promote */}
      <div className="sui-glass-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>Academic Years</div>
          <button
            onClick={() => { setPromoteConfirmText(''); setPromoteResult(null); setPromoteErr(''); setShowPromoteModal(true) }}
            className="sui-btn-outline"
            style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            Promote All Students
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Year', 'Active', 'Survey', 'Toggle Survey'].map(h => (
                <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {academicYears.map((yr: any) => (
              <tr key={yr.id} className="sui-tr">
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{yr.name}</td>
                <td style={{ padding: '8px 12px' }}>
                  {yr.is_active ? (
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 12 }}>Current</span>
                  ) : (
                    <span style={{ color: 'var(--txt3)', fontSize: 12 }}>Past</span>
                  )}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    background: yr.survey_active ? 'var(--violet-bg)' : 'var(--surface2)',
                    color: yr.survey_active ? 'var(--violet)' : 'var(--txt3)',
                  }}>
                    {yr.survey_active ? 'Open' : 'Closed'}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <button
                    onClick={() => toggleSurvey({ yearId: yr.id, active: !yr.survey_active })}
                    className="sui-btn-outline"
                    style={{ fontSize: 11, padding: '4px 10px',
                      color: yr.survey_active ? 'var(--danger)' : 'var(--success)',
                      borderColor: yr.survey_active ? 'var(--danger)' : 'var(--success)' }}
                  >
                    {yr.survey_active ? 'Close Survey' : 'Open Survey'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Promote Students Modal */}
      {showPromoteModal && (
        <div
          className="sui-overlay"
          style={{
            position: 'fixed', inset: 0, background: 'var(--modal-overlay)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowPromoteModal(false) }}
        >
          <div
            className="sui-modal-dialog"
            style={{
              background: 'var(--modal-bg)', borderRadius: 20, padding: 32,
              maxWidth: 480, width: '100%',
              border: '1px solid var(--modal-border)',
              borderTop: '1px solid var(--modal-border-t)',
              backdropFilter: 'blur(24px)', boxShadow: 'var(--modal-shadow)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', margin: '0 0 12px' }}>
              Promote All Students
            </h2>
            {promoteResult ? (
              <div>
                <div style={{
                  padding: '12px 16px', background: 'var(--success-bg)', borderRadius: 10,
                  border: '1px solid var(--success)', fontSize: 14, color: 'var(--success)',
                  fontWeight: 600, marginBottom: 16,
                }}>
                  Promotion complete: {promoteResult.promoted} promoted, {promoteResult.completed} marked as completed.
                </div>
                <button
                  onClick={() => setShowPromoteModal(false)}
                  className="sui-btn-outline"
                  style={{ width: '100%' }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16, lineHeight: 1.6 }}>
                  This will promote all active students to the next class. S.4 and S.6 students will be marked as Completed.
                  This cannot be undone. Type <strong>PROMOTE</strong> to confirm.
                </p>
                {promoteProgress && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 4 }}>
                      Promoting student {promoteProgress.current} of {promoteProgress.total}…
                    </div>
                    <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', background: 'var(--brand)',
                        width: `${Math.round((promoteProgress.current / promoteProgress.total) * 100)}%`,
                        transition: 'width 0.2s',
                      }} />
                    </div>
                  </div>
                )}
                <input
                  value={promoteConfirmText}
                  onChange={e => setPromoteConfirmText(e.target.value)}
                  placeholder="Type PROMOTE"
                  className="sui-input"
                  style={{ width: '100%', marginBottom: 12 }}
                />
                {promoteErr && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{promoteErr}</div>}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="sui-btn-outline" onClick={() => setShowPromoteModal(false)}>Cancel</button>
                  <button
                    disabled={promoteConfirmText !== 'PROMOTE' || isPromoting}
                    onClick={async () => {
                      setPromoteErr('')
                      setPromoteProgress({ current: 0, total: 1 })
                      try {
                        const result = await promoteStudents((c, t) => setPromoteProgress({ current: c, total: t }))
                        setPromoteResult(result)
                      } catch (e: any) {
                        setPromoteErr(e.message ?? 'Promotion failed')
                      } finally {
                        setPromoteProgress(null)
                      }
                    }}
                    style={{
                      padding: '8px 20px',
                      background: promoteConfirmText === 'PROMOTE' ? 'var(--danger)' : 'var(--border)',
                      color: promoteConfirmText === 'PROMOTE' ? '#fff' : 'var(--txt3)',
                      border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13,
                      cursor: promoteConfirmText === 'PROMOTE' ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {isPromoting ? 'Promoting…' : 'Confirm Promote'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD — 3 Tabs
// ═══════════════════════════════════════════════════════════════════════════
export function AdminDashboard() {
  return (
    <div className="sui-page-enter stagger-sections" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero band ── */}
      <div className="sui-hero-band">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: '0 0 4px', lineHeight: 1.2 }}>
              <span className="gradient-text">IT Administration</span>
            </h1>
            <p style={{ fontSize: 13, color: 'var(--txt3)', margin: 0 }}>
              System health, user management & school configuration.
            </p>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 14px', borderRadius: 99,
            background: 'var(--info-bg)', color: 'var(--info)',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)', whiteSpace: 'nowrap',
          }}>
            <svg width={12} height={12} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="10" cy="10" r="8"/><path d="M10 6v4M10 14h.01"/>
            </svg>
            Admin Only
          </div>
        </div>
      </div>

      <Tabs.Root defaultValue="kpis">
        <Tabs.List asChild>
          <div className="sui-tab-list-pill" style={{ marginBottom: 24 }}>
            {[
              { value: 'kpis',     label: 'System KPIs' },
              { value: 'users',    label: 'User Management' },
              { value: 'settings', label: 'School Settings' },
            ].map(tab => (
              <Tabs.Trigger key={tab.value} value={tab.value} asChild>
                <button className="sui-tab-pill">{tab.label}</button>
              </Tabs.Trigger>
            ))}
          </div>
        </Tabs.List>

        <Tabs.Content value="kpis">     <SystemKpisSection />      </Tabs.Content>
        <Tabs.Content value="users">    <UserManagementSection />   </Tabs.Content>
        <Tabs.Content value="settings"> <SchoolSettingsSection />   </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
