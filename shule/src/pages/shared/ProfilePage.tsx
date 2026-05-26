import { useState, useRef, useEffect } from 'react'
import {
  useMyProfile,
  useUpdateProfile,
  useChangePassword,
  useUpdateProfilePhoto,
} from '../../hooks/useProfile'
import { useBandwidth } from '../../store/BandwidthContext'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

export function ProfilePage() {
  const { data: profile, isLoading, isError } = useMyProfile()
  const updateProfile  = useUpdateProfile()
  const changePassword = useChangePassword()
  const updatePhoto    = useUpdateProfilePhoto()
  const { isLowBandwidth, toggleBandwidth } = useBandwidth()

  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [isDirty, setIsDirty]     = useState(false)
  const [saveMsg, setSaveMsg]     = useState('')

  const [_curPwd,  setCurPwd]      = useState('')
  const [newPwd,  setNewPwd]      = useState('')
  const [confPwd, setConfPwd]     = useState('')
  const [pwdMsg,  setPwdMsg]      = useState('')
  const [pwdErr,  setPwdErr]      = useState('')

  const fileRef = useRef<HTMLInputElement>(null)

  // Sync local state from profile once loaded
  useEffect(() => {
    if (profile) {
      setPhone(profile.phone ?? '')
      setEmail(profile.email ?? '')
    }
  }, [profile])

  function handleFieldChange(field: 'phone' | 'email', val: string) {
    if (field === 'phone') setPhone(val)
    else setEmail(val)
    setIsDirty(true)
    setSaveMsg('')
  }

  async function handleSave() {
    if (!profile) return
    try {
      await updateProfile.mutateAsync({
        phone: phone !== profile.phone ? phone : undefined,
        email: email !== profile.email ? email : undefined,
      })
      setIsDirty(false)
      setSaveMsg('Saved successfully.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err: any) {
      setSaveMsg(`Error: ${err.message}`)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwdErr('')
    if (newPwd !== confPwd) { setPwdErr('New passwords do not match.'); return }
    if (newPwd.length < 8)  { setPwdErr('Password must be at least 8 characters.'); return }
    try {
      await changePassword.mutateAsync(newPwd)
      setPwdMsg('Password changed.')
      setCurPwd(''); setNewPwd(''); setConfPwd('')
      setTimeout(() => setPwdMsg(''), 3000)
    } catch (err: any) {
      setPwdErr(err.message)
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await updatePhoto.mutateAsync(file)
    } catch (err: any) {
      alert(`Photo upload failed: ${err.message}`)
    }
  }

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading profile…</div>
  if (isError || !profile) return <div style={{ color: 'var(--danger)', padding: 32 }}>Failed to load profile.</div>

  const roleLabel = ROLE_LABEL[profile.role as UserRole] ?? profile.role

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
          My Profile
        </h1>
        <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4 }}>
          Update your contact details and password.
        </div>
      </div>

      {/* Photo + read-only identity */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24, display: 'flex', gap: 20, alignItems: 'center',
      }}>
        {/* Clickable photo */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
          title="Click to change photo"
        >
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="" style={{
              width: 80, height: 80, borderRadius: '50%', objectFit: 'cover',
              border: '3px solid var(--border)',
            }} />
          ) : (
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'var(--brand-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: 'var(--brand)',
              border: '3px solid var(--border)',
            }}>
              {initials(profile.firstName, profile.lastName)}
            </div>
          )}
          {updatePhoto.isPending && (
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 700,
            }}>
              Uploading…
            </div>
          )}
          {/* Camera overlay */}
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 22, height: 22, borderRadius: '50%',
            background: 'var(--brand)', border: '2px solid var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"
              style={{ width: 12, height: 12 }}>
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { void handlePhotoSelect(e) }} />

        {/* Identity (read-only) */}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 20, color: 'var(--txt)' }}>
            {profile.firstName} {profile.lastName}
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'var(--brand-light)', color: 'var(--brand)',
            }}>{roleLabel}</span>
            {profile.departmentName && (
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{profile.departmentName}</span>
            )}
          </div>
          {profile.schoolName && (
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 4 }}>{profile.schoolName}</div>
          )}
          {profile.staffNumber && (
            <div style={{ fontSize: 11, fontFamily: 'var(--font3)', color: 'var(--txt3)', marginTop: 2 }}>
              {profile.staffNumber}
            </div>
          )}
        </div>
      </div>

      {/* Editable fields */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>
          Contact Details
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={e => handleFieldChange('phone', e.target.value)}
              className="sui-input"
              style={{ width: '100%' }}
              placeholder="+256 7XX XXX XXX"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => handleFieldChange('email', e.target.value)}
              className="sui-input"
              style={{ width: '100%' }}
              placeholder="you@school.ug"
            />
            {email !== (profile.email ?? '') && (
              <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>
                Changing email will trigger a confirmation to both old and new addresses.
              </div>
            )}
          </div>

          {isDirty && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => void handleSave()}
                disabled={updateProfile.isPending}
                className="sui-btn-primary"
              >
                {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {saveMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Password change */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 16 }}>
          Change Password
        </div>
        <form onSubmit={e => { void handlePasswordChange(e) }} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              New Password
            </label>
            <input
              type="password"
              value={newPwd}
              onChange={e => { setNewPwd(e.target.value); setPwdErr('') }}
              className="sui-input"
              style={{ width: '100%' }}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt2)', display: 'block', marginBottom: 4 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confPwd}
              onChange={e => { setConfPwd(e.target.value); setPwdErr('') }}
              className="sui-input"
              style={{ width: '100%' }}
              placeholder="Repeat new password"
              required
            />
          </div>

          {pwdErr && (
            <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{pwdErr}</div>
          )}
          {pwdMsg && (
            <div style={{ background: 'var(--success-bg)', color: 'var(--success)',
              padding: '8px 12px', borderRadius: 8, fontSize: 13 }}>{pwdMsg}</div>
          )}

          <button
            type="submit"
            disabled={changePassword.isPending || !newPwd || !confPwd}
            className="sui-btn-primary"
            style={{ alignSelf: 'flex-start' }}
          >
            {changePassword.isPending ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Accessibility / bandwidth */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 4 }}>
          Accessibility
        </div>
        <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 16 }}>
          Use low-bandwidth mode on slow connections. Disables photos, charts, and animations.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Low-bandwidth mode</div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
              {isLowBandwidth ? 'Active — charts and photos disabled' : 'Off — full experience'}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleBandwidth}
            style={{
              width: 48, height: 26, borderRadius: 99, border: 'none', cursor: 'pointer',
              background: isLowBandwidth ? 'var(--brand)' : 'var(--surface2)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 3,
              left: isLowBandwidth ? 25 : 3,
              width: 20, height: 20, borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              transition: 'left 0.2s',
              display: 'block',
            }} />
          </button>
        </div>
      </div>
    </div>
  )
}
