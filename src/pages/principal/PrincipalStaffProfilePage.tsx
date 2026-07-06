import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStaffById } from '../../hooks/useStaff'
import { useSuspendStaff } from '../../hooks/usePrincipal'
import { useDosTeacherPerformance } from '../../hooks/useDos'
import { Avatar } from '../../components/shared/Avatar'
import { Modal, ModalCancelButton } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ROLE_LABEL } from '../../config/roleNav'
import type { UserRole } from '../../store/AuthContext'

const TEACHER_ROLES = new Set<UserRole>(['teacher', 'class_teacher'])

function RateBar({ value }: { value: number }) {
  const c = value >= 70 ? 'var(--success)' : value >= 50 ? 'var(--warning)' : 'var(--danger)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: c, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font3)', color: c }}>{value}%</span>
    </div>
  )
}

// Teacher performance — same metrics DOS sees (curriculum coverage, pass rate)
function TeacherPerformanceSection({ staffId, isActive }: { staffId: string; isActive: boolean }) {
  const { data = [], isLoading } = useDosTeacherPerformance()
  const row = data.find(t => t.staffId === staffId)

  if (isLoading) {
    return <div style={{ color: 'var(--txt3)', fontSize: 13, padding: 20 }}>Loading performance…</div>
  }
  if (!row) {
    // useDosTeacherPerformance only queries active staff — a suspended/inactive
    // teacher will never appear in `data` regardless of their actual history,
    // so the generic "hasn't been assigned subjects" message would be false
    // for them specifically. Distinguish the two cases.
    return (
      <div style={{ color: 'var(--txt3)', fontSize: 13, padding: 20, textAlign: 'center' }}>
        {isActive
          ? "No performance data yet — this teacher hasn't been assigned subjects or published any assessments."
          : 'Performance history is not shown for suspended/inactive staff.'}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {[
        { label: 'Pass Rate', node: <RateBar value={row.passRate} /> },
        { label: 'Curriculum Coverage', node: <RateBar value={row.curriculumCoverage} /> },
        { label: 'Assessments This Term', node: <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--txt)', lineHeight: 1 }}>{row.assessmentsThisTerm}</div> },
      ].map(({ label, node }) => (
        <div key={label} style={{ flex: '1 1 160px', background: 'var(--surface2)', borderRadius: 14, padding: '14px 16px', border: '.5px solid var(--border)' }}>
          <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>{label}</div>
          {node}
        </div>
      ))}
    </div>
  )
}

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
    if (confirmText !== fullName || isSuspending) return
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
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px',
          color: 'var(--txt3)', fontSize: 13, fontWeight: 700,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={fullName} photoPath={staff.photoUrl} bucket="staff-photos" size="xl" />
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
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 24,
      }}>
        <InfoRow label="Staff Number"    value={staff.staffNumber ?? '—'} mono />
        <InfoRow label="Email"           value={staff.email ?? '—'} />
        <InfoRow label="Phone"           value={staff.phone ?? '—'} />
        <InfoRow label="Employment Type" value={staff.employmentType?.replace('_', ' ') ?? '—'} />
        {/* joinDate is a date-only column ("YYYY-MM-DD"); `new Date(dateOnly)`
            parses as UTC midnight, so a naive toLocaleDateString() renders a day
            early for any browser timezone behind UTC. Force local interpretation. */}
        <InfoRow label="Join Date"       value={staff.joinDate ? new Date(`${staff.joinDate}T00:00:00`).toLocaleDateString('en-GB') : '—'} />
        <InfoRow label="Qualification"   value={staff.qualificationLevel ? QUAL_LABELS[staff.qualificationLevel] ?? `Level ${staff.qualificationLevel}` : '—'} />
        {staff.qualificationTitle && (
          <InfoRow label="Qualification Title" value={staff.qualificationTitle} />
        )}
        {staff.institution && (
          <InfoRow label="Institution" value={staff.institution} />
        )}
      </div>

      {/* Teacher performance — same metrics DOS sees */}
      {TEACHER_ROLES.has(staff.role as UserRole) && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, padding: 24,
        }}>
          <h2 style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 15, color: 'var(--txt)', margin: '0 0 16px' }}>
            Teaching Performance
          </h2>
          <TeacherPerformanceSection staffId={staff.id} isActive={staff.isActive} />
        </div>
      )}

      {/* Suspend modal */}
      <Modal
        open={showSuspendModal}
        onClose={() => setShowSuspendModal(false)}
        title="Suspend Staff Member"
        size="sm"
        footer={
          <>
            <ModalCancelButton onClose={() => setShowSuspendModal(false)} />
            <Button
              variant="danger"
              onClick={handleSuspend}
              loading={isSuspending}
              disabled={confirmText !== fullName}
            >
              Confirm Suspend
            </Button>
          </>
        }
      >
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
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{suspendErr}</div>
        )}
      </Modal>
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
