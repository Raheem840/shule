import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useStudentById, useUpdateStudent, useCreateStudentLogin } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { useStudentGuardians } from '../../hooks/useParentPortal'
import { supabase } from '../../lib/supabase'
import { uploadFile, BUCKETS } from '../../lib/storage'
import { compressToJpeg } from '../../lib/fileValidation'
import { getFriendlyErrorMessage } from '../../lib/errors'
import { useAuth } from '../../store/AuthContext'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { Avatar } from '../../components/shared/Avatar'
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
  active: '#10b981', suspended: '#f59e0b', expelled: '#f43f5e', completed: '#64748b',
}

export function SecretaryStudentEditPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: student, isLoading } = useStudentById(studentId)
  const { data: classes = [] } = useClasses()
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const { data: streams = [] } = useStreams(selectedClassId)
  const updateStudent = useUpdateStudent()
  const createLogin   = useCreateStudentLogin()

  // Guardian state
  const { data: guardians = [], refetch: refetchGuardians } = useStudentGuardians(studentId ?? null)
  const [guardianOpen, setGuardianOpen] = useState(false)
  const [guardianForm, setGuardianForm] = useState({ fullName: '', relationship: '', phone: '', email: '' })
  const [guardianSaving, setGuardianSaving] = useState(false)
  const [guardianError, setGuardianError] = useState<string | null>(null)
  const [guardianSaved, setGuardianSaved] = useState(false)
  // editingGuardianId !== null → that guardian's row shows an inline edit form
  const [editingGuardianId, setEditingGuardianId] = useState<string | null>(null)
  const [editGuardianForm, setEditGuardianForm] = useState({ fullName: '', relationship: '', phone: '', email: '', doNotContact: false })
  const [guardianDeletingId, setGuardianDeletingId] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '', lastName: '', dob: '', gender: '' as Student['gender'] | '',
    nationality: '', religion: '', classId: '', streamId: '',
    studentType: '' as Student['studentType'] | '', previousSchool: '', medicalNotes: '',
  })
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Photo upload state
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)

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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    setPhotoError(null)
    try {
      const dataUrl = await compressToJpeg(file, 200 * 1024)
      setPhotoDataUrl(dataUrl)
      setDirty(true); setSaved(false)
    } catch {
      setPhotoError('Could not process that image — try a different file.')
    }
  }

  async function handleSave() {
    if (!studentId || !user?.schoolId) return
    setSaveError(null)
    try {
      let photoUrl: string | undefined
      if (photoDataUrl) {
        const base64 = photoDataUrl.split(',')[1]
        const binary = atob(base64)
        const ua     = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) ua[i] = binary.charCodeAt(i)
        const blob = new Blob([ua], { type: 'image/jpeg' })
        const path = `${user.schoolId}/${studentId}.jpg`
        // Store path (not public URL) — student-photos is private, display via signed URL
        photoUrl = await uploadFile(BUCKETS.STUDENT_PHOTOS, path, blob, { upsert: true })
      }

      await updateStudent.mutateAsync({
        id: studentId, firstName: form.firstName, lastName: form.lastName,
        dob: form.dob || null, gender: (form.gender as Student['gender']) || null,
        nationality: form.nationality || null, religion: form.religion || null,
        classId: form.classId || undefined, streamId: form.streamId || null,
        // Keep academic_year_id in sync with the selected class — otherwise a
        // class change (e.g. correcting a mis-enrollment) can leave the
        // student's year pointing at their old class's year, breaking any
        // year-scoped query (report cards, promotion, curriculum).
        academicYearId: form.classId ? (classes.find(c => c.id === form.classId)?.academicYearId ?? undefined) : undefined,
        studentType: (form.studentType as Student['studentType']) || null,
        previousSchool: form.previousSchool || null, medicalNotes: form.medicalNotes || null,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
      })
      setPhotoDataUrl(null)
      setDirty(false); setSaved(true)
    } catch (err: unknown) { setSaveError(err instanceof Error ? err.message : 'Save failed') }
  }

  async function handleAddGuardian() {
    if (!studentId || !user?.schoolId) return
    const name = guardianForm.fullName.trim()
    if (!name) { setGuardianError('Full name is required'); return }
    setGuardianSaving(true); setGuardianError(null)
    try {
      const { error } = await supabase.from('student_guardians').insert({
        school_id:        user.schoolId,
        student_id:       studentId,
        full_name:        name,
        relationship:     guardianForm.relationship.trim() || 'Parent',
        phone:            guardianForm.phone.trim() || null,
        email:            guardianForm.email.trim() || null,
        is_primary:       guardians.length === 0,  // first guardian gets is_primary
        comms_preference: 'sms',
        do_not_contact:   false,
      })
      if (error) throw error
      setGuardianForm({ fullName: '', relationship: '', phone: '', email: '' })
      setGuardianSaved(true); setTimeout(() => setGuardianSaved(false), 3000)
      await refetchGuardians()
      void qc.invalidateQueries({ queryKey: ['student-guardians', studentId] })
    } catch (e) {
      setGuardianError(e instanceof Error ? e.message : 'Failed to save guardian')
    } finally {
      setGuardianSaving(false)
    }
  }

  function startEditGuardian(g: { id: string; fullName: string; relationship: string; phone: string | null; email: string | null; doNotContact: boolean }) {
    setEditingGuardianId(g.id)
    setEditGuardianForm({
      fullName: g.fullName, relationship: g.relationship,
      phone: g.phone ?? '', email: g.email ?? '', doNotContact: g.doNotContact,
    })
    setGuardianError(null)
  }

  async function handleSaveGuardianEdit() {
    if (!editingGuardianId) return
    const name = editGuardianForm.fullName.trim()
    if (!name) { setGuardianError('Full name is required'); return }
    setGuardianSaving(true); setGuardianError(null)
    try {
      const { error } = await supabase.from('student_guardians').update({
        full_name:      name,
        relationship:   editGuardianForm.relationship.trim() || 'Parent',
        phone:          editGuardianForm.phone.trim() || null,
        email:          editGuardianForm.email.trim() || null,
        do_not_contact: editGuardianForm.doNotContact,
      }).eq('id', editingGuardianId).eq('school_id', user!.schoolId)
      if (error) throw error
      setEditingGuardianId(null)
      await refetchGuardians()
      void qc.invalidateQueries({ queryKey: ['student-guardians', studentId] })
    } catch (e) {
      setGuardianError(e instanceof Error ? e.message : 'Failed to update guardian')
    } finally {
      setGuardianSaving(false)
    }
  }

  async function handleDeleteGuardian(guardianId: string) {
    setGuardianDeletingId(guardianId)
    setGuardianError(null)
    try {
      const { error } = await supabase.from('student_guardians').delete()
        .eq('id', guardianId).eq('school_id', user!.schoolId)
      if (error) throw error
      await refetchGuardians()
      void qc.invalidateQueries({ queryKey: ['student-guardians', studentId] })
    } catch (e) {
      setGuardianError(e instanceof Error ? e.message : 'Failed to remove guardian')
    } finally {
      setGuardianDeletingId(null)
    }
  }

  async function handleActivate() {
    if (!studentId) return
    setActivationState({ phase: 'running' })
    try {
      const r = await createLogin.mutateAsync(studentId)
      setActivationState({ phase: 'done', email: r.email, password: r.tempPassword })
    } catch (e: unknown) {
      setActivationState({ phase: 'error', message: getFriendlyErrorMessage(e, 'Activation failed') })
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
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: '2px solid var(--surface)', boxShadow: '0 5px 18px rgba(14,165,233,.35)' }}>
              {photoDataUrl ? (
                <img src={photoDataUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Avatar photoPath={student.photoUrl} bucket="student-photos" name={`${student.firstName} ${student.lastName}`} size="xl" />
              )}
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              aria-label="Change photo"
              title="Change photo"
              style={{ position: 'absolute', bottom: -2, right: -2, width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--surface)', background: 'linear-gradient(145deg,#0ea5e9,#0284c7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" aria-label="Upload student photo" style={{ display: 'none' }} onChange={handlePhotoChange} />
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
      {photoError && <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(244,63,94,.08)', color: 'var(--danger)', fontSize: 13, fontWeight: 700, border: '.5px solid rgba(244,63,94,.3)' }}>{photoError}</div>}

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

      {/* ── Guardians / Parent Details ──────────────────────────── */}
      <div style={{ background: 'var(--surface)', border: '.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
        {/* Collapsible header */}
        <button
          onClick={() => setGuardianOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--txt3)', fontFamily: 'var(--font2)' }}>
              Guardians / Parent Details
            </div>
            {guardians.length > 0 && (
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'var(--brand-light)', color: 'var(--brand)', fontFamily: 'var(--font2)' }}>
                {guardians.length}
              </span>
            )}
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2"
            style={{ transform: guardianOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>

        {guardianOpen && (
          <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Existing guardians list */}
            {guardians.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {guardians.map(g => (
                  editingGuardianId === g.id ? (
                    <div key={g.id} style={{ padding: '14px', background: 'var(--surface2)', border: '.5px solid var(--brand)', borderRadius: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                        <Field label="Full Name *">
                          <input value={editGuardianForm.fullName} onChange={e => setEditGuardianForm(f => ({ ...f, fullName: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Relationship">
                          <input value={editGuardianForm.relationship} onChange={e => setEditGuardianForm(f => ({ ...f, relationship: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Phone">
                          <input value={editGuardianForm.phone} onChange={e => setEditGuardianForm(f => ({ ...f, phone: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Email">
                          <input value={editGuardianForm.email} onChange={e => setEditGuardianForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
                        </Field>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={editGuardianForm.doNotContact} onChange={e => setEditGuardianForm(f => ({ ...f, doNotContact: e.target.checked }))} />
                        <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Do not contact</span>
                      </label>
                      {guardianError && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{guardianError}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => void handleSaveGuardianEdit()} disabled={guardianSaving}
                          style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: guardianSaving ? 'wait' : 'pointer', opacity: guardianSaving ? .7 : 1 }}>
                          {guardianSaving ? 'Saving…' : 'Save'}
                        </button>
                        <button onClick={() => { setEditingGuardianId(null); setGuardianError(null) }}
                          style={{ padding: '8px 16px', borderRadius: 9, border: '.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt2)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={g.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-start', padding: '10px 14px', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>{g.fullName}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'var(--surface)', border: '.5px solid var(--border)', color: 'var(--txt3)' }}>
                            {g.relationship}
                          </span>
                          {g.isPrimary && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'rgba(13,148,136,.12)', color: 'var(--brand)' }}>
                              Primary
                            </span>
                          )}
                          {g.doNotContact && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5, background: 'rgba(244,63,94,.1)', color: 'var(--danger)' }}>
                              Do Not Contact
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {g.phone && <span>{g.phone}</span>}
                          {g.email && <span>{g.email}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => startEditGuardian(g)} aria-label={`Edit ${g.fullName}`}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '.5px solid var(--border)', background: 'var(--surface)', color: 'var(--txt3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => void handleDeleteGuardian(g.id)} disabled={guardianDeletingId === g.id} aria-label={`Remove ${g.fullName}`}
                          style={{ width: 28, height: 28, borderRadius: 8, border: '.5px solid rgba(244,63,94,.3)', background: 'rgba(244,63,94,.06)', color: 'var(--danger)', cursor: guardianDeletingId === g.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: guardianDeletingId === g.id ? .6 : 1 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}

            {/* Add guardian form */}
            <div style={{ padding: '14px', background: 'var(--surface2)', border: '.5px solid var(--border)', borderRadius: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 12 }}>
                Add Guardian
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                <Field label="Full Name *">
                  <input value={guardianForm.fullName} onChange={e => setGuardianForm(f => ({ ...f, fullName: e.target.value }))} placeholder="e.g. Sarah Nakato" style={inputStyle} />
                </Field>
                <Field label="Relationship">
                  <input value={guardianForm.relationship} onChange={e => setGuardianForm(f => ({ ...f, relationship: e.target.value }))} placeholder="e.g. Mother, Father, Uncle" style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input value={guardianForm.phone} onChange={e => setGuardianForm(f => ({ ...f, phone: e.target.value }))} placeholder="+256 7XX XXX XXX" style={inputStyle} />
                </Field>
                <Field label="Email">
                  <input value={guardianForm.email} onChange={e => setGuardianForm(f => ({ ...f, email: e.target.value }))} placeholder="parent@email.com" style={inputStyle} />
                </Field>
              </div>
              {guardianError && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>{guardianError}</div>
              )}
              {guardianSaved && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>Guardian saved.</div>
              )}
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => void handleAddGuardian()}
                  disabled={guardianSaving}
                  style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(145deg,var(--brand),var(--brand-dark))', color: '#fff', fontWeight: 700, fontSize: 13, cursor: guardianSaving ? 'wait' : 'pointer', opacity: guardianSaving ? .7 : 1 }}
                >
                  {guardianSaving ? 'Saving…' : 'Add Guardian'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
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
