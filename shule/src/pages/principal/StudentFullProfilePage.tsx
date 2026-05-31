import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useStudentFullProfile, useSuspendStudent } from '../../hooks/usePrincipal'
import { Avatar } from '../../components/shared/Avatar'

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  active:    { bg: 'var(--success-bg)', color: 'var(--success)' },
  suspended: { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  expelled:  { bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, minWidth: 150 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--txt)', fontFamily: typeof value === 'number' ? 'var(--font3)' : undefined }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

export function StudentFullProfilePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate      = useNavigate()
  const { data: profile, isLoading, isError } = useStudentFullProfile(studentId ?? null)
  const suspendMut = useSuspendStudent()
  const [confirmAction, setConfirmAction] = useState<'suspended' | 'expelled' | null>(null)
  const [confirmText, setConfirmText]     = useState('')

  if (isLoading) return <div style={{ color: 'var(--txt3)', padding: 32 }}>Loading student profile…</div>
  if (isError || !profile) return (
    <div style={{ color: 'var(--danger)', padding: 32 }}>
      Failed to load student profile. <button onClick={() => navigate(-1)} className="sui-btn-outline" style={{ marginLeft: 12 }}>Go Back</button>
    </div>
  )

  const statusStyle = STATUS_COLOR[profile.status] ?? STATUS_COLOR.active

  async function handleStatusChange(newStatus: 'suspended' | 'expelled') {
    await suspendMut.mutateAsync({ studentId: studentId!, status: newStatus })
    setConfirmAction(null)
    setConfirmText('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none',
          cursor: 'pointer', fontSize: 20, color: 'var(--txt3)', padding: 0 }}>←</button>
        <Avatar
          photoPath={profile.photoUrl}
          bucket="student-photos"
          name={`${profile.firstName} ${profile.lastName}`}
          size="lg"
        />
        <div>
          <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 22, margin: 0, color: 'var(--txt)' }}>
            {profile.firstName} {profile.lastName}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--txt3)' }}>{profile.admissionNumber}</span>
            <span style={{
              padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: statusStyle.bg, color: statusStyle.color,
            }}>
              {profile.status}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Personal Information</div>
        <InfoRow label="Class"            value={profile.className} />
        <InfoRow label="Date of Birth"    value={profile.dob} />
        <InfoRow label="Gender"           value={profile.gender} />
        <InfoRow label="Admission No."    value={profile.admissionNumber} />
      </div>

      {/* Academic Performance */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Academic Performance</div>
        {profile.examResults.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13 }}>No exam results recorded yet.</div>
        ) : (
          <div className="mob-cards">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Term', 'Year', 'Score', 'Grade', ''].map(h => (
                  <th key={h} style={{ padding: '6px 10px', background: 'var(--surface2)',
                    fontWeight: 700, fontSize: 11, color: 'var(--txt2)', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profile.examResults.slice(0, 20).map((r: any, i: number) => (
                <tr key={i} className="sui-tr">
                  <td style={{ padding: '6px 10px', fontSize: 12, color: 'var(--txt2)' }}>{r.term}</td>
                  <td style={{ padding: '6px 10px', fontSize: 12, color: 'var(--txt2)' }}>{r.year}</td>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--font3)', fontSize: 13 }}>
                    {r.score ?? '—'}
                  </td>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--font3)', fontSize: 13 }}>{r.grade ?? '—'}</td>
                  <td style={{ padding: '6px 10px' }} />
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Attendance */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>Attendance Summary</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font2)', color: 'var(--brand)' }}>
              {profile.attendanceRate}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>Overall Rate</div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', height: 8, background: 'var(--surface2)', borderRadius: 99 }}>
              <div style={{
                height: 8, borderRadius: 99, width: `${profile.attendanceRate}%`,
                background: profile.attendanceRate < 80 ? 'var(--danger)' : 'var(--success)',
                transition: 'width 0.4s',
              }} />
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--txt2)', whiteSpace: 'nowrap' }}>
            {profile.presentDays} / {profile.totalDays} days present
          </div>
        </div>
      </div>

      {/* Fee Summary — totals ONLY, no line items */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 8 }}>Fee Status</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)' }}>
          Total Paid: <strong style={{ fontFamily: 'var(--font3)' }}>
            UGX {profile.feeSummary.totalPaid.toLocaleString()}
          </strong>
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 4 }}>
          (Detailed fee ledger is accessible to Bursar only)
        </div>
      </div>

      {/* Discipline */}
      {profile.disciplineCount > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginBottom: 12 }}>
            Discipline Records ({profile.disciplineCount})
          </div>
          {profile.recentDiscipline.map((r: any) => (
            <div key={r.id} style={{
              padding: '8px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--warning)' }}>
                  {r.nature.charAt(0).toUpperCase() + r.nature.slice(1)}
                </span>
                <span style={{ fontSize: 12, color: 'var(--txt3)', marginLeft: 8 }}>{r.incident_date}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--txt2)', maxWidth: 300, textAlign: 'right' }}>
                {r.resolution}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{
        display: 'flex', gap: 10, padding: 20,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)', marginRight: 'auto' }}>Actions</div>
        {profile.status === 'active' && (
          <button
            onClick={() => setConfirmAction('suspended')}
            className="sui-btn-outline"
            style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
          >
            Suspend Student
          </button>
        )}
        {profile.status !== 'expelled' && (
          <button
            onClick={() => setConfirmAction('expelled')}
            style={{ padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'var(--danger-bg)', color: 'var(--danger)',
              fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            Expel Student
          </button>
        )}
        {profile.status === 'suspended' && (
          <button
            onClick={() => void suspendMut.mutateAsync({ studentId: studentId!, status: 'active' })}
            className="sui-btn-primary"
          >
            Reinstate
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 28,
            width: 400, maxWidth: '90vw',
          }}>
            <h3 style={{ fontFamily: 'var(--font2)', fontWeight: 800, color: 'var(--danger)', marginTop: 0 }}>
              Confirm {confirmAction === 'suspended' ? 'Suspension' : 'Expulsion'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--txt2)' }}>
              Type the student's name to confirm: <strong>{profile.firstName} {profile.lastName}</strong>
            </p>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="sui-input"
              style={{ width: '100%', marginBottom: 16 }}
              placeholder="Type full name to confirm…"
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setConfirmAction(null); setConfirmText('') }} className="sui-btn-outline">Cancel</button>
              <button
                disabled={confirmText.trim() !== `${profile.firstName} ${profile.lastName}` || suspendMut.isPending}
                onClick={() => void handleStatusChange(confirmAction)}
                style={{ padding: '8px 16px', borderRadius: 10, border: 'none',
                  background: 'var(--danger)', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: confirmText.trim() !== `${profile.firstName} ${profile.lastName}` ? 0.4 : 1 }}
              >
                {suspendMut.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
