import { useState, useRef, useEffect, type ReactNode } from 'react'
import {
  useMyProfile,
  useUpdateProfile,
  useRequestPasswordReset,
  useUpdateProfilePhoto,
} from '../../hooks/useProfile'
import { useBandwidth } from '../../store/BandwidthContext'
import { ROLE_LABEL } from '../../config/roleNav'
import { useAuth } from '../../store/AuthContext'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { UserRole } from '../../store/AuthContext'

// ── Role → gradient colour ──────────────────────────────────────────────────
const ROLE_COLOURS: Record<string, string> = {
  principal:     '#7c3aed',
  deputy:        '#1e40af',
  dos:           '#065f46',
  secretary:     '#9a3412',
  bursar:        '#b45309',
  class_teacher: '#1e3a5f',
  teacher:       '#1e3a5f',
  student:       '#166534',
  parent:        '#831843',
  it_admin:      '#374151',
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  permanent: 'Permanent',
  contract:  'Contract',
  volunteer: 'Volunteer',
}

const QUAL_LABELS: Record<number, string> = {
  1: 'Certificate',
  2: 'Diploma',
  3: "Bachelor's Degree",
  4: 'PGDE / B.Ed.',
  5: "Master's Degree",
  6: 'PhD / Doctorate',
  7: 'Professor',
}

