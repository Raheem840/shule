import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStaffById } from '../../hooks/useStaff'
import { useSuspendStaff } from '../../hooks/usePrincipal'
import { InitialsAvatar } from '../../components/shared/InitialsAvatar'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

const QUAL_LABELS: Record<number, string> = {
  1: 'Certificate',
  2: 'Diploma',
  3: 'Bachelor\'s Degree',
  4: 'Postgraduate Diploma',
  5: 'Master\'s Degree',
  6: 'Doctoral Degree (PhD)',
  7: 'Other Professional',
}

export function PrincipalStaffProfilePage() {
  const { staffId } = useParams<{ staffId: string }>()
  const navigate = useNavigate()
  const { data: staff, isLoading } = useStaffById(staffId ?? '')
  const { mutateAsync: suspendStaff, isPending: isSuspending } = useSuspendStaff()
  const [showSuspendModal, setShowSuspendModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [suspendErr, setSuspendErr] = useState('')

  if (isLoading) {
    return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading staff profile…</div>
  }
  if (!staff) {
    return <div style={{ color: 'var(--danger)', padding: 32 }}>Staff member not found.</div>
  }

  const fullName = `${staff.firstName} ${staff.lastName}`

  async function handleSuspend() {
    if (confirmText !== fullName) return
    try {
      await suspendStaff({ staffId: staff!.id, isActive: false })
      setShowSuspendModal(false)
      navigate(-1)
    } catch (e: any) {
      setSuspendErr(e.message ?? 'Failed to suspend')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <InitialsAvatar name={fullName} photoUrl={staff.photoUrl} size="xl" />
          <div>
            <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, color: 'var(--txt)', margin: 0 }}>
              {fullName}
            </h1>
            <div style={{ fontSize: 13, color: 'var(--txt3)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: 'var(--brand-light)', color: 'var(--brand)',
              }}>
                {ROLE_LABEL[staff.role as UserRole] ?? staff.role}
              </span>
              <span style={{
                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                background: staff.isActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: staff.isActive ? 'var(--success)' : 'var(--danger)',
              }}>
                {staff.isActive ? 'Active' : 'Suspended'}
              </span>
            </div>
          </div>
        </div>
        {staff.isActive && (
          <button
            onClick={() => { setConfirmText(''); setSuspendErr(''); setShowSuspendModal(true) }}
            className="sui-btn-outline"
            style={{ color: 'var(--warning)', borderColor: 'var(--warning)', fontSize: 13 }}
          >
            Suspend Staff
          </button>
        )}
      </div>

      {/* Info grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24,
      }}>
        <InfoRow label="Staff Number"    value={staff.staffNumber ?? '—'} mono />
        <InfoRow label="Email"           value={staff.email ?? '—'} />
        <InfoRow label="Phone"           value={staff.phone ?? '—'} />
        <InfoRow label="Employment Type" value={staff.employmentType?.replace('_', ' ') ?? '—'} />
        <InfoRow label="Join Date"       value={staff.joinDate ? new Date(staff.joinDate).toLocaleDateString('en-GB') : '—'} />
        <InfoRow label="Salary Band"     value={staff.salaryBand ?? '—'} mono />
        <InfoRow label="Qualification"   value={staff.qualificationLevel ? QUAL_LABELS[staff.qualificationLevel] ?? `Level ${staff.qualificationLevel}` : '—'} />
        {staff.qualificationTitle && (
          <InfoRow label="Qualification Title" value={staff.qualificationTitle} />
        )}
        {staff.institution && (
          <InfoRow label="Institution" value={staff.institution} />
        )}
      </div>

      {/* Suspend modal */}
      {showSuspendModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 32,
            maxWidth: 440, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', margin: '0 0 8px' }}>
              Suspend Staff Member
            </h2>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 16 }}>
              This will prevent {fullName} from logging in. Type their full name to confirm.
            </p>
            <input
              placeholder={fullName}
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="sui-input"
              style={{ width: '100%', marginBottom: 12 }}
            />
            {suspendErr && (
              <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 8 }}>{suspendErr}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="sui-btn-outline" onClick={() => setShowSuspendModal(false)}>Cancel</button>
              <button
                onClick={handleSuspend}
                disabled={confirmText !== fullName || isSuspending}
                style={{
                  padding: '8px 20px', background: confirmText === fullName ? 'var(--warning)' : 'var(--border)',
                  color: confirmText === fullName ? '#fff' : 'var(--txt3)',
                  border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13,
                  cursor: confirmText === fullName ? 'pointer' : 'not-allowed',
                }}
              >
                {isSuspending ? 'Suspending…' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 14, fontWeight: 600, color: 'var(--txt)',
        fontFamily: mono ? 'var(--font3)' : 'inherit',
      }}>
        {value}
      </div>
    </div>
  )
}
