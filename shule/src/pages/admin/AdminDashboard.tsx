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
function KpiCard({ label, value, sub, danger }: {
  label: string
  value: string | number
  sub?: string
  danger?: boolean
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: `1px solid ${danger ? 'var(--danger)' : 'var(--border)'}`,
      borderRadius: 14, padding: '16px 20px', minWidth: 140,
    }}>
      <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)',
        color: danger ? 'var(--danger)' : 'var(--txt)',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
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
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <KpiCard label="Total Users"       value={kpis.totalUsers} />
        <KpiCard label="Active Today"      value={kpis.activeToday} />
        <KpiCard label="Browser Storage"   value={`${kpis.storageUsedMb} MB`} sub="IndexedDB estimate" />
        <KpiCard
          label="Sync Queue Pending"
          value={kpis.syncQueuePending}
          danger={kpis.syncQueuePending > 0}
          sub={kpis.syncQueuePending > 0 ? 'Waiting to sync' : 'All clear'}
        />
        <KpiCard
          label="Sync Queue Failed"
          value={kpis.syncQueueFailed}
          danger={kpis.syncQueueFailed > 0}
          sub={kpis.syncQueueFailed > 0 ? 'Manual review needed' : 'All clear'}
        />
      </div>

      {/* Storage per bucket */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--txt)' }}>
          Storage Buckets
        </div>
        {bucketsLoading ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>Listing buckets…</div>
        ) : buckets.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No storage buckets found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Bucket', 'Files', 'Size (MB)'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 11, color: 'var(--txt2)', textAlign: 'left',
                    textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.name} className="sui-tr">
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--font3)', fontSize: 13, color: 'var(--txt)' }}>
                    {b.name}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 13 }}>
                    {b.fileCount}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--brand)', fontWeight: 700, fontSize: 13, fontFamily: 'var(--font3)' }}>
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
  const listRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count:            users.length,
    getScrollElement: () => listRef.current,
    estimateSize:     () => 52,
    overscan:         5,
  })

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
      {isLoading && <div style={{ color: 'var(--txt3)' }}>Loading users…</div>}

      <div
        ref={listRef}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, overflow: 'auto', maxHeight: 480,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr>
              {['Name', 'Role', 'Last Login', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px 12px', background: 'var(--surface2)',
                  fontWeight: 700, fontSize: 12, color: 'var(--txt2)', textAlign: 'left',
                  whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map(vr => {
              const u = users[vr.index]
              return (
                <tr
                  key={u.staffId}
                  className="sui-tr"
                  style={{ height: vr.size, transform: `translateY(${vr.start}px)` }}
                >
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--txt)' }}>{u.name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'var(--brand-light)', color: 'var(--brand)',
                      textTransform: 'capitalize',
                    }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--txt2)', fontSize: 12 }}>
                    {u.lastLogin
                      ? new Date(u.lastLogin).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })
                      : 'Never'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: u.isActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                      color: u.isActive ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
                    {u.authUserId && (
                      <button
                        onClick={() => { setResetTarget(u); setResetDone(false); setResetError('') }}
                        className="sui-btn-outline"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        Reset Pwd
                      </button>
                    )}
                    <button
                      onClick={() => toggleActive({ staffId: u.staffId, isActive: !u.isActive })}
                      className="sui-btn-outline"
                      style={{ fontSize: 11, padding: '4px 10px',
                        color: u.isActive ? 'var(--warning)' : 'var(--success)',
                        borderColor: u.isActive ? 'var(--warning)' : 'var(--success)' }}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(u); setDeleteTyped(''); setDeleteError('') }}
                      className="sui-btn-outline"
                      style={{ fontSize: 11, padding: '4px 10px',
                        color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delete User Modal */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{ background: 'var(--surface)', borderRadius: 20, padding: 28, width: 420 }}>
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 28, width: 400,
          }}>
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
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16, color: 'var(--txt)' }}>
          School Profile
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
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--txt)' }}>
          Communication APIs
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
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 20,
      }}>
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
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 32,
            maxWidth: 480, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          }}>
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
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22,
          color: 'var(--txt)', margin: 0,
        }}>
          IT Administration
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          System health, user management, and school configuration.
        </div>
      </div>

      <Tabs.Root defaultValue="kpis">
        <Tabs.List style={{
          display: 'flex', gap: 4, borderBottom: '2px solid var(--border)', marginBottom: 24,
        }}>
          {[
            { value: 'kpis',     label: 'System KPIs' },
            { value: 'users',    label: 'User Management' },
            { value: 'settings', label: 'School Settings' },
          ].map(tab => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              style={{
                padding: '8px 18px', border: 'none', background: 'none',
                cursor: 'pointer', fontWeight: 700, fontSize: 13,
                color: 'var(--txt2)', borderRadius: '8px 8px 0 0',
              }}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="kpis">     <SystemKpisSection />      </Tabs.Content>
        <Tabs.Content value="users">    <UserManagementSection />   </Tabs.Content>
        <Tabs.Content value="settings"> <SchoolSettingsSection />   </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
