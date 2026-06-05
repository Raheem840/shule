import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudentById, useUpdateStudent, useCreateStudentLogin } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { Student } from '../../types/app'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 16 }}>{title}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', fontSize: 13, background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10, color: 'var(--txt)', outline: 'none', boxSizing: 'border-box' }
const selStyle: React.CSSProperties = { ...inputStyle, appearance: 'none' } as React.CSSProperties

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--txt3)', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

const STATUS_COLOR: Record<Student['status'], string> = {
  active: '#10b981', suspended: '#f59e0b', expelled: '#f43f5e',
}

export function SecretaryStudentEditPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()

  const { data: student, isLoading } = useStudentById(studentId)
  const { data: classes = [] } = useClasses()
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const { data: streams = [] } = useStreams(selectedClassId)
  const updateStudent = useUpdateStudent()
  const createLogin   = useCreateStudentLogin()

  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', gender: '' as Student['gender'] | '',
    nationality: '', religion: '', classId: '', streamId: '',
    studentType: '' as Student['studentType'] | '', previousSchool: '', medicalNotes: '',
  })
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Activation state
  const [activationState, setActivationState] = useState<
    | { phase: 'idle' }
    | { phase: 'running' }
    | { phase: 'done'; email: string; password: string }
    | { phase: 'error'; message: string }
  >({ phase: 'idle' })

  useEffect(() => {
    if (!student) return
    setForm({
      firstName: student.firstName, lastName: student.lastName, dob: student.dob ?? '',
      gender: student.gender ?? '', nationality: student.nationality ?? '', religion: student.religion ?? '',
      classId: student.classId ?? '', streamId: student.streamId ?? '',
      studentType: student.studentType ?? '', previousSchool: student.previousSchool ?? '',
      medicalNotes: student.medicalNotes ?? '',
    })
    setSelectedClassId(student.classId)
  }, [student])

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true); setSaved(false)
    if (field === 'classId') {
      setSelectedClassId(value || null)
      setForm(prev => ({ ...prev, classId: value, streamId: '' }))
    }
  }

  async function handleSave() {
    if (!studentId) return
    setSaveError(null)
    try {
      await updateStudent.mutateAsync({
        id: studentId, firstName: form.firstName, lastName: form.lastName,
        dob: form.dob || null, gender: (form.gender as Student['gender']) || null,
        nationality: form.nationality || null, religion: form.religion || null,
        classId: form.classId || undefined, streamId: form.streamId || null,
        studentType: (form.studentType as Student['studentType']) || null,
        previousSchool: form.previousSchool || null, medicalNotes: form.medicalNotes || null,
      })
      setDirty(false); setSaved(true)
    } catch (err: unknown) { setSaveError(err instanceof Error ? err.message : 'Save failed') }
  }

  async function handleActivate() {
    if (!studentId) return
    setActivationState({ phase: 'running' })
    try {
      const r = await createLogin.mutateAsync(studentId)
      setActivationState({ phase: 'done', email: r.email, password: r.tempPassword })
    } catch (e: unknown) {
      setActivationState({ phase: 'error', message: e instanceof Error ? e.message : 'Activation failed' })
    }
  }

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}><LoadingSpinner /></div>
  if (!student) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--txt3)' }}>Student not found.</div>

  const sc = STATUS_COLOR[student.status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(14,165,233,.15),transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 5px 18px rgba(14,165,233,.4)', flexShrink: 0 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 20, color: 'var(--txt)', margin: 0, letterSpacing: -.3 }}>{student.firstName} {student.lastName}</h1>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${sc}20`, color: sc, textTransform: 'capitalize' }}>{student.status}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--txt3)', margin: '2px 0 0', fontFamily: 'var(--font3)' }}>{student.admissionNumber}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/secretary/students')} style={{ padding: '9px 16px', borderRadius: 10, border: '.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt2)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => void handleSave()} disabled={!dirty || updateStudent.isPending}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 11, border: 'none', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,.35)', opacity: !dirty || updateStudent.isPending ? .6 : 1 }}>
            {updateStudent.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {saved && <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,.08)', color: '#065f46', fontSize: 13, fontWeight: 700, border: '.5px solid rgba(16,185,129,.3)' }}>Changes saved successfully.</div>}
      {saveError && <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, border: '.5px solid rgba(244,63,94,.3)' }}>{saveError}</div>}

      {/* ── Portal Account Section ──────────────────────────────── */}
      {!student.authUserId && (
        <div style={{ background: 'var(--surface)', border: '.5px solid rgba(13,148,136,.3)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--txt)' }}>No Portal Account</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.5 }}>
              This student cannot log in yet. Activate to create a Supabase auth account and generate login credentials.
            </div>
          </div>
          <button
            onClick={() => void handleActivate()}
            disabled={activationState.phase === 'running' || activationState.phase === 'done'}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 11, border: 'none', background: activationState.phase === 'done' ? 'rgba(16,185,129,.12)' : 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: activationState.phase === 'done' ? 'var(--success)' : '#fff', fontWeight: 800, fontSize: 13, cursor: activationState.phase === 'running' || activationState.phase === 'done' ? 'default' : 'pointer', boxShadow: activationState.phase === 'done' ? 'none' : '0 4px 16px rgba(13,148,136,.35)', transition: 'all 0.2s', flexShrink: 0 }}
          >
            {activationState.phase === 'running' ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                Activating…
              </>
            ) : activationState.phase === 'done' ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Activated
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Activate Account
              </>
            )}
          </button>
        </div>
      )}

      {/* Activation result */}
      {activationState.phase === 'done' && (
        <div style={{ background: 'rgba(16,185,129,.06)', border: '.5px solid rgba(16,185,129,.3)', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13, color: 'var(--success)', marginBottom: 10 }}>
            Account activated successfully!
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Email', value: activationState.email },
              { label: 'Temporary Password', value: activationState.password },
            ].map(f => (
              <div key={f.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,.04)', border: '1px solid rgba(16,185,129,.15)', borderRadius: 9, padding: '9px 14px' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 3 }}>{f.label}</div>
                  <div style={{ fontSize: 13, fontFamily: 'var(--font3)', color: 'var(--txt)', fontWeight: 600 }}>{f.value}</div>
                </div>
                <CopyBtn value={f.value} />
              </div>
            ))}
          </div>
        </div>
      )}
      {activationState.phase === 'error' && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, border: '.5px solid rgba(244,63,94,.3)' }}>
          Activation failed: {activationState.message}
        </div>
      )}

      {student.authUserId && (
        <div style={{ background: 'rgba(16,185,129,.06)', border: '.5px solid rgba(16,185,129,.2)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#065f46' }}>Portal account active — student can log in.</div>
        </div>
      )}

      <Section title="Personal Information">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <Field label="First Name"><input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="First name" style={inputStyle} /></Field>
          <Field label="Last Name"><input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Last name" style={inputStyle} /></Field>
          <Field label="Date of Birth"><input type="date" value={form.dob} onChange={e => set('dob', e.target.value)} style={inputStyle} /></Field>
          <Field label="Gender">
            <div style={{ position: 'relative' }}>
              <select value={form.gender ?? ''} onChange={e => set('gender', e.target.value)} style={selStyle}>
                <option value="">Select…</option><option value="male">Male</option><option value="female">Female</option>
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </Field>
          <Field label="Nationality"><input value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. Ugandan" style={inputStyle} /></Field>
          <Field label="Religion"><input value={form.religion} onChange={e => set('religion', e.target.value)} placeholder="e.g. Christian, Muslim" style={inputStyle} /></Field>
        </div>
      </Section>

      <Section title="Academic Placement">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
          <Field label="Class">
            <div style={{ position: 'relative' }}>
              <select value={form.classId} onChange={e => set('classId', e.target.value)} style={selStyle}>
                <option value="">Select class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </Field>
          <Field label="Stream">
            <div style={{ position: 'relative' }}>
              <select value={form.streamId} onChange={e => set('streamId', e.target.value)} style={selStyle}>
                <option value="">{streams.length ? 'Select stream…' : 'No streams'}</option>
                {streams.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </Field>
          <Field label="Student Type">
            <div style={{ position: 'relative' }}>
              <select value={form.studentType ?? ''} onChange={e => set('studentType', e.target.value)} style={selStyle}>
                <option value="">Select…</option><option value="day">Day</option><option value="boarder">Boarder</option>
              </select>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M6 9l6 6 6-6"/></svg>
            </div>
          </Field>
          <Field label="Previous School"><input value={form.previousSchool} onChange={e => set('previousSchool', e.target.value)} placeholder="Previous school name" style={inputStyle} /></Field>
        </div>
      </Section>

      <Section title="Medical Notes">
        <textarea value={form.medicalNotes} onChange={e => set('medicalNotes', e.target.value)}
          placeholder="Any medical conditions, allergies, or special needs…" rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--font1)' }} />
      </Section>
    </div>
  )
}

// ── Small copy button used in activation result ──────────────────────────────
function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { void navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ background: copied ? 'rgba(16,185,129,.12)' : 'var(--surface)', border: `1px solid ${copied ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 800, fontFamily: 'var(--font2)', color: copied ? 'var(--success)' : 'var(--txt2)', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}