function formatDate(str: string): string {
  try {
    return new Date(str).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch {
    return str
  }
}

// ── Reusable row primitives ─────────────────────────────────────────────────

function InfoRow({
  label, value, last = false, mono = false,
  badge,
}: {
  label: string
  value?: string
  last?: boolean
  mono?: boolean
  badge?: ReactNode
}) {
  return (
    <div style={{
      padding: '11px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0, fontFamily: 'var(--font2)' }}>
        {label}
      </span>
      {badge ?? (
        <span style={{ fontSize: 13, color: 'var(--txt)', fontFamily: mono ? 'var(--font3)' : undefined, textAlign: 'right' }}>
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

function EditRow({ label, children, last = false }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border)' }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6, fontFamily: 'var(--font2)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function InfoCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>{title}</span>
        {action}
      </div>
      <div style={{ padding: '0 20px' }}>{children}</div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user }                                   = useAuth()
  const { data: profile, isLoading, isError }      = useMyProfile()
  const updateProfile                              = useUpdateProfile()
  const updatePhoto                                = useUpdateProfilePhoto()
  const requestPwdReset                           = useRequestPasswordReset()
  const { isLowBandwidth, toggleBandwidth }        = useBandwidth()

  const [isEditing, setIsEditing]  = useState(false)
  const [phone,     setPhone]      = useState('')
  const [email,     setEmail]      = useState('')
  const [address,   setAddress]    = useState('')
  const [saveMsg,   setSaveMsg]    = useState<{ text: string; ok: boolean } | null>(null)

  // Password reset request state
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [reqPwd,       setReqPwd]       = useState('')
  const [reqPwdConf,   setReqPwdConf]   = useState('')
  const [reqPwdErr,    setReqPwdErr]    = useState('')
  const [reqPwdSent,   setReqPwdSent]   = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // Auth email is the reliable fallback when staff.email is null
  const authEmail = user?.email ?? null

  useEffect(() => {
    if (profile) {
      setPhone(profile.phone   ?? '')
      // Pre-fill with auth email when staff table email is null
      setEmail(profile.email   ?? authEmail ?? '')
      setAddress(profile.address ?? '')
    }
  }, [profile])

  async function handleSave() {
    if (!profile) return
    try {
      await updateProfile.mutateAsync({
        phone:   phone   !== (profile.phone   ?? '') ? phone   || null : undefined,
        email:   email   !== (profile.email   ?? '') ? email   || null : undefined,
        address: address !== (profile.address ?? '') ? address || null : undefined,
      })
      setSaveMsg({ text: 'Saved successfully.', ok: true })
      setIsEditing(false)
      setTimeout(() => setSaveMsg(null), 4000)
    } catch (err: any) {
      setSaveMsg({ text: err.message, ok: false })
    }
  }

  function handleCancel() {
    if (profile) {
      setPhone(profile.phone ?? '')
      setEmail(profile.email ?? '')
      setAddress(profile.address ?? '')
    }
    setIsEditing(false)
    setSaveMsg(null)
  }

  async function handlePwdRequest() {
    setReqPwdErr('')
    if (reqPwd.length < 8)        { setReqPwdErr('Password must be at least 8 characters.'); return }
    if (reqPwd !== reqPwdConf)    { setReqPwdErr('Passwords do not match.'); return }
    if (!profile) return
    try {
      await requestPwdReset.mutateAsync({
        staffName:       `${profile.firstName} ${profile.lastName}`,
        desiredPassword: reqPwd,
      })
      setReqPwdSent(true)
      setReqPwd(''); setReqPwdConf('')
    } catch (err: any) {
      setReqPwdErr(err.message)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try { await updatePhoto.mutateAsync(file) }
    catch (err: any) { alert(`Photo upload failed: ${err.message}`) }
  }

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
      <LoadingSpinner size="md" />
    </div>
  )
  if (isError || !profile) return (
    <div style={{ color: 'var(--danger)', padding: 32, fontSize: 13 }}>
      Failed to load profile.
    </div>
  )

  const roleColour     = ROLE_COLOURS[profile.role] ?? '#374151'
  const roleLabel      = ROLE_LABEL[profile.role as UserRole] ?? profile.role
  const avatarInitials = `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase()
  const canSeeSalary   = ['principal', 'bursar', 'it_admin'].includes(user?.role ?? '')

  return (
    <div className="profile-page-wrap">

      {/* ── Hero gradient band ─────────────────────────────────────── */}
      <div
        className="profile-band"
        style={{ background: `linear-gradient(135deg, ${roleColour}cc 0%, ${roleColour}33 100%)` }}
      >
        <button
          onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
          style={{
            position: 'absolute', top: 16, right: 24,
            padding: '7px 18px', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700,
            fontFamily: 'var(--font2)', border: 'none', cursor: 'pointer',
            background: isEditing ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.9)',
            color: isEditing ? '#fff' : '#0f172a',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.15s',
          }}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {/* ── Identity block (avatar overlaps band) ─────────────────── */}
      <div className="profile-identity">
        {/* Avatar — overlaps band by 48px */}
        <div
          onClick={() => fileRef.current?.click()}
          title="Click to change photo"
          style={{ cursor: 'pointer', position: 'relative', marginTop: -48, flexShrink: 0 }}
        >
          {profile.photoUrl ? (
            <img
              src={profile.photoUrl} alt=""
              style={{
                width: 96, height: 96, borderRadius: '50%', objectFit: 'cover',
                border: '3px solid var(--surface)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              }}
            />
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: roleColour,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 30, fontWeight: 900, color: '#fff',
              fontFamily: 'var(--font2)',
              border: '3px solid var(--surface)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            }}>
              {avatarInitials}
            </div>
          )}
          {updatePhoto.isPending && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.45)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 700,
            }}>
              Uploading…
            </div>
          )}
          {/* Camera badge */}
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--brand)', border: '2.5px solid var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width: 12, height: 12 }}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { void handlePhotoSelect(e) }} />

        {/* Name */}
        <h1 style={{
          fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 22,
          color: 'var(--txt)', margin: '14px 0 8px',
          letterSpacing: '-0.3px',
        }}>
          {profile.firstName} {profile.lastName}
        </h1>

        {/* Role badge + school */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{
            padding: '3px 12px', borderRadius: 20,
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
            background: `${roleColour}22`, color: roleColour,
            border: `1px solid ${roleColour}55`,
          }}>
            {roleLabel}
          </span>
          {profile.schoolName && (
            <span style={{ fontSize: 13, color: 'var(--txt3)' }}>
              · {profile.schoolName}
            </span>
          )}
        </div>

        {/* Save success / error flash */}
        {saveMsg && (
          <div style={{
            marginTop: 12,
            padding: '8px 20px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600,
            background: saveMsg.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
            color:      saveMsg.ok ? 'var(--success)'    : 'var(--danger)',
          }}>
            {saveMsg.text}
          </div>
        )}
      </div>

      {/* ── Info cards ─────────────────────────────────────────────── */}
      <div className="profile-body">
        <div className="profile-cards-grid">

          {/* ── Contact Info ── */}
          <InfoCard
            title="Contact Info"
            action={isEditing ? (
              <button
                className="sui-btn-primary"
                style={{ fontSize: 11, padding: '5px 16px' }}
                disabled={updateProfile.isPending}
                onClick={() => void handleSave()}
              >
                {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            ) : undefined}
          >
            {isEditing ? (
              <>
                <EditRow label="Email">
                  <input className="sui-input" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    style={{ fontSize: 13 }} placeholder="name@school.ug" />
                  {email !== (profile.email ?? '') && (
                    <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                      Changing email triggers a confirmation to both addresses.
                    </div>
                  )}
                </EditRow>
                <EditRow label="Phone">
                  <input className="sui-input" type="tel" value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={{ fontSize: 13 }} placeholder="+256 7XX XXX XXX" />
                </EditRow>
                <EditRow label="Address" last>
                  <input className="sui-input" value={address}
                    onChange={e => setAddress(e.target.value)}
                    style={{ fontSize: 13 }} placeholder="e.g. Kampala, Uganda" />
                </EditRow>
              </>
            ) : (
              <>
                <InfoRow label="Email"   value={profile.email ?? authEmail ?? 'Not set'} />
                <InfoRow label="Phone"   value={profile.phone   ?? 'Not set'} />
                <InfoRow label="Address" value={profile.address ?? 'Not set'} last />
              </>
            )}
          </InfoCard>

          {/* ── Employment ── */}
          <InfoCard title="Employment">
            <InfoRow
              label="Staff ID"
              value={profile.staffNumber ?? undefined}
              mono
              badge={!profile.staffNumber ? (
                <span style={{ fontSize: 11, color: 'var(--txt3)', fontStyle: 'italic' }}>
                  Not yet assigned — contact IT Admin
                </span>
              ) : undefined}
            />
            <InfoRow label="Department"    value={profile.departmentName ?? '—'} />
            <InfoRow label="Type"          value={EMPLOYMENT_LABEL[profile.employmentType ?? ''] ?? (profile.employmentType ?? '—')} />
            <InfoRow label="Join Date"     value={profile.joinDate ? formatDate(profile.joinDate) : '—'} />
            <InfoRow label="Qualification" value={QUAL_LABELS[profile.qualificationLevel ?? 0] ?? '—'} last={!canSeeSalary} />
            {canSeeSalary && (
              <InfoRow label="Salary Band" value={profile.salaryBand ?? '—'} last />
            )}
          </InfoCard>

          {/* ── Account Access ── */}
          <InfoCard title="Account">
            <InfoRow
              label="Status"
              badge={
                <span style={{
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font2)',
                  background: profile.isActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                  color:      profile.isActive ? 'var(--success)'    : 'var(--danger)',
                }}>
                  {profile.isActive ? 'Active' : 'Inactive'}
                </span>
              }
            />
            <InfoRow label="School"       value={profile.schoolName ?? '—'} />
            <InfoRow label="Last Sign-In" value={profile.lastSignInAt ? formatDate(profile.lastSignInAt) : '—'} last />
          </InfoCard>

        </div>

        {/* ── Accessibility ── */}
        <div style={{
          marginTop: 16,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
                Low-bandwidth mode
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                {isLowBandwidth ? 'Active — charts and photos disabled' : 'Full experience enabled'}
              </div>
            </div>
            <button
              type="button" onClick={toggleBandwidth}
              style={{
                width: 48, height: 26, borderRadius: 99, border: 'none',
                cursor: 'pointer', flexShrink: 0, position: 'relative',
                background: isLowBandwidth ? 'var(--brand)' : 'var(--surface2)',
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: isLowBandwidth ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s', display: 'block',
              }} />
            </button>
          </div>
        </div>

        {/* ── Password Reset Request ── */}
        <div style={{
          marginTop: 16,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)', fontFamily: 'var(--font2)' }}>
              Password
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>
              To change your password, submit a request to the IT Admin for approval.
            </div>
          </div>
          <button
            onClick={() => { setShowPwdModal(true); setReqPwdSent(false); setReqPwdErr(''); setReqPwd(''); setReqPwdConf('') }}
            style={{
              padding: '9px 22px', borderRadius: 10, flexShrink: 0,
              background: 'var(--brand)', color: '#fff',
              border: 'none', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'var(--font2)',
              boxShadow: '0 2px 8px rgba(13,148,136,0.3)',
              transition: 'all 0.15s',
            }}
          >
            Request Password Change
          </button>
        </div>

      </div>

      {/* ── Password Reset Modal ── */}
      {showPwdModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 32,
            width: 440, maxWidth: '90vw',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          }}>
            {reqPwdSent ? (
              <>
                <div style={{ textAlign: 'center', padding: '12px 0 24px' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: 'rgba(16,185,129,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 8 }}>
                    Request sent
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>
                    Your password change request has been sent to the IT Admin. You will be notified once it has been approved.
                  </div>
                </div>
                <button
                  onClick={() => setShowPwdModal(false)}
                  className="sui-btn-primary"
                  style={{ width: '100%', fontSize: 13 }}
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
                    Request Password Change
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>
                    Enter your desired new password. The IT Admin will review and confirm the change.
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6, fontFamily: 'var(--font2)' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={reqPwd}
                      onChange={e => { setReqPwd(e.target.value); setReqPwdErr('') }}
                      className="sui-input"
                      placeholder="At least 8 characters"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6, fontFamily: 'var(--font2)' }}>
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={reqPwdConf}
                      onChange={e => { setReqPwdConf(e.target.value); setReqPwdErr('') }}
                      className="sui-input"
                      placeholder="Repeat new password"
                    />
                  </div>

                  {reqPwdErr && (
                    <div style={{
                      background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                      color: 'var(--danger)', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                    }}>
                      {reqPwdErr}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button
                    onClick={() => setShowPwdModal(false)}
                    style={{
                      padding: '9px 20px', borderRadius: 10,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handlePwdRequest()}
                    disabled={requestPwdReset.isPending || !reqPwd || !reqPwdConf}
                    style={{
                      padding: '9px 22px', borderRadius: 10,
                      background: reqPwd && reqPwdConf ? 'var(--brand)' : 'var(--surface2)',
                      color: reqPwd && reqPwdConf ? '#fff' : 'var(--txt3)',
                      border: 'none', fontWeight: 700, fontSize: 13,
                      cursor: reqPwd && reqPwdConf ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    {requestPwdReset.isPending ? 'Sending…' : 'Send Request'}
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
