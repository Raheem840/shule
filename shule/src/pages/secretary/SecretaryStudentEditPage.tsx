import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStudentById } from '../../hooks/useStudents'
import { useUpdateStudent } from '../../hooks/useStudents'
import { useClasses, useStreams } from '../../hooks/useClasses'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import type { Student } from '../../types/app'

// ── Field section wrapper ─────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase',
        color: 'var(--txt3)', fontFamily: 'var(--font2)', marginBottom: 16,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Two-column field grid ─────────────────────────────────────
function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.25rem' }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: 'var(--txt3)', marginBottom: 4,
      }}>
        {label}
      </label>
      {children}
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────
const STATUS_COLOR: Record<Student['status'], string> = {
  active:    'var(--success)',
  suspended: 'var(--warning)',
  expelled:  'var(--danger)',
}

// ═══════════════════════════════════════════════════════════════
export function SecretaryStudentEditPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()

  const { data: student, isLoading } = useStudentById(studentId)
  const { data: classes = [] } = useClasses()
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const { data: streams = [] } = useStreams(selectedClassId)

  const updateStudent = useUpdateStudent()

  // Form state
  const [form, setForm] = useState({
    firstName:     '',
    lastName:      '',
    dob:           '',
    gender:        '' as Student['gender'] | '',
    nationality:   '',
    religion:      '',
    classId:       '',
    streamId:      '',
    studentType:   '' as Student['studentType'] | '',
    previousSchool:'',
    medicalNotes:  '',
  })
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Populate form when student data loads
  useEffect(() => {
    if (!student) return
    setForm({
      firstName:      student.firstName,
      lastName:       student.lastName,
      dob:            student.dob ?? '',
      gender:         student.gender ?? '',
      nationality:    student.nationality ?? '',
      religion:       student.religion ?? '',
      classId:        student.classId ?? '',
      streamId:       student.streamId ?? '',
      studentType:    student.studentType ?? '',
      previousSchool: student.previousSchool ?? '',
      medicalNotes:   student.medicalNotes ?? '',
    })
    setSelectedClassId(student.classId)
  }, [student])

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setDirty(true)
    setSaved(false)
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
        id:             studentId,
        firstName:      form.firstName,
        lastName:       form.lastName,
        dob:            form.dob || null,
        gender:         (form.gender as Student['gender']) || null,
        nationality:    form.nationality || null,
        religion:       form.religion || null,
        classId:        form.classId || undefined,
        streamId:       form.streamId || null,
        studentType:    (form.studentType as Student['studentType']) || null,
        previousSchool: form.previousSchool || null,
        medicalNotes:   form.medicalNotes || null,
      })
      setDirty(false)
      setSaved(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  const classOptions = [
    { value: '', label: 'Select class…' },
    ...classes.map(c => ({ value: c.id, label: c.name })),
  ]

  const streamOptions = [
    { value: '', label: streams.length ? 'Select stream…' : 'No streams' },
    ...streams.map(s => ({ value: s.id, label: s.name })),
  ]

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '6rem' }}>
        <LoadingSpinner />
      </div>
    )
  }

  if (!student) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--txt3)' }}>
        Student not found.
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={student.admissionNumber}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
              background: `${STATUS_COLOR[student.status]}20`,
              color: STATUS_COLOR[student.status],
              textTransform: 'capitalize',
            }}>
              {student.status}
            </span>
            <Button variant="ghost" onClick={() => navigate('/secretary/students')}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!dirty || updateStudent.isPending}
            >
              {updateStudent.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      {saved && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          background: 'var(--success-bg)', color: 'var(--success)',
          fontSize: 13, fontWeight: 700,
        }}>
          Changes saved successfully.
        </div>
      )}

      {saveError && (
        <div style={{
          padding: '10px 16px', borderRadius: 10, marginBottom: 12,
          background: 'var(--danger-bg)', color: 'var(--danger)',
          fontSize: 13, fontWeight: 700,
        }}>
          {saveError}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Personal Information */}
        <Section title="Personal Information">
          <FieldGrid>
            <Field label="First Name">
              <Input
                value={form.firstName}
                onChange={e => set('firstName', e.target.value)}
                placeholder="First name"
              />
            </Field>
            <Field label="Last Name">
              <Input
                value={form.lastName}
                onChange={e => set('lastName', e.target.value)}
                placeholder="Last name"
              />
            </Field>
            <Field label="Date of Birth">
              <input
                type="date"
                value={form.dob}
                onChange={e => set('dob', e.target.value)}
                className="sui-input"
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="Gender">
              <Select
                placeholder=""
                options={[
                  { value: '',       label: 'Select…'  },
                  { value: 'male',   label: 'Male'     },
                  { value: 'female', label: 'Female'   },
                ]}
                value={form.gender ?? ''}
                onChange={e => set('gender', e.target.value)}
              />
            </Field>
            <Field label="Nationality">
              <Input
                value={form.nationality}
                onChange={e => set('nationality', e.target.value)}
                placeholder="e.g. Ugandan"
              />
            </Field>
            <Field label="Religion">
              <Input
                value={form.religion}
                onChange={e => set('religion', e.target.value)}
                placeholder="e.g. Christian, Muslim"
              />
            </Field>
          </FieldGrid>
        </Section>

        {/* Academic Placement */}
        <Section title="Academic Placement">
          <FieldGrid>
            <Field label="Class">
              <Select
                placeholder=""
                options={classOptions}
                value={form.classId}
                onChange={e => set('classId', e.target.value)}
              />
            </Field>
            <Field label="Stream">
              <Select
                placeholder=""
                options={streamOptions}
                value={form.streamId}
                onChange={e => set('streamId', e.target.value)}
              />
            </Field>
            <Field label="Student Type">
              <Select
                placeholder=""
                options={[
                  { value: '',        label: 'Select…'  },
                  { value: 'day',     label: 'Day'      },
                  { value: 'boarder', label: 'Boarder'  },
                ]}
                value={form.studentType ?? ''}
                onChange={e => set('studentType', e.target.value)}
              />
            </Field>
            <Field label="Previous School">
              <Input
                value={form.previousSchool}
                onChange={e => set('previousSchool', e.target.value)}
                placeholder="Previous school name"
              />
            </Field>
          </FieldGrid>
        </Section>

        {/* Medical Notes */}
        <Section title="Medical Notes">
          <textarea
            value={form.medicalNotes}
            onChange={e => { set('medicalNotes', e.target.value) }}
            placeholder="Any medical conditions, allergies, or special needs the school should know about…"
            rows={4}
            className="sui-input"
            style={{ width: '100%', resize: 'vertical', fontFamily: 'var(--font1)' }}
          />
        </Section>
      </div>
    </>
  )
}
